import os
import logging
import threading

logger = logging.getLogger(__name__)


class AgentLLMModel:
    """Singleton wrapper around ChatGoogleGenerativeAI (Gemini backend) for the LangGraph agents.

    Self-healing initialization: If the environment variables are not loaded when
    the module is first imported, get_model() will retry initialization dynamically.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AgentLLMModel, cls).__new__(cls)
                cls._instance._model = None
                cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Attempts to build the LangChain Gemini model."""
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
        
        if not api_key:
            # We don't log a massive warning here anymore because it might just be
            # that the .env file hasn't loaded yet.
            return
            
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI  # type: ignore[import]
            
            self._model = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                temperature=0.7,
                google_api_key=api_key,
            )
            logger.info("AgentLLMModel: ChatGoogleGenerativeAI initialised (gemini-1.5-flash).")
            
        except ImportError:
            logger.error(
                "AgentLLMModel: 'langchain-google-genai' package not found. "
                "CRITICAL: Run `pip install langchain-google-genai`."
            )
        except Exception as exc:
            logger.error("AgentLLMModel: Failed to initialise Gemini client. Error: %s", exc)

    def get_model(self):
        """Return the configured LLM. If it failed previously, try one more time."""
        if self._model is None:
            self._initialize()
        return self._model


# ── Module-level singleton ───────────────────────────────────────────────────
_wrapper = AgentLLMModel()