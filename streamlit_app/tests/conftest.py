"""Ensure the SQLite database is seeded before tests run."""
import pytest


@pytest.fixture(scope="session", autouse=True)
def _ensure_database():
    from amd.db import init_db, session_scope
    from amd.models import User

    init_db()
    with session_scope() as s:
        empty = s.query(User).count() == 0
    if empty:
        from amd.seed import seed
        seed()
