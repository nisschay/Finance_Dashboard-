"""
These tests validate analytics responses derived from persisted financial records.
They matter because dashboard decisions rely on correct aggregation and role gating.
"""

from datetime import date
from decimal import Decimal

from fastapi import status
from psycopg2.extras import RealDictCursor


def _insert_record(db_connection, user_id, amount, record_type, category, record_date):
    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO financial_records (user_id, amount, type, category, date)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (user_id, str(amount), record_type, category, record_date),
        )
        row = cursor.fetchone()
    db_connection.commit()
    return int(row["id"])


def _month_label_with_offset(base_month: date, offset_from_base: int) -> str:
    month_index = base_month.month + offset_from_base
    year = base_month.year

    while month_index <= 0:
        month_index += 12
        year -= 1

    while month_index > 12:
        month_index -= 12
        year += 1

    return f"{year:04d}-{month_index:02d}"


def test_dashboard_summary_returns_correct_income_expense_and_net(client, mock_current_user, analyst_user, db_connection):
    _insert_record(db_connection, analyst_user["id"], Decimal("100.00"), "income", "salary", date(2026, 1, 1))
    _insert_record(db_connection, analyst_user["id"], Decimal("40.00"), "expense", "food", date(2026, 1, 2))

    mock_current_user(user=analyst_user)
    response = client.get("/dashboard/summary")
    body = response.json()

    assert response.status_code == status.HTTP_200_OK
    assert body["net_balance"] == "60.00"


def test_dashboard_summary_excludes_soft_deleted_records(client, mock_current_user, analyst_user, db_connection):
    active_id = _insert_record(db_connection, analyst_user["id"], Decimal("200.00"), "income", "salary", date(2026, 1, 3))
    deleted_id = _insert_record(db_connection, analyst_user["id"], Decimal("300.00"), "income", "bonus", date(2026, 1, 4))

    with db_connection.cursor() as cursor:
        cursor.execute(
            "UPDATE financial_records SET is_deleted = TRUE WHERE id = %s",
            (deleted_id,),
        )
    db_connection.commit()

    mock_current_user(user=analyst_user)
    response = client.get("/dashboard/summary")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["total_income"] == "200.00"


def test_dashboard_by_category_groups_records_correctly(client, mock_current_user, analyst_user, db_connection):
    _insert_record(db_connection, analyst_user["id"], Decimal("100.00"), "income", "salary", date(2026, 1, 1))
    _insert_record(db_connection, analyst_user["id"], Decimal("25.00"), "expense", "salary", date(2026, 1, 2))

    mock_current_user(user=analyst_user)
    response = client.get("/dashboard/by-category")

    salary_row = next(item for item in response.json() if item["category"] == "salary")
    assert salary_row["net"] == "75.00"


def test_dashboard_trends_returns_expected_month_entries(client, mock_current_user, analyst_user, db_connection):
    today_month = date.today().replace(day=1)
    current_month_label = _month_label_with_offset(today_month, 0)
    previous_month_label = _month_label_with_offset(today_month, -1)

    current_month_date = date(today_month.year, today_month.month, 2)
    prev_month_num = today_month.month - 1 or 12
    prev_month_year = today_month.year if today_month.month > 1 else today_month.year - 1
    previous_month_date = date(prev_month_year, prev_month_num, 2)

    _insert_record(db_connection, analyst_user["id"], Decimal("100.00"), "income", "salary", current_month_date)
    _insert_record(db_connection, analyst_user["id"], Decimal("10.00"), "expense", "food", previous_month_date)

    mock_current_user(user=analyst_user)
    response = client.get("/dashboard/trends?months=4")

    months = [item["month"] for item in response.json()]
    assert len(months) == 4 and current_month_label in months and previous_month_label in months


def test_dashboard_recent_respects_limit_parameter(client, mock_current_user, analyst_user, db_connection):
    for idx in range(1, 6):
        _insert_record(db_connection, analyst_user["id"], Decimal(str(idx * 10)), "expense", "food", date(2026, 1, idx))

    mock_current_user(user=analyst_user)
    response = client.get("/dashboard/recent?limit=3")

    assert len(response.json()) == 3


def test_viewer_can_access_dashboard_recent_endpoint(client, mock_current_user, viewer_user):
    mock_current_user(user=viewer_user)

    response = client.get("/dashboard/recent")

    assert response.status_code == status.HTTP_200_OK


def test_viewer_can_access_dashboard_summary_endpoint(client, mock_current_user, viewer_user):
    mock_current_user(user=viewer_user)

    response = client.get("/dashboard/summary")

    assert response.status_code == status.HTTP_200_OK
