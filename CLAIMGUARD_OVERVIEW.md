# ClaimGuard — AI-Powered Insurance Claims Intelligence Platform

**Bancassurance-scale fraud detection and decision support for the Kenyan motor insurance market.**

---

## What is ClaimGuard?

ClaimGuard is an AI-assisted decision-support platform for the insurance claims lifecycle. It automatically:

1. **Ingests** motor insurance claims from InsureMaster (or synthetic test data)
2. **Validates and enriches** claims with policy history and provider data
3. **Evaluates business rules** to catch obvious fraud patterns
4. **Scores fraud probability** using machine learning (XGBoost)
5. **Explains predictions** with SHAP feature attribution
6. **Routes cases** to auto-approve, auto-reject, or human review
7. **Learns continuously** by feeding human decisions back into model training

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLAIMGUARD SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────────────────────────────────┐ │
│  │   FRONTEND       │     │              BACKEND (FastAPI)               │ │
│  │   Next.js 16     │────▶│                                              │ │
│  │                  │     │  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │ │
│  │  • Dashboard     │     │  │ Ingest  │─▶│   ETL   │─▶│ Rules Engine│  │ │
│  │  • Cases         │     │  │ Claims  │  │ Pipeline│  │  (8 rules)  │  │ │
│  │  • HITL Queue    │     │  └─────────┘  └────┬────┘  └──────┬──────┘  │ │
│  │  • ML Admin      │     │                    │              │         │ │
│  │  • Analytics     │     │                    ▼              ▼         │ │
│  │  • Audit Trail   │     │  ┌─────────────────────────────────────┐    │ │
│  └──────────────────┘     │  │         ML SCORING (XGBoost)       │    │ │
│                           │  │    + SHAP Explainability           │    │ │
│                           │  └──────────────────┬──────────────────┘    │ │
│                           │                     │                       │ │
│                           │                     ▼                       │ │
│                           │  ┌──────────────────────────────────────┐   │ │
│                           │  │         ROUTING DECISION             │   │ │
│                           │  │  • Auto-approve (low risk)           │   │ │
│                           │  │  • Auto-reject (hard rule fail)      │   │ │
│                           │  │  • HITL Queue (needs human review)   │   │ │
│                           │  └──────────────────────────────────────┘   │ │
│                           └──────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         INFRASTRUCTURE                                │  │
│  │  PostgreSQL │ Redis │ Celery Workers │ MinIO (S3) │ Celery Beat     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Pipeline

### 1. Claim Ingestion
```
InsureMaster (or Faker) → Webhook/Batch → RawIntake table → ETL Queue
```

Claims enter via webhook or the dev seed endpoint and are stored in the `raw_intake` table for processing.

### 2. ETL Pipeline

| Step | Description |
|------|-------------|
| **Validate** | Checks required fields, data types, business rules |
| **Transform** | Converts raw payload to canonical `Case` record |
| **Enrich** | Looks up prior claims, provider history, policy details |
| **Feature Engineering** | Computes 25 ML features from case data |
| **Rules Engine** | Evaluates 8 business rules (hard fails + soft flags) |
| **ML Scoring** | XGBoost model predicts fraud probability (0-100) |
| **Routing** | Decides: auto-approve, auto-reject, or HITL queue |

### 3. Routing Decision Logic

```python
if hard_rule_fail:
    status = "auto_rejected"
elif fraud_score < 35 and confidence >= 72% and no_soft_flags:
    status = "auto_approved"
else:
    status = "in_review"  # Goes to HITL queue
```

---

## Business Rules Engine

8 Kenya motor insurance-specific rules:

| Rule | Type | Trigger Condition |
|------|------|-------------------|
| `AMOUNT_OVER_LIMIT` | Hard Fail | Claim exceeds policy sum insured |
| `MISSING_MANDATORY_DOCUMENT` | Hard Fail | Document completeness < 60% |
| `DUPLICATE_CLAIM_NUMBER` | Hard Fail | OB number already used |
| `QUICK_CLAIM_AFTER_INCEPTION` | Soft Flag | Claim within 14 days of policy start |
| `PROVIDER_BILLING_SPIKE` | Soft Flag | Repairer has >15 claims in 30 days |
| `ROUND_NUMBER_AMOUNT` | Soft Flag | Suspicious round amount (≥ KES 50K) |
| `LATE_REPORTING` | Soft Flag | Reported >30 days after incident |
| `REPEAT_CLAIMANT` | Soft Flag | Policyholder has 3+ prior claims |

- **Hard Fail** → Automatic rejection
- **Soft Flag** → Routes to human review

---

## Machine Learning Pipeline

### Model: XGBoost Classifier

**25 Features Used:**

| Category | Features |
|----------|----------|
| **Temporal** | days_since_inception, days_to_report, policy_age_days, vehicle_age_years, weekend_incident, hour_of_report |
| **Amount** | amount_claimed, claim_to_limit_ratio, amount_over_limit, is_round_number, claim_amount_log |
| **Provider** | provider_claim_count_30d, provider_claim_count_90d, provider_claim_amount_30d |
| **History** | prior_claims_count, prior_claims_total_amount, prior_motor_claims_count |
| **Documents** | document_completeness_score, has_police_abstract, has_valuers_report, has_repair_quotation |
| **Categorical** | claim_type_encoded, motor_class_encoded, county_risk_tier, ob_number_duplicate |

### Model Lifecycle

```
Train → Challenger (pending review) → Champion (approved) → Archived
```

- Models are trained on labeled data (human decisions + synthetic fraud labels)
- Challengers must beat minimum AUC floor (0.60) to be registered
- ML Admin reviews metrics and promotes challengers to champion
- Only the champion model is used for production scoring

### Explainability (SHAP)

Every prediction includes the top 5 features driving the fraud score, displayed visually in the UI.

---

## Human-in-the-Loop (HITL)

Cases that cannot be auto-decided are routed to the HITL queue:

### Priority Scoring
```
Priority = fraud_score × (amount_claimed / 10,000) × (1 / confidence)
```

Higher fraud scores, larger amounts, and lower confidence = higher priority.

### Review Workflow

1. **Queue** — Reviewers see priority-sorted cases
2. **Assign** — Claim to self or specific reviewer
3. **Investigate** — Open formal investigation if needed
4. **Decide** — Approve, Decline, Escalate, or Request Documents
5. **Feedback** — Decision feeds back into ML training data

---

## Tech Stack

### Backend (`claimgaurd-backend`)

| Layer | Technology |
|-------|------------|
| Language | Python 3.12 |
| API Framework | FastAPI |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Background Jobs | Celery + Redis |
| Database | PostgreSQL 16 |
| ML | XGBoost + SHAP |
| Object Storage | MinIO (S3-compatible) |
| Synthetic Data | Faker (Kenya-specific) |

### Frontend (`claimgaurd-frontend`)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| Data Fetching | React Query (TanStack) |
| Charts | Recharts |
| State Management | Zustand |
| Animations | Motion (Framer) |

### Infrastructure

| Service | Purpose | Port |
|---------|---------|------|
| PostgreSQL 16 | Primary database | 5432 |
| Redis 7 | Celery broker + cache | 6379 |
| MinIO | Document storage (S3-compatible) | 9000 |
| Celery Worker | Background ETL, ML, notifications | — |
| Celery Beat | Scheduled tasks (SLA alerts) | — |

---

## Database Schema

### Core Entities

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Party       │     │     Vehicle     │     │     Policy      │
│ (individuals,   │◄────│  (registration, │◄────│ (coverage,      │
│  providers)     │     │   make/model)   │     │  sum_insured)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        │
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   RawIntake     │────▶│      Case       │────▶│   CaseEvent     │
│ (landing table) │     │ (main record)   │     │ (audit trail)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ RuleEvaluation│       │ MLPrediction  │       │ReviewQueueItem│
│ (8 rules)     │       │ (+SHAP values)│       │ (HITL queue)  │
└───────────────┘       └───────────────┘       └───────────────┘
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `app_user` | Users with roles (admin, adjuster, viewer) |
| `party` | Individuals (policyholders) and providers (repairers) |
| `vehicle` | Vehicle details (registration, make, model) |
| `policy` | Insurance policies with coverage details |
| `case` | Main claim record with fraud scores |
| `case_event` | Immutable audit trail (append-only) |
| `raw_intake` | Landing table for incoming claims |
| `rule_evaluation` | Results of 8 business rules per case |
| `ml_prediction` | Fraud scores with SHAP explanations |
| `model_registry` | Champion/challenger models with metrics |
| `review_queue_item` | HITL queue with priority scores |
| `investigation` | Formal investigation records |

---

## API Endpoints

### Authentication
| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/register` | Create user account |
| `POST /api/auth/login` | OAuth2 login → JWT tokens |
| `POST /api/auth/refresh` | Refresh access token |
| `GET /api/auth/me` | Current user info |

### Cases
| Endpoint | Purpose |
|----------|---------|
| `GET /api/cases` | List cases (filterable by status) |
| `GET /api/cases/{id}` | Full case detail with rules, audit |
| `POST /api/cases/{id}/decision` | Record human decision |
| `POST /api/cases/{id}/documents` | Upload document |
| `GET /api/cases/{id}/evidence-export` | Download PDF evidence pack |

### HITL
| Endpoint | Purpose |
|----------|---------|
| `GET /api/hitl/queue` | Priority-sorted review queue |
| `POST /api/hitl/queue/{id}/assign-me` | Assign case to self |
| `POST /api/hitl/investigations` | Open investigation |
| `POST /api/hitl/investigations/{id}/close` | Close with outcome |

### ML
| Endpoint | Purpose |
|----------|---------|
| `GET /api/ml/predictions/{id}` | Fraud score + SHAP for case |
| `GET /api/ml/model-registry` | List all models |
| `POST /api/ml/retrain` | Train new challenger model |
| `PATCH /api/ml/model-registry/{id}/promote` | Promote to champion |

### Analytics
| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics/overview` | Portfolio KPIs |
| `GET /api/analytics/fraud-trend` | Daily fraud score trend |
| `GET /api/analytics/sla-compliance` | Monthly SLA metrics |
| `GET /api/analytics/provider-heatmap` | Provider risk profiles |

### Ingestion
| Endpoint | Purpose |
|----------|---------|
| `POST /api/ingestion/insuremaster/claims` | Webhook for claims |
| `POST /api/ingestion/dev/seed` | Generate synthetic data |
| `POST /api/ingestion/batch/process-pending` | Trigger ETL for all pending |

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/login` | JWT authentication |
| `/dashboard` | Portfolio KPIs, backend health, auto-decision rate |
| `/cases` | Filterable case list |
| `/cases/[id]` | Full case detail: fraud score gauge, SHAP explanation, rules, documents, decision form |
| `/hitl` | Human review queue |
| `/investigations` | Investigation management |
| `/ml-admin` | Model registry, retrain, promote/reject |
| `/analytics` | Fraud trends, SLA compliance, provider heatmap |
| `/quality` | Data quality summary |
| `/audit` | Full audit trail search |

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12 |
| Node.js | 20+ |
| pnpm | latest |
| Docker | 24+ |

### 1. Start Infrastructure

```bash
cd docker
docker-compose up -d
```

### 2. Start Backend

```bash
cd claimgaurd-backend
uv venv --python 3.12
uv pip install -r requirements.txt
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start Frontend

```bash
cd claimgaurd-frontend
pnpm install
pnpm dev
```

### 4. Create Admin User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","full_name":"Admin User","password":"admin1234","role":"admin"}'
```

### 5. Seed Test Data

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -d "username=admin&password=admin1234" | jq -r '.access_token')

# Seed 50 policyholders with 10% fraud rate
curl -X POST "http://localhost:8000/api/ingestion/dev/seed" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"policyholders": 50, "fraud_rate": 0.10, "seed": 42}'

# Process all claims through ETL pipeline
curl -X POST "http://localhost:8000/api/ingestion/batch/process-pending" \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Train ML Model

```bash
curl -X POST http://localhost:8000/api/ml/retrain \
  -H "Authorization: Bearer $TOKEN"
```

Then visit http://localhost:3000/ml-admin to review and promote the challenger model.

---

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (sync) |
| `ASYNC_DATABASE_URL` | PostgreSQL connection (async) |
| `SECRET_KEY` | JWT signing key |
| `REDIS_URL` | Redis connection |
| `CELERY_BROKER_URL` | Celery broker |
| `INSUREMASTER_MODE` | `faker` (dev) or `live` (prod) |
| `ENABLE_DEV_SEED_ENDPOINT` | `true` in dev, `false` in prod |

### Frontend (`.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL (default: http://localhost:8000) |

---

## Build Phases

| Phase | Status | Summary |
|-------|--------|---------|
| 1 — Foundation | ✅ Complete | Schema, auth/RBAC, adapters, Docker |
| 2 — Ingestion + ETL + Rules | ✅ Complete | Faker synth, ETL chain, 8 rules, 25 features |
| 3 — ML + HITL | ✅ Complete | XGBoost + SHAP, HITL queue, ML Admin |
| 4 — Analytics + Notifications | 🔄 Partial | Dashboards done, email/SMS pending |
| 5 — Hardening + Extras | ⏳ Pending | PDF export, NLP, prod checklist |

---

## Compliance Notes

- **Kenya DPA**: Confirm Kenya-region hosting before any real-data pilot
- **Audit Trail**: All decisions are permanently logged in `case_event` table
- **Synthetic Data**: Development uses Faker-generated data, no real PII
- **ENABLE_DEV_SEED_ENDPOINT**: Must be `false` in any production environment

---

## License

Internal project — Bancassurance claims intelligence platform.
