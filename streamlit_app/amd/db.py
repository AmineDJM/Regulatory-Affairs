"""SQLite engine + session management for AMD Internal OS."""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

DB_PATH = Path(os.environ.get("AMD_DB_PATH", Path(__file__).resolve().parent.parent / "amd.db"))

ENGINE = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    future=True,
)
SessionFactory = sessionmaker(bind=ENGINE, expire_on_commit=False, future=True)


def init_db() -> None:
    """Create all tables if they do not exist."""
    Base.metadata.create_all(ENGINE)


def db_exists() -> bool:
    return DB_PATH.exists() and DB_PATH.stat().st_size > 0


@contextmanager
def session_scope() -> Session:
    """Transactional session scope. Commits on success, rolls back on error."""
    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
