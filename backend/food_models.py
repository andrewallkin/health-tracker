from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class LabelEnergy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    per_serving: float
    unit: Literal["kJ", "kcal"]
    servings_consumed: float


class MacrosG(BaseModel):
    model_config = ConfigDict(extra="forbid")

    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class FoodEstimateRaw(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    label_energy: LabelEnergy | None
    calories_kcal: float | None
    macros_g: MacrosG
    confidence: Literal["high", "medium", "low"]
    source: Literal["label", "estimate"]
    summary: str
    assumptions: list[str]

    @model_validator(mode="after")
    def check_source_fields(self) -> FoodEstimateRaw:
        if self.source == "label" and self.label_energy is None:
            raise ValueError("label source requires label_energy")
        if self.source == "estimate":
            if self.calories_kcal is None:
                raise ValueError("estimate source requires calories_kcal")
            if self.label_energy is not None:
                raise ValueError("estimate source requires label_energy to be null")
        return self


class EnergyRaw(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: float
    unit: Literal["kJ", "kcal"]


class FoodEstimate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    label_energy: LabelEnergy | None
    calories_kcal: int
    macros_g: MacrosG
    confidence: Literal["high", "medium", "low"]
    source: Literal["label", "estimate"]
    summary: str
    assumptions: list[str]
    energy_raw: EnergyRaw | None = None


class EstimateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str | None
    photos: list[str]


class EstimateUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class FoodEstimateResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: EstimateInput
    output: FoodEstimate
    model: str
    usage: EstimateUsage | None = None


def select_food_model(*, has_photos: bool, text_model: str, image_model: str) -> str:
    """Text-only note/description uses text_model; any photo uses image_model."""
    return image_model if has_photos else text_model


def normalize_food_estimate(raw: FoodEstimateRaw, *, kj_factor: float) -> FoodEstimate:
    """Resolve calories_kcal from label_energy or an estimate."""
    if raw.source == "label":
        assert raw.label_energy is not None
        label_energy = raw.label_energy
        total = label_energy.per_serving * label_energy.servings_consumed
        if label_energy.unit == "kJ":
            calories_kcal = round(total / kj_factor)
            energy_raw = EnergyRaw(value=total, unit="kJ")
        else:
            calories_kcal = round(total)
            energy_raw = EnergyRaw(value=total, unit="kcal")
        return FoodEstimate(
            name=raw.name.strip(),
            label_energy=label_energy,
            calories_kcal=calories_kcal,
            macros_g=raw.macros_g,
            confidence=raw.confidence,
            source=raw.source,
            summary=raw.summary,
            assumptions=raw.assumptions,
            energy_raw=energy_raw,
        )

    assert raw.calories_kcal is not None
    return FoodEstimate(
        name=raw.name.strip(),
        label_energy=None,
        calories_kcal=round(raw.calories_kcal),
        macros_g=raw.macros_g,
        confidence=raw.confidence,
        source=raw.source,
        summary=raw.summary,
        assumptions=raw.assumptions,
        energy_raw=None,
    )


def _resolve_schema_node(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        if "$ref" in node:
            ref_name = node["$ref"].split("/")[-1]
            return _resolve_schema_node(defs[ref_name], defs)

        if "anyOf" in node:
            variants = node["anyOf"]
            non_null = [v for v in variants if v.get("type") != "null"]
            has_null = any(v.get("type") == "null" for v in variants)
            if has_null and len(non_null) == 1:
                resolved = _resolve_schema_node(non_null[0], defs)
                if isinstance(resolved, dict):
                    resolved = resolved.copy()
                    base_type = resolved.get("type", "object")
                    if isinstance(base_type, list):
                        resolved["type"] = base_type if "null" in base_type else [*base_type, "null"]
                    else:
                        resolved["type"] = [base_type, "null"]
                    resolved.pop("title", None)
                    return resolved

        resolved: dict[str, Any] = {}
        for key, value in node.items():
            if key in {"$defs", "title"}:
                continue
            resolved[key] = _resolve_schema_node(value, defs)
        return resolved

    if isinstance(node, list):
        return [_resolve_schema_node(item, defs) for item in node]

    return node


def _enforce_additional_properties_false(schema: dict[str, Any]) -> dict[str, Any]:
    if schema.get("type") == "object" or (
        isinstance(schema.get("type"), list) and "object" in schema["type"]
    ):
        schema["additionalProperties"] = False
    for key, value in schema.items():
        if isinstance(value, dict):
            _enforce_additional_properties_false(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _enforce_additional_properties_false(item)
    return schema


def build_food_estimate_schema() -> dict[str, Any]:
    schema = FoodEstimateRaw.model_json_schema()
    defs = schema.pop("$defs", {})
    root = _resolve_schema_node(schema, defs)
    assert isinstance(root, dict)
    return _enforce_additional_properties_false(root)


FOOD_ESTIMATE_SCHEMA = build_food_estimate_schema()
