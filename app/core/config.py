from __future__ import annotations

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_parse_none_str="null",
    )

    # ── Application ────────────────────────────────────────
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme-dev-key-replace-before-any-deployment"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Stored as a raw string; use the cors_origins property for the parsed list
    CORS_ORIGINS_STR: str = "http://localhost:3000,http://localhost:3001"

    @property
    def CORS_ORIGINS(self) -> List[str]:  # noqa: N802
        v = self.CORS_ORIGINS_STR.strip()
        if v.startswith("["):
            import json
            return json.loads(v)
        return [o.strip() for o in v.split(",") if o.strip()]

    # ── Database ───────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+psycopg2://claimguard:claimguard_dev@localhost:5432/claimguard"
    )
    ASYNC_DATABASE_URL: str = (
        "postgresql+asyncpg://claimguard:claimguard_dev@localhost:5432/claimguard"
    )

    # ── Redis / Celery ─────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── Object Storage ─────────────────────────────────────
    OBJECT_STORAGE_ENDPOINT: str = "http://localhost:9000"
    OBJECT_STORAGE_ACCESS_KEY: str = "minioadmin"
    OBJECT_STORAGE_SECRET_KEY: str = "minioadmin"
    OBJECT_STORAGE_BUCKET: str = "claimguard-docs"
    OBJECT_STORAGE_USE_SSL: bool = False

    # ── InsureMaster Integration ───────────────────────────
    INSUREMASTER_MODE: str = "faker"  # "faker" | "live"
    INSUREMASTER_BASE_URL: str = ""
    INSUREMASTER_API_KEY: str = ""

    # ── Dev Seed ───────────────────────────────────────────
    ENABLE_DEV_SEED_ENDPOINT: bool = True

    # ── Notifications ──────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    NOTIFICATION_FROM_EMAIL: str = "noreply@claimguard.co.ke"

    AT_API_KEY: str = "changeme"
    AT_USERNAME: str = "sandbox"
    AT_SENDER_ID: str = "ClaimGuard"

    # ── Kafka (Phase 2) ────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


settings = Settings()
