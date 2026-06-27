from __future__ import annotations

import base64
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from typing import Any

import pillow_heif
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageOps

from .food_models import (
    FOOD_ESTIMATE_SCHEMA,
    EstimateInput,
    EstimateUsage,
    FoodEstimateRaw,
    FoodEstimateResult,
    normalize_food_estimate,
    select_food_model,
)

load_dotenv()

pillow_heif.register_heif_opener()

logger = logging.getLogger(__name__)

SUPPORTED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic", ".heif"}

SYSTEM_PROMPT = """You estimate food calories and macros from a note and/or photos.

Rules:
1. If a nutrition label is visible in any photo, read per-serving values from the label
   and scale by the quantity in the note. Set source to "label" and confidence to "high"
   when the label is readable.
   - Fill label_energy with the per-serving energy exactly as printed (kJ or kcal) and
     servings_consumed for everything eaten. Do not convert units.
   - Set calories_kcal to null (conversion is done in code).
   - Scale macros_g to total consumed (not per serving).
2. Otherwise estimate from the note and/or meal photos together.
   Set source to "estimate" and choose confidence based on how much is known.
   - Fill calories_kcal with your total kcal estimate.
   - Set label_energy to null.
3. macros_g values are grams (protein, carbs, fat) for everything consumed.
4. List every guess in assumptions. Leave assumptions empty for clear label reads.
5. Keep summary to one short sentence explaining the calculation or estimate.
6. Set name to a short, human-readable meal title (max 48 characters) based on the note
   and/or what you see in the photos. Do not include serving sizes or calorie counts.
"""

MULTI_PHOTO_HINT = (
    "Photos are attached in order; nutrition labels may appear in any photo."
)


class EstimateAPIError(Exception):
    """Raised when the OpenAI API call for food estimation fails."""


class MacrosEstimator:
    def __init__(
        self,
        *,
        client: OpenAI | None = None,
        api_key: str | None = None,
        text_model: str | None = None,
        image_model: str | None = None,
        kj_to_kcal_factor: float = 4.184,
        max_image_edge: int = 1024,
        jpeg_quality: int = 85,
        max_retries: int = 3,
        load_env: bool = True,
    ) -> None:
        if load_env:
            load_dotenv()

        resolved_key = (api_key or os.environ.get("OPENAI_API_KEY") or "").strip() or None
        if client is None:
            if not resolved_key:
                raise ValueError(
                    "OpenAI API key is not set. Pass api_key=, client=, or set OPENAI_API_KEY."
                )
            client = OpenAI(api_key=resolved_key, max_retries=max_retries)
        self.client = client

        legacy_model = (os.environ.get("OPENAI_FOOD_MODEL") or "").strip() or None
        self.text_model = (
            (text_model or os.environ.get("OPENAI_FOOD_TEXT_MODEL") or "gpt-5-nano").strip()
        )
        self.image_model = (
            (
                image_model
                or os.environ.get("OPENAI_FOOD_IMAGE_MODEL")
                or legacy_model
                or "gpt-5-mini"
            ).strip()
        )
        self.kj_to_kcal_factor = kj_to_kcal_factor
        self.max_image_edge = max_image_edge
        self.jpeg_quality = jpeg_quality

    @staticmethod
    def _is_data_url(value: str) -> bool:
        return value.startswith("data:")

    @staticmethod
    def _decode_data_url(value: str) -> bytes:
        if "," not in value:
            raise ValueError("Invalid data URL: missing comma separator")
        _, encoded = value.split(",", 1)
        return base64.standard_b64decode(encoded)

    def _resize_image_bytes(self, data: bytes) -> tuple[bytes, str]:
        with Image.open(BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            width, height = img.size
            longest = max(width, height)
            if longest > self.max_image_edge:
                scale = self.max_image_edge / longest
                new_size = (int(width * scale), int(height * scale))
                img = img.resize(new_size, Image.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=self.jpeg_quality)
            return buf.getvalue(), "image/jpeg"

    def _prepare_image_for_api(self, path: Path) -> tuple[bytes, str]:
        suffix = path.suffix.lower()
        if suffix not in SUPPORTED_IMAGE_SUFFIXES:
            supported = ", ".join(sorted(SUPPORTED_IMAGE_SUFFIXES))
            raise ValueError(
                f"Unsupported image format {path.suffix!r} for {path.name}. "
                f"Supported: {supported}"
            )

        with open(path, "rb") as f:
            return self._resize_image_bytes(f.read())

    def _encode_photo(self, photo: str | Path) -> dict[str, Any]:
        if isinstance(photo, str) and self._is_data_url(photo):
            data, mime = self._resize_image_bytes(self._decode_data_url(photo))
        else:
            path = Path(photo)
            if not path.is_file():
                raise FileNotFoundError(path)
            data, mime = self._prepare_image_for_api(path)

        encoded = base64.standard_b64encode(data).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{encoded}"},
        }

    def _encode_images(self, photos: list[str | Path]) -> list[dict[str, Any]]:
        if len(photos) <= 1:
            return [self._encode_photo(photo) for photo in photos]
        with ThreadPoolExecutor(max_workers=len(photos)) as executor:
            return list(executor.map(self._encode_photo, photos))

    def estimate_macros(
        self,
        *,
        note: str | None = None,
        photos: list[str | Path] | None = None,
    ) -> FoodEstimateResult:
        """Estimate calories and macros from a note and/or image paths or data URLs."""
        note = (note or "").strip() or None
        photo_inputs = list(photos or [])

        if not note and not photo_inputs:
            raise ValueError("Provide at least one of note or photos")

        estimate_input = EstimateInput(
            note=note,
            photos=[str(p) for p in photo_inputs],
        )

        user_content: list[dict[str, Any]] = []
        user_text_parts: list[str] = []

        if note:
            user_text_parts.append(f"Note: {note}")
        if len(photo_inputs) > 1:
            user_text_parts.append(MULTI_PHOTO_HINT)

        model = select_food_model(
            has_photos=bool(photo_inputs),
            text_model=self.text_model,
            image_model=self.image_model,
        )

        if user_text_parts:
            user_content.append({"type": "text", "text": "\n".join(user_text_parts)})
        user_content.extend(self._encode_images(photo_inputs))

        logger.info("Calling OpenAI model=%s photos=%d", model, len(photo_inputs))

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "food_estimate",
                        "strict": True,
                        "schema": FOOD_ESTIMATE_SCHEMA,
                    },
                },
            )
        except Exception as exc:
            raise EstimateAPIError(
                f"Food estimate API call failed (model={model!r}): {exc}"
            ) from exc

        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("Empty response from model")

        usage: EstimateUsage | None = None
        if response.usage is not None:
            usage = EstimateUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
            )
            logger.info(
                "Token usage: prompt=%d completion=%d total=%d",
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
            )

        raw = FoodEstimateRaw.model_validate(json.loads(content))
        output = normalize_food_estimate(raw, kj_factor=self.kj_to_kcal_factor)

        result = FoodEstimateResult(
            input=estimate_input,
            output=output,
            model=model,
            usage=usage,
        )

        return result
