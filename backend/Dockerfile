FROM --platform=linux/amd64 python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

# Single worker — in-memory state is per-process.
# Add REDIS_URL env var to enable Redis persistence and scale to multiple workers.
# UvicornWorker handles the ASGI app (FastAPI + python-socketio combined).
CMD ["gunicorn", "main:app", "--workers", "1", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120"]
