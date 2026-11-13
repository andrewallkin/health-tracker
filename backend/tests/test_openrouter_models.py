from __future__ import annotations

from backend.openrouter_models import DEFAULT_FOOD_MODEL, models_from_payload


def test_models_from_payload_keeps_multimodal_structured_models() -> None:
    payload = {
        "data": [
            {
                "id": "text-only/model",
                "name": "Text only",
                "supported_parameters": ["structured_outputs"],
                "architecture": {
                    "input_modalities": ["text"],
                    "output_modalities": ["text"],
                },
            },
            {
                "id": "vision/no-schema",
                "name": "Vision without schema",
                "supported_parameters": ["temperature"],
                "architecture": {
                    "input_modalities": ["text", "image"],
                    "output_modalities": ["text"],
                },
            },
            {
                "id": "google/gemini-2.5-pro",
                "name": "Google: Gemini 2.5 Pro",
                "supported_parameters": ["structured_outputs", "response_format"],
                "architecture": {
                    "input_modalities": ["text", "image", "file"],
                    "output_modalities": ["text"],
                },
            },
            {
                "id": DEFAULT_FOOD_MODEL,
                "name": "Google: Gemini 2.5 Flash",
                "supported_parameters": ["structured_outputs"],
                "architecture": {
                    "input_modalities": ["text", "image"],
                    "output_modalities": ["text"],
                },
            },
        ]
    }

    models = models_from_payload(payload)
    assert [model.id for model in models] == [
        DEFAULT_FOOD_MODEL,
        "google/gemini-2.5-pro",
    ]
    assert models[0].recommended is True
    assert models[0].supportsVision is True
    assert models[1].recommended is False
