from typing import Any, Callable, Dict

from fastapi import Depends, HTTPException, status

from auth.dependencies import get_current_user


def require_roles(*roles: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    allowed = {role.strip().lower() for role in roles if role and role.strip()}

    if not allowed:
        raise ValueError("require_roles expects at least one role")

    async def _role_dependency(
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        role = str(current_user.get("role", "")).lower()

        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions",
            )

        return current_user

    return _role_dependency


# Usage examples:
# 1) Viewer-level route (all authenticated users):
# @router.get("/profile")
# async def profile(user: Dict[str, Any] = Depends(require_roles("viewer", "analyst", "admin"))):
#     return user
#
# 2) Analyst-level route:
# @router.get("/analysis")
# async def analysis(user: Dict[str, Any] = Depends(require_roles("analyst", "admin"))):
#     return {"can_analyze": True}
#
# 3) Admin-only route:
# @router.delete("/users/{user_id}")
# async def deactivate_user(user_id: int, user: Dict[str, Any] = Depends(require_roles("admin"))):
#     return {"deactivated_user_id": user_id}
