FROM --platform=linux/amd64 python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run as an unprivileged user — nothing here needs root at runtime.
RUN useradd --system --no-create-home app
USER app

EXPOSE 8000

# Single process — in-memory state is per-process, so App Runner must also be
# pinned to one instance (see DEPLOYMENT.md). --proxy-headers with
# --forwarded-allow-ips=* trusts App Runner's X-Forwarded-For so request.client
# is the real client IP; the container is only reachable through that proxy.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
