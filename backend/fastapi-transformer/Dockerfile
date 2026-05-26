FROM python:3.12-slim

WORKDIR /app

# ─── Runtime environment variables ───────────────────────────────────────────
# Override at deploy time with:  docker run -e GEMINI_API_KEY=your-key  or docker-compose env
ENV XGBOOST_MODEL_PATH=/app/models/xgboost_market.json \
    GEMINI_MODEL=gemini-2.0-flash
# GEMINI_API_KEY — set at runtime, never baked into the image for security.
# When absent the service runs in stub mode (deterministic linear extrapolation).

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model files (swap real xgboost_market.json at deploy time via volume mount)
COPY models ./models

COPY app ./app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/healthz')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
