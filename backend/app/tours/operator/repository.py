"""Truy vấn bảng operators. Chỉ SQL."""

from typing import Optional

from app.core.database import Transaction, execute_query


def _exec(query: str, params=None, tx: Optional[Transaction] = None):
    if tx is not None:
        if hasattr(tx, "execute"):
            return tx.execute(query, params)
        return Transaction(tx).execute(query, params)
    return execute_query(query, params)


def create_operator(
    user_id: int,
    company_name: str,
    tax_code: Optional[str] = None,
    commission_rate: float = 0.10,
    status: str = "ACTIVE",
    tx: Optional[Transaction] = None,
) -> int:
    rows = _exec(
        """
        INSERT INTO operators (user_id, company_name, tax_code, commission_rate, status)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (user_id, company_name, tax_code, commission_rate, status),
        tx=tx,
    )
    return rows[0]["id"] if rows else None


def find_by_user_id(user_id: int, tx: Optional[Transaction] = None) -> Optional[dict]:
    rows = _exec(
        """
        SELECT id, user_id, company_name, tax_code, commission_rate, status, created_at
        FROM operators
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
        tx=tx,
    )
    return rows[0] if rows else None


def find_by_id(operator_id: int, tx: Optional[Transaction] = None) -> Optional[dict]:
    rows = _exec(
        """
        SELECT o.id, o.user_id, o.company_name, o.tax_code, o.commission_rate, o.status, o.created_at,
               u.email, u.full_name, u.role
        FROM operators o
        JOIN users u ON u.id = o.user_id
        WHERE o.id = %s
        LIMIT 1
        """,
        (operator_id,),
        tx=tx,
    )
    return rows[0] if rows else None


def list_operators(limit: int = 100, offset: int = 0) -> list[dict]:
    return execute_query(
        """
        SELECT o.id, o.user_id, o.company_name, o.tax_code, o.commission_rate, o.status, o.created_at,
               u.email, u.full_name, u.role
        FROM operators o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
        LIMIT %s OFFSET %s
        """,
        (limit, offset),
    ) or []
