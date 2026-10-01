FROM python:3.12-slim

WORKDIR /app

# ─── Runtime environment variables ───────────────────────────────────────────
# Override at deploy time with: docker run -e GROQ_API_KEY=your-key, set
# FORECAST_ENGINE=groq, or set FORECAST_ENGINE=bilstm once its artifact exists.
ENV XGBOOST_MODEL_PATH=/app/models/xgboost_market.json \
    FORECAST_ENGINE=stub \
    GROQ_MODEL=openai/gpt-oss-120b
# GROQ_API_KEY is optional in the default deterministic stub mode and is never
# baked into the image. The stub is contract-compliant, but not a trained model.

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model files (swap real xgboost_market.json at deploy time via volume mount)
COPY models ./models

COPY app ./app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/healthz')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
