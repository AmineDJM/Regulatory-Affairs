"""Ventes — pharma/PCH revenue, CSV import, export."""
from __future__ import annotations

import datetime as dt
import io

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import DELIVERY_STATUS, PAYMENT_STATUS, label_of
from amd.models import Sale
from amd.rbac import apply_scope, can, scope_sales

MODULE = "SALES"


def render() -> None:
    user = current_user()
    ui.page_header("Ventes", "Suivi du chiffre d'affaires pharma / PCH, import et export.")

    if can(user["role"], MODULE, "CREATE"):
        c1, c2, _ = st.columns([1, 1, 4])
        with c1:
            if st.button("➕ Nouvelle vente", type="primary", use_container_width=True):
                _create_dialog(user)
        with c2:
            if st.button("📥 Importer CSV", use_container_width=True):
                _import_dialog(user)

    with session_scope() as s:
        sales = apply_scope(s.query(Sale), scope_sales(user)).order_by(Sale.date.desc()).limit(500).all()
        rows = [{
            "Date": ui.fmt_date(x.date), "_date": x.date, "Produit": x.product, "DCI": x.dci or "",
            "Client": x.client, "PCH": "Oui" if x.is_pch else "", "Qté": x.quantity,
            "PU": ui.fmt_currency(x.unit_price), "CA": ui.fmt_currency(x.revenue), "_rev": x.revenue, "_pch": x.is_pch,
            "Paiement": label_of(PAYMENT_STATUS, x.payment_status), "Livraison": label_of(DELIVERY_STATUS, x.delivery_status),
            "Commercial": x.sales_user.name if x.sales_user else "",
        } for x in sales]

    now = dt.datetime.utcnow()
    month_start = dt.datetime(now.year, now.month, 1)
    ca_month = sum(r["_rev"] for r in rows if r["_date"] >= month_start)
    ca_year = sum(r["_rev"] for r in rows if r["_date"].year == now.year)
    pch = sum(r["_rev"] for r in rows if r["_pch"])
    ui.kpi_row([
        {"label": "CA mensuel", "value": ui.fmt_currency(ca_month), "tone": "success"},
        {"label": "CA annuel", "value": ui.fmt_currency(ca_year), "tone": "info"},
        {"label": "Ventes PCH", "value": ui.fmt_currency(pch), "tone": "info"},
        {"label": "Transactions", "value": len(rows), "tone": "neutral"},
    ])
    if not rows:
        st.info("Aucune vente enregistrée.")
        return
    df = pd.DataFrame(rows)
    show = ["Date", "Produit", "DCI", "Client", "PCH", "Qté", "PU", "CA", "Paiement", "Livraison", "Commercial"]
    filtered = ui.text_filter(df, ["Produit", "DCI", "Client"], "Rechercher produit, client…")
    ui.show_table(filtered[show], column_maps={"Paiement": PAYMENT_STATUS, "Livraison": DELIVERY_STATUS}, height=440)
    ui.export_buttons(filtered[show], "ventes")


@st.dialog("Enregistrer une vente", width="large")
def _create_dialog(user):
    with st.form("new_sale"):
        c1, c2 = st.columns(2)
        date = c1.date_input("Date", value=dt.date.today())
        product = c2.text_input("Produit *")
        dci = c1.text_input("DCI")
        client = c2.text_input("Client *")
        institution = c1.text_input("Institution")
        is_pch = c2.checkbox("Vente PCH")
        qty = c1.number_input("Quantité", min_value=0, step=10)
        price = c2.number_input("Prix unitaire (DZD)", min_value=0.0, step=10.0)
        if st.form_submit_button("Enregistrer", type="primary"):
            if not product.strip() or not client.strip():
                st.error("Produit et client sont obligatoires.")
                return
            with session_scope() as s:
                sale = Sale(date=dt.datetime.combine(date, dt.time()), product=product.strip(), dci=dci or None,
                            client=client.strip(), institution=institution or None, is_pch=is_pch, quantity=qty,
                            unit_price=price, revenue=qty * price,
                            sales_user_id=user["id"] if user["role"] == "SALES_USER" else None)
                s.add(sale)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Ventes", entity_type="SALE", entity_id=sale.id,
                             summary=f"Vente {product} — {client}")
            st.rerun()


@st.dialog("Importer des ventes (CSV / Excel)", width="large")
def _import_dialog(user):
    st.caption("Colonnes attendues : date, product, dci, client, institution, isPch, quantity, unitPrice")
    up = st.file_uploader("Fichier CSV ou Excel", type=["csv", "xlsx"])
    if up is not None:
        try:
            if up.name.endswith(".xlsx"):
                df = pd.read_excel(io.BytesIO(up.getvalue()))
            else:
                df = pd.read_csv(io.BytesIO(up.getvalue()), sep=None, engine="python")
        except Exception as e:  # noqa: BLE001
            st.error(f"Lecture impossible : {e}")
            return
        st.dataframe(df.head(10), use_container_width=True, hide_index=True)
        if st.button(f"Importer {len(df)} lignes", type="primary"):
            cols = {c.lower().strip(): c for c in df.columns}
            count = 0
            with session_scope() as s:
                for _, r in df.iterrows():
                    product = str(r.get(cols.get("product", ""), "") or "").strip()
                    client = str(r.get(cols.get("client", ""), "") or "").strip()
                    if not product or not client:
                        continue
                    qty = int(float(r.get(cols.get("quantity", ""), 0) or 0))
                    price = float(r.get(cols.get("unitprice", ""), 0) or 0)
                    date_val = r.get(cols.get("date", ""), None)
                    try:
                        date = pd.to_datetime(date_val).to_pydatetime() if pd.notna(date_val) else dt.datetime.utcnow()
                    except Exception:  # noqa: BLE001
                        date = dt.datetime.utcnow()
                    pch_raw = str(r.get(cols.get("ispch", ""), "")).strip().lower()
                    s.add(Sale(date=date, product=product, dci=str(r.get(cols.get("dci", ""), "") or "") or None,
                               client=client, institution=str(r.get(cols.get("institution", ""), "") or "") or None,
                               is_pch=pch_raw in ("1", "true", "oui", "yes"), quantity=qty, unit_price=price,
                               revenue=qty * price, sales_user_id=user["id"] if user["role"] == "SALES_USER" else None))
                    count += 1
                record_audit(s, user["id"], "IMPORT", "Ventes", summary=f"{count} ventes importées")
            st.success(f"{count} ventes importées.")
            st.rerun()
