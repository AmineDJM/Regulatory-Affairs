"""Authentication: bcrypt verification + Streamlit session helpers."""
from __future__ import annotations

import datetime as dt

import bcrypt
import streamlit as st

from .audit import record_audit
from .db import session_scope
from .models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def authenticate(email: str, password: str) -> dict | None:
    """Return a user dict on success, else None."""
    email = (email or "").strip().lower()
    with session_scope() as s:
        user = s.query(User).filter(User.email == email).one_or_none()
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        user.last_login_at = dt.datetime.utcnow()
        record_audit(s, user.id, "LOGIN", "Authentification", summary=f"Connexion de {user.name}")
        return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def current_user() -> dict | None:
    return st.session_state.get("user")


def login_user(user: dict) -> None:
    st.session_state["user"] = user


def logout() -> None:
    st.session_state.pop("user", None)
