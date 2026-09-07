from __future__ import annotations

import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import AdminOnly, CurrentUser, DBSession, Pagination
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password,
)
from app.users import crud
from app.users.schemas import (
    LoginResponse,
    PasswordChangeRequest,
    RefreshRequest,
    RefreshResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
users_router = APIRouter(prefix="/api/users", tags=["users"])


# ── Auth endpoints ────────────────────────────────────────────────────────────

@auth_router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DBSession):
    """
    Create a new user account.
    In production this should be admin-only. For dev/demo it is open.
    """
    existing = await crud.get_user_by_username(db, data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{data.username}' is already taken",
        )
    if data.email:
        existing_email = await crud.get_user_by_email(db, data.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already registered",
            )
    user = await crud.create_user(db, data)
    return user


@auth_router.post("/login", response_model=LoginResponse)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DBSession,
):
    """OAuth2 password flow — returns access + refresh JWT tokens."""
    user = await crud.get_user_by_username(db, form.username)
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    await crud.update_last_login(db, user)

    return LoginResponse(
        access_token=create_access_token(str(user.id), user.role, user.username),
        refresh_token=create_refresh_token(str(user.id)),
        username=user.username,
        full_name=user.full_name,
        role=user.role,
    )


@auth_router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(body: RefreshRequest, db: DBSession):
    """Exchange a valid refresh token for a new access token."""
    user_id = decode_refresh_token(body.refresh_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await crud.get_user_by_id(db, uid)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return RefreshResponse(
        access_token=create_access_token(str(user.id), user.role, user.username)
    )


@auth_router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    """Return the currently authenticated user."""
    return current_user


@auth_router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChangeRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """Allow a logged-in user to change their own password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    from app.core.security import hash_password
    current_user.hashed_password = hash_password(body.new_password)
    db.add(current_user)


# ── User management endpoints (admin only) ────────────────────────────────────

@users_router.get("", response_model=List[UserOut])
async def list_users(
    db: DBSession,
    pagination: Pagination,
    _: Annotated[None, AdminOnly],
):
    return await crud.get_users(db, skip=pagination["skip"], limit=pagination["limit"])


@users_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    data: UserCreate,
    db: DBSession,
    _: Annotated[None, AdminOnly],
):
    existing = await crud.get_user_by_username(db, data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{data.username}' is already taken",
        )
    return await crud.create_user(db, data)


@users_router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: DBSession,
    _: Annotated[None, AdminOnly],
):
    user = await crud.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@users_router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: DBSession,
    _: Annotated[None, AdminOnly],
):
    user = await crud.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await crud.update_user(db, user, data)


@users_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
    _: Annotated[None, AdminOnly],
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )
    user = await crud.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await crud.deactivate_user(db, user)
