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
_KERAS_PATH = os.environ.get(
    "KERAS_MODEL_PATH", "/app/models/complete_classifier_head.keras"
)
E5_MODEL_ID = "intfloat/multilingual-e5-base"
CATEGORY_THRESHOLD = 0.5


# ── BertModel singleton ───────────────────────────────────────────────────────

class _BertModel:
    """Singleton holding the encoder and Keras classifier head."""

    _instance: "_BertModel | None" = None

    def __init__(self) -> None:
        # Imports remain inside the init to delay loading until needed
        from sentence_transformers import SentenceTransformer
        import tensorflow as tf

        log.info("ml_classifier: loading encoder %s", E5_MODEL_ID)
        self._encoder = SentenceTransformer(E5_MODEL_ID)

        log.info("ml_classifier: loading Keras classifier from %s", _KERAS_PATH)
        self._classifier = tf.keras.models.load_model(_KERAS_PATH)

        log.info("ml_classifier: both models loaded successfully")

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

    @property
    def classifier(self):
        return self._classifier