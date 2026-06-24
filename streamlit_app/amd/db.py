"""SQLite engine + session management for AMD Internal OS."""
from __future__ import annotations

import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base


def _resolve_db_path() -> Path:
    """Pick a writable location for the SQLite file.

    Local dev keeps the database next to the app for persistence. Hosts that
    mount the repository read-only (e.g. Streamlit Community Cloud, which serves
    the code from /mount/src) can't create the file there, so we fall back to a
    writable temp directory. Override explicitly with AMD_DB_PATH.
    """
    env = os.environ.get("AMD_DB_PATH")
    if env:
        return Path(env)
    app_dir = Path(__file__).resolve().parent.parent
    probe = app_dir / ".amd_write_test"
    try:
        probe.write_text("ok")
        probe.unlink()
        return app_dir / "amd.db"
    except OSError:
        return Path(tempfile.gettempdir()) / "amd_internal_os.db"


DB_PATH = _resolve_db_path()

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
