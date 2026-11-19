from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from fastmcp import FastMCP

from ..api.routes import external as external_routes
from ..api.schemas_external import (
    ExternalDayStatusWrite,
    ExternalFoodCreate,
    ExternalFoodUpdate,
    ExternalLogFood,
    ExternalLogMeal,
    ExternalMealCreate,
    ExternalMealUpdate,
    ExternalQuickLog,
    ExternalWeightWrite,
    HevyBodyMeasurementWrite,
    HevyLinkWrite,
    HevyRoutineCreate,
    HevyRoutineFolderCreate,
    HevyRoutineUpdate,
)
from ..config import get_settings
from ..database import SessionLocal
from ..hevy_client import hevy_client_from_settings
from .auth import McpAuthError, require_mcp_user

READ_ONLY = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "openWorldHint": False,
    "idempotentHint": True,
}

MUTATION = {
    "readOnlyHint": False,
    "destructiveHint": False,
    "openWorldHint": False,
    "idempotentHint": False,
}

PUT_MUTATION = {**MUTATION, "idempotentHint": True}

DELETE_MUTATION = {
    "readOnlyHint": False,
    "destructiveHint": True,
    "openWorldHint": False,
    "idempotentHint": True,
}

_HTTP_ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    503: "unavailable",
}


def _http_error_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, str):
        return detail
    return str(detail)


def normalize_result(result: Any) -> dict | list:
    if isinstance(result, JSONResponse):
        body = result.body
        if not body:
            return {}
        return json.loads(body.decode())
    if result is None:
        return {}
    return result


def _hevy_client():
    return hevy_client_from_settings(get_settings())


def invoke_external(
    operation: Callable[..., Any],
    *,
    needs_hevy: bool = False,
    **kwargs: Any,
) -> dict | list:
    """Call one external API route function and return its JSON body."""
    try:
        user = require_mcp_user()
        with SessionLocal() as db:
            if needs_hevy:
                hevy_client = _hevy_client()
                if hevy_client is None:
                    return {"error": {"code": "unavailable", "message": "Hevy not configured"}}
                result = operation(db=db, user=user, hevy_client=hevy_client, **kwargs)
            else:
                result = operation(db=db, user=user, **kwargs)
            return normalize_result(result)
    except McpAuthError as exc:
        return {"error": {"code": "unauthorized", "message": str(exc)}}
    except HTTPException as exc:
        code = _HTTP_ERROR_CODES.get(exc.status_code, "error")
        return {"error": {"code": code, "message": _http_error_message(exc)}}


def list_foods(q: str | None = None) -> list[dict]:
    """Same payload as GET /api/external/foods."""
    return invoke_external(external_routes.get_foods, q=q)


def list_meals(q: str | None = None) -> list[dict]:
    """Same payload as GET /api/external/meals."""
    return invoke_external(external_routes.get_meals, q=q)


def create_meal(
    name: str,
    calories: float,
    protein: float,
    carbs: float,
    fat: float,
    description: str | None = None,
    items: list[dict] | None = None,
) -> dict:
    """Same payload as POST /api/external/meals."""
    from ..api.schemas_external import ExternalMealItemInput

    schema_items = None
    if items is not None:
        schema_items = [ExternalMealItemInput(foodId=item["foodId"], quantity=item["quantity"]) for item in items]
    payload = ExternalMealCreate(
        name=name,
        description=description,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        items=schema_items,
    )
    return invoke_external(external_routes.post_meal, payload=payload)


def update_meal(meal_id: str, fields: dict) -> dict:
    """Same payload as PATCH /api/external/meals/{meal_id}."""
    payload = ExternalMealUpdate.model_validate(fields)
    return invoke_external(external_routes.patch_meal, meal_id=meal_id, payload=payload)


def delete_meal(meal_id: str) -> dict:
    """Same payload as DELETE /api/external/meals/{meal_id}."""
    return invoke_external(external_routes.remove_meal, meal_id=meal_id)


def log_meal(meal_id: str, servings: float, slot: str, date: str | None = None) -> dict:
    """Same payload as POST /api/external/log-meal."""
    payload = ExternalLogMeal(mealId=meal_id, servings=servings, slot=slot, date=date)
    return invoke_external(external_routes.post_log_meal, payload=payload)


def create_food(
    name: str,
    calories: float,
    protein: float,
    carbs: float,
    fat: float,
    description: str | None = None,
) -> dict:
    """Same payload as POST /api/external/foods."""
    payload = ExternalFoodCreate(
        name=name,
        description=description,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
    )
    return invoke_external(external_routes.post_food, payload=payload)


def update_food(food_id: str, fields: dict) -> dict:
    """Same payload as PATCH /api/external/foods/{food_id}."""
    payload = ExternalFoodUpdate.model_validate(fields)
    return invoke_external(external_routes.patch_food, food_id=food_id, payload=payload)


def delete_food(food_id: str, confirm: bool = False) -> dict:
    """Same payload as DELETE /api/external/foods/{food_id}."""
    return invoke_external(external_routes.remove_food, food_id=food_id, confirm=confirm)


def quick_log(
    name: str,
    slot: str,
    calories: float,
    protein: float,
    carbs: float,
    fat: float,
    date: str | None = None,
) -> dict:
    """Same payload as POST /api/external/quick-log."""
    payload = ExternalQuickLog(
        name=name,
        slot=slot,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        date=date,
    )
    return invoke_external(external_routes.post_quick_log, payload=payload)


def log_food(food_id: str, servings: float, slot: str, date: str | None = None) -> dict:
    """Same payload as POST /api/external/log-food."""
    payload = ExternalLogFood(foodId=food_id, servings=servings, slot=slot, date=date)
    return invoke_external(external_routes.post_log_food, payload=payload)


def delete_entry(entry_id: str) -> dict:
    """Same payload as DELETE /api/external/entries/{entry_id}."""
    return invoke_external(external_routes.remove_entry, entry_id=entry_id)


def get_today(date: str | None = None) -> dict:
    """Same payload as GET /api/external/today."""
    return invoke_external(external_routes.get_today, date=date)


def get_week(date: str | None = None) -> dict:
    """Same payload as GET /api/external/week."""
    return invoke_external(external_routes.get_week, date=date)


def get_month(year: int | None = None, month: int | None = None) -> dict:
    """Same payload as GET /api/external/month."""
    return invoke_external(external_routes.get_month, year=year, month=month)


def get_health(from_date: str | None = None, to: str | None = None) -> dict:
    """Same payload as GET /api/external/health. from_date is the external from parameter."""
    return invoke_external(external_routes.get_health_range, from_=from_date, to=to)


def get_weight(date: str | None = None) -> dict:
    """Same payload as GET /api/external/weight."""
    return invoke_external(external_routes.get_weight, date=date)


def put_weight(weight_kg: float, date: str | None = None) -> dict:
    """Same payload as PUT /api/external/weight."""
    payload = ExternalWeightWrite(weightKg=weight_kg, date=date)
    return invoke_external(external_routes.put_weight, payload=payload)


def get_day_status(date: str | None = None) -> dict:
    """Same payload as GET /api/external/day-status."""
    return invoke_external(external_routes.get_day_status, date=date)


def put_day_status(not_tracked: bool, date: str | None = None) -> dict:
    """Same payload as PUT /api/external/day-status."""
    payload = ExternalDayStatusWrite(notTracked=not_tracked, date=date)
    return invoke_external(external_routes.put_day_status, payload=payload)


def list_health_snapshots(limit: int | None = None) -> list[dict]:
    """Same payload as GET /api/external/health-snapshots."""
    return invoke_external(external_routes.get_health_snapshots, limit=limit)


def list_hevy_workouts(from_date: str | None = None, to: str | None = None, limit: int = 50) -> list[dict]:
    """Same payload as GET /api/external/hevy/workouts."""
    return invoke_external(external_routes.get_hevy_workouts, from_=from_date, to=to, limit=limit)


def get_hevy_workout(workout_id: str) -> dict:
    """Same payload as GET /api/external/hevy/workouts/{workout_id}."""
    return invoke_external(external_routes.get_hevy_workout_detail, workout_id=workout_id)


def list_hevy_exercises(
    muscle_group: str | None = None,
    equipment: str | None = None,
    type: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """Same payload as GET /api/external/hevy/exercises."""
    return invoke_external(
        external_routes.get_hevy_exercises,
        muscle_group=muscle_group,
        equipment=equipment,
        type=type,
        search=search,
    )


def get_hevy_metadata() -> dict:
    """Same payload as GET /api/external/hevy/metadata."""
    return invoke_external(external_routes.get_hevy_metadata)


def get_hevy_exercise_progression(template_id: str, from_date: str | None = None, to: str | None = None) -> list[dict]:
    """Same payload as GET /api/external/hevy/exercises/{template_id}/progression."""
    return invoke_external(
        external_routes.get_hevy_exercise_progression,
        template_id=template_id,
        from_=from_date,
        to=to,
    )


def list_hevy_prs() -> list[dict]:
    """Same payload as GET /api/external/hevy/prs."""
    return invoke_external(external_routes.get_hevy_prs)


def get_hevy_habits(from_date: str | None = None, to: str | None = None) -> dict:
    """Same payload as GET /api/external/hevy/habits."""
    return invoke_external(external_routes.get_hevy_habits, from_=from_date, to=to)


def list_hevy_routines() -> list[dict]:
    """Same payload as GET /api/external/hevy/routines."""
    return invoke_external(external_routes.get_hevy_routines, needs_hevy=True)


def create_hevy_routine(fields: dict) -> dict:
    """Same payload as POST /api/external/hevy/routines."""
    payload = HevyRoutineCreate.model_validate(fields)
    return invoke_external(external_routes.post_hevy_routine, needs_hevy=True, payload=payload)


def update_hevy_routine(routine_id: str, fields: dict) -> dict:
    """Same payload as PUT /api/external/hevy/routines/{routine_id}."""
    payload = HevyRoutineUpdate.model_validate(fields)
    return invoke_external(
        external_routes.put_hevy_routine,
        needs_hevy=True,
        routine_id=routine_id,
        payload=payload,
    )


def create_hevy_routine_folder(fields: dict) -> dict:
    """Same payload as POST /api/external/hevy/routine-folders."""
    payload = HevyRoutineFolderCreate.model_validate(fields)
    return invoke_external(external_routes.post_hevy_routine_folder, needs_hevy=True, payload=payload)


def get_hevy_body_measurement(date: str) -> dict:
    """Same payload as GET /api/external/hevy/body-measurements/{date}."""
    return invoke_external(external_routes.get_hevy_body_measurement, needs_hevy=True, date=date)


def put_hevy_body_measurement(date: str, fields: dict) -> dict:
    """Same payload as PUT /api/external/hevy/body-measurements/{date}."""
    payload = HevyBodyMeasurementWrite.model_validate(fields)
    return invoke_external(
        external_routes.put_hevy_body_measurement,
        needs_hevy=True,
        date=date,
        payload=payload,
    )


def link_hevy_garmin(workout_id: str, garmin_activity_id: str) -> dict:
    """Same payload as POST /api/external/hevy/links."""
    payload = HevyLinkWrite(workout_id=workout_id, garmin_activity_id=garmin_activity_id)
    return invoke_external(external_routes.post_hevy_link, payload=payload)


def unlink_hevy_garmin(workout_id: str, garmin_activity_id: str) -> dict:
    """Same payload as DELETE /api/external/hevy/links."""
    payload = HevyLinkWrite(workout_id=workout_id, garmin_activity_id=garmin_activity_id)
    return invoke_external(external_routes.delete_hevy_link, payload=payload)


def load_hevy_templates() -> dict:
    """Same payload as POST /api/external/hevy/load/templates."""
    return invoke_external(external_routes.post_hevy_load_templates, needs_hevy=True)


def load_hevy_workouts() -> dict:
    """Same payload as POST /api/external/hevy/load/workouts."""
    return invoke_external(external_routes.post_hevy_load_workouts, needs_hevy=True)


def load_hevy_events() -> dict:
    """Same payload as POST /api/external/hevy/load/events."""
    return invoke_external(external_routes.post_hevy_load_events, needs_hevy=True)


def register_external_tools(mcp: FastMCP) -> None:
    read_tools = [
      list_foods,
      list_meals,
      get_today,
      get_week,
      get_month,
      get_health,
      get_weight,
      get_day_status,
      list_health_snapshots,
      list_hevy_workouts,
      get_hevy_workout,
      list_hevy_exercises,
      get_hevy_metadata,
      get_hevy_exercise_progression,
      list_hevy_prs,
      get_hevy_habits,
      list_hevy_routines,
      get_hevy_body_measurement,
    ]
    post_tools = [
      create_meal,
      log_meal,
      create_food,
      quick_log,
      log_food,
      create_hevy_routine,
      create_hevy_routine_folder,
      link_hevy_garmin,
      load_hevy_templates,
      load_hevy_workouts,
      load_hevy_events,
    ]
    patch_tools = [update_meal, update_food]
    put_tools = [put_weight, put_day_status, update_hevy_routine, put_hevy_body_measurement]
    delete_tools = [delete_meal, delete_food, delete_entry, unlink_hevy_garmin]

    for tool in read_tools:
        mcp.tool(annotations=READ_ONLY)(tool)
    for tool in post_tools:
        mcp.tool(annotations=MUTATION)(tool)
    for tool in patch_tools:
        mcp.tool(annotations=MUTATION)(tool)
    for tool in put_tools:
        mcp.tool(annotations=PUT_MUTATION)(tool)
    for tool in delete_tools:
        mcp.tool(annotations=DELETE_MUTATION)(tool)