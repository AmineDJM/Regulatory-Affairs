"""Sponsoring — requests and validation workflow."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import notify, notify_roles, record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import PRIORITY, SPONSORING_STATUS, label_of
from amd.models import SponsoringRequest
from amd.rbac import can
from ._common import document_panel

MODULE = "SPONSORING"
DIRECTION_THRESHOLD = 100000
FINAL = {"ACCEPTED", "REFUSED", "PAID", "CLOSED"}
DOC_CATEGORIES = ["REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"]


def render() -> None:
    user = current_user()
    ui.page_header("Sponsoring", "Demandes de sponsoring et validation.")

    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouvelle demande", type="primary"):
            _create_dialog(user)

    with session_scope() as s:
        reqs = s.query(SponsoringRequest).order_by(SponsoringRequest.request_date.desc()).all()
        rows = [{
            "id": r.id, "Réf.": r.reference, "Date": ui.fmt_date(r.request_date), "Institution": r.institution,
            "Médecin": r.doctor or "", "Type": r.type, "Ville": r.city or "",
            "Demandé": ui.fmt_currency(r.amount_requested), "Accordé": ui.fmt_currency(r.amount_granted),
            "Importance": label_of(PRIORITY, r.strategic_importance), "Statut": label_of(SPONSORING_STATUS, r.status),
        } for r in reqs]

    if not rows:
        st.info("Aucune demande de sponsoring.")
        return
    df = pd.DataFrame(rows)
    cols = [c for c in df.columns if c != "id"]
    filtered = ui.text_filter(df, ["Réf.", "Institution", "Médecin", "Type"], "Rechercher institution, médecin…")
    ui.show_table(filtered[cols], column_maps={"Statut": SPONSORING_STATUS, "Importance": PRIORITY})
    ui.export_buttons(filtered[cols], "sponsoring")

    st.divider()
    labels = {f"{r['Réf.']} — {r['Institution']}": r["id"] for r in rows}
    choice = st.selectbox("🔎 Ouvrir une demande", ["—"] + list(labels.keys()))
    if choice != "—":
        _detail(user, labels[choice])


@st.dialog("Nouvelle demande de sponsoring", width="large")
def _create_dialog(user):
    with st.form("new_spo"):
        c1, c2 = st.columns(2)
        inst = c1.text_input("Institution / Association *")
        doctor = c2.text_input("Médecin concerné")
        spec = c1.text_input("Spécialité")
        city = c2.text_input("Ville")
        type_ = c1.text_input("Type de sponsoring", value="Congrès")
        product = c2.text_input("Produit concerné")
        amount = c1.number_input("Montant demandé (DZD)", min_value=0, step=10000)
        imp = c2.selectbox("Importance stratégique", list(PRIORITY.keys()), index=1, format_func=lambda k: PRIORITY[k][0])
        desc = st.text_area("Description de la demande")
        if st.form_submit_button("Enregistrer", type="primary"):
            if not inst.strip():
                st.error("L'institution est obligatoire.")
                return
            with session_scope() as s:
                year = dt.datetime.utcnow().year
                n = s.query(SponsoringRequest).filter(SponsoringRequest.reference.like(f"SPO-{year}-%")).count()
                needs_dir = amount > DIRECTION_THRESHOLD
                r = SponsoringRequest(
                    reference=f"SPO-{year}-{n+1:03d}", institution=inst.strip(), doctor=doctor or None,
                    specialty=spec or None, city=city or None, type=type_ or "Sponsoring", description=desc or None,
                    amount_requested=amount or None, product=product or None, strategic_importance=imp,
                    status="AWAITING_DIRECTION" if needs_dir else "RECEIVED", requester_id=user["id"],
                )
                s.add(r)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Sponsoring", entity_type="SPONSORING", entity_id=r.id,
                             summary=f"Demande {r.reference} — {inst}")
                if needs_dir:
                    notify_roles(s, ["DIRECTION", "SUPER_ADMIN"], "SPONSORING_VALIDATION", "Sponsoring à valider",
                                 f"{r.reference} — {inst}", "Sponsoring")
            st.success("Demande créée.")
            st.rerun()


def _detail(user, req_id):
    with session_scope() as s:
        r = s.get(SponsoringRequest, req_id)
        info = {
            "ref": r.reference, "inst": r.institution, "doctor": r.doctor, "spec": r.specialty, "type": r.type,
            "city": r.city, "product": r.product, "req": r.amount_requested, "granted": r.amount_granted,
            "status": r.status, "imp": r.strategic_importance, "desc": r.description, "decision": r.final_decision,
            "validated_by": r.validated_by,
        }
    st.markdown(f"### {info['inst']} &nbsp; <span style='font-size:13px;color:#64748b'>{info['ref']}</span>", unsafe_allow_html=True)
    c = st.columns(4)
    c[0].markdown("**Statut**  \n" + ui.status_pill(SPONSORING_STATUS, info["status"]), unsafe_allow_html=True)
    c[1].markdown("**Importance**  \n" + ui.status_pill(PRIORITY, info["imp"]), unsafe_allow_html=True)
    c[2].markdown(f"**Demandé**  \n{ui.fmt_currency(info['req'])}")
    c[3].markdown(f"**Accordé**  \n{ui.fmt_currency(info['granted'])}")
    st.markdown(f"**Type** · {info['type']} — **Ville** · {info['city'] or '—'} — **Produit** · {info['product'] or '—'}")
    if info["doctor"]:
        st.markdown(f"**Médecin** · {info['doctor']} ({info['spec'] or '—'})")
    st.markdown(f"**Description** · {info['desc'] or '—'}")
    if info["decision"]:
        st.markdown(f"**Décision finale** · {info['decision']} _(par {info['validated_by']})_")

    if can(user["role"], MODULE, "VALIDATE") and info["status"] not in FINAL:
        st.markdown("#### ⚖️ Décision")
        with st.form(f"decide_{req_id}"):
            decision = st.radio("Décision", ["ACCEPTED", "REFUSED", "PAID"],
                                format_func=lambda k: {"ACCEPTED": "Accepter", "REFUSED": "Refuser", "PAID": "Marquer payé"}[k],
                                horizontal=True)
            granted = st.number_input("Montant accordé (DZD)", min_value=0, step=10000,
                                      value=int(info["req"] or 0))
            note = st.text_area("Note de décision")
            if st.form_submit_button("Confirmer la décision", type="primary"):
                with session_scope() as s:
                    r = s.get(SponsoringRequest, req_id)
                    old = r.status
                    r.status = decision
                    r.amount_granted = granted if decision in ("ACCEPTED", "PAID") else 0
                    r.final_decision = note or None
                    r.validated_by = user["name"]
                    r.validation_date = dt.datetime.utcnow()
                    record_audit(s, user["id"], "REFUSE" if decision == "REFUSED" else "VALIDATE", "Sponsoring",
                                 entity_type="SPONSORING", entity_id=req_id, field="status", old_value=old,
                                 new_value=decision, summary=f"Décision sur {r.reference}: {decision}")
                    if r.requester_id:
                        notify(s, r.requester_id, "SPONSORING_VALIDATION",
                               f"Sponsoring {'refusé' if decision=='REFUSED' else 'accepté'}", r.reference, "Sponsoring")
                st.rerun()

    document_panel(user, "SPONSORING", req_id, "Sponsoring", categories=DOC_CATEGORIES,
                   can_upload=can(user["role"], MODULE, "UPLOAD"), can_delete=can(user["role"], MODULE, "DELETE"))
