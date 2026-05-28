import os
import logging
import threading

logger = logging.getLogger(__name__)


class AgentLLMModel:
    """Singleton wrapper around ChatOpenAI (Groq) for the LangGraph caption agent.

    Initialisation is deferred and fail-safe: if GROQ_API_KEY is absent or
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
        api_key = os.environ.get("GROQ_API_KEY", "")
        if not api_key:
            logger.warning(
                "AgentLLMModel: GROQ_API_KEY not set — "
                "caption generation agent will be unavailable."
            )
            return
        try:
            from langchain_openai import ChatOpenAI  # type: ignore[import]
            self._model = ChatOpenAI(
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
            )
            logger.info("AgentLLMModel: ChatOpenAI (Groq/llama-3.3-70b-versatile) initialised.")
        except Exception as exc:
            logger.warning(
                "AgentLLMModel: could not initialise Groq client — "
                "caption agent will be unavailable. Error: %s", exc
            )

    def get_model(self):
        """Return the configured LLM, or None if unavailable."""
        return self._model


# ── Module-level singleton — safe: never raises, may be None ─────────────────
_wrapper = AgentLLMModel()
model = _wrapper.get_model()   # None when GROQ_API_KEY absent
