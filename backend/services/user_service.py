import os
from typing import Any, Dict, List, Optional

from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor

from database import get_db


def _seed_analyst_emails() -> set[str]:
    raw = os.getenv("ANALYST_EMAILS", "")
    emails = [item.strip().lower() for item in raw.split(",") if item.strip()]
    return set(emails)


def _is_seed_analyst(email: str) -> bool:
    return email.strip().lower() in _seed_analyst_emails()


def sync_user(firebase_uid: str, email: str, name: str) -> Dict[str, Any]:
    if not firebase_uid or not email or not name:
        raise ValueError("firebase_uid, email, and name are required")

    role_for_new_user = "analyst" if _is_seed_analyst(email) else "viewer"

    with get_db() as db:
        with db.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                INSERT INTO users (firebase_uid, email, name, role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (firebase_uid)
                DO UPDATE SET
                    email = EXCLUDED.email,
                    name = EXCLUDED.name
                RETURNING id, firebase_uid, email, name, role, status, created_at
                """,
                (firebase_uid, email, name, role_for_new_user),
            )
            user = cursor.fetchone()

            if user and role_for_new_user == "analyst" and user["role"] == "viewer":
                cursor.execute(
                    """
                    UPDATE users
                    SET role = 'analyst'
                    WHERE id = %s
                    RETURNING id, firebase_uid, email, name, role, status, created_at
                    """,
                    (user["id"],),
                )
                user = cursor.fetchone()

    if user is None:
        raise RuntimeError("Unable to synchronize user")

    return dict(user)


def get_all_users(db: PGConnection) -> List[Dict[str, Any]]:
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, firebase_uid, email, name, role, status, created_at
            FROM users
            ORDER BY created_at DESC
            """
        )
        rows = cursor.fetchall()

    return [dict(row) for row in rows]


def get_user_by_id(db: PGConnection, user_id: int) -> Optional[Dict[str, Any]]:
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, firebase_uid, email, name, role, status, created_at
            FROM users
            WHERE id = %s
            LIMIT 1
            """,
            (user_id,),
        )
        row = cursor.fetchone()

    return dict(row) if row else None


def update_user_role(db: PGConnection, user_id: int, role: str) -> Optional[Dict[str, Any]]:
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            UPDATE users
            SET role = %s
            WHERE id = %s
            RETURNING id, firebase_uid, email, name, role, status, created_at
            """,
            (role, user_id),
        )
        row = cursor.fetchone()

    return dict(row) if row else None


def update_user_status(db: PGConnection, user_id: int, status: str) -> Optional[Dict[str, Any]]:
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            UPDATE users
            SET status = %s
            WHERE id = %s
            RETURNING id, firebase_uid, email, name, role, status, created_at
            """,
            (status, user_id),
        )
        row = cursor.fetchone()

    return dict(row) if row else None
