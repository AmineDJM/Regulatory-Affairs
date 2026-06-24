"""Administration — users, roles, audit log, settings."""
from __future__ import annotations

import random

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user, hash_password
from amd.db import session_scope
from amd.labels import AUDIT_ACTION, ROLE_LABELS, label_of
from amd.models import AuditLog, User
from amd.rbac import can

MODULE = "ADMIN"
COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"]


def render() -> None:
    user = current_user()
    can_manage = can(user["role"], MODULE, "CREATE")
    ui.page_header("Administration", "Utilisateurs, rôles, journal d'activité et paramètres.")

    if can_manage and st.button("➕ Nouvel utilisateur", type="primary"):
        _create_user_dialog(user)

    with session_scope() as s:
        users = s.query(User).order_by(User.created_at).all()
        user_rows = [{
            "id": u.id, "Nom": u.name, "Email": u.email, "Rôle": ROLE_LABELS.get(u.role, u.role),
            "_role": u.role, "Fonction": u.title or "", "Région": u.region or "",
            "Actif": "✅" if u.is_active else "⛔", "Dernière connexion": ui.fmt_datetime(u.last_login_at),
        } for u in users]
        logs = s.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(200).all()
        audit_rows = [{
            "Date / Heure": ui.fmt_datetime(l.created_at), "Utilisateur": l.actor.name if l.actor else "Système",
            "Action": label_of(AUDIT_ACTION, l.action), "Module": l.module, "Détail": l.summary or "",
            "Changement": f"{l.field}: {l.old_value or '∅'} → {l.new_value or '∅'}" if l.field else "",
        } for l in logs]
        audit_count = s.query(AuditLog).count()

    active = sum(1 for u in user_rows if u["Actif"] == "✅")
    ui.kpi_row([
        {"label": "Utilisateurs", "value": len(user_rows), "tone": "info"},
        {"label": "Actifs", "value": active, "tone": "success"},
        {"label": "Rôles", "value": len(ROLE_LABELS), "tone": "info"},
        {"label": "Entrées d'audit", "value": audit_count, "tone": "neutral"},
    ])

    ui.section("Utilisateurs & rôles")
    df = pd.DataFrame(user_rows)
    show = ["Nom", "Email", "Rôle", "Fonction", "Région", "Actif", "Dernière connexion"]
    ui.show_table(df[show])

    if can_manage:
        with st.expander("✏️ Modifier un rôle / activer-désactiver"):
            names = {f"{u['Nom']} ({u['Email']})": u for u in user_rows}
            target = st.selectbox("Utilisateur", list(names.keys()))
            sel = names[target]
            c1, c2 = st.columns(2)
            new_role = c1.selectbox("Rôle", list(ROLE_LABELS.keys()),
                                    index=list(ROLE_LABELS).index(sel["_role"]), format_func=lambda k: ROLE_LABELS[k])
            if c1.button("Mettre à jour le rôle"):
                with session_scope() as s:
                    u = s.get(User, sel["id"])
                    old = u.role
                    u.role = new_role
                    record_audit(s, user["id"], "UPDATE", "Administration", field="role", old_value=old,
                                 new_value=new_role, summary=f"Rôle de {u.name} → {new_role}")
                st.rerun()
            if c2.button("Activer / Désactiver"):
                if sel["id"] == user["id"]:
                    st.error("Vous ne pouvez pas vous désactiver vous-même.")
                else:
                    with session_scope() as s:
                        u = s.get(User, sel["id"])
                        u.is_active = not u.is_active
                        record_audit(s, user["id"], "UPDATE", "Administration", field="is_active",
                                     new_value=u.is_active, summary=f"{'Activation' if u.is_active else 'Désactivation'} de {u.name}")
                    st.rerun()

    col1, col2 = st.columns([1, 2])
    with col1:
        ui.section("Paramètres entreprise")
        for label, value in [("Société", "Adventum Pharma"), ("Devise", "DZD"),
                             ("Seuil validation Direction", "100 000 DZD"), ("Taille max upload", "25 Mo"),
                             ("Modules actifs", "8 pôles"), ("Politique d'accès", "RBAC + row-level")]:
            st.markdown(f"<div style='display:flex;justify-content:space-between;border-bottom:1px solid #eef2f6;padding:4px 0'>"
                        f"<span style='color:#64748b'>{label}</span><b>{value}</b></div>", unsafe_allow_html=True)
    with col2:
        ui.section("Journal d'activité (audit log)")
        adf = pd.DataFrame(audit_rows)
        filtered = ui.text_filter(adf, ["Utilisateur", "Module", "Détail"], "Rechercher dans le journal…", key="audit_q")
        ui.show_table(filtered, column_maps={"Action": AUDIT_ACTION}, height=420)
        ui.export_buttons(filtered, "audit-log")


@st.dialog("Créer un utilisateur")
def _create_user_dialog(admin):
    with st.form("new_user"):
        name = st.text_input("Nom complet *")
        email = st.text_input("Email *")
        password = st.text_input("Mot de passe (min. 8) *", type="password")
        role = st.selectbox("Rôle", list(ROLE_LABELS.keys()), format_func=lambda k: ROLE_LABELS[k])
        title = st.text_input("Fonction")
        region = st.text_input("Région")
        if st.form_submit_button("Créer", type="primary"):
            if not name.strip() or not email.strip() or len(password) < 8:
                st.error("Nom, email et mot de passe (≥ 8 caractères) sont obligatoires.")
                return
            with session_scope() as s:
                if s.query(User).filter(User.email == email.lower().strip()).count():
                    st.error("Un utilisateur avec cet email existe déjà.")
                    return
                u = User(email=email.lower().strip(), name=name.strip(), password_hash=hash_password(password),
                         role=role, title=title or None, region=region or None, avatar_color=random.choice(COLORS))
                s.add(u)
                s.flush()
                record_audit(s, admin["id"], "CREATE", "Administration", summary=f"Utilisateur créé: {name} ({role})")
            st.success("Utilisateur créé.")
            st.rerun()
