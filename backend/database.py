from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import db_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_schema()


def _migrate_schema() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "log_entries" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("log_entries")}
    if "image_url" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE log_entries ADD COLUMN image_url VARCHAR(512)"))
