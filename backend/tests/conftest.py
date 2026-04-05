import os
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Generator

import psycopg2
import pytest
from fastapi.testclient import TestClient
from psycopg2.extras import RealDictCursor

import database
from auth.dependencies import get_current_user
from main import app


DROP_SCHEMA_SQL = """
DROP TABLE IF EXISTS financial_records CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP TYPE IF EXISTS record_type CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
"""


@pytest.fixture(scope="session")
def test_database_url() -> str:
    # This fixture ensures tests never accidentally run against production data.
    # It requires an explicit TEST_DATABASE_URL so test intent is always clear.
    value = os.getenv("TEST_DATABASE_URL")
    if not value:
        raise RuntimeError("TEST_DATABASE_URL must be set before running tests")
    return value


@pytest.fixture(scope="session", autouse=True)
def setup_test_database(test_database_url: str) -> Generator[None, None, None]:
    # This fixture initializes a dedicated test schema once per test session.
    # Session scope keeps startup fast while still guaranteeing fresh tables.
    schema_path = Path(__file__).resolve().parents[1] / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")

    database.close_db_pool()
    database.DATABASE_URL = test_database_url

    with psycopg2.connect(test_database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute(DROP_SCHEMA_SQL)
            cursor.execute(schema_sql)

    yield

    database.close_db_pool()
    with psycopg2.connect(test_database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute(DROP_SCHEMA_SQL)


@pytest.fixture(autouse=True)
def reset_data_between_tests(test_database_url: str) -> Generator[None, None, None]:
    # This fixture clears row data before each test to keep tests independent.
    # Function scope prevents hidden coupling between test cases.
    with psycopg2.connect(test_database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE financial_records, users RESTART IDENTITY CASCADE")

    yield


@pytest.fixture
def db_connection(test_database_url: str) -> Generator[psycopg2.extensions.connection, None, None]:
    # This fixture provides direct DB access for precise setup/assertion checks.
    # Tests can verify externally-visible API behavior against real persisted state.
    conn = psycopg2.connect(test_database_url)
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture
def mock_current_user() -> Generator[Callable[..., Dict[str, Any]], None, None]:
    # This fixture bypasses Firebase verification by overriding get_current_user.
    # A factory shape keeps role/status configurable per test without duplicate code.
    def _apply(
        *,
        user: Dict[str, Any] | None = None,
        role: str = "viewer",
        status: str = "active",
        user_id: int = 1,
        email: str = "test@example.com",
    ) -> Dict[str, Any]:
        payload = dict(user) if user else {"id": user_id, "email": email, "role": role, "status": status}

        async def _override() -> Dict[str, Any]:
            return payload

        app.dependency_overrides[get_current_user] = _override
        return payload

    yield _apply

    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_user(db_connection: psycopg2.extensions.connection) -> Dict[str, Any]:
    # Ready-made active viewer user for authorization tests.
    firebase_uid = f"viewer-{uuid.uuid4()}"
    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO users (firebase_uid, email, name, role, status)
            VALUES (%s, %s, %s, 'viewer', 'active')
            RETURNING id, firebase_uid, email, name, role, status, created_at
            """,
            (firebase_uid, f"{firebase_uid}@example.com", "Viewer User"),
        )
        row = cursor.fetchone()
    db_connection.commit()
    return dict(row)


@pytest.fixture
def analyst_user(db_connection: psycopg2.extensions.connection) -> Dict[str, Any]:
    # Ready-made active analyst user for create/update privilege checks.
    firebase_uid = f"analyst-{uuid.uuid4()}"
    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO users (firebase_uid, email, name, role, status)
            VALUES (%s, %s, %s, 'analyst', 'active')
            RETURNING id, firebase_uid, email, name, role, status, created_at
            """,
            (firebase_uid, f"{firebase_uid}@example.com", "Analyst User"),
        )
        row = cursor.fetchone()
    db_connection.commit()
    return dict(row)


@pytest.fixture
def admin_user(db_connection: psycopg2.extensions.connection) -> Dict[str, Any]:
    # Ready-made active admin user for privileged management operations.
    firebase_uid = f"admin-{uuid.uuid4()}"
    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO users (firebase_uid, email, name, role, status)
            VALUES (%s, %s, %s, 'admin', 'active')
            RETURNING id, firebase_uid, email, name, role, status, created_at
            """,
            (firebase_uid, f"{firebase_uid}@example.com", "Admin User"),
        )
        row = cursor.fetchone()
    db_connection.commit()
    return dict(row)


@pytest.fixture
def client(
    setup_test_database: None,
    mock_current_user: Callable[..., Dict[str, Any]],
    viewer_user: Dict[str, Any],
) -> Generator[TestClient, None, None]:
    # This is the default app client for most endpoint tests.
    # It starts with a viewer override so tests can opt into stricter roles explicitly.
    mock_current_user(user=viewer_user)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_client(setup_test_database: None) -> Generator[TestClient, None, None]:
    # This client runs without auth dependency overrides for true auth-flow checks.
    app.dependency_overrides.pop(get_current_user, None)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_record(
    db_connection: psycopg2.extensions.connection,
    analyst_user: Dict[str, Any],
) -> Dict[str, Any]:
    # This fixture inserts one persisted financial record to simplify list/detail tests.
    # Centralizing this setup keeps tests focused on behavior instead of boilerplate inserts.
    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO financial_records (user_id, amount, type, category, date, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, amount, type, category, date, notes, is_deleted, created_at, updated_at
            """,
            (analyst_user["id"], "50.00", "expense", "food", "2026-01-15", "sample"),
        )
        row = cursor.fetchone()
    db_connection.commit()
    return dict(row)
