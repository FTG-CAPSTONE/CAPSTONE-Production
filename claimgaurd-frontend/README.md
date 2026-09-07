# ClaimGuard Frontend

Next.js 16 / React 19 / TypeScript / Tailwind frontend for ClaimGuard, built against the verified
`claimguard-backend` API contract. **This has been built and tested against a live instance of that
backend in this session** — not just scaffolded: `npm run build` passes clean, all 9 routes render,
CORS was confirmed against real cross-origin requests, and the API response shapes were verified
byte-for-byte against `lib/types.ts`.

## Pages
| Route | Purpose |
|---|---|
| `/login` | Auth (JWT via `POST /api/auth/login`) |
| `/dashboard` | Portfolio KPIs |
| `/cases` | Case queue, filterable by status |
| `/cases/[id]` | Case detail: SHAP explanation, rules triggered, decision form, live audit trail |
| `/hitl` | Prioritized human review queue |
| `/ml-admin` | Model overview, registry compare/approve/reject, training runs, manual retrain |
| `/analytics` | Charts (cases by line of business, by status) |
| `/quality` | Data quality pass/fail summary |

## Run it

```bash
npm install
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_BASE_URL at your backend
npm run dev
```

Requires the backend running (`uvicorn app.main:app` from `claimguard-backend/`, default `:8000`).

## Verified in this session
- `npm run build` — clean production build, all routes compile (one real bug caught and fixed:
  a `/** ... */` comment containing the literal substring `app/*/router.py` closed the block
  comment early at the embedded `*/`, breaking `lib/types.ts` — reworded to avoid it).
- Backend started on `:8000`, frontend dev server on `:3000`; confirmed `access-control-allow-origin`
  is present on cross-origin API responses.
- Fetched `/api/analytics/overview`, `/api/hitl/queue`, and `/api/cases/{id}` live and confirmed
  every field matches `lib/types.ts` exactly, including the "no champion model registered yet"
  fallback state (`confidence: 0.0`, a `note` instead of `feature`/`impact` in `top_features`) that
  `components/shap-explanation.tsx` is specifically written to handle.
- A full browser (Playwright/Chromium) click-through could **not** be run in this sandbox — browser
  binary installation was blocked by network egress restrictions unrelated to the app code. The
  verification above (build + live API contract matching) is real but is not a substitute for an
  actual click-through; do that manually before treating this as demo-ready.

## Known simplifications (MVP scaffold, not production-final)
- **Auth token is stored in `sessionStorage`**, attached via an axios interceptor. The backend
  architecture plan calls for an httpOnly-cookie pattern proxied through a Next.js route handler
  instead — this scaffold uses the simpler approach to get the full loop working end-to-end first;
  swap this out before any real deployment (sessionStorage is readable by any script on the page,
  i.e. vulnerable to XSS token theft in a way httpOnly cookies are not).
- No investigation-workspace page yet (`POST /api/hitl/investigations` exists on the backend and is
  unused by the frontend so far).
- No document viewer — `documents` on a claim are backend-modeled but not yet rendered/fetchable
  from the UI (object storage read/write isn't wired up on the backend either — see the backend
  README's "what's deliberately not implemented yet").
- Charts are two simple bar charts; the richer analytics envisioned in the architecture docs
  (control charts, model performance over time) are not yet built.
