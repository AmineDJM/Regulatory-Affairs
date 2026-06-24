"""Congrès internationaux."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import CONGRESS_STATUS, label_of
from amd.models import CongressInternational
from amd.rbac import can

MODULE = "CONGRESS_INTERNATIONAL"


def render() -> None:
    user = current_user()
    ui.page_header("Congrès internationaux", "Organisation et suivi des congrès internationaux.")
    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouveau congrès", type="primary"):
            _create_dialog(user)

    with session_scope() as s:
        items = s.query(CongressInternational).order_by(CongressInternational.start_date.desc()).all()
        rows = [{
            "Congrès": c.name, "Pays": c.country or "", "Ville": c.city or "",
            "Début": ui.fmt_date(c.start_date), "Fin": ui.fmt_date(c.end_date), "Spécialité": c.specialty or "",
            "Budget prévu": ui.fmt_currency(c.planned_budget), "Statut": label_of(CONGRESS_STATUS, c.status),
        } for c in items]
    if not rows:
        st.info("Aucun congrès international.")
        return
    df = pd.DataFrame(rows)
    filtered = ui.text_filter(df, ["Congrès", "Pays", "Spécialité"], "Rechercher congrès, pays…")
    ui.show_table(filtered, column_maps={"Statut": CONGRESS_STATUS})
    ui.export_buttons(filtered, "congres-internationaux")


@st.dialog("Nouveau congrès international", width="large")
def _create_dialog(user):
    with st.form("new_ci"):
        name = st.text_input("Nom du congrès *")
        c1, c2 = st.columns(2)
        country = c1.text_input("Pays")
        city = c2.text_input("Ville")
        start = c1.date_input("Date début", value=None)
        end = c2.date_input("Date fin", value=None)
        spec = c1.text_input("Spécialité")
        budget = c2.number_input("Budget prévu (DZD)", min_value=0, step=100000)
        participants = c1.text_input("Participants Adventum")
        products = c2.text_input("Produits concernés")
        status = st.selectbox("Statut", list(CONGRESS_STATUS.keys()), format_func=lambda k: CONGRESS_STATUS[k][0])
        if st.form_submit_button("Enregistrer", type="primary"):
            if not name.strip():
                st.error("Le nom est obligatoire.")
                return
            with session_scope() as s:
                c = CongressInternational(
                    name=name.strip(), country=country or None, city=city or None,
                    start_date=dt.datetime.combine(start, dt.time()) if start else None,
                    end_date=dt.datetime.combine(end, dt.time()) if end else None, specialty=spec or None,
                    participants=participants or None, products=products or None,
                    planned_budget=budget or None, status=status)
                s.add(c)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Congrès internationaux",
                             entity_type="CONGRESS_INTERNATIONAL", entity_id=c.id, summary=f"Congrès « {name} »")
            st.rerun()
