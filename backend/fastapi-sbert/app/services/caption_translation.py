"""Caption translation (native → English) and re-localisation (English → native).

Backs POST /internal/generation/translate and /localize. Like every AI endpoint in
this service it returns real model output or raises DependencyUnavailable — there
is no canned or word-for-word fallback.
"""
from __future__ import annotations

import logging
import re

from langchain_core.output_parsers import JsonOutputParser  # type: ignore[import]

from app import errors
from app.agents.creative_director_agent.prompts import (
    PLATFORM_RULES_SHORT,
    caption_localization_prompt,
    caption_translation_prompt,
)
from app.config.markets import LANGUAGE_NAMES
from app.core.TranslationLLMModel import _translation_wrapper as _llm_wrapper
from app.unavailable import DependencyUnavailable

logger = logging.getLogger(__name__)

_HANGUL = re.compile(r"[ᄀ-ᇿ㄰-㆏가-힯]")
_KANA = re.compile(r"[぀-ヿㇰ-ㇿｦ-ﾟ]")
_HAN = re.compile(r"[㐀-䶿一-鿿]")

_MARKET_FOR_LANGUAGE = {"ko": "South Korea", "ja": "Japan"}
_STAGE = "fastapi-sbert/caption_translation"


def has_non_english_script(text: str) -> bool:
    return bool(_HANGUL.search(text) or _KANA.search(text) or _HAN.search(text))


def detect_language(text: str) -> str:
    """'ko' for any Hangul, 'ja' for kana or Han, otherwise 'en'."""
    if _HANGUL.search(text):
        return "ko"
    if _KANA.search(text) or _HAN.search(text):
        return "ja"
    return "en"


def _failed(cause: str, stage: str) -> DependencyUnavailable:
    return DependencyUnavailable(
        code=errors.MOD31_TRANSLATION_FAILED,
        message="Caption translation failed.",
        dependency="groq",
        cause=cause,
        stage=stage,
    )


def _run(chain_input: dict, prompt, stage: str) -> dict:
    llm = _llm_wrapper.get_model()
    if llm is None:
        raise DependencyUnavailable(
            code=errors.MOD31_TRANSLATION_UNAVAILABLE,
            message="Caption translation is unavailable.",
            dependency="groq",
            cause=getattr(_llm_wrapper, "last_error", None) or "the Groq client is not initialised",
            stage=stage,
        )
    try:
        result = (prompt | llm | JsonOutputParser()).invoke(chain_input)
    except Exception as exc:
        detail = str(exc)
        if len(detail) > 200:
            detail = detail[:200] + "… (truncated)"
        logger.error("[%s] %s: %s", errors.MOD31_TRANSLATION_FAILED, stage, exc)
        raise _failed(f"{type(exc).__name__}: {detail}", stage) from exc
    if not isinstance(result, dict):
        raise _failed("the model did not return a JSON object", stage)
    return result


def translate_to_english(caption: str, platform: str, business_name: str) -> dict:
    stage = f"{_STAGE}.translate"
    result = _run(
        {"caption": caption, "platform": platform, "business_name": business_name},
        caption_translation_prompt,
        stage,
    )
    caption_en = result.get("caption_en")
    if not isinstance(caption_en, str) or not caption_en.strip():
        raise _failed("the model returned no caption_en", stage)
    return {
        "caption_en": caption_en.strip(),
        "source_language": detect_language(caption),
        "source": "groq",
    }


def localize_from_english(
    caption_en: str,
    target_language: str,
    platform: str,
    original_caption: str,
    business_name: str,
) -> dict:
    stage = f"{_STAGE}.localize"
    language_name = LANGUAGE_NAMES[target_language]
    result = _run(
        {
            "caption_en": caption_en,
            "language_name": language_name,
            "market": _MARKET_FOR_LANGUAGE[target_language],
            "platform": platform,
            "platform_rules": PLATFORM_RULES_SHORT[platform],
            "original_caption": original_caption,
            "business_name": business_name,
        },
        caption_localization_prompt,
        stage,
    )
    caption = result.get("caption")
    if not isinstance(caption, str) or not caption.strip():
        raise _failed("the model returned no caption", stage)
    if detect_language(caption) != target_language:
        raise _failed(f"the model returned a caption that is not in {language_name}", stage)
    back = result.get("caption_en")
    return {
        "caption": caption.strip(),
        "caption_en": back.strip() if isinstance(back, str) and back.strip() else caption_en.strip(),
        "target_language": target_language,
        "source": "groq",
    }
