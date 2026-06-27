from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")


class Settings:
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: str
    postgres_db: str
    database_url: str
    encryption_key: str
    cors_origins: list[str]
    meal_photos_dir: Path
    gcp_service_account_credentials: str
    gcs_images_bucket_name: str
    gcs_meal_photos_folder: str
    jwt_secret_key: str
    jwt_access_token_expire_minutes: int
    jwt_refresh_token_expire_days: int
    cookie_secure: bool

    def __init__(self) -> None:
        self.postgres_user = os.environ["POSTGRES_USER"]
        self.postgres_password = os.environ["POSTGRES_PASSWORD"]
        self.postgres_host = os.environ["POSTGRES_HOST"]
        self.postgres_port = os.environ["POSTGRES_PORT"]
        self.postgres_db = os.environ["POSTGRES_DB"]
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        self.database_url = (
            f"postgresql://{user}:{password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
        self.encryption_key = os.environ.get("SETTINGS_ENCRYPTION_KEY", "")
        origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]
        photos_dir = os.environ.get("MEAL_PHOTOS_DIR", "data/meal-photos")
        self.meal_photos_dir = Path(photos_dir)
        if not self.meal_photos_dir.is_absolute():
            self.meal_photos_dir = REPO_ROOT / self.meal_photos_dir
        self.gcp_service_account_credentials = os.environ.get("GCP_SERVICE_ACCOUNT_CREDENTIALS", "")
        self.gcs_images_bucket_name = os.environ.get("GCS_IMAGES_BUCKET_NAME", "")
        self.gcs_meal_photos_folder = os.environ.get("GCS_MEAL_PHOTOS_FOLDER", "meal-photos")
        self.jwt_secret_key = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")
        self.jwt_access_token_expire_minutes = int(
            os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
        )
        self.jwt_refresh_token_expire_days = int(
            os.environ.get("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7")
        )
        self.cookie_secure = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


@lru_cache
def get_settings() -> Settings:
    return Settings()
