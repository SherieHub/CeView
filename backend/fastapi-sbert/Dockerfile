FROM python:3.12-slim

WORKDIR /app

# GEMINI_API_KEY — set at runtime via docker-compose env.
# When absent the service runs without LLM (caption agent and feedback unavailable).
# Install dependencies first (layer-cached separately from app code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Models are mounted at runtime via docker-compose volume (./fastapi-sbert/models:/app/models:ro)
# This placeholder keeps the COPY layer from failing when the directory is empty.
COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
