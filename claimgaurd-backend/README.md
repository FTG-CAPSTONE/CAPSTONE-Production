# ClaimGuard — Backend

Python/FastAPI backend for the ClaimGuard claims intelligence platform.

> **See the root [`README.md`](../README.md) for full project setup including database creation, frontend startup, and seeding.**

---

## Running Locally

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12 | system or pyenv |
| uv | latest | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| PostgreSQL | 16 | running locally (`pg_isready` should return OK) |
| Redis | 7 | running locally (`redis-cli ping` should return PONG) |

### First-time setup

```bash
export PATH="$HOME/.local/bin:$PATH"
cd claimgaurd-backend

# 1. Create virtual environment (Python 3.12)
uv venv --python 3.12

# 2. Install all dependencies
uv pip install -r requirements.txt

# 3. Create the database and user (run once as postgres superuser)
psql -U postgres -c "CREATE USER claimguard WITH ENCRYPTED PASSWORD 'cg_secure_2026';"
psql -U postgres -c "CREATE DATABASE claimguard OWNER claimguard;"

# 4. Copy the dev environment file
cp .env.example .env
# .env already has the correct local defaults — no edits needed for dev

# 5. Run Alembic migrations (creates all 22 tables)
.venv/bin/alembic upgrade head
```

### Start the API server

```bash
export PATH="$HOME/.local/bin:$PATH"
cd claimgaurd-backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

| URL | Purpose |
|-----|---------|
| http://localhost:8000 | API root |
| http://localhost:8000/docs | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc reference |
| http://localhost:8000/health | Health check |
| http://localhost:8000/metrics | Prometheus metrics |

### Start Celery (optional — needed for background ETL/ML jobs)

Open two additional terminals from the `claimgaurd-backend/` directory:

```bash
# Terminal 2 — Celery worker
export PATH="$HOME/.local/bin:$PATH"
.venv/bin/celery -A workers.celery_app worker \
  --loglevel=info \
  -Q default,etl,ml,notifications \
  --concurrency=2
```

```bash
# Terminal 3 — Celery beat scheduler
export PATH="$HOME/.local/bin:$PATH"
.venv/bin/celery -A workers.celery_app beat --loglevel=info
```

> **Without Celery:** ETL can be triggered synchronously via `POST /api/ingestion/batch/process-pending` — no background workers needed for basic dev.

### Start MinIO (optional — needed for document uploads only)

```bash
docker run -d --name claimguard-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

MinIO console: http://localhost:9001 (minioadmin / minioadmin). Leave this out if you don't need document storage — the rest of the app works fine without it.

### Seed dev data

With the API running:

```bash
# Create 100 synthetic Kenya motor insurance claims
curl -s -X POST http://localhost:8000/api/ingestion/dev/seed \
  -H "Content-Type: application/json" \
  -d '{"count": 100}' | python3 -m json.tool

# Run ETL pipeline on all pending intakes
curl -s -X POST http://localhost:8000/api/ingestion/batch/process-pending | python3 -m json.tool
```

This populates cases, rule evaluations, ML predictions, and the HITL queue so the frontend has data to show.

### Create your first user

```bash
curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "full_name": "Admin User", "email": "admin@local.dev", "password": "Admin@1234", "role": "admin"}' \
  | python3 -m json.tool
```

Then log in via `POST /api/auth/login` (OAuth2 form data) or directly from the frontend at http://localhost:3000/login.

### Full Docker stack (alternative)

Runs API + Celery + PostgreSQL + Redis + MinIO all together:

```bash
cd claimgaurd-backend/docker
docker compose up -d          # starts everything
docker compose logs -f api    # watch API logs
docker compose down           # stop (data preserved)
docker compose down -v        # stop and wipe all data
```

The `docker-compose.yml` also runs `alembic upgrade head` automatically before starting the API.

---

## Module Layout

```
app/
├── core/          config, security (JWT + bcrypt), db sessions, FastAPI deps
├── users/         auth endpoints, user/role CRUD
├── integration/   InsureMaster adapter (faker dev mode / live stub)
├── ingestion/     webhook receiver, batch upload, dev/seed endpoint
├── etl/           validate → transform → enrich → features → quality gate
├── rules/         8 motor rules engine (hard-fail + soft-flag)
├── ml/            XGBoost trainer, scorer, SHAP explainer, model registry
├── hitl/          review queue, investigations, decision recording
├── cases/         case CRUD, detail, decision, similar cases
├── analytics/     portfolio KPI aggregations
├── quality/       data quality event tracking
└── audit/         case event timeline search

synth/             Faker synthetic data (Kenya motor insurance)
workers/           Celery app + beat schedule
migrations/        Alembic migration scripts
```

---

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create user |
| `POST` | `/api/auth/login` | OAuth2 login → JWT |
| `GET` | `/api/cases` | Case list (filterable) |
| `GET` | `/api/cases/{id}` | Full case detail + SHAP + rules + events |
| `POST` | `/api/cases/{id}/decision` | Record human decision |
| `GET` | `/api/hitl/queue` | Priority-sorted HITL queue |
| `POST` | `/api/hitl/investigations` | Open investigation |
| `POST` | `/api/ingestion/dev/seed` | Seed synthetic claims (dev only) |
| `POST` | `/api/ingestion/batch/process-pending` | Trigger ETL on all pending intakes |
| `POST` | `/api/ml/retrain` | Train new XGBoost challenger |
| `PATCH` | `/api/ml/model-registry/{id}/promote` | Promote challenger → champion |
| `GET` | `/api/analytics/overview` | Portfolio KPIs |
| `GET` | `/api/audit` | Audit trail search |

Full catalogue at **http://localhost:8000/docs**.

---

## ETL Pipeline

Each ingested claim runs through this synchronous chain:

```
validate → transform → enrich → feature engineering (25 features)
→ rules engine (8 rules) → ML scoring (XGBoost + SHAP)
→ route: auto_approved | auto_rejected | in_review (HITL queue)
```

Run pending claims manually (dev, no Celery/Redis needed):

```python
from app.etl.tasks import run_etl_sync
from app.core.db import SyncSessionLocal
from sqlalchemy import select
from app.ingestion.models import RawIntake
import app.users.models, app.cases.models, app.ml.models
import app.hitl.models, app.quality.models, app.rules.models, app.ingestion.models

db = SyncSessionLocal()
rows = db.execute(select(RawIntake).where(RawIntake.etl_status=='pending')).scalars().all()
db.close()
for r in rows:
    run_etl_sync(str(r.id))
```

---

## ML Pipeline

1. Seed claims and process them through ETL (creates labeled `feature_snapshot` rows)
2. `POST /api/ml/retrain` — trains XGBoost on all labeled snapshots, registers as challenger
3. Review metrics in ML Admin Portal (`/ml-admin` on frontend)
4. `PATCH /api/ml/model-registry/{id}/promote` — manually promote to champion
5. New claims will now be scored automatically during ETL

Model artifacts are saved to `/tmp/claimguard_models/` in development.

---

## Database

- **User:** `claimguard` / **Password:** `cg_secure_2026`
- **Database:** `claimguard`
- **Host:** `127.0.0.1:5432`
- **22 tables** — see `migrations/versions/001_initial_schema.py` for the full schema

Run migrations:
```bash
export PATH="$HOME/.local/bin:$PATH"
.venv/bin/alembic upgrade head
```

---

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Default | Note |
|----------|---------|------|
| `SECRET_KEY` | `changeme-dev-key-...` | **Change before any real deployment** |
| `DATABASE_URL` | `postgresql+psycopg2://claimguard:cg_secure_2026@127.0.0.1:5432/claimguard` | Sync URL |
| `ASYNC_DATABASE_URL` | `postgresql+asyncpg://...` | Async URL for FastAPI endpoints |
| `INSUREMASTER_MODE` | `faker` | Set to `live` when real InsureMaster access exists |
| `ENABLE_DEV_SEED_ENDPOINT` | `true` | **Must be `false` with real data** |

---

## Roles

| Role | Access |
|------|--------|
| `admin` | Full access |
| `adjuster` | Claims decisions, HITL queue |
| `underwriter` | Underwriting decisions |
| `investigator` | Investigations, HITL queue |
| `ml_admin` | Model registry, retrain, promote |
| `compliance` | Audit trail, quality reports |
| `corporate_risk` | Corporate workspace (Phase 2) |
| `viewer` | Read-only |
