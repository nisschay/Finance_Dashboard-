from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from database import get_db
from middleware.rbac import require_roles
from models.record import RecordCreate, RecordFilter, RecordResponse, RecordUpdate
from services.record_service import (
    create_record,
    get_record_by_id,
    get_records,
    soft_delete_record,
    update_record,
)

router = APIRouter()


@router.post("/", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
async def create_financial_record(
    payload: RecordCreate,
    current_user: Dict[str, Any] = Depends(require_roles("analyst", "admin")),
) -> Dict[str, Any]:
    user_id = current_user.get("id")

    if not isinstance(user_id, int) or user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user context is invalid",
        )

    with get_db() as db:
        return create_record(db, user_id, payload)


@router.get("/", response_model=List[RecordResponse])
async def list_financial_records(
    type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    _: Dict[str, Any] = Depends(require_roles("viewer", "analyst", "admin")),
) -> List[Dict[str, Any]]:
    try:
        filters = RecordFilter(
            type=type,
            category=category,
            from_date=from_date,
            to_date=to_date,
            page=page,
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid query parameters: {exc}",
        ) from exc

    if filters.from_date and filters.to_date and filters.from_date > filters.to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_date cannot be greater than to_date",
        )

    with get_db() as db:
        return get_records(db, filters)


@router.get("/{record_id}", response_model=RecordResponse)
async def get_financial_record(
    record_id: int,
    _: Dict[str, Any] = Depends(require_roles("viewer", "analyst", "admin")),
) -> Dict[str, Any]:
    if record_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="record_id must be a positive integer",
        )

    with get_db() as db:
        record = get_record_by_id(db, record_id)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial record not found",
        )

    return record


@router.patch("/{record_id}", response_model=RecordResponse)
async def patch_financial_record(
    record_id: int,
    payload: RecordUpdate,
    _: Dict[str, Any] = Depends(require_roles("analyst", "admin")),
) -> Dict[str, Any]:
    if record_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="record_id must be a positive integer",
        )

    try:
        with get_db() as db:
            updated = update_record(db, record_id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial record not found",
        )

    return updated


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_financial_record(
    record_id: int,
    _: Dict[str, Any] = Depends(require_roles("admin")),
) -> None:
    if record_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="record_id must be a positive integer",
        )

    with get_db() as db:
        deleted = soft_delete_record(db, record_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial record not found",
        )
