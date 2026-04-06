from typing import Any, Dict, List, Optional

from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor

from logger import get_logger
from models.record import RecordCreate, RecordFilter, RecordUpdate

logger = get_logger(__name__)


def _normalize_category(value: str) -> str:
    collapsed = " ".join(value.strip().split())
    return collapsed.title()


def create_record(db: PGConnection, user_id: int, data: RecordCreate) -> Dict[str, Any]:
    normalized_category = _normalize_category(data.category)

    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO financial_records (user_id, amount, type, category, date, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, amount, type, category, date, notes, is_deleted, created_at, updated_at
            """,
            (user_id, data.amount, data.type, normalized_category, data.date, data.notes),
        )
        row = cursor.fetchone()

    if row is None:
        raise RuntimeError("Failed to create financial record")

    logger.info(
        "Created financial record",
        extra={"record_id": row["id"], "user_id": user_id},
    )

    return dict(row)


def get_records(db: PGConnection, filters: RecordFilter) -> List[Dict[str, Any]]:
    where_clauses = ["is_deleted = FALSE"]
    params: List[Any] = []

    if filters.type:
        where_clauses.append("type = %s")
        params.append(filters.type)

    if filters.category:
        where_clauses.append("LOWER(TRIM(category)) = LOWER(TRIM(%s))")
        params.append(filters.category)

    if filters.from_date:
        where_clauses.append("date >= %s")
        params.append(filters.from_date)

    if filters.to_date:
        where_clauses.append("date <= %s")
        params.append(filters.to_date)

    offset = (filters.page - 1) * filters.limit
    params.extend([filters.limit, offset])

    query = f"""
        SELECT id, user_id, amount, type, INITCAP(TRIM(category)) AS category, date, notes, is_deleted, created_at, updated_at
        FROM financial_records
        WHERE {' AND '.join(where_clauses)}
        ORDER BY date DESC, created_at DESC
        LIMIT %s OFFSET %s
    """

    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

    return [dict(row) for row in rows]


def get_record_by_id(db: PGConnection, record_id: int) -> Optional[Dict[str, Any]]:
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, user_id, amount, type, INITCAP(TRIM(category)) AS category, date, notes, is_deleted, created_at, updated_at
            FROM financial_records
            WHERE id = %s AND is_deleted = FALSE
            LIMIT 1
            """,
            (record_id,),
        )
        row = cursor.fetchone()

    return dict(row) if row else None


def update_record(db: PGConnection, record_id: int, data: RecordUpdate) -> Optional[Dict[str, Any]]:
    updates: List[str] = []
    params: List[Any] = []

    payload = data.model_dump(exclude_unset=True)

    if isinstance(payload.get("category"), str):
        payload["category"] = _normalize_category(payload["category"])

    for field in ("amount", "type", "category", "date", "notes"):
        if field in payload:
            updates.append(f"{field} = %s")
            params.append(payload[field])

    if not updates:
        raise ValueError("At least one field is required to update a record")

    updates.append("updated_at = NOW()")
    params.append(record_id)

    query = f"""
        UPDATE financial_records
        SET {', '.join(updates)}
        WHERE id = %s AND is_deleted = FALSE
        RETURNING id, user_id, amount, type, INITCAP(TRIM(category)) AS category, date, notes, is_deleted, created_at, updated_at
    """

    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(query, tuple(params))
        row = cursor.fetchone()

    if row is not None:
        logger.info("Updated financial record", extra={"record_id": record_id})

    return dict(row) if row else None


def soft_delete_record(db: PGConnection, record_id: int) -> bool:
    with db.cursor() as cursor:
        cursor.execute(
            """
            UPDATE financial_records
            SET is_deleted = TRUE, updated_at = NOW()
            WHERE id = %s AND is_deleted = FALSE
            """,
            (record_id,),
        )
        deleted = cursor.rowcount > 0

    if deleted:
        logger.info("Soft deleted financial record", extra={"record_id": record_id})

    return deleted
