from __future__ import annotations

import uuid
import calendar
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..db_models import (
    CheckInRow,
    DayStatusRow,
    LogEntryRow,
    SavedFoodRow,
    SavedMealItemRow,
    SavedMealRow,
    utcnow,
)
from .external_time import add_days, today_key
from .health_service import GarminNotConnectedError, require_garmin_connected, resolve_dates, resolve_day
from .mappers import get_daily_goal, get_or_create_app_settings
from .compose import sum_components
from .ownership import (
    get_check_in_for_date,
    get_day_status_for_date,
    get_owned_entry,
    get_owned_food,
    get_owned_meal,
)
from .routes.health import build_fetch_day
from .schemas import DailyHealth

GOAL_MISSING = "Daily goal is not configured"
MIN_WEIGHT_KG = 30.0
MAX_WEIGHT_KG = 300.0
_DELTA_PERIODS = (
    (1, "1 day"),
    (7, "7 days"),
    (14, "14 days"),
    (30, "1 month"),
)


def half_up(value: float) -> int:
    if value >= 0:
        return int(value + 0.5)
    return int(value - 0.5)


def _food_out(row: SavedFoodRow) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "calories": row.calories,
        "protein": row.protein,
        "carbs": row.carbs,
        "fat": row.fat,
    }


def _entry_out(row: LogEntryRow) -> dict:
    return {
        "id": row.id,
        "logDate": row.log_date,
        "time": row.time,
        "name": row.name,
        "slot": row.slot,
        "servings": row.servings,
        "calories": row.calories,
        "protein": row.protein,
        "carbs": row.carbs,
        "fat": row.fat,
    }


def list_foods(db: Session, user_id: str, q: str | None) -> list[dict]:
    query = db.query(SavedFoodRow).filter(SavedFoodRow.user_id == user_id)
    if q and q.strip():
        query = query.filter(func.lower(SavedFoodRow.name).like(f"%{q.strip().lower()}%"))
    rows = query.order_by(SavedFoodRow.name).all()
    return [_food_out(row) for row in rows]


def _meal_out(row: SavedMealRow) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "calories": row.calories,
        "protein": row.protein,
        "carbs": row.carbs,
        "fat": row.fat,
        "items": [
            {
                "foodId": item.food_id,
                "foodName": item.food.name if item.food is not None else "",
                "quantity": item.quantity,
            }
            for item in row.items
        ],
    }


def _load_meal(db: Session, user_id: str, meal_id: str) -> SavedMealRow | None:
    return (
        db.query(SavedMealRow)
        .options(joinedload(SavedMealRow.items).joinedload(SavedMealItemRow.food))
        .filter(SavedMealRow.user_id == user_id, SavedMealRow.id == meal_id)
        .first()
    )


def list_meals(db: Session, user_id: str, q: str | None) -> list[dict]:
    query = (
        db.query(SavedMealRow)
        .options(joinedload(SavedMealRow.items).joinedload(SavedMealItemRow.food))
        .filter(SavedMealRow.user_id == user_id)
    )
    if q and q.strip():
        query = query.filter(func.lower(SavedMealRow.name).like(f"%{q.strip().lower()}%"))
    rows = query.order_by(SavedMealRow.name).all()
    return [_meal_out(row) for row in rows]


def create_food(
    db: Session,
    user_id: str,
    *,
    name: str,
    description: str | None,
    calories: int,
    protein: float,
    carbs: float,
    fat: float,
) -> dict:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Name is required")
    row = SavedFoodRow(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=cleaned,
        description=description,
        image_url=None,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _food_out(row)


def _insert_entry(
    db: Session,
    user_id: str,
    *,
    log_date: str,
    slot: str,
    name: str,
    servings: float,
    calories: int,
    protein: float,
    carbs: float,
    fat: float,
    time_value: str,
    saved_meal_id: str | None = None,
) -> dict:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Name is required")
    row = LogEntryRow(
        id=str(uuid.uuid4()),
        user_id=user_id,
        log_date=log_date,
        slot=slot,
        time=time_value,
        name=cleaned,
        servings=servings,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        saved_meal_id=saved_meal_id,
        image_url=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _entry_out(row)


def quick_log(
    db: Session,
    user_id: str,
    *,
    name: str,
    slot: str,
    calories: int,
    protein: float,
    carbs: float,
    fat: float,
    log_date: str,
    time_value: str,
) -> dict:
    return _insert_entry(
        db,
        user_id,
        log_date=log_date,
        slot=slot,
        name=name,
        servings=1,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        time_value=time_value,
    )


def log_food(
    db: Session,
    user_id: str,
    *,
    food_id: str,
    servings: float,
    slot: str,
    log_date: str,
    time_value: str,
) -> dict:
    food = get_owned_food(db, user_id, food_id)
    if food is None:
        raise HTTPException(status_code=404, detail="Food not found")
    return _insert_entry(
        db,
        user_id,
        log_date=log_date,
        slot=slot,
        name=food.name,
        servings=servings,
        calories=half_up(food.calories * servings),
        protein=float(half_up(food.protein * servings)),
        carbs=float(half_up(food.carbs * servings)),
        fat=float(half_up(food.fat * servings)),
        time_value=time_value,
    )


def create_meal(
    db: Session,
    user_id: str,
    *,
    name: str,
    description: str | None,
    calories: int | None,
    protein: float | None,
    carbs: float | None,
    fat: float | None,
    items: list[tuple[str, float]] | None,
) -> dict:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Name is required")

    if items:
        food_ids = [food_id for food_id, _quantity in items]
        if len(food_ids) != len(set(food_ids)):
            raise HTTPException(status_code=400, detail="Each food can appear once in a meal")
        row = SavedMealRow(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=cleaned,
            description=description,
            image_url=None,
            kind="composed",
            calories=0,
            protein=0,
            carbs=0,
            fat=0,
        )
        db.add(row)
        db.flush()
        components: list[tuple[SavedFoodRow, float]] = []
        for index, (food_id, quantity) in enumerate(items):
            food = get_owned_food(db, user_id, food_id)
            if food is None:
                raise HTTPException(status_code=404, detail=f"Food not found: {food_id}")
            item = SavedMealItemRow(
                id=str(uuid.uuid4()),
                meal_id=row.id,
                food_id=food.id,
                quantity=quantity,
                sort_order=index,
            )
            item.food = food
            db.add(item)
            row.items.append(item)
            components.append((food, quantity))
        totals = sum_components(components)
        row.calories = totals.calories
        row.protein = totals.protein
        row.carbs = totals.carbs
        row.fat = totals.fat
    else:
        row = SavedMealRow(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=cleaned,
            description=description,
            image_url=None,
            kind="manual",
            calories=calories or 0,
            protein=protein or 0,
            carbs=carbs or 0,
            fat=fat or 0,
        )
        db.add(row)

    db.commit()
    loaded = _load_meal(db, user_id, row.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    return _meal_out(loaded)


def log_meal(
    db: Session,
    user_id: str,
    *,
    meal_id: str,
    servings: float,
    slot: str,
    log_date: str,
    time_value: str,
) -> dict:
    meal = get_owned_meal(db, user_id, meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    return _insert_entry(
        db,
        user_id,
        log_date=log_date,
        slot=slot,
        name=meal.name,
        servings=servings,
        calories=half_up(meal.calories * servings),
        protein=float(half_up(meal.protein * servings)),
        carbs=float(half_up(meal.carbs * servings)),
        fat=float(half_up(meal.fat * servings)),
        time_value=time_value,
        saved_meal_id=meal.id,
    )


def delete_entry(db: Session, user_id: str, entry_id: str) -> None:
    row = get_owned_entry(db, user_id, entry_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(row)
    db.commit()


def _require_goal(db: Session, user_id: str):
    goal = get_daily_goal(db, user_id)
    if goal is None:
        raise HTTPException(status_code=404, detail=GOAL_MISSING)
    return goal


def _entries_on(db: Session, user_id: str, dates: list[str]) -> list[LogEntryRow]:
    if not dates:
        return []
    return (
        db.query(LogEntryRow)
        .filter(LogEntryRow.user_id == user_id, LogEntryRow.log_date.in_(dates))
        .order_by(LogEntryRow.log_date, LogEntryRow.time, LogEntryRow.created_at)
        .all()
    )


def _not_tracked_dates(db: Session, user_id: str, dates: list[str]) -> set[str]:
    if not dates:
        return set()
    rows = (
        db.query(DayStatusRow.status_date)
        .filter(DayStatusRow.user_id == user_id, DayStatusRow.status_date.in_(dates))
        .all()
    )
    return {row[0] for row in rows}


def _sum_entries(entries: list[LogEntryRow]) -> dict:
    return {
        "calories": sum(entry.calories for entry in entries),
        "protein": sum(entry.protein for entry in entries),
        "carbs": sum(entry.carbs for entry in entries),
        "fat": sum(entry.fat for entry in entries),
    }


def _activity_out(activity) -> dict:
    return {
        "id": activity.id,
        "name": activity.name,
        "type": activity.type,
        "startTime": activity.startTime,
        "durationMin": activity.durationMin,
        "calories": activity.calories,
        "distanceKm": activity.distanceKm,
    }


def _health_for_dates(db: Session, user_id: str, dates: list[str]) -> tuple[str | None, dict[str, DailyHealth]]:
    settings_row = get_or_create_app_settings(db, user_id)
    try:
        require_garmin_connected(settings_row)
    except GarminNotConnectedError:
        return "disconnected", {}

    today = today_key()
    eligible = [day for day in dates if day <= today]
    if not eligible:
        return None, {}

    fetch_day, persist_tokens = build_fetch_day(settings_row)
    if len(eligible) == 1:
        day, errors = resolve_day(
            db,
            user_id,
            eligible[0],
            "Africa/Johannesburg",
            fetch_day=fetch_day,
        )
        persist_tokens(db, settings_row)
        if day is None:
            return ("error" if errors else "missing"), {}
        return None, {day.date: day}

    days, _errors = resolve_dates(
        db,
        user_id,
        eligible,
        "Africa/Johannesburg",
        fetch_day=fetch_day,
        concurrency=get_settings().garmin_fetch_concurrency,
    )
    persist_tokens(db, settings_row)
    return None, {day.date: day for day in days}


def _health_block(day: DailyHealth | None, reason: str | None) -> dict:
    if reason is not None or day is None:
        return {"status": "unavailable", "reason": reason or "missing"}
    return {
        "status": "ready",
        "totalCalories": day.totalCalories,
        "activeCalories": day.activeCalories,
        "bmrCalories": day.bmrCalories,
        "activities": [_activity_out(activity) for activity in day.activities],
    }


def build_today(db: Session, user_id: str, date_key: str) -> dict:
    goal = _require_goal(db, user_id)
    entries = _entries_on(db, user_id, [date_key])
    eaten = _sum_entries(entries)
    reason, days = _health_for_dates(db, user_id, [date_key])
    check_in = get_check_in_for_date(db, user_id, date_key)
    return {
        "date": date_key,
        "goal": {
            "calories": goal.calories,
            "protein": goal.protein,
            "carbs": goal.carbs,
            "fat": goal.fat,
        },
        "eaten": eaten,
        "remaining": {
            "calories": goal.calories - eaten["calories"],
            "protein": goal.protein - eaten["protein"],
            "carbs": goal.carbs - eaten["carbs"],
            "fat": goal.fat - eaten["fat"],
        },
        "entries": [_entry_out(entry) for entry in entries],
        "notTracked": get_day_status_for_date(db, user_id, date_key) is not None,
        "weightKg": check_in.weight_kg if check_in is not None else None,
        "health": _health_block(days.get(date_key), reason),
    }


def _counted_days(
    dates: list[str],
    entries_by_date: dict[str, list[LogEntryRow]],
    skipped: set[str],
    goal_calories: int,
) -> list[dict]:
    today = today_key()
    counted: list[dict] = []
    for day in dates:
        if day > today or day in skipped:
            continue
        day_entries = entries_by_date.get(day, [])
        if not day_entries:
            continue
        consumed = _sum_entries(day_entries)
        counted.append(
            {
                "date": day,
                "consumed": consumed,
                "onTarget": consumed["calories"] > 0 and consumed["calories"] <= goal_calories,
            }
        )
    return counted


def _nutrition_summary(counted: list[dict]) -> dict:
    if not counted:
        averages = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    else:
        averages = {
            "calories": half_up(sum(day["consumed"]["calories"] for day in counted) / len(counted)),
            "protein": half_up(sum(day["consumed"]["protein"] for day in counted) / len(counted)),
            "carbs": half_up(sum(day["consumed"]["carbs"] for day in counted) / len(counted)),
            "fat": half_up(sum(day["consumed"]["fat"] for day in counted) / len(counted)),
        }
    return {
        "daysLogged": len(counted),
        "daysOnTarget": sum(1 for day in counted if day["onTarget"]),
        "averages": averages,
    }


def _energy_summary(counted: list[dict], burn_by_date: dict[str, int] | None, reason: str | None) -> dict:
    if reason == "disconnected":
        return {"status": "unavailable", "reason": "disconnected"}
    if burn_by_date is None:
        return {"status": "unavailable", "reason": reason or "missing"}
    paired = []
    for day in counted:
        burned = burn_by_date.get(day["date"])
        if burned is None:
            continue
        paired.append((day["consumed"]["calories"], burned))
    if not paired:
        return {"status": "unavailable", "reason": "missing"}
    eaten = half_up(sum(item[0] for item in paired) / len(paired))
    burned = half_up(sum(item[1] for item in paired) / len(paired))
    return {
        "status": "ready",
        "daysUsed": len(paired),
        "averageEaten": eaten,
        "averageBurned": burned,
        "averageNet": eaten - burned,
    }


def _period_summary(db: Session, user_id: str, dates: list[str]) -> tuple[dict, dict]:
    goal = _require_goal(db, user_id)
    entries = _entries_on(db, user_id, dates)
    by_date: dict[str, list[LogEntryRow]] = {}
    for entry in entries:
        by_date.setdefault(entry.log_date, []).append(entry)
    skipped = _not_tracked_dates(db, user_id, dates)
    counted = _counted_days(dates, by_date, skipped, goal.calories)
    reason, health_days = _health_for_dates(db, user_id, dates)
    burn = None if reason == "disconnected" else {
        day: health.totalCalories for day, health in health_days.items()
    }
    return _nutrition_summary(counted), _energy_summary(counted, burn, reason)


def build_week(db: Session, user_id: str, date_key: str) -> dict:
    start = date.fromisoformat(date_key) - timedelta(days=date.fromisoformat(date_key).weekday())
    dates = [(start + timedelta(days=offset)).isoformat() for offset in range(7)]
    today = today_key()
    through = dates[-1] if dates[-1] < today else today
    nutrition, energy = _period_summary(db, user_id, dates)
    return {
        "startDate": dates[0],
        "endDate": dates[-1],
        "throughDate": through,
        "nutrition": nutrition,
        "energy": energy,
    }


def build_month(db: Session, user_id: str, year: int, month: int) -> dict:
    if not 1 <= year <= 9999 or not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    day_count = calendar.monthrange(year, month)[1]
    dates = [date(year, month, day_number).isoformat() for day_number in range(1, day_count + 1)]
    nutrition, energy = _period_summary(db, user_id, dates)
    return {"year": year, "month": month, "nutrition": nutrition, "energy": energy}


def _weights_by_date(db: Session, user_id: str) -> dict[str, float]:
    rows = (
        db.query(CheckInRow)
        .filter(CheckInRow.user_id == user_id, CheckInRow.weight_kg.isnot(None))
        .all()
    )
    return {row.check_in_date: row.weight_kg for row in rows if row.weight_kg is not None}


def _seven_day_average(as_of: str, weights: dict[str, float]) -> dict | None:
    if as_of > today_key():
        return None
    window = [add_days(as_of, index - 6) for index in range(7)]
    values = [weights[day] for day in window if day in weights]
    if not values:
        return None
    return {"averageKg": sum(values) / len(values), "sampleCount": len(values)}


def _first_weighted_date(weights: dict[str, float]) -> str | None:
    if not weights:
        return None
    return min(weights)


def _rolling_deltas(as_of: str, weights: dict[str, float]) -> list[dict | None]:
    end_avg = _seven_day_average(as_of, weights)
    first_date = _first_weighted_date(weights)
    deltas: list[dict | None] = []
    for period_days, full_label in _DELTA_PERIODS:
        if end_avg is None:
            deltas.append(None)
            continue
        intended = add_days(as_of, -period_days)
        actual = intended if first_date is None or intended > first_date else first_date
        if actual >= as_of:
            deltas.append(None)
            continue
        start_avg = _seven_day_average(actual, weights)
        if start_avg is None:
            deltas.append(None)
            continue
        span = (date.fromisoformat(as_of) - date.fromisoformat(actual)).days
        if actual == intended:
            label = full_label
        elif span == 1:
            label = "1 day"
        else:
            label = f"{span} days"
        deltas.append(
            {
                "periodDays": period_days,
                "label": label,
                "deltaKg": end_avg["averageKg"] - start_avg["averageKg"],
                "startDate": actual,
                "endDate": as_of,
            }
        )
    return deltas


def _series(as_of: str, count: int, weights: dict[str, float]) -> list[dict]:
    points = []
    for offset in range(count - 1, -1, -1):
        day = add_days(as_of, -offset)
        average = _seven_day_average(day, weights)
        points.append(
            {
                "date": day,
                "weightKg": weights.get(day),
                "sevenDayAverageKg": None if average is None else average["averageKg"],
                "sampleCount": None if average is None else average["sampleCount"],
            }
        )
    return points


def build_weight(db: Session, user_id: str, date_key: str) -> dict:
    weights = _weights_by_date(db, user_id)
    average = _seven_day_average(date_key, weights)
    return {
        "date": date_key,
        "weightKg": weights.get(date_key),
        "sevenDayAverage": average,
        "series7": _series(date_key, 7, weights),
        "series30": _series(date_key, 30, weights),
        "deltas": _rolling_deltas(date_key, weights),
    }


def upsert_weight(db: Session, user_id: str, date_key: str, weight_kg: float) -> dict:
    if not MIN_WEIGHT_KG <= weight_kg <= MAX_WEIGHT_KG:
        raise HTTPException(
            status_code=400,
            detail=f"Weight must be between {MIN_WEIGHT_KG} and {MAX_WEIGHT_KG} kg",
        )
    row = get_check_in_for_date(db, user_id, date_key)
    if row is None:
        row = CheckInRow(
            id=str(uuid.uuid4()),
            user_id=user_id,
            check_in_date=date_key,
            recorded_at=utcnow(),
            weight_kg=weight_kg,
            notes=None,
        )
        db.add(row)
    else:
        row.weight_kg = weight_kg
    db.commit()
    return build_weight(db, user_id, date_key)
