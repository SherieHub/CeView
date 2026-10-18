"""ChatGroq wrapper for caption translation (KO/JA → EN) and re-localisation (EN → KO/JA).

Kept separate from AgentLLMModel so translation can run on its own model
(GROQ_TRANSLATION_MODEL) and at a lower temperature without touching the caption
agent — the same reason omcs_agent keeps its vision model to itself.
AgentLLMModel is a one-instance singleton, so it cannot hand out a second model.
"""
from __future__ import annotations

import logging
import os
import threading

from dotenv import load_dotenv

from app.config.llm import translation_model

load_dotenv()

logger = logging.getLogger(__name__)


class TranslationLLMModel:
    """Lazily built ChatGroq for translation. Records why it has no model in `last_error`."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self.last_error: str | None = None

    def _initialize(self) -> None:
        api_key = os.environ.get("GROQ_API_KEY", "")
        if not api_key:
            self.last_error = "GROQ_API_KEY is not set"
            return

        model_name = translation_model()
        try:
            from langchain_groq import ChatGroq  # type: ignore[import]

            self._model = ChatGroq(
                model=model_name,
                # Low enough to stay faithful to the source, high enough to read
                # naturally rather than word-for-word.
                temperature=0.3,
                groq_api_key=api_key,
                # gpt-oss counts reasoning tokens against this; without it a long
                # caption's JSON is cut off and JsonOutputParser drops the key.
                max_tokens=8192,
            )
            self.last_error = None
            logger.info("TranslationLLMModel: ChatGroq initialised (model=%s).", model_name)
        except ImportError as exc:
            self.last_error = f"langchain-groq is not installed ({exc})"
            logger.error("TranslationLLMModel: %s", self.last_error)
        except Exception as exc:
            detail = str(exc)
            if len(detail) > 200:
                detail = detail[:200] + "… (truncated)"
            self.last_error = (
                f"ChatGroq failed to initialise with GROQ_TRANSLATION_MODEL/GROQ_MODEL "
                f"'{model_name}': {type(exc).__name__}: {detail}"
            )
            logger.error("TranslationLLMModel: %s", self.last_error)

    def get_model(self):
        """Return the translation LLM, retrying initialisation once per call if it failed."""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    self._initialize()
        return self._model


# ── Module-level instance ────────────────────────────────────────────────────
_translation_wrapper = TranslationLLMModel()
