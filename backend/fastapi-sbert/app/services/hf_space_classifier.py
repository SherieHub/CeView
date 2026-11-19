"""Client for the hosted CeView SBERT classifier on Hugging Face Spaces."""

from __future__ import annotations

import ast
import os
import re
import math
from time import perf_counter
from collections.abc import Sequence

from gradio_client import Client

from app.unavailable import DependencyUnavailable


SPACE_ID = os.getenv("HF_SPACE_ID", "JamJamzz/ceview_sbert")
MODEL_VERSION = os.getenv("MODEL_VERSION", "JamJamzz/ceview_sbert:v1.0.0")
CATEGORY_NAMES = (
    "Coastal & Island", "Adventure & Nature", "Cultural & Heritage",
    "Theme Parks / Entertainment", "Urban & City", "Culinary & Gastronomy",
    "Accommodation & Staycation",
)
_NUMBER = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?")
_OUT_OF_SCOPE = "OUT_OF_SCOPE"
_OUT_OF_SCOPE_THRESHOLD = 0.75
_MIN_CATEGORY_PERCENTAGE = 20
_MAX_CATEGORIES = 3


def predict_categories(
    description: str,
    uvp: str,
    core_services: list[str],
) -> list[dict[str, int]]:
    """Return the existing display allocations."""
    categories, confidences, _ = _predict(description, uvp, core_services)
    return _to_allocations(categories, confidences)


def predict_with_details(description: str, uvp: str, core_services: list[str]) -> dict:
    """Preserve raw independent probabilities before display normalization."""
    categories, confidences, latency = _predict(description, uvp, core_services)
    scores = _parse_named_scores(confidences)
    if not set(CATEGORY_NAMES).issubset(scores) or any(
        not math.isfinite(score) or not 0 <= score <= 1 for score in scores.values()
    ):
        raise _invalid_response("expected all seven named category probabilities in [0, 1]")
    allocations = _to_allocations(categories, confidences)
    top = max(scores, key=scores.get)
    predicted = _parse_names(categories)
    if not predicted or any(name not in scores for name in predicted):
        raise _invalid_response("predicted categories must have corresponding raw scores")
    return {
        "categories": allocations,
        "inference": {
            "topCategory": top,
            "topConfidence": scores[top],
            "predictedCategories": {name: scores[name] for name in predicted},
            "categoryScores": scores,
            "modelVersion": MODEL_VERSION,
            "inferenceLatencyMs": latency,
        },
    }


def _predict(description: str, uvp: str, core_services: list[str]) -> tuple:
    """Time the hosted request, including client setup, network and queue time."""
    try:
        started = perf_counter()
        client = Client(SPACE_ID, token=os.getenv("HF_TOKEN") or None, verbose=False)
        categories, confidences = client.predict(
            description=description,
            uvp=uvp,
            services=", ".join(core_services),
            api_name="/predict_gradio",
        )
        return categories, confidences, (perf_counter() - started) * 1000
    except DependencyUnavailable:
        raise
    except Exception as exc:
        raise DependencyUnavailable(
            code="MOD1_HF_SPACE_UNAVAILABLE",
            message="Business classification is unavailable.",
            dependency="huggingface_space",
            cause=_safe_cause(exc),
            stage="fastapi-sbert/classification",
        ) from exc


def category_score(
    description: str,
    uvp: str,
    core_services: list[str],
    selected_categories: list[str],
    inference: dict | None = None,
) -> float:
    """Return the average Space confidence for the categories the operator kept."""
    if not selected_categories:
        return 0.0
    if inference is not None:
        inference.update(predict_with_details(description, uvp, core_services))
        allocations = inference["categories"]
    else:
        allocations = predict_categories(description, uvp, core_services)
    scores = {
        item["name"]: item["percentage"]
        for item in allocations
    }
    return round(
        sum(scores.get(category, 0) for category in selected_categories)
        / len(selected_categories),
        1,
    )


def _invalid_response(cause: str) -> DependencyUnavailable:
    """The 503 raised when the Space answers with a payload we cannot allocate from."""
    return DependencyUnavailable(
        code="MOD1_HF_SPACE_INVALID_RESPONSE",
        message="Business classification returned an invalid response.",
        dependency="huggingface_space",
        cause=cause,
        stage="fastapi-sbert/classification",
    )


def _to_allocations(categories: object, confidences: object) -> list[dict[str, int]]:
    named_scores = _parse_named_scores(confidences)
    if named_scores:
        return _select_named_allocations(named_scores)

    names = _parse_names(categories)
    scores = _parse_scores(confidences)
    if not names or len(names) != len(scores):
        raise _invalid_response(f"received {len(names)} categories and {len(scores)} confidence scores")

    return _allocate(names, scores)


def _select_named_allocations(named_scores: dict[str, float]) -> list[dict[str, int]]:
    if named_scores.get(_OUT_OF_SCOPE, 0.0) > _OUT_OF_SCOPE_THRESHOLD:
        return [{"name": _OUT_OF_SCOPE, "percentage": 100}]

    in_scope_scores = [
        (name, score)
        for name, score in named_scores.items()
        if name != _OUT_OF_SCOPE and score > 0
    ]
    total = sum(score for _, score in in_scope_scores)
    if total <= 0:
        raise _invalid_response("confidence scores did not contain a positive in-scope value")

    selected = [
        (name, score)
        for name, score in in_scope_scores
        if score / total * 100 >= _MIN_CATEGORY_PERCENTAGE
    ]
    if not selected:
        selected = [max(in_scope_scores, key=lambda item: item[1])]

    selected.sort(key=lambda item: item[1], reverse=True)
    selected = selected[:_MAX_CATEGORIES]
    return _allocate(
        [name for name, _ in selected],
        [score for _, score in selected],
    )


def _allocate(names: list[str], scores: list[float]) -> list[dict[str, int]]:
    total = sum(scores)
    if total <= 0:
        raise _invalid_response("confidence scores did not contain a positive value")

    allocations: list[dict[str, int]] = []
    remaining = 100
    for index, (name, score) in enumerate(zip(names, scores)):
        percentage = round(score / total * 100) if index < len(names) - 1 else remaining
        remaining -= percentage
        allocations.append({"name": name, "percentage": percentage})
    return allocations


def _parse_names(value: object) -> list[str]:
    return [item.strip(" -•\t") for item in _as_items(value) if item.strip(" -•\t")]


def _parse_scores(value: object) -> list[float]:
    scores: list[float] = []
    for item in _as_items(value):
        match = _NUMBER.search(item)
        if match:
            scores.append(float(match.group()))
    return scores


def _parse_named_scores(value: object) -> dict[str, float]:
    scores: dict[str, float] = {}
    for item in _as_items(value):
        name, separator, score_text = item.rpartition(":")
        if not separator:
            continue
        match = _NUMBER.fullmatch(score_text.strip())
        if match:
            scores[name.strip()] = float(match.group())
    return scores


def _as_items(value: object) -> list[str]:
    if isinstance(value, Sequence) and not isinstance(value, str):
        return [str(item) for item in value]

    text = str(value).strip()
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, Sequence) and not isinstance(parsed, str):
            return [str(item) for item in parsed]
    except (SyntaxError, ValueError):
        pass
    return [item.strip() for item in re.split(r"[,\n;]+", text) if item.strip()]


def _safe_cause(exc: Exception) -> str:
    return f"{type(exc).__name__}: {exc}"[:300]
