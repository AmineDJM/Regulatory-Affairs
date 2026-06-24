"""Notifications — internal alerts with read state."""
from __future__ import annotations

import streamlit as st

from amd import ui
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import NOTIFICATION_TYPE
from amd.models import Notification


def render() -> None:
    user = current_user()
    ui.page_header("Notifications", "Échéances, validations, retards et assignations.")

    with session_scope() as s:
        notifs = (
            s.query(Notification)
            .filter(Notification.user_id == user["id"])
            .order_by(Notification.created_at.desc())
            .limit(100)
            .all()
        )
        items = [{"id": n.id, "type": n.type, "title": n.title, "body": n.body,
                  "is_read": n.is_read, "at": n.created_at} for n in notifs]

    unread = [i for i in items if not i["is_read"]]
    col1, col2 = st.columns([3, 1])
    col1.caption(f"{len(unread)} non lue(s) sur {len(items)}")
    if col2.button("✓ Tout marquer comme lu", disabled=not unread, use_container_width=True):
        with session_scope() as s:
            s.query(Notification).filter(Notification.user_id == user["id"],
                                         Notification.is_read.is_(False)).update({"is_read": True})
        st.rerun()

    if not items:
        st.info("Aucune notification. Vous êtes à jour.")
        return

    for it in items:
        bg = "#eff6ff" if not it["is_read"] else "#ffffff"
        c1, c2 = st.columns([8, 1])
        c1.markdown(
            f"<div style='background:{bg};border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:6px'>"
            f"{ui.status_pill(NOTIFICATION_TYPE, it['type'])} "
            f"<span style='color:#94a3b8;font-size:12px'>{ui.fmt_datetime(it['at'])}</span><br>"
            f"<b>{it['title']}</b>" + (f"<br><span style='color:#475569'>{it['body']}</span>" if it['body'] else "")
            + "</div>",
            unsafe_allow_html=True,
        )
        if not it["is_read"]:
            if c2.button("Lu", key=f"read_{it['id']}"):
                with session_scope() as s:
                    n = s.get(Notification, it["id"])
                    if n:
                        n.is_read = True
                st.rerun()
