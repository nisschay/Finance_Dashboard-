from typing import Any, Dict, List

from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor


def get_summary(db: PGConnection) -> Dict[str, Any]:
    # Raw SQL:
    # SELECT
    #   COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
    #   COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
    #   COUNT(*) AS total_records
    # FROM financial_records
    # WHERE is_deleted = FALSE;
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
                COUNT(*) AS total_records
            FROM financial_records
            WHERE is_deleted = FALSE
            """
        )
        row = cursor.fetchone()

    total_income = row["total_income"] if row else 0
    total_expenses = row["total_expenses"] if row else 0
    total_records = row["total_records"] if row else 0

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_balance": total_income - total_expenses,
        "total_records": total_records,
    }


def get_by_category(db: PGConnection) -> List[Dict[str, Any]]:
    # Raw SQL:
    # SELECT
    #   category,
    #   COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
    #   COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
    # FROM financial_records
    # WHERE is_deleted = FALSE
    # GROUP BY category
    # ORDER BY category ASC;
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT
                category,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
            FROM financial_records
            WHERE is_deleted = FALSE
            GROUP BY category
            ORDER BY category ASC
            """
        )
        rows = cursor.fetchall()

    return [
        {
            "category": row["category"],
            "total_income": row["total_income"],
            "total_expense": row["total_expense"],
            "net": row["total_income"] - row["total_expense"],
        }
        for row in rows
    ]


def get_monthly_trends(db: PGConnection, months: int = 6) -> List[Dict[str, Any]]:
    # Raw SQL:
    # WITH month_series AS (
    #   SELECT DATE_TRUNC('month', CURRENT_DATE) - (INTERVAL '1 month' * gs) AS month_start
    #   FROM generate_series(0, %s - 1) AS gs
    # )
    # SELECT
    #   TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
    #   COALESCE(SUM(CASE WHEN fr.type = 'income' THEN fr.amount ELSE 0 END), 0) AS total_income,
    #   COALESCE(SUM(CASE WHEN fr.type = 'expense' THEN fr.amount ELSE 0 END), 0) AS total_expenses
    # FROM month_series ms
    # LEFT JOIN financial_records fr
    #   ON DATE_TRUNC('month', fr.date) = ms.month_start
    #  AND fr.is_deleted = FALSE
    # GROUP BY ms.month_start
    # ORDER BY ms.month_start ASC;
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            WITH month_series AS (
                SELECT DATE_TRUNC('month', CURRENT_DATE) - (INTERVAL '1 month' * gs) AS month_start
                FROM generate_series(0, %s - 1) AS gs
            )
            SELECT
                TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
                COALESCE(SUM(CASE WHEN fr.type = 'income' THEN fr.amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN fr.type = 'expense' THEN fr.amount ELSE 0 END), 0) AS total_expenses
            FROM month_series ms
            LEFT JOIN financial_records fr
                ON DATE_TRUNC('month', fr.date) = ms.month_start
                AND fr.is_deleted = FALSE
            GROUP BY ms.month_start
            ORDER BY ms.month_start ASC
            """,
            (months,),
        )
        rows = cursor.fetchall()

    return [
        {
            "month": row["month"],
            "total_income": row["total_income"],
            "total_expenses": row["total_expenses"],
            "net": row["total_income"] - row["total_expenses"],
        }
        for row in rows
    ]


def get_recent_activity(db: PGConnection, limit: int = 10) -> List[Dict[str, Any]]:
    # Raw SQL:
    # SELECT id, user_id, amount, type, category, date, notes, is_deleted, created_at, updated_at
    # FROM financial_records
    # WHERE is_deleted = FALSE
    # ORDER BY date DESC, created_at DESC
    # LIMIT %s;
    with db.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            SELECT id, user_id, amount, type, category, date, notes, is_deleted, created_at, updated_at
            FROM financial_records
            WHERE is_deleted = FALSE
            ORDER BY date DESC, created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()

    return [dict(row) for row in rows]
