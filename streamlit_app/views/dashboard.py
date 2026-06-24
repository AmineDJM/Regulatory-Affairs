"""Dashboard — role-aware KPIs and charts across all poles."""
from __future__ import annotations

import datetime as dt

import plotly.graph_objects as go
import streamlit as st

from amd import ui
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import BUDGET_CATEGORY, REGULATORY_STATUS, ROLE_LABELS, TONES, color_of
from amd.models import (
    BudgetLine, BusinessDevelopmentOpportunity, CongressInternational, CongressNational,
    LogisticsOrder, MedicalVisit, RegulatoryProduct, Sale, SponsoringRequest,
)
from amd.rbac import (
    apply_scope, can, scope_business_development, scope_medical_visits,
    scope_regulatory, scope_sales,
)

MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]


def render() -> None:
    user = current_user()
    st.markdown(f"## Bonjour {user['name'].split()[0]} 👋")
    st.caption(f"Synthèse de votre activité — {ROLE_LABELS.get(user['role'], user['role'])}.")
    now = dt.datetime.utcnow()

    with session_scope() as s:
        if can(user["role"], "REGULATORY", "VIEW"):
            _regulatory(s, user, now)
        if can(user["role"], "SALES", "VIEW"):
            _sales(s, user, now)
        if can(user["role"], "LOGISTICS", "VIEW"):
            _logistics(s, now)
        if can(user["role"], "BUDGETS", "VIEW"):
            _budgets(s, now)
        _secondary(s, user, now)


def _regulatory(s, user, now):
    ui.section("Regulatory")
    rows = apply_scope(s.query(RegulatoryProduct), scope_regulatory(user)).all()
    by_status: dict[str, int] = {}
    late = 0
    for p in rows:
        by_status[p.status] = by_status.get(p.status, 0) + 1
        if p.target_date and p.target_date < now and p.status not in ("DECISION_OBTAINED", "CLOSED"):
            late += 1
    c = by_status.get
    ui.kpi_row([
        {"label": "Dossiers", "value": len(rows), "tone": "info"},
        {"label": "Pré-soumission", "value": c("PRE_SUBMISSION", 0), "tone": "neutral"},
        {"label": "Déposés", "value": c("SUBMITTED", 0), "tone": "info"},
        {"label": "Attente BV/ANPP", "value": c("AWAITING_BV_PAYMENT", 0) + c("AWAITING_ANPP", 0), "tone": "warning"},
        {"label": "Décisions", "value": c("DECISION_OBTAINED", 0) + c("CLOSED", 0), "tone": "success"},
        {"label": "Bloqués / Retard", "value": c("BLOCKED", 0) + late, "tone": "danger"},
    ])
    if by_status:
        labels = [REGULATORY_STATUS.get(k, (k,))[0] for k in by_status]
        colors = [color_of(REGULATORY_STATUS, k) for k in by_status]
        fig = go.Figure(go.Pie(labels=labels, values=list(by_status.values()), hole=0.55,
                               marker=dict(colors=colors), textinfo="value"))
        fig.update_layout(height=280, margin=dict(t=10, b=10, l=10, r=10),
                          title="Répartition des dossiers par statut", legend=dict(orientation="h", y=-0.1))
        st.plotly_chart(fig, use_container_width=True)


def _sales(s, user, now):
    ui.section("Ventes")
    year_start = dt.datetime(now.year, 1, 1)
    month_start = dt.datetime(now.year, now.month, 1)
    rows = apply_scope(s.query(Sale), scope_sales(user)).filter(Sale.date >= year_start).all()
    ca_year = sum(r.revenue for r in rows)
    ca_month = sum(r.revenue for r in rows if r.date >= month_start)
    pch = sum(r.revenue for r in rows if r.is_pch)
    monthly = [0.0] * 12
    by_product: dict[str, float] = {}
    for r in rows:
        monthly[r.date.month - 1] += r.revenue
        by_product[r.product] = by_product.get(r.product, 0) + r.revenue
    ui.kpi_row([
        {"label": "CA mensuel", "value": ui.fmt_compact(ca_month), "hint": "DZD", "tone": "success"},
        {"label": "CA annuel", "value": ui.fmt_compact(ca_year), "hint": "DZD", "tone": "info"},
        {"label": "Ventes PCH", "value": ui.fmt_compact(pch), "hint": "DZD", "tone": "info"},
        {"label": "Transactions", "value": len(rows), "tone": "neutral"},
    ])
    col1, col2 = st.columns(2)
    series = [(MONTHS_FR[(now.month - 1 - i) % 12], round(monthly[(now.month - 1 - i) % 12])) for i in range(5, -1, -1)]
    fig = go.Figure(go.Scatter(x=[x[0] for x in series], y=[x[1] for x in series], fill="tozeroy",
                               line=dict(color=TONES["success"], width=2)))
    fig.update_layout(height=240, margin=dict(t=30, b=10, l=10, r=10), title="CA (6 mois)")
    col1.plotly_chart(fig, use_container_width=True)
    top = sorted(by_product.items(), key=lambda x: -x[1])[:5]
    bar = go.Figure(go.Bar(x=[t[0] for t in top], y=[round(t[1]) for t in top], marker_color=TONES["info"]))
    bar.update_layout(height=240, margin=dict(t=30, b=10, l=10, r=10), title="Top produits")
    col2.plotly_chart(bar, use_container_width=True)


def _logistics(s, now):
    ui.section("Logistique PCH")
    week = now + dt.timedelta(days=7)
    in_progress = s.query(LogisticsOrder).filter(LogisticsOrder.status.notin_(["DELIVERED", "BLOCKED"])).count()
    arriving = s.query(LogisticsOrder).filter(LogisticsOrder.estimated_arrival >= now,
                                              LogisticsOrder.estimated_arrival <= week,
                                              LogisticsOrder.status != "DELIVERED").count()
    late = s.query(LogisticsOrder).filter(LogisticsOrder.estimated_arrival < now,
                                          LogisticsOrder.status != "DELIVERED").count()
    total_value = sum(o.order_value or 0 for o in s.query(LogisticsOrder).all())
    ui.kpi_row([
        {"label": "Commandes en cours", "value": in_progress, "tone": "info"},
        {"label": "Arrivées cette semaine", "value": arriving, "tone": "info"},
        {"label": "Arrivées en retard", "value": late, "tone": "danger"},
        {"label": "Valeur commandes", "value": ui.fmt_compact(total_value), "tone": "neutral"},
    ])


def _budgets(s, now):
    ui.section(f"Budgets {now.year}")
    rows = s.query(BudgetLine).filter(BudgetLine.year == now.year).all()
    initial = sum(r.initial_budget for r in rows)
    consumed = sum(r.consumed_budget for r in rows)
    ui.kpi_row([
        {"label": "Budget initial", "value": ui.fmt_compact(initial), "hint": "DZD", "tone": "info"},
        {"label": "Consommé", "value": ui.fmt_compact(consumed), "hint": "DZD", "tone": "warning"},
        {"label": "Restant", "value": ui.fmt_compact(initial - consumed), "hint": "DZD", "tone": "success"},
    ])
    by_dep: dict[str, list[float]] = {}
    for r in rows:
        d = by_dep.setdefault(r.department, [0, 0])
        d[0] += r.initial_budget
        d[1] += r.consumed_budget
    for dep, (init, cons) in by_dep.items():
        pct = min(100, round(cons / init * 100)) if init else 0
        st.markdown(f"**{BUDGET_CATEGORY.get(dep, dep)}** — {ui.fmt_currency(cons)} / {ui.fmt_currency(init)}")
        st.progress(pct / 100)


def _secondary(s, user, now):
    cols = st.columns(4)
    if can(user["role"], "SPONSORING", "VIEW"):
        pending = s.query(SponsoringRequest).filter(
            SponsoringRequest.status.in_(["RECEIVED", "IN_ANALYSIS", "AWAITING_DIRECTION"])).count()
        granted = sum(r.amount_granted or 0 for r in s.query(SponsoringRequest).filter(
            SponsoringRequest.status.in_(["ACCEPTED", "PAID"])).all())
        with cols[0]:
            st.markdown("**Sponsoring**")
            st.metric("En attente", pending)
            st.metric("Budget accordé", ui.fmt_compact(granted))
    if can(user["role"], "MEDICAL", "VIEW"):
        planned = apply_scope(s.query(MedicalVisit), scope_medical_visits(user)).filter(MedicalVisit.status == "PLANNED").count()
        with cols[1]:
            st.markdown("**Promotion médicale**")
            st.metric("Visites prévues", planned)
    if can(user["role"], "BUSINESS_DEVELOPMENT", "VIEW"):
        inprog = apply_scope(s.query(BusinessDevelopmentOpportunity), scope_business_development(user)).filter(
            BusinessDevelopmentOpportunity.status.notin_(["VALIDATED", "ABANDONED"])).count()
        with cols[2]:
            st.markdown("**Business Development**")
            st.metric("Opportunités en cours", inprog)
    if can(user["role"], "CONGRESS_INTERNATIONAL", "VIEW") or can(user["role"], "CONGRESS_NATIONAL", "VIEW"):
        intl = s.query(CongressInternational).filter(CongressInternational.start_date >= now,
                                                     CongressInternational.status != "CANCELLED").count()
        nat = s.query(CongressNational).filter(CongressNational.date >= now,
                                               CongressNational.status != "CANCELLED").count()
        with cols[3]:
            st.markdown("**Congrès à venir**")
            st.metric("Internationaux", intl)
            st.metric("Nationaux", nat)
