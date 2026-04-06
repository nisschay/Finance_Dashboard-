import os
from contextlib import contextmanager
from typing import Generator, Optional

from dotenv import load_dotenv
from psycopg2.extensions import connection as PGConnection
from psycopg2.pool import ThreadedConnectionPool

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
MIN_DB_CONNECTIONS = int(os.getenv("MIN_DB_CONNECTIONS", "1"))
MAX_DB_CONNECTIONS = int(os.getenv("MAX_DB_CONNECTIONS", "10"))

_db_pool: Optional[ThreadedConnectionPool] = None


def init_db_pool() -> None:
    global _db_pool

    if _db_pool is not None:
        return

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set in environment variables")

    _db_pool = ThreadedConnectionPool(
        minconn=MIN_DB_CONNECTIONS,
        maxconn=MAX_DB_CONNECTIONS,
        dsn=DATABASE_URL,
    )


def close_db_pool() -> None:
    global _db_pool

    if _db_pool is None:
        return

    _db_pool.closeall()
    _db_pool = None


@contextmanager
def get_db() -> Generator[PGConnection, None, None]:
    if _db_pool is None:
        init_db_pool()

    if _db_pool is None:
        raise RuntimeError("Database pool failed to initialize")

    conn = _db_pool.getconn()

    # Drop stale pooled connections and fetch a fresh one when needed.
    if conn.closed:
        _db_pool.putconn(conn, close=True)
        conn = _db_pool.getconn()

    if conn.closed:
        _db_pool.putconn(conn, close=True)
        raise RuntimeError("Failed to obtain an open database connection from pool")

    returned_to_pool = False

    try:
        yield conn
        conn.commit()
    except Exception:
        # A dropped network connection can leave psycopg2 connection closed.
        # Guard rollback in that case so error handling does not raise a second exception.
        if not conn.closed:
            conn.rollback()
            _db_pool.putconn(conn)
        else:
            _db_pool.putconn(conn, close=True)
        returned_to_pool = True
        raise
    finally:
        if not returned_to_pool:
            _db_pool.putconn(conn, close=bool(conn.closed))
