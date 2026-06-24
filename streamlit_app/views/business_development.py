"""Business Development — pipeline Kanban, scoring, suppliers."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import BD_STATUS, BD_TYPE, PRIORITY, label_of
from amd.models import BusinessDevelopmentOpportunity as BDO
from amd.rbac import apply_scope, can, scope_business_development

MODULE = "BUSINESS_DEVELOPMENT"
STAGES = ["IDEA", "RESEARCH", "CONTACTED", "NDA", "OFFER_RECEIVED", "NEGOTIATION", "VALIDATED", "ABANDONED"]


def render() -> None:
    user = current_user()
    can_update = can(user["role"], MODULE, "UPDATE")
    ui.page_header("Business Development", "Pipeline des opportunités, scoring, suivi fournisseurs.")
    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouvelle opportunité", type="primary"):
            _create_dialog(user)

    with session_scope() as s:
        items = apply_scope(s.query(BDO), scope_business_development(user)).order_by(BDO.created_at.desc()).all()
        rows = [{
            "id": o.id, "Opportunité": o.name, "DCI": o.dci or "", "Type": label_of(BD_TYPE, o.type),
            "Marché": o.target_market or "", "Fournisseur": o.potential_supplier or "", "Pays": o.supplier_country or "",
            "Priorité": label_of(PRIORITY, o.priority), "Score": o.score, "Statut": label_of(BD_STATUS, o.status),
            "_status": o.status, "Prochaine action": o.next_action or "",
        } for o in items]

    inprog = sum(1 for r in rows if r["_status"] not in ("VALIDATED", "ABANDONED"))
    prio = sum(1 for r in rows if r["Priorité"] in (PRIORITY["HIGH"][0], PRIORITY["CRITICAL"][0]))
    ui.kpi_row([
        {"label": "Opportunités", "value": len(rows), "tone": "info"},
        {"label": "En cours", "value": inprog, "tone": "info"},
        {"label": "Prioritaires", "value": prio, "tone": "warning"},
        {"label": "Validées", "value": sum(1 for r in rows if r["_status"] == "VALIDATED"), "tone": "success"},
    ])

    st.markdown("#### 🧭 Pipeline")
    active_stages = [s for s in STAGES if any(r["_status"] == s for r in rows)] or STAGES[:4]
    cols = st.columns(len(active_stages))
    for col, stage in zip(cols, active_stages):
        with col:
            st.markdown(ui.status_pill(BD_STATUS, stage), unsafe_allow_html=True)
            stage_items = [r for r in rows if r["_status"] == stage]
            st.caption(f"{len(stage_items)} opportunité(s)")
            for r in stage_items:
                with st.container(border=True):
                    st.markdown(f"**{r['Opportunité']}**")
                    st.markdown(ui.status_pill(PRIORITY, _prio_key(r["Priorité"])) +
                                (f" &nbsp; <span style='font-size:12px;color:#64748b'>Score {r['Score']}</span>" if r["Score"] else ""),
                                unsafe_allow_html=True)
                    if can_update and stage not in ("VALIDATED", "ABANDONED"):
                        nxt = STAGES[min(STAGES.index(stage) + 1, len(STAGES) - 2)]
                        if st.button("➡️ Étape suivante", key=f"mv_{r['id']}", use_container_width=True):
                            _move(user, r["id"], nxt)

    st.divider()
    if rows:
        df = pd.DataFrame(rows)
        show = ["Opportunité", "DCI", "Type", "Marché", "Fournisseur", "Pays", "Priorité", "Score", "Statut", "Prochaine action"]
        filtered = ui.text_filter(df, ["Opportunité", "DCI", "Fournisseur"], "Rechercher opportunité, fournisseur…")
        ui.show_table(filtered[show], column_maps={"Statut": BD_STATUS, "Priorité": PRIORITY})
        ui.export_buttons(filtered[show], "business-development")


def _prio_key(label):
    for k, (lbl, _) in PRIORITY.items():
        if lbl == label:
            return k
    return "MEDIUM"


def _move(user, opp_id, new_status):
    with session_scope() as s:
        o = s.get(BDO, opp_id)
        old = o.status
        o.status = new_status
        record_audit(s, user["id"], "UPDATE", "Business Development", entity_type="BD_OPPORTUNITY", entity_id=opp_id,
                     field="status", old_value=old, new_value=new_status, summary=f"Pipeline: {o.name} → {new_status}")
    st.rerun()


@st.dialog("Nouvelle opportunité", width="large")
def _create_dialog(user):
    with st.form("new_bd"):
        name = st.text_input("Opportunité *")
        c1, c2 = st.columns(2)
        dci = c1.text_input("DCI")
        cls = c2.text_input("Classe thérapeutique")
        type_ = c1.selectbox("Type", list(BD_TYPE.keys()), format_func=lambda k: BD_TYPE[k])
        market = c2.text_input("Marché cible")
        supplier = c1.text_input("Fournisseur potentiel")
        country = c2.text_input("Pays fournisseur")
        status = c1.selectbox("Statut", STAGES, format_func=lambda k: BD_STATUS[k][0])
        prio = c2.selectbox("Priorité", list(PRIORITY.keys()), index=1, format_func=lambda k: PRIORITY[k][0])
        score = c1.number_input("Score (0-100)", min_value=0, max_value=100, value=50)
        action = c2.text_input("Prochaine action")
        if st.form_submit_button("Enregistrer", type="primary"):
            if not name.strip():
                st.error("Le nom est obligatoire.")
                return
            with session_scope() as s:
                o = BDO(name=name.strip(), dci=dci or None, therapeutic_class=cls or None, type=type_,
                        target_market=market or None, potential_supplier=supplier or None, supplier_country=country or None,
                        status=status, priority=prio, score=score, next_action=action or None, owner_id=user["id"])
                s.add(o)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Business Development", entity_type="BD_OPPORTUNITY",
                             entity_id=o.id, summary=f"Opportunité « {name} »")
            st.rerun()
