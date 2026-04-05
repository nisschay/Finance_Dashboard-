"""
These tests verify record access control, CRUD behavior, and filtering semantics.
They matter because records are the core business object and must remain correct and secure.
"""

from datetime import date
from decimal import Decimal

from fastapi import status
from psycopg2.extras import RealDictCursor


def _insert_record(db_connection, user_id, amount, record_type, category, record_date, notes=None):
    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """
            INSERT INTO financial_records (user_id, amount, type, category, date, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, amount, type, category, date, notes, is_deleted, created_at, updated_at
            """,
            (user_id, str(amount), record_type, category, record_date, notes),
        )
        row = cursor.fetchone()
    db_connection.commit()
    return dict(row)


def _valid_record_payload():
    return {
        "amount": 120.50,
        "type": "income",
        "category": "salary",
        "date": "2026-02-01",
        "notes": "monthly pay",
    }


def test_viewer_can_get_records_successfully(client, mock_current_user, viewer_user, sample_record):
    mock_current_user(user=viewer_user)

    response = client.get("/records")

    assert response.status_code == status.HTTP_200_OK


def test_viewer_cannot_create_financial_record(client, mock_current_user, viewer_user):
    mock_current_user(user=viewer_user)

    response = client.post("/records", json=_valid_record_payload())

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_patch_financial_record(client, mock_current_user, viewer_user, sample_record):
    mock_current_user(user=viewer_user)

    response = client.patch(f"/records/{sample_record['id']}", json={"notes": "edited"})

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_viewer_cannot_delete_financial_record(client, mock_current_user, viewer_user, sample_record):
    mock_current_user(user=viewer_user)

    response = client.delete(f"/records/{sample_record['id']}")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_analyst_can_create_financial_record_successfully(client, mock_current_user, analyst_user):
    mock_current_user(user=analyst_user)

    response = client.post("/records", json=_valid_record_payload())

    assert response.status_code == status.HTTP_201_CREATED


def test_analyst_cannot_delete_financial_record(client, mock_current_user, analyst_user, sample_record):
    mock_current_user(user=analyst_user)

    response = client.delete(f"/records/{sample_record['id']}")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_admin_can_create_patch_and_delete_financial_record(client, mock_current_user, admin_user):
    mock_current_user(user=admin_user)

    created = client.post("/records", json=_valid_record_payload())
    record_id = created.json()["id"]
    patched = client.patch(f"/records/{record_id}", json={"category": "bonus"})
    deleted = client.delete(f"/records/{record_id}")

    assert created.status_code == status.HTTP_201_CREATED
    assert patched.status_code == status.HTTP_200_OK
    assert deleted.status_code == status.HTTP_204_NO_CONTENT


def test_post_records_with_valid_data_returns_created_record(client, mock_current_user, analyst_user):
    mock_current_user(user=analyst_user)

    response = client.post("/records", json=_valid_record_payload())
    body = response.json()

    assert response.status_code == status.HTTP_201_CREATED
    assert body["category"] == "salary"


def test_post_records_with_missing_required_field_returns_422(client, mock_current_user, analyst_user):
    mock_current_user(user=analyst_user)

    payload = _valid_record_payload()
    payload.pop("category")
    response = client.post("/records", json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_post_records_with_negative_amount_returns_422(client, mock_current_user, analyst_user):
    mock_current_user(user=analyst_user)

    payload = _valid_record_payload()
    payload["amount"] = -1
    response = client.post("/records", json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_post_records_with_invalid_type_returns_422(client, mock_current_user, analyst_user):
    mock_current_user(user=analyst_user)

    payload = _valid_record_payload()
    payload["type"] = "transfer"
    response = client.post("/records", json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_get_records_returns_only_non_deleted_records(client, mock_current_user, viewer_user, db_connection, analyst_user):
    active = _insert_record(db_connection, analyst_user["id"], Decimal("11.00"), "expense", "food", date(2026, 2, 2))
    deleted = _insert_record(db_connection, analyst_user["id"], Decimal("20.00"), "expense", "travel", date(2026, 2, 3))

    with db_connection.cursor() as cursor:
        cursor.execute("UPDATE financial_records SET is_deleted = TRUE WHERE id = %s", (deleted["id"],))
    db_connection.commit()

    mock_current_user(user=viewer_user)
    response = client.get("/records")

    ids = {row["id"] for row in response.json()}
    assert active["id"] in ids and deleted["id"] not in ids


def test_patch_records_with_partial_data_only_updates_provided_fields(client, mock_current_user, analyst_user, db_connection):
    record = _insert_record(db_connection, analyst_user["id"], Decimal("100.00"), "income", "salary", date(2026, 1, 1), "before")

    mock_current_user(user=analyst_user)
    response = client.patch(f"/records/{record['id']}", json={"notes": "after"})
    body = response.json()

    assert response.status_code == status.HTTP_200_OK
    assert body["amount"] == "100.00"


def test_delete_records_sets_is_deleted_true_without_removing_row(client, mock_current_user, admin_user, db_connection):
    record = _insert_record(db_connection, admin_user["id"], Decimal("55.00"), "expense", "food", date(2026, 2, 1))

    mock_current_user(user=admin_user)
    response = client.delete(f"/records/{record['id']}")

    with db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT id, is_deleted FROM financial_records WHERE id = %s", (record["id"],))
        row = cursor.fetchone()

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert row and row["is_deleted"] is True


def test_get_record_by_id_after_soft_delete_returns_404(client, mock_current_user, admin_user, db_connection):
    record = _insert_record(db_connection, admin_user["id"], Decimal("42.00"), "expense", "misc", date(2026, 2, 5))

    mock_current_user(user=admin_user)
    client.delete(f"/records/{record['id']}")
    response = client.get(f"/records/{record['id']}")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_get_records_filtered_by_type_returns_only_income(client, mock_current_user, viewer_user, db_connection, analyst_user):
    _insert_record(db_connection, analyst_user["id"], Decimal("100.00"), "income", "salary", date(2026, 1, 1))
    _insert_record(db_connection, analyst_user["id"], Decimal("20.00"), "expense", "food", date(2026, 1, 2))

    mock_current_user(user=viewer_user)
    response = client.get("/records?type=income")

    assert all(item["type"] == "income" for item in response.json())


def test_get_records_filtered_by_category_returns_only_food(client, mock_current_user, viewer_user, db_connection, analyst_user):
    _insert_record(db_connection, analyst_user["id"], Decimal("15.00"), "expense", "food", date(2026, 1, 3))
    _insert_record(db_connection, analyst_user["id"], Decimal("10.00"), "expense", "travel", date(2026, 1, 4))

    mock_current_user(user=viewer_user)
    response = client.get("/records?category=food")

    assert all(item["category"] == "food" for item in response.json())


def test_get_records_filtered_by_date_range_returns_only_records_in_range(client, mock_current_user, viewer_user, db_connection, analyst_user):
    _insert_record(db_connection, analyst_user["id"], Decimal("10.00"), "expense", "food", date(2026, 1, 1))
    in_range = _insert_record(db_connection, analyst_user["id"], Decimal("20.00"), "expense", "food", date(2026, 1, 15))
    _insert_record(db_connection, analyst_user["id"], Decimal("30.00"), "expense", "food", date(2026, 2, 1))

    mock_current_user(user=viewer_user)
    response = client.get("/records?from_date=2026-01-10&to_date=2026-01-20")

    ids = {item["id"] for item in response.json()}
    assert in_range["id"] in ids and len(ids) == 1


def test_get_records_with_page_and_limit_returns_correct_page(client, mock_current_user, viewer_user, db_connection, analyst_user):
    for idx in range(1, 6):
        _insert_record(
            db_connection,
            analyst_user["id"],
            Decimal(str(10 * idx)),
            "expense",
            "food",
            date(2026, 1, idx),
        )

    mock_current_user(user=viewer_user)
    response = client.get("/records?page=2&limit=2")

    page_ids = [item["id"] for item in response.json()]
    with db_connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id FROM financial_records
            WHERE is_deleted = FALSE
            ORDER BY date DESC, created_at DESC
            LIMIT 2 OFFSET 2
            """
        )
        expected_ids = [row[0] for row in cursor.fetchall()]

    assert page_ids == expected_ids


def test_get_records_response_length_matches_active_database_count(client, mock_current_user, viewer_user, db_connection, analyst_user):
    _insert_record(db_connection, analyst_user["id"], Decimal("10.00"), "expense", "food", date(2026, 1, 1))
    _insert_record(db_connection, analyst_user["id"], Decimal("20.00"), "income", "salary", date(2026, 1, 2))
    removed = _insert_record(db_connection, analyst_user["id"], Decimal("30.00"), "expense", "travel", date(2026, 1, 3))

    with db_connection.cursor() as cursor:
        cursor.execute("UPDATE financial_records SET is_deleted = TRUE WHERE id = %s", (removed["id"],))
    db_connection.commit()

    mock_current_user(user=viewer_user)
    response = client.get("/records")

    with db_connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM financial_records WHERE is_deleted = FALSE")
        expected_count = cursor.fetchone()[0]

    assert len(response.json()) == expected_count
