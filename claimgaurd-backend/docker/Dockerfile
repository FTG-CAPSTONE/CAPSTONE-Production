FROM python:3.12-slim

LABEL maintainer="ClaimGuard <dev@claimguard.co.ke>"

WORKDIR /app

# System deps for psycopg2 and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create non-root user
RUN addgroup --system claimguard && adduser --system --ingroup claimguard claimguard
RUN chown -R claimguard:claimguard /app
USER claimguard

EXPOSE 8000

# Default: run the API server
# Override CMD for worker/beat containers:
#   worker: celery -A workers.celery_app worker --loglevel=info -Q default,etl,ml
#   beat:   celery -A workers.celery_app beat --loglevel=info
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
