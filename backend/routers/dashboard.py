from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from database import get_db
from middleware.rbac import require_roles
from services.dashboard_service import (
    get_by_category,
    get_monthly_trends,
    get_recent_activity,
    get_summary,
)

router = APIRouter()


@router.get("/summary")
async def get_dashboard_summary(
    _: Dict[str, Any] = Depends(require_roles("analyst", "admin")),
) -> Dict[str, Any]:
    with get_db() as db:
        return get_summary(db)


@router.get("/by-category")
async def get_dashboard_by_category(
    _: Dict[str, Any] = Depends(require_roles("analyst", "admin")),
) -> list[Dict[str, Any]]:
    with get_db() as db:
        return get_by_category(db)


@router.get("/trends")
async def get_dashboard_trends(
    months: int = Query(default=6, ge=1, le=60),
    _: Dict[str, Any] = Depends(require_roles("analyst", "admin")),
) -> list[Dict[str, Any]]:
    with get_db() as db:
        return get_monthly_trends(db, months=months)


@router.get("/recent")
async def get_dashboard_recent_activity(
    limit: int = Query(default=10, ge=1, le=100),
    _: Dict[str, Any] = Depends(require_roles("viewer", "analyst", "admin")),
) -> list[Dict[str, Any]]:
    with get_db() as db:
        return get_recent_activity(db, limit=limit)
