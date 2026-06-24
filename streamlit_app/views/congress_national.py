"""Congrès nationaux."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import CONGRESS_STATUS, label_of
from amd.models import CongressNational
from amd.rbac import can

MODULE = "CONGRESS_NATIONAL"


def render() -> None:
    user = current_user()
    ui.page_header("Congrès nationaux", "Événements locaux : stands, symposiums, délégués.")
    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouvel événement", type="primary"):
            _create_dialog(user)

    with session_scope() as s:
        items = s.query(CongressNational).order_by(CongressNational.date.desc()).all()
        rows = [{
            "Événement": c.name, "Ville": c.city or "", "Hôpital / Association": c.host_institution or "",
            "Date": ui.fmt_date(c.date), "Spécialité": c.specialty or "", "Budget": ui.fmt_currency(c.budget),
            "Stand": "Oui" if c.has_booth else "—", "Symposium": "Oui" if c.has_symposium else "—",
            "Statut": label_of(CONGRESS_STATUS, c.status),
        } for c in items]
    if not rows:
        st.info("Aucun congrès national.")
        return
    df = pd.DataFrame(rows)
    filtered = ui.text_filter(df, ["Événement", "Ville"], "Rechercher événement, ville…")
    ui.show_table(filtered, column_maps={"Statut": CONGRESS_STATUS})
    ui.export_buttons(filtered, "congres-nationaux")


@st.dialog("Nouvel événement national", width="large")
def _create_dialog(user):
    with st.form("new_cn"):
        name = st.text_input("Nom de l'événement *")
        c1, c2 = st.columns(2)
        city = c1.text_input("Ville")
        host = c2.text_input("Hôpital / Association")
        date = c1.date_input("Date", value=None)
        spec = c2.text_input("Spécialité")
        products = c1.text_input("Produits promus")
        budget = c2.number_input("Budget (DZD)", min_value=0, step=50000)
        delegates = c1.text_input("Délégués présents")
        status = c2.selectbox("Statut", list(CONGRESS_STATUS.keys()), format_func=lambda k: CONGRESS_STATUS[k][0])
        cc1, cc2 = st.columns(2)
        booth = cc1.checkbox("Stand")
        sympo = cc2.checkbox("Symposium")
        if st.form_submit_button("Enregistrer", type="primary"):
            if not name.strip():
                st.error("Le nom est obligatoire.")
                return
            with session_scope() as s:
                c = CongressNational(
                    name=name.strip(), city=city or None, host_institution=host or None,
                    date=dt.datetime.combine(date, dt.time()) if date else None, specialty=spec or None,
                    promoted_products=products or None, budget=budget or None, has_booth=booth,
                    has_symposium=sympo, present_delegates=delegates or None, status=status)
                s.add(c)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Congrès nationaux",
                             entity_type="CONGRESS_NATIONAL", entity_id=c.id, summary=f"Événement « {name} »")
            st.rerun()
