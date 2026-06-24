from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("SETTINGS_ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.pop("GCP_SERVICE_ACCOUNT_CREDENTIALS", None)
os.environ.pop("GCS_IMAGES_BUCKET_NAME", None)

from backend.database import Base, get_db  # noqa: E402
from backend.gcs import reset_gcs_service  # noqa: E402
from backend.main import app  # noqa: E402

reset_gcs_service()


@pytest.fixture(autouse=True)
def disable_gcs_for_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GCP_SERVICE_ACCOUNT_CREDENTIALS", raising=False)
    monkeypatch.delenv("GCS_IMAGES_BUCKET_NAME", raising=False)
    reset_gcs_service()


@pytest.fixture()
def client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def register_user(client: TestClient, email: str, password: str = "password123") -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
