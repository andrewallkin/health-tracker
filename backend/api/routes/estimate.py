from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ...food_classifier import EstimateAPIError, MacrosEstimator
from ..deps import get_macros_estimator
from ..schemas import EstimateRequest, FoodEstimateResponse, MacrosG

router = APIRouter(prefix="/estimate", tags=["estimate"])


@router.post("", response_model=FoodEstimateResponse)
def estimate_food(
    payload: EstimateRequest,
    estimator: MacrosEstimator = Depends(get_macros_estimator),
) -> FoodEstimateResponse:
    note = (payload.note or "").strip() or None
    photos = payload.photos or []

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
