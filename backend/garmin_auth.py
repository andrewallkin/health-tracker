from __future__ import annotations

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)


class GarminAuthError(Exception):
    """Raised when Garmin login cannot complete."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def login_and_dump_tokens(email: str, password: str) -> str:
    """Authenticate with Garmin and return the JSON tokenstore payload.

    Does not support MFA. If Garmin requires MFA, raises GarminAuthError.
    """
    try:
        garmin = Garmin(email=email, password=password, return_on_mfa=True)
        result1, _result2 = garmin.login()
    except GarminConnectAuthenticationError as exc:
        raise GarminAuthError("Invalid Garmin email or password.") from exc
    except GarminConnectTooManyRequestsError as exc:
        raise GarminAuthError(
            "Too many Garmin login attempts. Try again later.",
            status_code=429,
        ) from exc
    except GarminConnectConnectionError as exc:
        raise GarminAuthError("Could not reach Garmin Connect. Try again later.") from exc
    except Exception as exc:  # noqa: BLE001 — surface unexpected library failures
        raise GarminAuthError("Garmin login failed. Check your credentials and try again.") from exc

    if result1 == "needs_mfa":
        raise GarminAuthError(
            "Garmin MFA is required for this account, but MFA is not supported yet."
        )

    tokens_json = garmin.client.dumps()
    if not tokens_json or "di_token" not in tokens_json:
        raise GarminAuthError("Garmin login succeeded but no tokens were returned.")

    return tokens_json
