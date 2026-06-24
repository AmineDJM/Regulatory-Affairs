"""AMD Internal OS — Streamlit edition (Adventum Pharma).

Entry point: ensures the database, gates on authentication, then builds an
RBAC-filtered navigation across all modules.
"""
from __future__ import annotations

import streamlit as st

st.set_page_config(page_title="AMD Internal OS — Adventum", page_icon="🅰️", layout="wide")

from amd.auth import authenticate, current_user, login_user, logout  # noqa: E402
from amd.db import init_db, session_scope  # noqa: E402
from amd.labels import ROLE_LABELS  # noqa: E402
from amd.models import User  # noqa: E402
from amd.rbac import accessible_modules  # noqa: E402
from views import NAV  # noqa: E402

CUSTOM_CSS = """
<style>
  .block-container {padding-top: 2.2rem; padding-bottom: 2rem; max-width: 1400px;}
  [data-testid="stSidebarNav"] {background: transparent;}
  section[data-testid="stSidebar"] {background: #0f1b2d;}
  section[data-testid="stSidebar"] * {color: #e2e8f0;}
  section[data-testid="stSidebar"] a[aria-current="page"] {background: rgba(255,255,255,.10); border-radius:8px;}
  h2 {font-weight: 700; letter-spacing: -0.01em;}
  [data-testid="stMetricValue"] {font-size: 1.5rem;}
</style>
"""


def ensure_database() -> None:
    """Create tables and seed demo data on first run."""
    init_db()
    with session_scope() as s:
        empty = s.query(User).count() == 0
    if empty:
        from amd.seed import seed
        seed()


def login_screen() -> None:
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)
    _, mid, _ = st.columns([1, 1.4, 1])
    with mid:
        st.markdown(
            "<div style='text-align:center;margin-bottom:8px'>"
            "<div style='display:inline-flex;width:46px;height:46px;border-radius:12px;background:#1e293b;"
            "color:#fff;font-weight:700;font-size:20px;align-items:center;justify-content:center'>A</div>"
            "<h2 style='margin:8px 0 0'>AMD Internal OS</h2>"
            "<div style='color:#64748b'>Adventum Pharma — espace interne</div></div>",
            unsafe_allow_html=True,
        )
        with st.form("login"):
            st.text_input("Email professionnel", key="login_email", placeholder="prenom@adventum.dz")
            st.text_input("Mot de passe", key="login_pwd", type="password", placeholder="••••••••")
            submitted = st.form_submit_button("Se connecter", type="primary", use_container_width=True)
        if submitted:
            user = authenticate(st.session_state.get("login_email", ""), st.session_state.get("login_pwd", ""))
            if user:
                login_user(user)
                st.rerun()
            else:
                st.error("Identifiants invalides. Vérifiez votre email et votre mot de passe.")

        st.caption("Comptes de démonstration — mot de passe : `password123`")
        demos = [
            ("Direction", "direction@adventum.dz"), ("Resp. Regulatory", "regulatory@adventum.dz"),
            ("Assistante Reg.", "assistante1@adventum.dz"), ("Logistique", "logistique@adventum.dz"),
            ("Délégué médical", "delegue1@adventum.dz"), ("Super Admin", "superadmin@adventum.dz"),
        ]
        cols = st.columns(3)
        for i, (label, email) in enumerate(demos):
            cols[i % 3].button(label, key=f"demo_{i}", on_click=_prefill, args=(email,), use_container_width=True)


def _prefill(email: str) -> None:
    st.session_state["login_email"] = email
    st.session_state["login_pwd"] = "password123"


GROUP_ORDER = ["Pilotage", "Pôles", "Transverse", "Système"]


def app_shell(user: dict) -> None:
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)
    modules = accessible_modules(user["role"])

    # Sidebar header + account.
    with st.sidebar:
        st.markdown(
            "<div style='display:flex;align-items:center;gap:10px;padding:4px 0 14px'>"
            "<div style='width:34px;height:34px;border-radius:9px;background:#3b82f6;color:#fff;font-weight:700;"
            "display:flex;align-items:center;justify-content:center'>A</div>"
            "<div><div style='font-weight:700'>AMD Internal OS</div>"
            "<div style='font-size:11px;color:#94a3b8'>Adventum Pharma</div></div></div>",
            unsafe_allow_html=True,
        )

    # Build grouped, RBAC-filtered pages.
    grouped: dict[str, list] = {}
    for module in modules:
        if module not in NAV:
            continue
        title, icon, group, fn = NAV[module]
        page = st.Page(fn, title=title, icon=icon, url_path=module.lower())
        grouped.setdefault(group, []).append(page)
    pages = {g: grouped[g] for g in GROUP_ORDER if g in grouped}

    nav = st.navigation(pages, position="sidebar")

    with st.sidebar:
        st.divider()
        st.markdown(
            f"<div style='font-size:13px'><b>{user['name']}</b><br>"
            f"<span style='color:#94a3b8;font-size:12px'>{ROLE_LABELS.get(user['role'], user['role'])}</span></div>",
            unsafe_allow_html=True,
        )
        if st.button("🚪 Se déconnecter", use_container_width=True):
            logout()
            st.rerun()

    nav.run()


def main() -> None:
    ensure_database()
    user = current_user()
    if not user:
        login_screen()
    else:
        app_shell(user)


main()
