# ── Stage: Runtime image ──────────────────────────────────────────────────────
# python:3.11-slim keeps the image lean while matching our local dev Python.
FROM python:3.11-slim

WORKDIR /app

# ── Layer 1: System deps (curl needed for the docker-compose healthcheck) ─────
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# ── Layer 2: Python dependencies ─────────────────────────────────────────────
# Copied first so Docker cache keeps this layer when only app code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Layer 3: Pre-download the SentenceTransformer model weights ───────────────
# Baking the ~280 MB model into the image means:
#   • No runtime download → works in air-gapped / firewall-restricted envs
#   • Container startup is deterministic and fast
#   • Model layer is cached separately from code — code changes don't re-download
#
# HF_HOME controls where sentence-transformers caches downloaded weights.
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
print('Downloading intfloat/multilingual-e5-base ...'); \
SentenceTransformer('intfloat/multilingual-e5-base'); \
print('Download complete.')"

# ── Layer 4: Application code (last — so code edits only invalidate this layer)
COPY app ./app

EXPOSE 8000

# Single worker is correct here: TensorFlow/Keras is not fork-safe.
# Scale horizontally with multiple containers instead of multiple workers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
