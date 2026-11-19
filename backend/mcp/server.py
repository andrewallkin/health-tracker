from __future__ import annotations

import re

from fastmcp import FastMCP
from fastmcp.server.auth import MultiAuth
from fastmcp.server.auth.middleware import RequireAuthMiddleware
from mcp.server.sse import SseServerTransport
from starlette.responses import Response
from starlette.routing import Mount, Route
from starlette.types import Receive, Scope, Send

from ..config import get_settings
from .auth import McpApiKeyVerifier
from .external_tools import register_external_tools
from .oauth_provider import SCOPE, OwnerOAuthProvider, metadata_url

INSTRUCTIONS = (
    "Tools for the signed-in owner's health and nutrition data. Each tool returns the same JSON "
    "as the external API under /api/external: list_foods, list_meals, create_meal, update_meal, "
    "delete_meal, log_meal, create_food, update_food, delete_food, quick_log, log_food, delete_entry, "
    "get_today, get_week, get_month, get_health, get_weight, put_weight, get_day_status, put_day_status, "
    "list_health_snapshots, list_hevy_workouts, get_hevy_workout, list_hevy_exercises, get_hevy_metadata, "
    "get_hevy_exercise_progression, list_hevy_prs, get_hevy_habits, list_hevy_routines, create_hevy_routine, "
    "update_hevy_routine, create_hevy_routine_folder, get_hevy_body_measurement, put_hevy_body_measurement, "
    "link_hevy_garmin, unlink_hevy_garmin, load_hevy_templates, load_hevy_workouts, and load_hevy_events. "
    "from_date is the external from query parameter. Dates are YYYY-MM-DD unless noted otherwise."
)


def build_auth(base_url: str | None = None) -> MultiAuth:
    settings = get_settings()
    origin = (base_url or settings.mcp_oauth_base_url).rstrip("/")
    provider = OwnerOAuthProvider(origin)
    return MultiAuth(server=provider, verifiers=[McpApiKeyVerifier(origin)], required_scopes=[SCOPE])


mcp = FastMCP(
    "health-tracker",
    instructions=INSTRUCTIONS,
    auth=build_auth(),
)
register_external_tools(mcp)


class RewriteResourceMetadata:
    """Point ChatGPT at the protected-resource document served by this process."""

    def __init__(self, app, public_metadata_url: str) -> None:
        self.app = app
        self.public_metadata_url = public_metadata_url

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = []
                for key, value in message.get("headers", []):
                    if key.lower() == b"www-authenticate":
                        text = re.sub(
                            r'resource_metadata="[^"]*"',
                            f'resource_metadata="{self.public_metadata_url}"',
                            value.decode(),
                        )
                        value = text.encode()
                    headers.append((key, value))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_wrapper)


def _mount_sse(app, server: FastMCP) -> None:
    """Keep the existing /sse endpoint for Claude Desktop mcp-remote."""
    message_path = "/messages/"
    sse = SseServerTransport(message_path)

    async def handle_sse(scope: Scope, receive: Receive, send: Send) -> Response:
        async with sse.connect_sse(scope, receive, send) as streams:
            await server._mcp_server.run(
                streams[0],
                streams[1],
                server._mcp_server.create_initialization_options(),
            )
        return Response()

    auth = server.auth
    resource_metadata = metadata_url(str(auth.base_url)) if auth is not None and auth.base_url else None
    scopes = list(auth.required_scopes or []) if auth is not None else []
    app.router.routes.append(
        Route(
            "/sse",
            endpoint=RequireAuthMiddleware(handle_sse, scopes, resource_metadata),
            methods=["GET"],
        )
    )
    app.router.routes.append(
        Mount(
            message_path,
            app=RequireAuthMiddleware(sse.handle_post_message, scopes, resource_metadata),
        )
    )


def build_http_app():
    settings = get_settings()
    app = mcp.http_app(transport="http", path="/mcp", stateless_http=True, json_response=True)
    _mount_sse(app, mcp)
    app.add_middleware(RewriteResourceMetadata, public_metadata_url=metadata_url(settings.mcp_oauth_base_url))
    return app


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(build_http_app(), host="0.0.0.0", port=8000)