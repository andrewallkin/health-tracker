from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import UserRow
from ..external_auth import get_user_from_external_api_key
from ..external_service import (
    build_month,
    build_today,
    build_week,
    build_weight,
    create_food,
    delete_entry,
    list_foods,
    list_meals,
    log_food,
    quick_log,
    upsert_weight,
)
from ..external_time import current_hhmm, johannesburg_now, resolve_optional_date
from ..schemas_external import ExternalFoodCreate, ExternalLogFood, ExternalQuickLog, ExternalWeightWrite

router = APIRouter(prefix="/external", tags=["external"])

_DOCS_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docs" / "external-api.md",
    Path(__file__).resolve().parents[2] / "docs" / "external-api.md",
)
_INFO_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "docs" / "external-api-info.txt",
    Path(__file__).resolve().parents[2] / "docs" / "external-api-info.txt",
)


def _read_first(candidates: tuple[Path, ...], label: str) -> str:
    for path in candidates:
        if path.is_file():
            return path.read_text(encoding="utf-8")
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail=f"{label} not found")


@router.get("/info", response_class=PlainTextResponse)
def get_external_info() -> PlainTextResponse:
    return PlainTextResponse(_read_first(_INFO_CANDIDATES, "External API info"), media_type="text/plain; charset=utf-8")


@router.get("/docs", response_class=PlainTextResponse)
def get_external_docs() -> PlainTextResponse:
    return PlainTextResponse(
        _read_first(_DOCS_CANDIDATES, "External API documentation"),
        media_type="text/markdown; charset=utf-8",
    )


@router.get("/foods")
def get_foods(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> list[dict]:
    return list_foods(db, user.id, q)


@router.get("/meals")
def get_meals(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> list[dict]:
    return list_meals(db, user.id, q)


@router.post("/foods", status_code=201)
def post_food(
    payload: ExternalFoodCreate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return create_food(
        db,
        user.id,
        name=payload.name,
        description=payload.description,
        calories=payload.calories,
        protein=payload.protein,
        carbs=payload.carbs,
        fat=payload.fat,
    )


@router.post("/quick-log", status_code=201)
def post_quick_log(
    payload: ExternalQuickLog,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return quick_log(
        db,
        user.id,
        name=payload.name,
        slot=payload.slot,
        calories=payload.calories,
        protein=payload.protein,
        carbs=payload.carbs,
        fat=payload.fat,
        log_date=resolve_optional_date(payload.date),
        time_value=current_hhmm(),
    )


@router.post("/log-food", status_code=201)
def post_log_food(
    payload: ExternalLogFood,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return log_food(
        db,
        user.id,
        food_id=payload.foodId,
        servings=payload.servings,
        slot=payload.slot,
        log_date=resolve_optional_date(payload.date),
        time_value=current_hhmm(),
    )


@router.delete("/entries/{entry_id}", status_code=204)
def remove_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> None:
    delete_entry(db, user.id, entry_id)


@router.get("/today")
def get_today(
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return build_today(db, user.id, resolve_optional_date(date))


@router.get("/week")
def get_week(
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return build_week(db, user.id, resolve_optional_date(date))


@router.get("/month")
def get_month(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    current = johannesburg_now().date()
    resolved_year = current.year if year is None else year
    resolved_month = current.month if month is None else month
    return build_month(db, user.id, resolved_year, resolved_month)


@router.get("/weight")
def get_weight(
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return build_weight(db, user.id, resolve_optional_date(date))


@router.put("/weight")
def put_weight(
    payload: ExternalWeightWrite,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_user_from_external_api_key),
) -> dict:
    return upsert_weight(db, user.id, resolve_optional_date(payload.date), payload.weightKg)
