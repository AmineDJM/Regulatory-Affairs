"""Documents — centralized, access-scoped library."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from amd import storage, ui
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import CONFIDENTIALITY, DOCUMENT_CATEGORY, ENTITY_TYPE_LABELS, label_of
from amd.models import (
    BusinessDevelopmentOpportunity, Document, MedicalDoctor, MedicalVisit, RegulatoryProduct, Sale,
)
from amd.rbac import (
    apply_scope, can, scope_business_development, scope_medical_doctors,
    scope_medical_visits, scope_regulatory, scope_sales,
)

ENTITY_MODULE = {
    "REGULATORY_PRODUCT": "REGULATORY", "REGULATORY_STEP": "REGULATORY", "SPONSORING": "SPONSORING",
    "BUDGET": "BUDGETS", "CONGRESS_INTERNATIONAL": "CONGRESS_INTERNATIONAL",
    "CONGRESS_NATIONAL": "CONGRESS_NATIONAL", "SALE": "SALES", "LOGISTICS": "LOGISTICS",
    "DOCTOR": "MEDICAL", "VISIT": "MEDICAL", "BD_OPPORTUNITY": "BUSINESS_DEVELOPMENT",
}


def _scoped_ids(s, user, model, scope_fn):
    cond = scope_fn(user)
    if cond is None:
        return None  # all
    return [r.id for r in apply_scope(s.query(model.id), cond).all()]


def accessible_documents(s, user):
    docs = s.query(Document).order_by(Document.created_at.desc()).all()
    reg_ids = _scoped_ids(s, user, RegulatoryProduct, scope_regulatory)
    doc_ids = _scoped_ids(s, user, MedicalDoctor, scope_medical_doctors)
    visit_ids = _scoped_ids(s, user, MedicalVisit, scope_medical_visits)
    sale_ids = _scoped_ids(s, user, Sale, scope_sales)
    bd_ids = _scoped_ids(s, user, BusinessDevelopmentOpportunity, scope_business_development)
    scoped = {"REGULATORY_PRODUCT": reg_ids, "DOCTOR": doc_ids, "VISIT": visit_ids,
              "SALE": sale_ids, "BD_OPPORTUNITY": bd_ids}

    out = []
    for d in docs:
        module = ENTITY_MODULE.get(d.entity_type)
        if not module or not can(user["role"], module, "VIEW"):
            continue
        allowed_ids = scoped.get(d.entity_type, None)
        if allowed_ids is not None and d.entity_id not in allowed_ids:
            continue
        out.append(d)
    return out


def render() -> None:
    user = current_user()
    ui.page_header("Documents", "Bibliothèque centralisée — filtrée selon vos accès.")
    with session_scope() as s:
        docs = accessible_documents(s, user)
        rows = [{
            "id": d.id, "Document": d.name, "Catégorie": label_of(DOCUMENT_CATEGORY, d.category),
            "Module": ENTITY_TYPE_LABELS.get(d.entity_type, d.entity_type),
            "Confidentialité": label_of(CONFIDENTIALITY, d.confidentiality), "Version": f"v{d.version}",
            "Taille (Ko)": round((d.size_bytes or 0) / 1024), "Par": d.uploaded_by.name if d.uploaded_by else "—",
            "Date": ui.fmt_date(d.created_at), "_key": d.file_key, "_name": d.name,
        } for d in docs]

    if not rows:
        st.info("Aucun document accessible.")
        return

    df = pd.DataFrame(rows)
    modules = sorted(df["Module"].unique())
    mod = st.selectbox("Filtrer par module", ["Tous"] + modules)
    if mod != "Tous":
        df = df[df["Module"] == mod]
    filtered = ui.text_filter(df, ["Document", "Catégorie", "Module"], "Rechercher par nom, catégorie…")
    show = ["Document", "Catégorie", "Module", "Confidentialité", "Version", "Taille (Ko)", "Par", "Date"]
    ui.show_table(filtered[show], column_maps={"Confidentialité": CONFIDENTIALITY}, height=420)
    ui.export_buttons(filtered[show], "documents")

    downloadable = filtered[filtered["_key"].notna()]
    if not downloadable.empty:
        st.markdown("##### ⬇️ Télécharger un document")
        choice = st.selectbox("Document", ["—"] + downloadable["Document"].tolist())
        if choice != "—":
            row = downloadable[downloadable["Document"] == choice].iloc[0]
            data = storage.read_file(row["_key"])
            if data is not None:
                st.download_button("Télécharger", data, file_name=row["_name"])
            else:
                st.caption("Fichier indisponible (métadonnées uniquement).")
