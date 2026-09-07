from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Shared declarative base — all models import from here."""
    pass


# ── Sync engine (Alembic migrations + Celery workers) ─────────────────────────
sync_engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.is_development,
)
SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


def get_sync_db() -> Session:  # type: ignore[return]
    """Sync DB session — used by Celery workers."""
    db = SyncSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Async engine (FastAPI request handlers) ────────────────────────────────────
async_engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.is_development,
)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_async_db() -> AsyncSession:  # type: ignore[return]
    """Async DB session — used by FastAPI dependency injection."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """
    Create all tables from metadata.
    Used in development only — production uses Alembic migrations.
    """
    if settings.is_development:
        async with async_engine.begin() as conn:
            # Import all models to ensure they are registered on Base.metadata
            import app.users.models  # noqa: F401
            import app.cases.models  # noqa: F401
            import app.ingestion.models  # noqa: F401
            import app.rules.models  # noqa: F401
            import app.ml.models  # noqa: F401
            import app.hitl.models  # noqa: F401
            import app.quality.models  # noqa: F401

            await conn.run_sync(Base.metadata.create_all)
