"""Client for the hosted CeView SBERT classifier on Hugging Face Spaces."""

from __future__ import annotations

import ast
import os
import re
from collections.abc import Sequence

from gradio_client import Client

from app.unavailable import DependencyUnavailable


SPACE_ID = os.getenv("HF_SPACE_ID", "JamJamzz/ceview_sbert")
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
    """Call the Space and adapt its two text fields to CeView allocations."""
    try:
        client = Client(SPACE_ID, token=os.getenv("HF_TOKEN") or None, verbose=False)
        categories, confidences = client.predict(
            description=description,
            uvp=uvp,
            services=", ".join(core_services),
            api_name="/predict_gradio",
        )
        return _to_allocations(categories, confidences)
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
) -> float:
    """Return the average Space confidence for the categories the operator kept."""
    if not selected_categories:
        return 0.0
    scores = {
        item["name"]: item["percentage"]
        for item in predict_categories(description, uvp, core_services)
    }
    return round(
        sum(scores.get(category, 0) for category in selected_categories)
        / len(selected_categories),
        1,
    )


def _to_allocations(categories: object, confidences: object) -> list[dict[str, int]]:
    named_scores = _parse_named_scores(confidences)
    if named_scores:
        return _select_named_allocations(named_scores)

    names = _parse_names(categories)
    scores = _parse_scores(confidences)
    if not names or len(names) != len(scores):
        raise DependencyUnavailable(
            code="MOD1_HF_SPACE_INVALID_RESPONSE",
            message="Business classification returned an invalid response.",
            dependency="huggingface_space",
            cause=f"received {len(names)} categories and {len(scores)} confidence scores",
            stage="fastapi-sbert/classification",
        )

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
        raise DependencyUnavailable(
            code="MOD1_HF_SPACE_INVALID_RESPONSE",
            message="Business classification returned an invalid response.",
            dependency="huggingface_space",
            cause="confidence scores did not contain a positive in-scope value",
            stage="fastapi-sbert/classification",
        )

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
        raise DependencyUnavailable(
            code="MOD1_HF_SPACE_INVALID_RESPONSE",
            message="Business classification returned an invalid response.",
            dependency="huggingface_space",
            cause="confidence scores did not contain a positive value",
            stage="fastapi-sbert/classification",
        )

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
