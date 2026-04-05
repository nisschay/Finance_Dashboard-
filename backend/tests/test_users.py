"""
These tests verify user onboarding and administrative user-management behaviors.
They matter because user synchronization and role/status controls gate all protected features.
"""

from typing import Any, Dict

from fastapi import status
from psycopg2.extras import RealDictCursor


def _token_payload_for(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "firebase_uid": user["firebase_uid"],
        "email": user["email"],
        "claims": {},
    }


def test_users_sync_creates_new_user_with_default_viewer_role(auth_client, monkeypatch):
    async def _valid_token(_: str) -> Dict[str, Any]:
        return {
            "firebase_uid": "firebase-user-1",
            "email": "new-user@example.com",
            "claims": {},
        }

    monkeypatch.setattr("routers.users.verify_firebase_token", _valid_token)

    response = auth_client.post(
        "/users/sync",
        headers={"Authorization": "Bearer valid-token"},
        json={
            "firebase_uid": "firebase-user-1",
            "email": "new-user@example.com",
            "name": "New User",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["role"] == "viewer"


def test_users_sync_for_existing_firebase_uid_returns_existing_user(auth_client, monkeypatch):
    async def _valid_token(_: str) -> Dict[str, Any]:
        return {
            "firebase_uid": "firebase-user-2",
            "email": "same-user@example.com",
            "claims": {},
        }

    monkeypatch.setattr("routers.users.verify_firebase_token", _valid_token)

    first = auth_client.post(
        "/users/sync",
        headers={"Authorization": "Bearer valid-token"},
        json={
            "firebase_uid": "firebase-user-2",
            "email": "same-user@example.com",
            "name": "Same User",
        },
    )
    second = auth_client.post(
        "/users/sync",
        headers={"Authorization": "Bearer valid-token"},
        json={
            "firebase_uid": "firebase-user-2",
            "email": "same-user@example.com",
            "name": "Same User",
        },
    )

    assert first.json()["id"] == second.json()["id"]


def test_users_me_returns_authenticated_users_data(client, mock_current_user, viewer_user):
    mock_current_user(user=viewer_user)

    response = client.get("/users/me")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == viewer_user["id"]


def test_users_list_is_forbidden_for_viewer(client, mock_current_user, viewer_user):
    mock_current_user(user=viewer_user)

    response = client.get("/users")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_users_list_is_forbidden_for_analyst(client, mock_current_user, analyst_user):
    mock_current_user(user=analyst_user)

    response = client.get("/users")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_users_list_returns_all_users_for_admin(client, mock_current_user, admin_user, viewer_user, analyst_user):
    mock_current_user(user=admin_user)

    response = client.get("/users")

    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 3


def test_patch_user_role_by_admin_changes_role(client, mock_current_user, admin_user, viewer_user):
    mock_current_user(user=admin_user)

    response = client.patch(f"/users/{viewer_user['id']}/role", json={"role": "analyst"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["role"] == "analyst"


def test_patch_user_role_by_non_admin_returns_403(client, mock_current_user, analyst_user, viewer_user):
    mock_current_user(user=analyst_user)

    response = client.patch(f"/users/{viewer_user['id']}/role", json={"role": "admin"})

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_patch_user_status_by_admin_sets_user_inactive(client, mock_current_user, admin_user, viewer_user):
    mock_current_user(user=admin_user)

    response = client.patch(f"/users/{viewer_user['id']}/status", json={"status": "inactive"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "inactive"


def test_inactive_user_making_request_receives_403(auth_client, db_connection, viewer_user, monkeypatch):
    with db_connection.cursor() as cursor:
        cursor.execute("UPDATE users SET status = 'inactive' WHERE id = %s", (viewer_user["id"],))
    db_connection.commit()

    async def _valid_token(_: str) -> Dict[str, Any]:
        return _token_payload_for(viewer_user)

    monkeypatch.setattr("auth.dependencies.verify_firebase_token", _valid_token)

    response = auth_client.get("/users/me", headers={"Authorization": "Bearer valid-token"})

    assert response.status_code == status.HTTP_403_FORBIDDEN
