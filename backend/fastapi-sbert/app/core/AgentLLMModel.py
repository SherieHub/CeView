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
                cls._instance.last_error = None
                cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Attempts to build the LangChain Groq model.

        On failure, records the reason in `last_error` as a single sentence fit to
        be shown to a developer in the browser — the caption agent passes it
        straight through as the `cause` field of a 503 (see app/unavailable.py).
        """
        api_key = os.environ.get("GROQ_API_KEY", "")

        if not api_key:
            self.last_error = "GROQ_API_KEY is not set"
            return

        # Read from GROQ_MODEL so the model can be changed without a code
        # edit — services/gemini_client.py already reads the same variable.
        # Groq decommissions models periodically; when that happens the API
        # answers 404 model_not_found while the key still authenticates,
        # which surfaces as MOD31_CAPTION_AGENT_FAILED rather than an
        # auth error. Set GROQ_MODEL in backend/.env to a model your key
        # can access.
        groq_model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

        try:
            from langchain_groq import ChatGroq  # type: ignore[import]

            self._model = ChatGroq(
                model=groq_model,
                temperature=0.7,
                groq_api_key=api_key,
            )
            self.last_error = None
            logger.info("AgentLLMModel: ChatGroq initialised (model=%s).", groq_model)

        except ImportError as exc:
            self.last_error = f"langchain-groq is not installed ({exc})"
            logger.error("AgentLLMModel: %s", self.last_error)
        except Exception as exc:
            detail = str(exc)
            if len(detail) > 200:
                detail = detail[:200] + "… (truncated)"
            self.last_error = (
                f"ChatGroq failed to initialise with GROQ_MODEL '{groq_model}': "
                f"{type(exc).__name__}: {detail}"
            )
            logger.error("AgentLLMModel: %s", self.last_error)

    def get_model(self):
        """Return the configured LLM. If it failed previously, try one more time.

        The retry holds the class lock: `_initialize()` writes `_model` and
        `last_error` as two separate statements, so concurrent retries could
        otherwise interleave into a valid model paired with a stale error string.
        Locking also collapses a thundering herd of duplicate ChatGroq
        constructions when several requests arrive during an outage.
        """
        if self._model is None:
            with self._lock:
                # Re-check inside the lock: another thread may have succeeded
                # while this one waited.
                if self._model is None:
                    self._initialize()
        return self._model


# ── Module-level singleton ───────────────────────────────────────────────────
_wrapper = AgentLLMModel()