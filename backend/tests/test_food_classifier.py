from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from food_models import (
    FoodEstimateRaw,
    LabelEnergy,
    MacrosG,
    normalize_food_estimate,
    select_food_model,
)


def _raw_label_kj() -> FoodEstimateRaw:
    return FoodEstimateRaw(
        name="Greek yogurt",
        label_energy=LabelEnergy(
            per_serving=418.4,
            unit="kJ",
            servings_consumed=2,
        ),
        calories_kcal=None,
        macros_g=MacrosG(protein=10, carbs=20, fat=5),
        confidence="high",
        source="label",
        summary="From label.",
        assumptions=[],
    )


def _raw_label_kcal() -> FoodEstimateRaw:
    return FoodEstimateRaw(
        name="Protein bar",
        label_energy=LabelEnergy(
            per_serving=250,
            unit="kcal",
            servings_consumed=2,
        ),
        calories_kcal=None,
        macros_g=MacrosG(protein=10, carbs=20, fat=5),
        confidence="high",
        source="label",
        summary="From label.",
        assumptions=[],
    )


def _raw_estimate() -> FoodEstimateRaw:
    return FoodEstimateRaw(
        name="Chicken rice bowl",
        label_energy=None,
        calories_kcal=650.4,
        macros_g=MacrosG(protein=40, carbs=50, fat=20),
        confidence="medium",
        source="estimate",
        summary="Estimated from photo.",
        assumptions=["Portion size guessed"],
    )


def test_normalize_label_kj_to_kcal() -> None:
    result = normalize_food_estimate(_raw_label_kj(), kj_factor=4.184)
    assert result.calories_kcal == 200
    assert result.energy_raw is not None
    assert result.energy_raw.unit == "kJ"
    assert result.energy_raw.value == pytest.approx(836.8)


def test_normalize_label_kcal() -> None:
    result = normalize_food_estimate(_raw_label_kcal(), kj_factor=4.184)
    assert result.calories_kcal == 500
    assert result.energy_raw is not None
    assert result.energy_raw.unit == "kcal"


def test_normalize_estimate_clears_label_energy() -> None:
    result = normalize_food_estimate(_raw_estimate(), kj_factor=4.184)
    assert result.name == "Chicken rice bowl"
    assert result.label_energy is None
    assert result.calories_kcal == 650
    assert result.energy_raw is None


def test_raw_label_missing_label_energy_raises() -> None:
    with pytest.raises(ValidationError):
        FoodEstimateRaw(
            name="Missing label data",
            label_energy=None,
            calories_kcal=None,
            macros_g=MacrosG(protein=1, carbs=1, fat=1),
            confidence="high",
            source="label",
            summary="Bad.",
            assumptions=[],
        )


def test_raw_estimate_missing_calories_raises() -> None:
    with pytest.raises(ValidationError):
        FoodEstimateRaw(
            name="Missing calories",
            label_energy=None,
            calories_kcal=None,
            macros_g=MacrosG(protein=1, carbs=1, fat=1),
            confidence="medium",
            source="estimate",
            summary="Bad.",
            assumptions=[],
        )


def test_select_food_model() -> None:
    assert (
        select_food_model(
            has_photos=False, text_model="gpt-5-nano", image_model="gpt-5-mini"
        )
        == "gpt-5-nano"
    )
    assert (
        select_food_model(
            has_photos=True, text_model="gpt-5-nano", image_model="gpt-5-mini"
        )
        == "gpt-5-mini"
    )


def test_macros_negative_raises() -> None:
    with pytest.raises(ValidationError):
        MacrosG(protein=-1, carbs=0, fat=0)


def test_food_estimate_schema_has_required_fields() -> None:
    from food_models import FOOD_ESTIMATE_SCHEMA

    assert FOOD_ESTIMATE_SCHEMA["additionalProperties"] is False
    assert "name" in FOOD_ESTIMATE_SCHEMA["properties"]
    assert "name" in FOOD_ESTIMATE_SCHEMA["required"]
    assert "macros_g" in FOOD_ESTIMATE_SCHEMA["properties"]
    assert "source" in FOOD_ESTIMATE_SCHEMA["required"]
    assert "$ref" not in json.dumps(FOOD_ESTIMATE_SCHEMA)
    assert "$defs" not in json.dumps(FOOD_ESTIMATE_SCHEMA)
