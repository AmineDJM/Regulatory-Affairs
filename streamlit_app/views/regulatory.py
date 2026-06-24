"""Regulatory — DCI dossiers, 17-step workflow, documents, comments."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import notify, record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import (
    PRIORITY, PRODUCT_TYPE, REGULATORY_STATUS, REGULATORY_STEP_ORDER,
    REGULATORY_STEP_TYPE, STEP_STATUS, label_of,
)
from amd.models import RegulatoryProduct, RegulatoryStep
from amd.rbac import apply_scope, can, scope_regulatory
from ._common import comment_panel, document_panel, user_options

MODULE = "REGULATORY"
DOC_CATEGORIES = ["CTD_FULL", "MODULE_1", "MODULE_2", "MODULE_3", "MODULE_4", "MODULE_5",
                  "GMP_CERTIFICATE", "CPP", "ORIGIN_AMM", "SUBMISSION_LETTER", "BV_RECEIPT",
                  "QUERY_RESPONSE", "REGISTRATION_DECISION", "OTHER"]
STEP_LABELS = [v[0] for v in STEP_STATUS.values()]
STEP_LABEL_TO_KEY = {v[0]: k for k, v in STEP_STATUS.items()}


def render() -> None:
    user = current_user()
    ui.page_header("Regulatory", "Suivi des molécules/DCI jusqu'à l'enregistrement.")

    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouveau dossier", type="primary"):
            _create_dialog(user)

    with session_scope() as s:
        products = apply_scope(s.query(RegulatoryProduct), scope_regulatory(user)).order_by(
            RegulatoryProduct.updated_at.desc()).all()
        rows = []
        for p in products:
            total = len(p.steps) or 17
            done = sum(1 for st_ in p.steps if st_.status == "DONE")
            rows.append({
                "id": p.id, "Référence": p.reference, "DCI": p.dci, "Nom commercial": p.brand_name or "",
                "Type": label_of(PRODUCT_TYPE, p.product_type), "Priorité": label_of(PRIORITY, p.priority),
                "Statut": label_of(REGULATORY_STATUS, p.status),
                "Responsable": p.responsible.name if p.responsible else "",
                "Assistante": p.assistant.name if p.assistant else "",
                "Avancement": f"{done}/{total}", "Date cible": ui.fmt_date(p.target_date),
            })

    if not rows:
        st.info("Aucun dossier réglementaire visible pour votre profil.")
        return

    df = pd.DataFrame(rows)
    display_cols = [c for c in df.columns if c != "id"]
    filtered = ui.text_filter(df, ["Référence", "DCI", "Nom commercial", "Responsable"], "Rechercher DCI, référence…")
    ui.show_table(filtered[display_cols], column_maps={"Statut": REGULATORY_STATUS, "Priorité": PRIORITY})
    ui.export_buttons(filtered[display_cols], "regulatory")

    st.divider()
    labels = {f"{r['Référence']} — {r['DCI']}": r["id"] for r in rows}
    choice = st.selectbox("🔎 Ouvrir un dossier", ["—"] + list(labels.keys()))
    if choice != "—":
        _detail(user, labels[choice])


@st.dialog("Nouveau dossier réglementaire", width="large")
def _create_dialog(user):
    users = user_options(["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "DIRECTION"])
    uopts = {"—": None, **{name: uid for uid, name in users}}
    with st.form("new_reg"):
        c1, c2 = st.columns(2)
        dci = c1.text_input("DCI *")
        brand = c2.text_input("Nom commercial envisagé")
        dosage = c1.text_input("Dosage")
        form = c2.text_input("Forme pharmaceutique")
        cls = c1.text_input("Classe thérapeutique")
        lab = c2.text_input("Fournisseur / Laboratoire")
        country = c1.text_input("Pays d'origine")
        ptype = c2.selectbox("Type de produit", list(PRODUCT_TYPE.keys()), format_func=lambda k: PRODUCT_TYPE[k])
        prio = c1.selectbox("Priorité", list(PRIORITY.keys()), index=1, format_func=lambda k: PRIORITY[k][0])
        status = c2.selectbox("Statut initial", list(REGULATORY_STATUS.keys()), format_func=lambda k: REGULATORY_STATUS[k][0])
        resp = c1.selectbox("Responsable", list(uopts.keys()))
        asst = c2.selectbox("Assistante assignée", list(uopts.keys()))
        target = c1.date_input("Date cible", value=None)
        comments = st.text_area("Commentaires")
        if st.form_submit_button("Créer le dossier", type="primary"):
            if not dci.strip():
                st.error("La DCI est obligatoire.")
                return
            with session_scope() as s:
                year = dt.datetime.utcnow().year
                n = s.query(RegulatoryProduct).filter(RegulatoryProduct.reference.like(f"REG-{year}-%")).count()
                resp_id, asst_id = uopts[resp], uopts[asst]
                p = RegulatoryProduct(
                    reference=f"REG-{year}-{n+1:03d}", dci=dci.strip(), brand_name=brand or None, dosage=dosage or None,
                    pharmaceutical_form=form or None, therapeutic_class=cls or None, partner_lab=lab or None,
                    country_of_origin=country or None, product_type=ptype, priority=prio, status=status,
                    responsible_id=resp_id, assistant_id=asst_id,
                    target_date=dt.datetime.combine(target, dt.time()) if target else None,
                    comments=comments or None, created_by_id=user["id"],
                )
                from amd.models import User as U
                for uid in {resp_id, asst_id}:
                    if uid:
                        u = s.get(U, uid)
                        if u:
                            p.assigned_users.append(u)
                p.steps = [RegulatoryStep(type=t, order=i + 1, status="NOT_STARTED")
                           for i, t in enumerate(REGULATORY_STEP_ORDER)]
                s.add(p)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Regulatory", entity_type="REGULATORY_PRODUCT",
                             entity_id=p.id, summary=f"Nouveau dossier {p.reference} — {dci}")
                if asst_id and asst_id != user["id"]:
                    notify(s, asst_id, "ASSIGNMENT", "Nouveau dossier assigné", f"{p.reference} — {dci}", "Regulatory")
            st.success(f"Dossier créé.")
            st.rerun()


def _detail(user, product_id):
    can_update = can(user["role"], MODULE, "UPDATE")
    with session_scope() as s:
        p = s.get(RegulatoryProduct, product_id)
        if not p:
            st.error("Dossier introuvable.")
            return
        info = {
            "ref": p.reference, "dci": p.dci, "brand": p.brand_name, "status": p.status, "priority": p.priority,
            "dosage": p.dosage, "form": p.pharmaceutical_form, "cls": p.therapeutic_class,
            "ptype": p.product_type, "lab": p.partner_lab, "country": p.country_of_origin,
            "resp": p.responsible.name if p.responsible else None, "asst": p.assistant.name if p.assistant else None,
            "target": p.target_date, "assigned": [u.name for u in p.assigned_users],
        }
        steps = [{"id": x.id, "order": x.order, "type": x.type, "status": x.status,
                  "planned": x.planned_date, "actual": x.actual_date, "responsible": x.responsible,
                  "missing": x.missing_docs, "comment": x.comment} for x in p.steps]

    st.markdown(f"### {info['dci']} &nbsp; <span style='font-size:13px;color:#64748b'>{info['ref']}</span>", unsafe_allow_html=True)
    cols = st.columns([1, 1, 1, 2])
    cols[0].markdown("**Statut**  \n" + ui.status_pill(REGULATORY_STATUS, info["status"]), unsafe_allow_html=True)
    cols[1].markdown("**Priorité**  \n" + ui.status_pill(PRIORITY, info["priority"]), unsafe_allow_html=True)
    cols[2].markdown(f"**Type**  \n{label_of(PRODUCT_TYPE, info['ptype'])}")
    cols[3].markdown(f"**Avancement**  \n{sum(1 for x in steps if x['status']=='DONE')}/{len(steps)} étapes")

    info_cols = st.columns(3)
    info_cols[0].markdown(f"**Dosage** · {info['dosage'] or '—'}  \n**Forme** · {info['form'] or '—'}")
    info_cols[1].markdown(f"**Classe** · {info['cls'] or '—'}  \n**Lab** · {info['lab'] or '—'}")
    info_cols[2].markdown(f"**Responsable** · {info['resp'] or '—'}  \n**Assistante** · {info['asst'] or '—'}")

    if can_update:
        with st.expander("✏️ Modifier le statut / la priorité"):
            with st.form(f"status_{product_id}"):
                c1, c2 = st.columns(2)
                ns = c1.selectbox("Statut", list(REGULATORY_STATUS.keys()),
                                  index=list(REGULATORY_STATUS).index(info["status"]),
                                  format_func=lambda k: REGULATORY_STATUS[k][0])
                npr = c2.selectbox("Priorité", list(PRIORITY.keys()), index=list(PRIORITY).index(info["priority"]),
                                   format_func=lambda k: PRIORITY[k][0])
                if st.form_submit_button("Enregistrer"):
                    with session_scope() as s:
                        prod = s.get(RegulatoryProduct, product_id)
                        old = prod.status
                        prod.status, prod.priority = ns, npr
                        record_audit(s, user["id"], "UPDATE", "Regulatory", entity_type="REGULATORY_PRODUCT",
                                     entity_id=product_id, field="status", old_value=old, new_value=ns,
                                     summary=f"Statut {prod.reference} → {ns}")
                    st.rerun()

    # Workflow steps — editable grid
    st.markdown("#### 🔬 Workflow réglementaire")
    step_df = pd.DataFrame([{
        "id": x["id"], "Étape": f"{x['order']}. {label_of(REGULATORY_STEP_TYPE, x['type'])}",
        "Statut": label_of(STEP_STATUS, x["status"]),
        "Prévu": x["planned"].date() if x["planned"] else None,
        "Réel": x["actual"].date() if x["actual"] else None,
        "Responsable": x["responsible"] or "", "Pièces manquantes": x["missing"] or "",
    } for x in steps])

    edited = st.data_editor(
        step_df, hide_index=True, use_container_width=True, disabled=([] if can_update else step_df.columns) or ["Étape"],
        column_config={
            "id": None,
            "Étape": st.column_config.TextColumn(disabled=True),
            "Statut": st.column_config.SelectboxColumn(options=STEP_LABELS),
            "Prévu": st.column_config.DateColumn(format="DD/MM/YYYY"),
            "Réel": st.column_config.DateColumn(format="DD/MM/YYYY"),
        },
        key=f"steps_{product_id}",
    )
    if can_update and st.button("💾 Enregistrer les étapes", key=f"savesteps_{product_id}"):
        with session_scope() as s:
            for _, row in edited.iterrows():
                step = s.get(RegulatoryStep, row["id"])
                if not step:
                    continue
                step.status = STEP_LABEL_TO_KEY.get(row["Statut"], step.status)
                step.planned_date = dt.datetime.combine(row["Prévu"], dt.time()) if pd.notna(row["Prévu"]) and row["Prévu"] else None
                step.actual_date = dt.datetime.combine(row["Réel"], dt.time()) if pd.notna(row["Réel"]) and row["Réel"] else None
                step.responsible = row["Responsable"] or None
                step.missing_docs = row["Pièces manquantes"] or None
            record_audit(s, user["id"], "UPDATE", "Regulatory", entity_type="REGULATORY_PRODUCT",
                         entity_id=product_id, summary="Mise à jour des étapes du workflow")
        st.success("Étapes enregistrées.")
        st.rerun()

    c1, c2 = st.columns(2)
    with c1:
        document_panel(user, "REGULATORY_PRODUCT", product_id, "Regulatory", categories=DOC_CATEGORIES,
                       can_upload=can(user["role"], MODULE, "UPLOAD"), can_delete=can(user["role"], MODULE, "DELETE"))
    with c2:
        comment_panel(user, "REGULATORY_PRODUCT", product_id)
