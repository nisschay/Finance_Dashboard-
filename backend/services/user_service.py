from typing import Any, Dict, List, Optional

from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor

from database import get_db


ADMIN_EMAIL = "admin@finance.dev"
ANALYST_EMAIL = "analyst@finance.dev"


def _role_for_email(email: str) -> str:
    normalized = email.strip().lower()

    if normalized == ADMIN_EMAIL:
        return "admin"

    if normalized == ANALYST_EMAIL:
        return "analyst"

    return "viewer"


def sync_user(firebase_uid: str, email: str, name: str) -> Dict[str, Any]:
    if not firebase_uid or not email or not name:
        raise ValueError("firebase_uid, email, and name are required")

    role_for_user = _role_for_email(email)

    with get_db() as db:
        with db.cursor(cursor_factory=RealDictCursor) as cursor:
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
                (firebase_uid, email, name, role_for_user),
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
