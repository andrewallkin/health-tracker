from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from ...db_models import UserRow
from ...food_classifier import EstimateAPIError, MacrosEstimator
from ..deps import get_current_user, get_macros_estimator
from ..schemas import EstimateRequest, FoodEstimateResponse, MacrosG
from .photos import resolve_meal_photo_path

router = APIRouter(prefix="/estimate", tags=["estimate"])


def _resolve_photos(photos: list[str], user_id: str) -> list[str | Path]:
    resolved: list[str | Path] = []
    for photo in photos:
        if photo.startswith("data:"):
            resolved.append(photo)
            continue
        path = resolve_meal_photo_path(photo, user_id)
        if path is None:
            raise HTTPException(status_code=400, detail=f"Photo not found: {photo}")
        resolved.append(path)
    return resolved


@router.post("", response_model=FoodEstimateResponse)
def estimate_food(
    payload: EstimateRequest,
    user: UserRow = Depends(get_current_user),
    estimator: MacrosEstimator = Depends(get_macros_estimator),
) -> FoodEstimateResponse:
    note = (payload.note or "").strip() or None
    photos = _resolve_photos(payload.photos or [], user.id)

    if not note and not photos:
        raise HTTPException(status_code=400, detail="Provide at least one of note or photos")

    try:
        result = estimator.estimate_macros(note=note, photos=photos)
    except EstimateAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    output = result.output
    return FoodEstimateResponse(
        name=output.name,
        calories_kcal=output.calories_kcal,
        macros_g=MacrosG(
            protein=output.macros_g.protein,
            carbs=output.macros_g.carbs,
            fat=output.macros_g.fat,
        ),
        confidence=output.confidence,
        source=output.source,
        summary=output.summary,
        assumptions=output.assumptions,
    )
