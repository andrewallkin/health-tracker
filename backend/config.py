from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")


class Settings:
    db_path: Path = REPO_ROOT / "db.sqlite3"
    database_url: str
    encryption_key: str
    cors_origins: list[str]
    meal_photos_dir: Path
    jwt_secret_key: str
    jwt_access_token_expire_minutes: int
    jwt_refresh_token_expire_days: int
    cookie_secure: bool

    def __init__(self) -> None:
        self.database_url = os.environ.get(
            "DATABASE_URL",
            f"sqlite:///{REPO_ROOT / 'db.sqlite3'}",
        )
        self.encryption_key = os.environ.get("SETTINGS_ENCRYPTION_KEY", "")
        origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]
        photos_dir = os.environ.get("MEAL_PHOTOS_DIR", "data/meal-photos")
        self.meal_photos_dir = Path(photos_dir)
        if not self.meal_photos_dir.is_absolute():
            self.meal_photos_dir = REPO_ROOT / self.meal_photos_dir
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
