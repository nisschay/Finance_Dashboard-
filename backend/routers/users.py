from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.dependencies import get_current_user
from auth.firebase import verify_firebase_token
from database import get_db
from middleware.rbac import require_roles
from models.user import UserCreate, UserResponse, UserRoleUpdate, UserStatusUpdate
from services.user_service import (
    get_all_users,
    get_user_by_id,
    sync_user,
    update_user_role,
    update_user_status,
)

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/sync", response_model=UserResponse)
async def sync_current_user(
    payload: UserCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is missing or invalid",
        )

    token_data = await verify_firebase_token(credentials.credentials)
    token_uid = token_data.get("firebase_uid")
    token_email = token_data.get("email")

    if not token_uid or not token_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token is missing required identity fields",
        )

    if payload.firebase_uid != token_uid or payload.email.lower() != str(token_email).lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload firebase_uid/email must match authenticated token",
        )

    try:
        return sync_user(payload.firebase_uid, payload.email, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/", response_model=List[UserResponse])
async def list_all_users(
    _: Dict[str, Any] = Depends(require_roles("admin")),
) -> List[Dict[str, Any]]:
    with get_db() as db:
        return get_all_users(db)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_id = current_user.get("id")

    if not isinstance(user_id, int):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user context is invalid",
        )

    with get_db() as db:
        user = get_user_by_id(db, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
async def patch_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    _: Dict[str, Any] = Depends(require_roles("admin")),
) -> Dict[str, Any]:
    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must be a positive integer",
        )

    with get_db() as db:
        user = update_user_role(db, user_id, payload.role)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.patch("/{user_id}/status", response_model=UserResponse)
async def patch_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    _: Dict[str, Any] = Depends(require_roles("admin")),
) -> Dict[str, Any]:
    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must be a positive integer",
        )

    with get_db() as db:
        user = update_user_status(db, user_id, payload.status)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user
