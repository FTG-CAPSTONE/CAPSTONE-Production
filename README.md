# ClaimGuard

AI-assisted claims intelligence platform for bancassurance. Ingests motor insurance claims, runs a rules engine and XGBoost fraud scorer, routes high-risk cases to human review, and gives adjusters a full decision audit trail.

---

## Project Structure

```
claim-gaurd/
├── claimgaurd-backend/   Python/FastAPI API + Celery workers + ML pipeline
├── claimgaurd-frontend/  Next.js 16 / React 19 / TypeScript dashboard
└── backend/              Java microservices (future architecture — all placeholder files)
```

---

## Quick Start — Local Dev

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.12 | `python3 --version` |
| uv | latest | `uv --version` |
| Node.js | 18+ | `node --version` |
| pnpm | 8+ | `pnpm --version` |
| PostgreSQL | 16 | `pg_isready` |
| Redis | 7 | `redis-cli ping` |

Install `uv` if missing:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

---

## 1. Database Setup (one-time)

```bash
# Create the database user and database
psql -U postgres -c "CREATE USER claimguard WITH ENCRYPTED PASSWORD 'cg_secure_2026';"
psql -U postgres -c "CREATE DATABASE claimguard OWNER claimguard;"
```

---

## 2. Backend

```bash
export PATH="$HOME/.local/bin:$PATH"
cd claimgaurd-backend

# First time only
uv venv --python 3.12
uv pip install -r requirements.txt
cp .env.example .env          # dev defaults are already correct — no edits needed

# Apply database migrations (22 tables)
.venv/bin/alembic upgrade head

# Start the API server
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

| URL | Purpose |
|-----|---------|
| http://localhost:8000 | API root |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/health | Health check |

**Optional — Celery workers** (needed for background ETL/ML, not for basic dev):

```bash
# Terminal 2: worker
.venv/bin/celery -A workers.celery_app worker \
  --loglevel=info -Q default,etl,ml,notifications --concurrency=2

# Terminal 3: beat scheduler
.venv/bin/celery -A workers.celery_app beat --loglevel=info
```

---

## 3. Frontend

```bash
cd claimgaurd-frontend
pnpm install
cp .env.local.example .env.local   # points NEXT_PUBLIC_API_BASE_URL at localhost:8000
pnpm dev
```

Frontend: **http://localhost:3000**

> The backend must be running on port 8000 before the frontend will work.

---

## 4. Seed Dev Data

With the backend running, create a user and load synthetic claims:

```bash
# Create admin user
curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","full_name":"Admin User","email":"admin@local.dev","password":"Admin@1234","role":"admin"}' \
  | python3 -m json.tool

# Seed 100 synthetic Kenya motor insurance claims
curl -s -X POST http://localhost:8000/api/ingestion/dev/seed \
  -H "Content-Type: application/json" \
  -d '{"count": 100}' | python3 -m json.tool

# Run ETL pipeline — validates, scores, and routes all pending claims
curl -s -X POST http://localhost:8000/api/ingestion/batch/process-pending \
  | python3 -m json.tool
```

This populates cases, fraud scores, rule evaluations, and the HITL review queue.

---

## 5. Full Docker Stack (alternative to steps 1–4)

Starts API + Celery + PostgreSQL + Redis + MinIO in one command:

```bash
cd claimgaurd-backend/docker
docker compose up -d

# Watch logs
docker compose logs -f api

# Stop (keeps data)
docker compose down

# Stop and wipe everything
docker compose down -v
```

Migrations run automatically. The API will be on http://localhost:8000 and the database on port 5432.

---

## Dev URLs at a Glance

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | Next.js dev server |
| API | http://localhost:8000 | FastAPI + uvicorn |
| Swagger UI | http://localhost:8000/docs | Full API explorer |
| Metrics | http://localhost:8000/metrics | Prometheus |
| MinIO console | http://localhost:9001 | minioadmin / minioadmin (if running) |

---

## User Roles

| Role | Access |
|------|--------|
| `admin` | Full access |
| `adjuster` | Claims decisions, HITL queue |
| `underwriter` | Underwriting decisions |
| `investigator` | Investigations, HITL queue |
| `ml_admin` | Model registry, retrain, promote |
| `compliance` | Audit trail, quality reports |
| `viewer` | Read-only |

---

## Key Environment Variables

Both `.env.example` (backend) and `.env.local.example` (frontend) have correct dev defaults. The only variables you'd need to change for local development:

| File | Variable | When to change |
|------|----------|----------------|
| `claimgaurd-backend/.env` | `DATABASE_URL` | If your Postgres is on a non-default host/port |
| `claimgaurd-backend/.env` | `SECRET_KEY` | Before any deployment outside localhost |
| `claimgaurd-backend/.env` | `ENABLE_DEV_SEED_ENDPOINT` | Set to `false` before touching real data |
| `claimgaurd-frontend/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | If backend runs on a different port |

---

## Further Reading

- [`claimgaurd-backend/README.md`](claimgaurd-backend/README.md) — backend module layout, ETL pipeline, ML pipeline, all endpoints, Docker details
- [`claimgaurd-frontend/README.md`](claimgaurd-frontend/README.md) — frontend pages, known simplifications, build verification notes
