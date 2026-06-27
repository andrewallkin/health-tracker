from __future__ import annotations

import re
import uuid
from datetime import date, datetime

from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload

from ...database import get_db
from ...db_models import CheckInPhotoRow, CheckInRow, UserRow
from ...gcs import GCSService, get_gcs_service
from ..deps import get_current_user
from ..mappers import check_in_to_schema
from ..ownership import get_check_in_for_date, get_owned_check_in
from ..photo_storage import validate_check_in_photo_path
from ..schemas import CheckIn, CheckInUpsert

router = APIRouter(prefix="/check-ins", tags=["check-ins"])

CheckInsResponse = Union[CheckIn, list[CheckIn], None]

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MIN_WEIGHT_KG = 30.0
MAX_WEIGHT_KG = 300.0
MAX_PHOTOS = 10


def _parse_date(value: str, field: str) -> str:
    if not DATE_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    return value


def _reject_future_date(check_in_date: str) -> None:
    parsed = date.fromisoformat(check_in_date)
    if parsed > date.today():
        raise HTTPException(status_code=400, detail="Cannot log check-ins for future dates")


def _validate_upsert(payload: CheckInUpsert, user_id: str) -> None:
    _parse_date(payload.checkInDate, "checkInDate")
    _reject_future_date(payload.checkInDate)

    has_weight = payload.weightKg is not None
    has_photos = len(payload.photoPaths) > 0
    if not has_weight and not has_photos:
        raise HTTPException(
            status_code=400,
            detail="Provide at least weight or one photo",
        )

    if payload.weightKg is not None and not (MIN_WEIGHT_KG <= payload.weightKg <= MAX_WEIGHT_KG):
        raise HTTPException(
            status_code=400,
            detail=f"Weight must be between {MIN_WEIGHT_KG} and {MAX_WEIGHT_KG} kg",
        )

    if len(payload.photoPaths) > MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_PHOTOS} photos allowed")

    for path in payload.photoPaths:
        validate_check_in_photo_path(path, user_id)


def _load_check_in(db: Session, user_id: str, check_in_id: str) -> CheckInRow | None:
    return (
        db.query(CheckInRow)
        .options(joinedload(CheckInRow.photos))
        .filter(CheckInRow.id == check_in_id, CheckInRow.user_id == user_id)
        .first()
    )


@router.get("", response_model=CheckInsResponse)
def get_check_ins(
    date: str | None = Query(default=None, alias="date"),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> CheckInsResponse:
    if date:
        _parse_date(date, "date")
        row = (
            db.query(CheckInRow)
            .options(joinedload(CheckInRow.photos))
            .filter(CheckInRow.user_id == user.id, CheckInRow.check_in_date == date)
            .first()
        )
        if row is None:
            return None
        return check_in_to_schema(row, gcs)

    if from_date and to_date:
        from_key = _parse_date(from_date, "from")
        to_key = _parse_date(to_date, "to")
        rows = (
            db.query(CheckInRow)
            .options(joinedload(CheckInRow.photos))
            .filter(
                CheckInRow.user_id == user.id,
                CheckInRow.check_in_date >= from_key,
                CheckInRow.check_in_date <= to_key,
            )
            .order_by(CheckInRow.check_in_date)
            .all()
        )
        return [check_in_to_schema(row, gcs) for row in rows]

    if from_date or to_date:
        raise HTTPException(status_code=400, detail="Provide both 'from' and 'to' for date ranges")

    raise HTTPException(status_code=400, detail="Provide 'date' or 'from' and 'to'")


@router.put("", response_model=CheckIn)
def upsert_check_in(
    payload: CheckInUpsert,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
    gcs: GCSService = Depends(get_gcs_service),
) -> CheckIn:
    _validate_upsert(payload, user.id)

    row = get_check_in_for_date(db, user.id, payload.checkInDate)
    if row is None:
        row = CheckInRow(
            id=str(uuid.uuid4()),
            user_id=user.id,
            check_in_date=payload.checkInDate,
            recorded_at=datetime.utcnow(),
            weight_kg=payload.weightKg,
            notes=payload.notes,
        )
        db.add(row)
    else:
        row = _load_check_in(db, user.id, row.id)
        assert row is not None
        row.weight_kg = payload.weightKg
        row.notes = payload.notes
        row.photos.clear()

    for index, path in enumerate(payload.photoPaths):
        row.photos.append(
            CheckInPhotoRow(
                id=str(uuid.uuid4()),
                image_url=path,
                sort_order=index,
            )
        )

    db.commit()
    refreshed = _load_check_in(db, user.id, row.id)
    assert refreshed is not None
    return check_in_to_schema(refreshed, gcs)


@router.delete("/{check_in_id}", status_code=204)
def delete_check_in(
    check_in_id: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> Response:
    row = get_owned_check_in(db, user.id, check_in_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Check-in not found")
    db.delete(row)
    db.commit()
    return Response(status_code=204)
