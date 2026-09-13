from typing import Optional

from app.core.database import Transaction, execute_query


def _exec(query: str, params=None, tx: Optional[Transaction] = None):
    if tx is not None:
        if hasattr(tx, "execute"):
            return tx.execute(query, params)
        return Transaction(tx).execute(query, params)
    return execute_query(query, params)


def find_by_email(email: str, tx: Optional[Transaction] = None):
    rows = _exec(
        "SELECT id, email, hashed_password, full_name, role FROM users "
        "WHERE email = %s LIMIT 1",
        (email,),
        tx=tx,
    )
    return rows[0] if rows else None


def find_by_id(user_id: int, tx: Optional[Transaction] = None):
    rows = _exec(
        "SELECT id, email, hashed_password, full_name, role FROM users "
        "WHERE id = %s LIMIT 1",
        (user_id,),
        tx=tx,
    )
    return rows[0] if rows else None


def email_exists(email: str, tx: Optional[Transaction] = None) -> bool:
    rows = _exec("SELECT id FROM users WHERE email = %s LIMIT 1", (email,), tx=tx)
    return bool(rows)


def create(
    email: str,
    hashed_password: str,
    full_name: str,
    role: str = "user",
    tx: Optional[Transaction] = None,
) -> int:
    rows = _exec(
        "INSERT INTO users (email, hashed_password, full_name, role) "
        "VALUES (%s, %s, %s, %s) RETURNING id",
        (email, hashed_password, full_name, role),
        tx=tx,
    )
    return rows[0]["id"] if rows else None

