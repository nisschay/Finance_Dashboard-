"""
These tests verify authentication guard behavior from the API boundary.
They matter because every protected endpoint depends on consistent 401/403 behavior.
"""

from typing import Any, Dict

from fastapi import HTTPException, status


def test_request_without_authorization_header_returns_401(auth_client):
    response = auth_client.get("/users/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_request_with_malformed_token_returns_401(auth_client, monkeypatch):
    async def _reject_token(_: str) -> Dict[str, Any]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token")

    monkeypatch.setattr("auth.dependencies.verify_firebase_token", _reject_token)

    response = auth_client.get("/users/me", headers={"Authorization": "Bearer malformed-token"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_request_from_inactive_user_returns_403(auth_client, db_connection, viewer_user, monkeypatch):
    with db_connection.cursor() as cursor:
        cursor.execute("UPDATE users SET status = 'inactive' WHERE id = %s", (viewer_user["id"],))
    db_connection.commit()

    async def _valid_token(_: str) -> Dict[str, Any]:
        return {
            "firebase_uid": viewer_user["firebase_uid"],
            "email": viewer_user["email"],
            "claims": {},
        }

    monkeypatch.setattr("auth.dependencies.verify_firebase_token", _valid_token)

    response = auth_client.get("/users/me", headers={"Authorization": "Bearer valid-token"})

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_request_from_active_user_with_valid_token_proceeds(auth_client, viewer_user, monkeypatch):
    async def _valid_token(_: str) -> Dict[str, Any]:
        return {
            "firebase_uid": viewer_user["firebase_uid"],
            "email": viewer_user["email"],
            "claims": {},
        }

    monkeypatch.setattr("auth.dependencies.verify_firebase_token", _valid_token)

    response = auth_client.get("/users/me", headers={"Authorization": "Bearer valid-token"})

    assert response.status_code == status.HTTP_200_OK
