"""Thin wrapper around the Hevy public REST API (https://api.hevyapp.com).

Mirrors ``garmin_client.py`` conventions: a static ``api-key`` header, a
>=1 second throttle between requests (Hevy asks hourly/daily syncers not to
hammer the API), and a single error type for non-2xx responses.
"""

from __future__ import annotations

import time
from typing import Any

import requests

from backend.config import Settings

BASE_URL = "https://api.hevyapp.com"
MIN_REQUEST_INTERVAL_SECONDS = 1.0
PAGE_SIZE_CAP = 10
_TIMEOUT_SECONDS = 30
_SNIPPET_CHARS = 200


def _page_params(page: int, page_size: int) -> dict[str, int]:
    """Build pagination params, clamped to Hevy's pageSize cap of 10."""
    return {"page": page, "pageSize": min(page_size, PAGE_SIZE_CAP)}


class HevyAPIError(RuntimeError):
    """Raised when the Hevy API returns a non-2xx response."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class HevyClient:
    """Requests wrapper for the Hevy v1 API, throttled to >=1s per request."""

    def __init__(self, api_key: str) -> None:
        self._session = requests.Session()
        self._headers = {"api-key": api_key}
        self._last_request_monotonic: float | None = None

    def get_workouts(self, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        """Raw paginated workout list (``page``/``page_count``/``workouts``)."""
        return self._request("GET", "/v1/workouts", params=_page_params(page, page_size))

    def get_workout(self, workout_id: str) -> dict[str, Any] | None:
        """Full single workout; ``None`` when Hevy reports 404."""
        try:
            return self._request("GET", f"/v1/workouts/{workout_id}")
        except HevyAPIError as err:
            if err.status == 404:
                return None
            raise

    def get_workout_events(self, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        """Raw paginated workout update/delete events feed."""
        return self._request(
            "GET", "/v1/workouts/events", params=_page_params(page, page_size)
        )

    def get_exercise_templates(self, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        """Raw paginated exercise template catalogue."""
        return self._request(
            "GET",
            "/v1/exercise_templates",
            params=_page_params(page, page_size),
        )

    def get_routines(self, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        """Raw paginated routine list."""
        return self._request(
            "GET", "/v1/routines", params=_page_params(page, page_size)
        )

    def get_routine_folders(self, page: int = 1, page_size: int = 10) -> dict[str, Any]:
        """Raw paginated routine folder list."""
        return self._request(
            "GET", "/v1/routine_folders", params=_page_params(page, page_size)
        )

    def create_routine(self, body: dict[str, Any]) -> dict[str, Any]:
        """Create a routine from a Hevy ``PostRoutinesRequestBody`` payload."""
        return self._request("POST", "/v1/routines", json=body)

    def update_routine(self, routine_id: str, body: dict[str, Any]) -> dict[str, Any]:
        """Overwrite an existing routine via ``PUT /v1/routines/{routineId}``."""
        return self._request("PUT", f"/v1/routines/{routine_id}", json=body)

    def create_routine_folder(self, body: dict[str, Any]) -> dict[str, Any]:
        """Create a routine folder from a Hevy ``PostRoutineFolderRequestBody``."""
        return self._request("POST", "/v1/routine_folders", json=body)

    def get_body_measurement(self, date: str) -> dict[str, Any] | None:
        """Body measurement for ``YYYY-MM-DD``; ``None`` when Hevy reports 404.

        The response is the ``BodyMeasurement`` object itself (verified against
        the live OpenAPI spec — no envelope to unwrap).
        """
        try:
            return self._request("GET", f"/v1/body_measurements/{date}")
        except HevyAPIError as err:
            if err.status == 404:
                return None
            raise

    def put_body_measurement(self, date: str, body: dict[str, Any]) -> dict[str, Any]:
        """Upsert body measurements for ``YYYY-MM-DD`` (all fields overwritten)."""
        return self._request("PUT", f"/v1/body_measurements/{date}", json=body)

    def get_user_info(self) -> dict[str, Any]:
        """Authenticated account info."""
        return self._request("GET", "/v1/user/info")

    def _throttle(self) -> None:
        """Guarantee >=1s between request starts using monotonic-clock tracking."""
        now = time.monotonic()
        if self._last_request_monotonic is not None:
            remaining = MIN_REQUEST_INTERVAL_SECONDS - (
                now - self._last_request_monotonic
            )
            if remaining > 0:
                time.sleep(remaining)
        self._last_request_monotonic = time.monotonic()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._throttle()
        response = self._session.request(
            method,
            BASE_URL + path,
            headers=self._headers,
            params=params,
            json=json,
            timeout=_TIMEOUT_SECONDS,
        )
        if not 200 <= response.status_code < 300:
            snippet = (response.text or "").strip()[:_SNIPPET_CHARS]
            raise HevyAPIError(
                f"Hevy {method} {path} failed with status {response.status_code}: "
                f"{snippet}",
                status=response.status_code,
            )
        if not response.content:
            return {}
        return response.json()


def hevy_client_from_settings(settings: Settings) -> HevyClient | None:
    """Build a client from app settings; ``None`` when no API key is configured."""
    if not settings.hevy_api_key:
        return None
    return HevyClient(settings.hevy_api_key)
