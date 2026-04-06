import os
from typing import Any, Dict, List, Optional

from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor

from database import get_db


ADMIN_EMAIL = "admin@finance.dev"
ANALYST_EMAIL = "analyst@finance.dev"


def _configured_emails(env_key: str, default_email: str) -> set[str]:
    raw = os.getenv(env_key, "")
    parsed = {item.strip().lower() for item in raw.split(",") if item.strip()}
    parsed.add(default_email)
    return parsed


ADMIN_EMAILS = _configured_emails("ADMIN_ROLE_EMAILS", ADMIN_EMAIL)
ANALYST_EMAILS = _configured_emails("ANALYST_ROLE_EMAILS", ANALYST_EMAIL)


def role_for_email(email: str) -> str:
    normalized = email.strip().lower()

    if normalized in ADMIN_EMAILS:
        return "admin"

    if normalized in ANALYST_EMAILS:
        return "analyst"

    return "viewer"


def sync_user(firebase_uid: str, email: str, name: str) -> Dict[str, Any]:
    if not firebase_uid or not email or not name:
        raise ValueError("firebase_uid, email, and name are required")

    normalized_email = email.strip().lower()
    role_for_user = role_for_email(normalized_email)

    with get_db() as db:
        with db.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (normalized_email,),
            )
            existing_by_email = cursor.fetchone()

            if existing_by_email:
                cursor.execute(
                    """
                    UPDATE users
                    SET firebase_uid = %s,
                        email = %s,
                        name = %s,
                        role = %s
                    WHERE id = %s
                    RETURNING id, firebase_uid, email, name, role, status, created_at
                    """,
                    (
                        firebase_uid,
                        normalized_email,
                        name,
                        role_for_user,
                        existing_by_email["id"],
                    ),
                )
                user = cursor.fetchone()
            else:
                cursor.execute(
                    """
                    INSERT INTO users (firebase_uid, email, name, role)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (firebase_uid)
                    DO UPDATE SET
                        email = EXCLUDED.email,
                        name = EXCLUDED.name,
                        role = EXCLUDED.role
                    RETURNING id, firebase_uid, email, name, role, status, created_at
                    """,
                    (firebase_uid, normalized_email, name, role_for_user),
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
