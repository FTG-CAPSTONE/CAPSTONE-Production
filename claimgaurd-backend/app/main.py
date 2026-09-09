from __future__ import annotations

import re
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.db import init_db

logger = structlog.get_logger()

# ── IP-range CORS patterns ────────────────────────────────────────────────────
# Standard CORSMiddleware only accepts exact origin strings.
# This middleware pre-processes requests whose Origin matches a configured
# IP wildcard pattern and injects the correct CORS headers directly,
# before CORSMiddleware runs. All other origins are handled by CORSMiddleware.

# Each entry is a compiled regex that matches the *host* portion of an origin.
# "176.16.*.*" → matches any port on any 176.16.x.x address.
_CORS_IP_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^176\.16\.\d{1,3}\.\d{1,3}$"),
]


def _origin_matches_ip_pattern(origin: str) -> bool:
    """
    Returns True if the Origin header's host (stripped of scheme/port)
    matches any of the configured IP wildcard patterns.
    """
    # Strip scheme (http:// or https://) and optional port
    match = re.match(r"^https?://([^:/]+)", origin)
    if not match:
        return False
    host = match.group(1)
    return any(p.match(host) for p in _CORS_IP_PATTERNS)


class WildcardIPCORSMiddleware(BaseHTTPMiddleware):
    """
    Handles CORS for origins that match the 176.16.*.* pattern.
    Sits *before* FastAPI's CORSMiddleware in the stack.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")

        if origin and _origin_matches_ip_pattern(origin):
            # Handle preflight
            if request.method == "OPTIONS":
                response = Response(status_code=204)
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Max-Age"] = "3600"
                return response

            response = await call_next(request)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
            return response

        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown logic."""
    logger.info("claimguard.startup", env=settings.APP_ENV)

    # Dev only — create tables if they don't exist (prod uses Alembic)
    if settings.is_development:
        await init_db()
        logger.info("claimguard.db.ready")
    else:
        # Production: tables exist via Alembic, but still seed roles + admin
        from app.core.db import _seed_roles_and_admin
        await _seed_roles_and_admin()
        logger.info("claimguard.db.seed.done")

    yield

    logger.info("claimguard.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="ClaimGuard API",
        description=(
            "Bancassurance-scale claims intelligence and trust layer. "
            "AI-assisted fraud scoring, human-in-the-loop review, and "
            "an auditable decision record for every claim."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Starlette applies add_middleware in reverse order (last-added = outermost).
    # So we add CORSMiddleware first (innermost), then WildcardIPCORSMiddleware
    # (outermost) — ensuring the IP-pattern handler runs before CORSMiddleware
    # can reject a 176.16.*.* origin as "not in the allow list".
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Trace-ID"],
    )
    # Added second = runs first (outermost) — handles 176.16.*.* before CORSMiddleware
    app.add_middleware(WildcardIPCORSMiddleware)

    # ── Request timing middleware ─────────────────────────────────────────────
    @app.middleware("http")
    async def add_timing_header(request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        return response

    # ── Prometheus metrics ────────────────────────────────────────────────────
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    # ── Routers ───────────────────────────────────────────────────────────────
    from app.users.router import auth_router, users_router
    app.include_router(auth_router)
    app.include_router(users_router)

    # Placeholder routers — wired but empty until Phase 2+
    from app.ingestion.router import router as ingestion_router
    app.include_router(ingestion_router)

    from app.cases.router import router as cases_router
    app.include_router(cases_router)

    from app.rules.router import router as rules_router
    app.include_router(rules_router)

    from app.hitl.router import router as hitl_router
    app.include_router(hitl_router)

    from app.ml.router import router as ml_router
    app.include_router(ml_router)

    from app.analytics.router import router as analytics_router
    app.include_router(analytics_router)

    from app.quality.router import router as quality_router
    app.include_router(quality_router)

    from app.audit.router import router as audit_router
    app.include_router(audit_router)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["system"])
    async def health():
        return {
            "status": "ok",
            "env": settings.APP_ENV,
            "insuremaster_mode": settings.INSUREMASTER_MODE,
        }

    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": "ClaimGuard API — visit /docs for the OpenAPI explorer"}

    return app


app = create_app()
