from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session, joinedload

from ..db_models import SavedFoodRow, SavedMealItemRow, SavedMealRow


@dataclass
class MacroTotals:
    calories: int
    protein: float
    carbs: float
    fat: float


def scale_macros(base: MacroTotals, quantity: float) -> MacroTotals:
    return MacroTotals(
        calories=round(base.calories * quantity),
        protein=round(base.protein * quantity),
        carbs=round(base.carbs * quantity),
        fat=round(base.fat * quantity),
    )


def food_to_macros(food: SavedFoodRow) -> MacroTotals:
    return MacroTotals(
        calories=food.calories,
        protein=food.protein,
        carbs=food.carbs,
        fat=food.fat,
    )


def sum_components(components: list[tuple[SavedFoodRow, float]]) -> MacroTotals:
    total = MacroTotals(calories=0, protein=0, carbs=0, fat=0)
    for food, quantity in components:
        scaled = scale_macros(food_to_macros(food), quantity)
        total.calories += scaled.calories
        total.protein += scaled.protein
        total.carbs += scaled.carbs
        total.fat += scaled.fat
    return total


def recompute_meal_from_items(meal: SavedMealRow) -> None:
    components = [(item.food, item.quantity) for item in meal.items if item.food is not None]
    totals = sum_components(components)
    meal.calories = totals.calories
    meal.protein = totals.protein
    meal.carbs = totals.carbs
    meal.fat = totals.fat


def recompute_meals_for_food(db: Session, user_id: str, food_id: str) -> list[str]:
    meal_ids = (
        db.query(SavedMealItemRow.meal_id)
        .join(SavedMealRow, SavedMealRow.id == SavedMealItemRow.meal_id)
        .filter(
            SavedMealItemRow.food_id == food_id,
            SavedMealRow.user_id == user_id,
            SavedMealRow.kind == "composed",
        )
        .distinct()
        .all()
    )
    affected: list[str] = []
    for (meal_id,) in meal_ids:
        meal = (
            db.query(SavedMealRow)
            .options(joinedload(SavedMealRow.items).joinedload(SavedMealItemRow.food))
            .filter(SavedMealRow.id == meal_id, SavedMealRow.user_id == user_id)
            .first()
        )
        if meal is None:
            continue
        recompute_meal_from_items(meal)
        affected.append(meal_id)
    return affected


def get_meals_using_food(db: Session, user_id: str, food_id: str) -> list[SavedMealRow]:
    return (
        db.query(SavedMealRow)
        .join(SavedMealItemRow, SavedMealItemRow.meal_id == SavedMealRow.id)
        .filter(
            SavedMealItemRow.food_id == food_id,
            SavedMealRow.user_id == user_id,
        )
        .distinct()
        .order_by(SavedMealRow.name)
        .all()
    )


def cascade_delete_food(db: Session, user_id: str, food: SavedFoodRow) -> None:
    affected_meals = get_meals_using_food(db, user_id, food.id)
    affected_meal_ids = [meal.id for meal in affected_meals]

    db.query(SavedMealItemRow).filter(SavedMealItemRow.food_id == food.id).delete(
        synchronize_session=False,
    )
    db.flush()

    for meal_id in affected_meal_ids:
        meal = (
            db.query(SavedMealRow)
            .options(joinedload(SavedMealRow.items).joinedload(SavedMealItemRow.food))
            .filter(SavedMealRow.id == meal_id, SavedMealRow.user_id == user_id)
            .first()
        )
        if meal is None:
            continue
        if meal.kind == "composed" and len(meal.items) == 0:
            db.delete(meal)
        elif meal.kind == "composed":
            recompute_meal_from_items(meal)

    db.delete(food)
