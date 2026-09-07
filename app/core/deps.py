from __future__ import annotations

from typing import Annotated, Any, List, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_async_db
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Type aliases for clean injection signatures
DBSession = Annotated[AsyncSession, Depends(get_async_db)]


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DBSession,
):
    """
    Validates JWT and returns the active AppUser.
    Raises 401 if token is invalid or user is inactive.
    """
    # Import here to avoid circular imports at module level
    from app.users.crud import get_user_by_id
    from app.users.models import AppUser  # noqa: F401

    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exc

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise credentials_exc

    try:
        uid = UUID(user_id)
    except ValueError:
        raise credentials_exc

    user = await get_user_by_id(db, uid)
    if user is None or not user.is_active:
        raise credentials_exc

    return user


# Re-usable annotated type — import AppUser lazily to avoid circular dep
def _current_user_dep():
    from app.users.models import AppUser
    return Annotated[AppUser, Depends(get_current_user)]


CurrentUser = Annotated[Any, Depends(get_current_user)]  # type: ignore[valid-type]


def require_roles(*allowed_roles: str):
    """
    FastAPI dependency factory — restricts endpoint to specific roles.

    Usage:
        @router.post("/admin-only")
        async def endpoint(_=Depends(require_roles("admin"))):
            ...
    """
    async def _check(user: CurrentUser) -> Any:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action. "
                       f"Required: {list(allowed_roles)}",
            )
        return user

    return Depends(_check)


# ── Convenience role guards ────────────────────────────────────────────────────
AdminOnly = require_roles("admin")
MLAdminOnly = require_roles("admin", "ml_admin")
AdjusterPlus = require_roles("admin", "adjuster", "underwriter", "investigator")
CompliancePlus = require_roles("admin", "compliance", "ml_admin")


def get_pagination(skip: int = 0, limit: int = 20) -> dict:
    """Standard pagination parameters."""
    limit = min(limit, 200)  # cap at 200
    return {"skip": skip, "limit": limit}


Pagination = Annotated[dict, Depends(get_pagination)]
