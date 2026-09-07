from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.users.models import AppRole, AppUser
from app.users.schemas import UserCreate, UserUpdate


# ── Role helpers ──────────────────────────────────────────────────────────────

async def get_role_by_name(db: AsyncSession, name: str) -> Optional[AppRole]:
    result = await db.execute(select(AppRole).where(AppRole.name == name))
    return result.scalar_one_or_none()


async def get_all_roles(db: AsyncSession) -> list[AppRole]:
    result = await db.execute(select(AppRole).order_by(AppRole.name))
    return list(result.scalars().all())


# ── User CRUD ─────────────────────────────────────────────────────────────────

async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[AppUser]:
    result = await db.execute(
        select(AppUser)
        .options(selectinload(AppUser.role_obj))
        .where(AppUser.id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[AppUser]:
    result = await db.execute(
        select(AppUser)
        .options(selectinload(AppUser.role_obj))
        .where(AppUser.username == username.lower())
    )
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[AppUser]:
    result = await db.execute(
        select(AppUser)
        .options(selectinload(AppUser.role_obj))
        .where(AppUser.email == email)
    )
    return result.scalar_one_or_none()


async def get_users(
    db: AsyncSession, skip: int = 0, limit: int = 50
) -> list[AppUser]:
    result = await db.execute(
        select(AppUser)
        .options(selectinload(AppUser.role_obj))
        .order_by(AppUser.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_user(db: AsyncSession, data: UserCreate) -> AppUser:
    role = await get_role_by_name(db, data.role)
    if role is None:
        # Fallback to viewer if role doesn't exist yet
        role = await get_role_by_name(db, "viewer")

    user = AppUser(
        username=data.username.lower(),
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role_id=role.id if role else None,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user, ["role_obj"])
    return user


async def update_user(
    db: AsyncSession, user: AppUser, data: UserUpdate
) -> AppUser:
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.role is not None:
        role = await get_role_by_name(db, data.role)
        if role:
            user.role_id = role.id

    db.add(user)
    await db.flush()
    await db.refresh(user, ["role_obj"])
    return user


async def deactivate_user(db: AsyncSession, user: AppUser) -> AppUser:
    user.is_active = False
    db.add(user)
    await db.flush()
    return user


async def update_last_login(db: AsyncSession, user: AppUser) -> None:
    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    await db.flush()
