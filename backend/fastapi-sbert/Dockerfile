FROM python:3.12-slim

WORKDIR /app

# GROQ_API_KEY — set at runtime via docker-compose env.
# When absent the service runs without LLM (caption agent and feedback unavailable).
# CPU-only torch first: the default Linux wheel that sentence-transformers would
# pull in bundles CUDA libraries, adding several GB to an image that only ever
# runs on CPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install dependencies first (layer-cached separately from app code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
