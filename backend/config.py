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

    def __init__(self) -> None:
        self.database_url = os.environ.get(
            "DATABASE_URL",
            f"sqlite:///{REPO_ROOT / 'db.sqlite3'}",
        )
        self.encryption_key = os.environ.get("SETTINGS_ENCRYPTION_KEY", "")
        origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
