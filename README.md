# ClaimGuard — Backend

Python/FastAPI backend for the ClaimGuard claims intelligence platform.

> **See the root [`README.md`](../README.md) for full project setup including database creation, frontend startup, and seeding.**

---

## Start

```bash
export PATH="$HOME/.local/bin:$PATH"
cd claimgaurd-backend

# First time only
uv venv --python 3.12
uv pip install -r requirements.txt
cp .env.example .env
alembic upgrade head

# Start the API server
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API: **http://localhost:8000**
- Swagger docs: **http://localhost:8000/docs**
- Health check: `GET /health`

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
