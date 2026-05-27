import os
import logging
import threading

logger = logging.getLogger(__name__)


class AgentLLMModel:
    """Singleton wrapper around ChatOpenAI (DeepSeek backend) for the LangGraph caption agent.

    Initialisation is deferred and fail-safe: if DEEPSEEK_API_KEY is absent or
    langchain_openai cannot be imported, the singleton is set to None so
    the rest of the SBERT server starts normally.  Callers must guard against
    get_model() returning None.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AgentLLMModel, cls).__new__(cls)
                cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self._model = None
        api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        if not api_key:
            logger.warning(
                "AgentLLMModel: DEEPSEEK_API_KEY not set — "
                "caption generation agent will be unavailable."
            )
            return
        try:
            from langchain_openai import ChatOpenAI  # type: ignore[import]
            self._model = ChatOpenAI(
                model="deepseek-chat",
                temperature=0.7,
                openai_api_key=api_key,
                openai_api_base="https://api.deepseek.com/v1",
            )
            logger.info("AgentLLMModel: ChatOpenAI (DeepSeek) initialised (deepseek-chat).")
        except Exception as exc:
            logger.warning(
                "AgentLLMModel: could not initialise DeepSeek client — "
                "caption agent will be unavailable. Error: %s", exc
            )

    def get_model(self):
        """Return the configured LLM, or None if unavailable."""
        return self._model


# ── Module-level singleton — safe: never raises, may be None ─────────────────
_wrapper = AgentLLMModel()
model = _wrapper.get_model()   # None when DEEPSEEK_API_KEY absent
