# Backend image — FastAPI served by uvicorn.
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Data (SQLite db + uploaded documents) lives here; mount a volume in production.
RUN mkdir -p /app/data/documents

EXPOSE 8000

# Seed on first boot (idempotent), then start the server.
CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
