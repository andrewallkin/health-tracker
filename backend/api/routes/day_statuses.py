from __future__ import annotations

import re
import uuid
from datetime import date
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from ...database import get_db
from ...db_models import DayStatusRow, UserRow
from ..deps import get_current_user
from ..mappers import day_status_to_schema
from ..ownership import get_day_status_for_date, get_owned_day_status
from ..schemas import DayStatus, DayStatusUpsert

router = APIRouter(prefix="/day-statuses", tags=["day-statuses"])

DayStatusesResponse = Union[DayStatus, list[DayStatus], None]

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parse_date(value: str, field: str) -> str:
    if not DATE_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    return value


def _reject_future_date(status_date: str) -> None:
    parsed = date.fromisoformat(status_date)
    if parsed > date.today():
        raise HTTPException(status_code=400, detail="Cannot mark future dates as not tracked")


@router.get("", response_model=DayStatusesResponse)
def get_day_statuses(
    date_key: str | None = Query(default=None, alias="date"),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> DayStatusesResponse:
    if date_key:
        _parse_date(date_key, "date")
        row = get_day_status_for_date(db, user.id, date_key)
        if row is None:
            return None
        return day_status_to_schema(row)

    if from_date and to_date:
        from_key = _parse_date(from_date, "from")
        to_key = _parse_date(to_date, "to")
        rows = (
            db.query(DayStatusRow)
            .filter(
                DayStatusRow.user_id == user.id,
                DayStatusRow.status_date >= from_key,
                DayStatusRow.status_date <= to_key,
            )
            .order_by(DayStatusRow.status_date)
            .all()
        )
        return [day_status_to_schema(row) for row in rows]

    if from_date or to_date:
        raise HTTPException(status_code=400, detail="Provide both 'from' and 'to' for date ranges")

    raise HTTPException(status_code=400, detail="Provide 'date' or 'from' and 'to'")


@router.put("", response_model=DayStatus)
def upsert_day_status(
    payload: DayStatusUpsert,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> DayStatus:
    _parse_date(payload.statusDate, "statusDate")
    _reject_future_date(payload.statusDate)

    row = get_day_status_for_date(db, user.id, payload.statusDate)
    if row is None:
        row = DayStatusRow(
            id=str(uuid.uuid4()),
            user_id=user.id,
            status_date=payload.statusDate,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return day_status_to_schema(row)


@router.delete("/{day_status_id}", status_code=204)
def delete_day_status(
    day_status_id: str,
    db: Session = Depends(get_db),
    user: UserRow = Depends(get_current_user),
) -> Response:
    row = get_owned_day_status(db, user.id, day_status_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Day status not found")
    db.delete(row)
    db.commit()
    return Response(status_code=204)
