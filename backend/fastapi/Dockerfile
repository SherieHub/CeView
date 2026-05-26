FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Pre-download E5 model into the image so first inference isn't slow.
# The || true makes the build succeed even when HuggingFace is unreachable
# (e.g. air-gapped CI, proxy issues). The model downloads on first inference instead.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')" \
    || echo "WARNING: multilingual-e5-base pre-download skipped — will download on first inference"
COPY models ./models
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
