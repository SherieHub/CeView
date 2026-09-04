import os

# ── ANTI-DEADLOCK THREAD LIMITERS ─────────────────────────────────────────────
# These force PyTorch and TensorFlow to share the CPU instead of freezing.
# Must be declared BEFORE importing sentence_transformers or tensorflow.
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["TF_NUM_INTEROP_THREADS"] = "1"
os.environ["TF_NUM_INTRAOP_THREADS"] = "1"
# ──────────────────────────────────────────────────────────────────────────────

import logging
from dotenv import load_dotenv

log = logging.getLogger("module1.classifier")
# logging.basicConfig(level=logging.DEBUG)

load_dotenv()
E5_MODEL_ID = "intfloat/multilingual-e5-base"


# ── BertModel singleton ───────────────────────────────────────────────────────

class _BertModel:
    """Singleton holding the local encoder used for uniqueness embeddings."""

    _instance: "_BertModel | None" = None

    def __init__(self) -> None:
        # Imports remain inside the init to delay loading until needed
        from sentence_transformers import SentenceTransformer
        log.info("ml_classifier: loading encoder %s", E5_MODEL_ID)
        self._encoder = SentenceTransformer(E5_MODEL_ID)

        log.info("ml_classifier: encoder loaded successfully")

    @classmethod
    def get(cls) -> "_BertModel | None":
        if cls._instance is None:
            try:
                cls._instance = _BertModel()
            except Exception as exc:
                log.warning(
                    "ml_classifier: failed to load models — %s", exc,
                    extra={"code": "MOD1_ML_LOAD_FAIL"},
                )
                cls._instance = None  # type: ignore[assignment]
        return cls._instance

    @property
    def encoder(self):
        return self._encoder

