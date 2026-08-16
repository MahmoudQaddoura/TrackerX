# Backend image — FastAPI served by uvicorn.
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Data (SQLite db + uploaded documents) lives here; mount a volume in production.
RUN addgroup --system trackerx \
    && adduser --system --ingroup trackerx trackerx \
    && mkdir -p /app/data/documents \
    && chown -R trackerx:trackerx /app

USER trackerx

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

# Validate production secrets, bootstrap the first administrator on an empty
# database, and then hand PID 1 to uvicorn for clean container shutdowns.
CMD ["sh", "-c", "python -m app.bootstrap && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
