from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ...database import get_db
from ...db_models import LogEntryRow, UserRow
from ...gcs import GCSService, get_gcs_service
from ..deps import get_current_user
from ..mappers import log_entry_to_schema
from ..ownership import get_owned_entry, get_owned_meal
from ..schemas import LogEntry, LogEntryCreate, LogEntryUpdate

router = APIRouter(prefix="/entries", tags=["entries"])


@router.get("", response_model=list[LogEntry])
def list_entries(
    date: str | None = Query(default=None, alias="date"),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> list[LogEntry]:
    query = (
        db.query(LogEntryRow)
        .options(joinedload(LogEntryRow.saved_meal))
        .filter(LogEntryRow.user_id == user.id)
    )

    if date:
        query = query.filter(LogEntryRow.log_date == date)
    elif from_date and to_date:
        query = query.filter(
            LogEntryRow.log_date >= from_date,
            LogEntryRow.log_date <= to_date,
        )
    elif from_date or to_date:
        raise HTTPException(status_code=400, detail="Provide both 'from' and 'to' for date ranges")

    rows = query.order_by(LogEntryRow.log_date, LogEntryRow.time).all()
    return [log_entry_to_schema(row, gcs) for row in rows]


def _validate_saved_meal_id(db: Session, user_id: str, saved_meal_id: str | None) -> None:
    if saved_meal_id is None:
        return
    if get_owned_meal(db, user_id, saved_meal_id) is None:
        raise HTTPException(status_code=404, detail="Saved meal not found")


@router.post("", response_model=LogEntry, status_code=201)
def create_entry(
    payload: LogEntryCreate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> LogEntry:
    _validate_saved_meal_id(db, user.id, payload.savedMealId)
    row = LogEntryRow(
        id=str(uuid.uuid4()),
        user_id=user.id,
        log_date=payload.logDate,
        slot=payload.slot,
        time=payload.time,
        name=payload.name.strip(),
        servings=payload.servings,
        calories=payload.calories,
        protein=payload.protein,
        carbs=payload.carbs,
        fat=payload.fat,
        saved_meal_id=payload.savedMealId,
        image_url=payload.imageUrl,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return log_entry_to_schema(row, gcs)


@router.patch("/{entry_id}", response_model=LogEntry)
def update_entry(
    entry_id: str,
    payload: LogEntryUpdate,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> LogEntry:
    row = get_owned_entry(db, user.id, entry_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")

    updates = payload.model_dump(exclude_unset=True)
    if "savedMealId" in updates:
        _validate_saved_meal_id(db, user.id, updates["savedMealId"])

    field_map = {
        "name": "name",
        "slot": "slot",
        "time": "time",
        "servings": "servings",
        "calories": "calories",
        "protein": "protein",
        "carbs": "carbs",
        "fat": "fat",
        "savedMealId": "saved_meal_id",
        "imageUrl": "image_url",
    }
    for api_field, orm_field in field_map.items():
        if api_field in updates:
            value = updates[api_field]
            if api_field == "name" and isinstance(value, str):
                value = value.strip()
            setattr(row, orm_field, value)

    db.commit()
    db.refresh(row)
    return log_entry_to_schema(row, gcs)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> None:
    row = get_owned_entry(db, user.id, entry_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(row)
    db.commit()
