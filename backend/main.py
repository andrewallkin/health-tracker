from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import auth, check_ins, entries, estimate, goals, meals, photos, users
from .api.routes import settings as settings_routes
from .config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    settings.meal_photos_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Health Tracker API", lifespan=lifespan)

app_settings = get_settings()
app_settings.meal_photos_dir.mkdir(parents=True, exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(meals.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
app.include_router(estimate.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(check_ins.router, prefix="/api")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
