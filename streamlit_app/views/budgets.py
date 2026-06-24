"""Budgets — planned vs actual, consumed/remaining, overspend alerts."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import notify_roles, record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import BUDGET_CATEGORY, BUDGET_STATUS, label_of
from amd.models import BudgetLine
from amd.rbac import can

MODULE = "BUDGETS"
MONTHS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]


def _status_of(consumed, initial):
    if initial > 0 and consumed > initial:
        return "OVER_BUDGET"
    if initial > 0 and consumed / initial > 0.8:
        return "AT_RISK"
    return "ON_TRACK"


def render() -> None:
    user = current_user()
    year = dt.datetime.utcnow().year
    ui.page_header("Budgets", "Suivi des budgets par département : prévu vs réel.")

    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouvelle ligne", type="primary"):
            _create_dialog(user, year)

    with session_scope() as s:
        lines = s.query(BudgetLine).order_by(BudgetLine.year.desc(), BudgetLine.department).all()
        rows = []
        for l in lines:
            rows.append({
                "id": l.id, "Année": l.year, "Mois": MONTHS[l.month] if l.month else "Annuel",
                "Département": label_of(BUDGET_CATEGORY, l.department), "Ligne": l.label,
                "Initial": ui.fmt_currency(l.initial_budget), "Consommé": ui.fmt_currency(l.consumed_budget),
                "Restant": ui.fmt_currency(l.initial_budget - l.consumed_budget),
                "Conso %": round(l.consumed_budget / l.initial_budget * 100) if l.initial_budget else 0,
                "Statut": label_of(BUDGET_STATUS, l.status), "_year": l.year,
                "_init": l.initial_budget, "_cons": l.consumed_budget,
            })

    df = pd.DataFrame(rows)
    year_rows = [r for r in rows if r["_year"] == year]
    ui.kpi_row([
        {"label": f"Budget initial {year}", "value": ui.fmt_compact(sum(r["_init"] for r in year_rows)), "tone": "info"},
        {"label": "Consommé", "value": ui.fmt_compact(sum(r["_cons"] for r in year_rows)), "tone": "warning"},
        {"label": "Restant", "value": ui.fmt_compact(sum(r["_init"] - r["_cons"] for r in year_rows)), "tone": "success"},
        {"label": "Lignes", "value": len(year_rows), "tone": "neutral"},
    ])
    if df.empty:
        st.info("Aucune ligne budgétaire.")
        return
    show_cols = ["Année", "Mois", "Département", "Ligne", "Initial", "Consommé", "Restant", "Conso %", "Statut"]
    filtered = ui.text_filter(df, ["Département", "Ligne"], "Rechercher une ligne, un département…")
    ui.show_table(filtered[show_cols], column_maps={"Statut": BUDGET_STATUS})
    ui.export_buttons(filtered[show_cols], "budgets")


@st.dialog("Nouvelle ligne budgétaire")
def _create_dialog(user, year):
    with st.form("new_budget"):
        c1, c2 = st.columns(2)
        y = c1.number_input("Année", value=year, step=1)
        month = c2.number_input("Mois (0 = annuel)", min_value=0, max_value=12, value=0)
        dep = c1.selectbox("Département", list(BUDGET_CATEGORY.keys()), format_func=lambda k: BUDGET_CATEGORY[k])
        label = c2.text_input("Ligne budgétaire *")
        initial = c1.number_input("Budget initial (DZD)", min_value=0, step=100000)
        consumed = c2.number_input("Budget consommé (DZD)", min_value=0, step=100000)
        future = c1.number_input("Engagements futurs (DZD)", min_value=0, step=50000)
        comments = st.text_area("Commentaires")
        if st.form_submit_button("Enregistrer", type="primary"):
            if not label.strip():
                st.error("La ligne budgétaire est obligatoire.")
                return
            status = _status_of(consumed, initial)
            with session_scope() as s:
                line = BudgetLine(year=int(y), month=int(month) or None, department=dep, label=label.strip(),
                                  initial_budget=initial, consumed_budget=consumed, future_committed=future,
                                  status=status, comments=comments or None, owner_id=user["id"])
                s.add(line)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Budgets", entity_type="BUDGET", entity_id=line.id,
                             summary=f"Ligne budgétaire « {label} »")
                if status == "OVER_BUDGET":
                    notify_roles(s, ["DIRECTION", "FINANCE_BUDGET_MANAGER"], "BUDGET_EXCEEDED", "Budget dépassé", label, "Budgets")
            st.success("Ligne créée.")
            st.rerun()
