import os
import logging
import threading

from dotenv import load_dotenv

# This forces Python to find and load the .env file
load_dotenv()

logger = logging.getLogger(__name__)


class AgentLLMModel:
    """Singleton wrapper around ChatGroq (Groq) for the LangGraph agents.

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
        """Attempts to build the LangChain Groq model."""
        api_key = os.environ.get("GROQ_API_KEY", "")

        if not api_key:
            return

        try:
            from langchain_groq import ChatGroq  # type: ignore[import]

            self._model = ChatGroq(
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                groq_api_key=api_key,
            )
            logger.info("AgentLLMModel: ChatGroq initialised (llama-3.3-70b-versatile).")

        except ImportError:
            logger.error(
                "AgentLLMModel: 'langchain-groq' package not found. "
                "CRITICAL: Run `pip install langchain-groq`."
            )
        except Exception as exc:
            logger.error("AgentLLMModel: Failed to initialise Groq client. Error: %s", exc)

    def get_model(self):
        """Return the configured LLM. If it failed previously, try one more time."""
        if self._model is None:
            self._initialize()
        return self._model


# ── Module-level singleton ───────────────────────────────────────────────────
_wrapper = AgentLLMModel()