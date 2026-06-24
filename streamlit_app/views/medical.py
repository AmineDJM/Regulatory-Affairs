"""Promotion médicale — médecins & visites scopés par délégué."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import INFLUENCE_LEVEL, PRIORITY, VISIT_STATUS, label_of
from amd.models import MedicalDoctor, MedicalVisit
from amd.rbac import apply_scope, can, scope_medical_doctors, scope_medical_visits
from ._common import user_options

MODULE = "MEDICAL"


def render() -> None:
    user = current_user()
    is_manager = user["role"] in ("MEDICAL_PROMOTION_MANAGER", "SUPER_ADMIN", "DIRECTION")
    ui.page_header("Promotion médicale", "Médecins, plans de tournée et visites des délégués.")

    with session_scope() as s:
        doctors = apply_scope(s.query(MedicalDoctor), scope_medical_doctors(user)).order_by(MedicalDoctor.name).all()
        visits = apply_scope(s.query(MedicalVisit), scope_medical_visits(user)).order_by(MedicalVisit.date.desc()).all()
        doc_rows = [{
            "id": d.id, "Médecin": d.name, "Spécialité": d.specialty or "", "Établissement": d.institution or "",
            "Ville": d.city or "", "Région": d.region or "", "Influence": label_of(INFLUENCE_LEVEL, d.influence_level),
            "Potentiel": label_of(PRIORITY, d.prescription_potential), "Dernière visite": ui.fmt_date(d.last_visit),
            "Délégué": d.delegate.name if d.delegate else "",
        } for d in doctors]
        visit_rows = [{
            "Date": ui.fmt_date(v.date), "Médecin": v.doctor.name if v.doctor else "—",
            "Délégué": v.delegate.name if v.delegate else "", "Région": v.region or "",
            "Objectif": v.objective or "", "Statut": label_of(VISIT_STATUS, v.status),
        } for v in visits]
        doctor_choices = [(d.id, d.name) for d in doctors]

    month_start = dt.datetime(dt.datetime.utcnow().year, dt.datetime.utcnow().month, 1)
    completed = sum(1 for v in visits if v.status == "COMPLETED" and v.date >= month_start)
    ui.kpi_row([
        {"label": "Médecins", "value": len(doc_rows), "tone": "info"},
        {"label": "Visites totales", "value": len(visit_rows), "tone": "neutral"},
        {"label": "Réalisées (mois)", "value": completed, "tone": "success"},
        {"label": "Prévues", "value": sum(1 for v in visits if v.status == "PLANNED"), "tone": "info"},
    ])

    delegate_opts = user_options(["MEDICAL_DELEGATE"]) if is_manager else []
    tab_doc, tab_visit = st.tabs(["🩺 Médecins", "📅 Visites & tournées"])

    with tab_doc:
        if can(user["role"], MODULE, "CREATE") and st.button("➕ Nouveau médecin"):
            _doctor_dialog(user, is_manager, delegate_opts)
        if doc_rows:
            df = pd.DataFrame(doc_rows)
            cols = [c for c in df.columns if c != "id"]
            filtered = ui.text_filter(df, ["Médecin", "Ville", "Spécialité"], "Rechercher médecin, ville…", key="doc_q")
            ui.show_table(filtered[cols], column_maps={"Influence": INFLUENCE_LEVEL, "Potentiel": PRIORITY})
            ui.export_buttons(filtered[cols], "medecins")
        else:
            st.info("Aucun médecin.")

    with tab_visit:
        if can(user["role"], MODULE, "CREATE") and st.button("➕ Nouvelle visite"):
            _visit_dialog(user, is_manager, delegate_opts, doctor_choices)
        if visit_rows:
            df = pd.DataFrame(visit_rows)
            filtered = ui.text_filter(df, ["Médecin", "Région", "Objectif"], "Rechercher médecin, région…", key="visit_q")
            ui.show_table(filtered, column_maps={"Statut": VISIT_STATUS})
            ui.export_buttons(filtered, "visites")
        else:
            st.info("Aucune visite.")


@st.dialog("Ajouter un médecin", width="large")
def _doctor_dialog(user, is_manager, delegate_opts):
    with st.form("new_doc"):
        c1, c2 = st.columns(2)
        name = c1.text_input("Nom du médecin *")
        spec = c2.text_input("Spécialité")
        inst = c1.text_input("Hôpital / Clinique")
        city = c2.text_input("Ville")
        region = c1.text_input("Région")
        phone = c2.text_input("Téléphone")
        email = c1.text_input("Email")
        inf = c2.selectbox("Niveau d'influence", list(INFLUENCE_LEVEL.keys()), index=1, format_func=lambda k: INFLUENCE_LEVEL[k][0])
        pot = c1.selectbox("Potentiel prescription", list(PRIORITY.keys()), index=1, format_func=lambda k: PRIORITY[k][0])
        deleg = None
        if is_manager and delegate_opts:
            dmap = {"—": None, **{n: i for i, n in delegate_opts}}
            deleg = dmap[c2.selectbox("Délégué", list(dmap.keys()))]
        if st.form_submit_button("Enregistrer", type="primary"):
            if not name.strip():
                st.error("Le nom est obligatoire.")
                return
            with session_scope() as s:
                d = MedicalDoctor(name=name.strip(), specialty=spec or None, institution=inst or None, city=city or None,
                                  region=region or None, phone=phone or None, email=email or None, influence_level=inf,
                                  prescription_potential=pot,
                                  delegate_id=user["id"] if user["role"] == "MEDICAL_DELEGATE" else deleg)
                s.add(d)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Promotion médicale", entity_type="DOCTOR", entity_id=d.id,
                             summary=f"Médecin « {name} »")
            st.rerun()


@st.dialog("Planifier une visite", width="large")
def _visit_dialog(user, is_manager, delegate_opts, doctor_choices):
    with st.form("new_visit"):
        c1, c2 = st.columns(2)
        date = c1.date_input("Date", value=dt.date.today())
        dmap = {"—": None, **{n: i for i, n in doctor_choices}}
        doctor = dmap[c2.selectbox("Médecin", list(dmap.keys()))]
        region = c1.text_input("Région")
        objective = c2.text_input("Objectif de visite")
        products = c1.text_input("Produits à présenter")
        status = c2.selectbox("Statut", list(VISIT_STATUS.keys()), format_func=lambda k: VISIT_STATUS[k][0])
        deleg = None
        if is_manager and delegate_opts:
            delmap = {"—": None, **{n: i for i, n in delegate_opts}}
            deleg = delmap[st.selectbox("Délégué", list(delmap.keys()))]
        if st.form_submit_button("Enregistrer", type="primary"):
            with session_scope() as s:
                v = MedicalVisit(date=dt.datetime.combine(date, dt.time()), doctor_id=doctor, region=region or None,
                                 objective=objective or None, presented_products=products or None, status=status,
                                 delegate_id=user["id"] if user["role"] == "MEDICAL_DELEGATE" else (deleg or user["id"]))
                s.add(v)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Promotion médicale", entity_type="VISIT", entity_id=v.id,
                             summary="Visite planifiée")
            st.rerun()
