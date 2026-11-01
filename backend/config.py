from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import quote_plus

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(REPO_ROOT / ".env"), extra="ignore")

    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int = 5432
    postgres_db: str

    encryption_key: str = Field(
        default="",
        validation_alias=AliasChoices("ENCRYPTION_KEY", "SETTINGS_ENCRYPTION_KEY"),
    )

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default=["http://localhost:5173"],
        validation_alias=AliasChoices("CORS_ORIGINS"),
    )

    meal_photos_dir: Path = Path("data/meal-photos")

    gcp_service_account_credentials: str = ""
    gcs_images_bucket_name: str = ""
    gcs_meal_photos_folder: str = "meal-photos"
    gcs_check_in_photos_folder: str = "check-in-photos"

    jwt_secret_key: str
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7
    cookie_secure: bool = False

    garmin_fetch_concurrency: int = 3

    @field_validator("cors_origins", mode="plain")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("meal_photos_dir", mode="after")
    @classmethod
    def _resolve_photos_dir(cls, value: Path) -> Path:
        return value if value.is_absolute() else REPO_ROOT / value

    @field_validator("garmin_fetch_concurrency", mode="before")
    @classmethod
    def _parse_concurrency(cls, value: Any) -> Any:
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            return 3

    @field_validator("garmin_fetch_concurrency", mode="after")
    @classmethod
    def _floor_concurrency(cls, value: int) -> int:
        return value if value > 0 else 3

    @property
    def database_url(self) -> str:
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        return (
            f"postgresql://{user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
