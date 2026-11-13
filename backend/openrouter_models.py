from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from .api.schemas import ModelOption

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODELS_URL = f"{OPENROUTER_BASE_URL}/models"
DEFAULT_FOOD_MODEL = "google/gemini-2.5-flash"
_CACHE_TTL_SECONDS = 60 * 60

_cache: tuple[float, list[ModelOption]] | None = None


def fallback_food_models() -> list[ModelOption]:
    return [
        ModelOption(
            id=DEFAULT_FOOD_MODEL,
            label="Google: Gemini 2.5 Flash",
            supportsVision=True,
            recommended=True,
        ),
        ModelOption(
            id="google/gemini-2.5-flash-lite",
            label="Google: Gemini 2.5 Flash Lite",
            supportsVision=True,
        ),
        ModelOption(
            id="google/gemini-2.5-pro",
            label="Google: Gemini 2.5 Pro",
            supportsVision=True,
        ),
    ]


def models_from_payload(payload: dict[str, Any]) -> list[ModelOption]:
    """Keep text+image models that can return strict JSON schemas."""
    options: list[ModelOption] = []
    seen: set[str] = set()
    for row in payload.get("data") or []:
        if not isinstance(row, dict):
            continue
        model_id = str(row.get("id") or "").strip()
        if not model_id or model_id in seen:
            continue
        parameters = row.get("supported_parameters") or []
        if "structured_outputs" not in parameters:
            continue
        architecture = row.get("architecture") or {}
        inputs = architecture.get("input_modalities") or []
        outputs = architecture.get("output_modalities") or []
        if "text" not in inputs or "image" not in inputs or "text" not in outputs:
            continue
        seen.add(model_id)
        label = str(row.get("name") or model_id).strip() or model_id
        options.append(
            ModelOption(
                id=model_id,
                label=label,
                supportsVision=True,
                recommended=model_id == DEFAULT_FOOD_MODEL,
            )
        )
    options.sort(key=lambda model: (not model.recommended, model.label.lower()))
    if not any(model.id == DEFAULT_FOOD_MODEL for model in options):
        options.insert(0, fallback_food_models()[0])
    return options


def list_food_models(*, client: httpx.Client | None = None) -> list[ModelOption]:
    global _cache
    now = time.monotonic()
    if _cache is not None and now - _cache[0] < _CACHE_TTL_SECONDS:
        return _cache[1]

    owns_client = client is None
    http = client or httpx.Client(timeout=10)
    try:
        response = http.get(
            OPENROUTER_MODELS_URL,
            params={"input_modalities": "text,image", "output_modalities": "text"},
        )
        response.raise_for_status()
        models = models_from_payload(response.json())
    except Exception:
        logger.warning("OpenRouter model catalog request failed", exc_info=True)
        if _cache is not None:
            return _cache[1]
        return fallback_food_models()
    finally:
        if owns_client:
            http.close()

    if not models:
        return fallback_food_models()
    _cache = (now, models)
    return models


def clear_food_model_cache() -> None:
    global _cache
    _cache = None
