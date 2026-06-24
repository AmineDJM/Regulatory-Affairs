"""Logistique PCH — orders, estimated vs real dates, shipment timeline."""
from __future__ import annotations

import datetime as dt

import pandas as pd
import streamlit as st

from amd import ui
from amd.audit import record_audit
from amd.auth import current_user
from amd.db import session_scope
from amd.labels import LOGISTICS_STATUS, label_of
from amd.models import LogisticsOrder
from amd.rbac import can
from ._common import document_panel

MODULE = "LOGISTICS"
DOC_CATEGORIES = ["PROFORMA", "INVOICE", "PACKING_LIST", "BL_AWB", "ANALYSIS_CERTIFICATE",
                  "ORIGIN_CERTIFICATE", "CUSTOMS_DOCS", "DELIVERY_NOTE", "RECEPTION_REPORT", "OTHER"]


def render() -> None:
    user = current_user()
    ui.page_header("Logistique PCH", "Commandes PCH : dates estimées vs réelles, dédouanement, livraison.")
    if can(user["role"], MODULE, "CREATE"):
        if st.button("➕ Nouvelle commande", type="primary"):
            _create_dialog(user)

    now = dt.datetime.utcnow()
    week = now + dt.timedelta(days=7)
    with session_scope() as s:
        orders = s.query(LogisticsOrder).order_by(LogisticsOrder.estimated_arrival).all()
        rows = [{
            "id": o.id, "Réf.": o.reference, "Produit": o.product, "Fournisseur": o.supplier or "",
            "Pays": o.country or "", "Qté": o.quantity_ordered, "Statut": label_of(LOGISTICS_STATUS, o.status),
            "Arrivée estimée": ui.fmt_date(o.estimated_arrival), "Valeur": ui.fmt_currency(o.order_value, o.currency),
        } for o in orders]
        in_progress = sum(1 for o in orders if o.status not in ("DELIVERED", "BLOCKED"))
        arriving = sum(1 for o in orders if o.estimated_arrival and now <= o.estimated_arrival <= week and o.status != "DELIVERED")
        late = sum(1 for o in orders if o.estimated_arrival and o.estimated_arrival < now and o.status != "DELIVERED")

    ui.kpi_row([
        {"label": "Commandes en cours", "value": in_progress, "tone": "info"},
        {"label": "Arrivées cette semaine", "value": arriving, "tone": "info"},
        {"label": "En retard", "value": late, "tone": "danger"},
        {"label": "Total commandes", "value": len(rows), "tone": "neutral"},
    ])
    if not rows:
        st.info("Aucune commande PCH.")
        return
    df = pd.DataFrame(rows)
    cols = [c for c in df.columns if c != "id"]
    filtered = ui.text_filter(df, ["Réf.", "Produit", "Fournisseur"], "Rechercher produit, fournisseur…")
    ui.show_table(filtered[cols], column_maps={"Statut": LOGISTICS_STATUS})
    ui.export_buttons(filtered[cols], "logistique-pch")

    st.divider()
    labels = {f"{r['Réf.']} — {r['Produit']}": r["id"] for r in rows}
    choice = st.selectbox("🔎 Ouvrir une commande", ["—"] + list(labels.keys()))
    if choice != "—":
        _detail(user, labels[choice])


def _detail(user, order_id):
    with session_scope() as s:
        o = s.get(LogisticsOrder, order_id)
        d = {k: getattr(o, k) for k in [
            "reference", "product", "supplier", "country", "status", "carrier", "incoterm",
            "quantity_ordered", "quantity_received", "order_value", "currency", "order_date",
            "estimated_departure", "actual_departure", "estimated_arrival", "actual_arrival",
            "customs_date", "pch_delivery_date"]}

    st.markdown(f"### {d['product']} &nbsp; <span style='font-size:13px;color:#64748b'>{d['reference']}</span>", unsafe_allow_html=True)
    st.markdown(ui.status_pill(LOGISTICS_STATUS, d["status"]), unsafe_allow_html=True)

    st.markdown("#### 🚢 Timeline logistique")
    milestones = [("Commande", d["order_date"], d["order_date"]), ("Départ", d["estimated_departure"], d["actual_departure"]),
                  ("Arrivée terminal", d["estimated_arrival"], d["actual_arrival"]), ("Dédouanement", None, d["customs_date"]),
                  ("Livraison PCH", None, d["pch_delivery_date"])]
    for label, planned, real in milestones:
        icon = "✅" if real else "⬜"
        plan_txt = f"Estimé : {ui.fmt_date(planned)}" if planned else ""
        st.markdown(f"{icon} **{label}** &nbsp; <span style='color:#64748b;font-size:13px'>{plan_txt} &nbsp; Réel : {ui.fmt_date(real)}</span>", unsafe_allow_html=True)

    cc = st.columns(3)
    cc[0].markdown(f"**Transporteur** · {d['carrier'] or '—'}  \n**Incoterm** · {d['incoterm'] or '—'}")
    cc[1].markdown(f"**Qté commandée** · {d['quantity_ordered']}  \n**Qté reçue** · {d['quantity_received']}")
    cc[2].markdown(f"**Valeur** · {ui.fmt_currency(d['order_value'], d['currency'])}")

    if can(user["role"], MODULE, "UPDATE"):
        with st.expander("✏️ Mettre à jour le suivi"):
            with st.form(f"upd_{order_id}"):
                c1, c2 = st.columns(2)
                ns = c1.selectbox("Statut", list(LOGISTICS_STATUS.keys()),
                                  index=list(LOGISTICS_STATUS).index(d["status"]), format_func=lambda k: LOGISTICS_STATUS[k][0])
                qr = c2.number_input("Quantité reçue", min_value=0, value=d["quantity_received"])
                dep = c1.date_input("Départ réel", value=d["actual_departure"].date() if d["actual_departure"] else None)
                arr = c2.date_input("Arrivée réelle", value=d["actual_arrival"].date() if d["actual_arrival"] else None)
                cust = c1.date_input("Dédouanement", value=d["customs_date"].date() if d["customs_date"] else None)
                pch = c2.date_input("Livraison PCH", value=d["pch_delivery_date"].date() if d["pch_delivery_date"] else None)
                if st.form_submit_button("Enregistrer", type="primary"):
                    with session_scope() as s:
                        o = s.get(LogisticsOrder, order_id)
                        old = o.status
                        o.status = ns
                        o.quantity_received = qr
                        o.actual_departure = dt.datetime.combine(dep, dt.time()) if dep else None
                        o.actual_arrival = dt.datetime.combine(arr, dt.time()) if arr else None
                        o.customs_date = dt.datetime.combine(cust, dt.time()) if cust else None
                        o.pch_delivery_date = dt.datetime.combine(pch, dt.time()) if pch else None
                        record_audit(s, user["id"], "UPDATE", "Logistique PCH", entity_type="LOGISTICS",
                                     entity_id=order_id, field="status", old_value=old, new_value=ns,
                                     summary=f"Statut commande {o.reference} → {ns}")
                    st.rerun()

    document_panel(user, "LOGISTICS", order_id, "Logistique PCH", categories=DOC_CATEGORIES,
                   can_upload=can(user["role"], MODULE, "UPLOAD"), can_delete=can(user["role"], MODULE, "DELETE"))


@st.dialog("Nouvelle commande PCH", width="large")
def _create_dialog(user):
    with st.form("new_log"):
        c1, c2 = st.columns(2)
        product = c1.text_input("Produit *")
        dci = c2.text_input("DCI")
        supplier = c1.text_input("Fournisseur")
        country = c2.text_input("Pays")
        qty = c1.number_input("Quantité commandée", min_value=0, step=100)
        status = c2.selectbox("Statut", list(LOGISTICS_STATUS.keys()), format_func=lambda k: LOGISTICS_STATUS[k][0])
        order_date = c1.date_input("Date de commande", value=dt.date.today())
        eta = c2.date_input("Arrivée estimée", value=None)
        value = c1.number_input("Valeur commande", min_value=0, step=10000)
        currency = c2.text_input("Devise", value="EUR")
        if st.form_submit_button("Enregistrer", type="primary"):
            if not product.strip():
                st.error("Le produit est obligatoire.")
                return
            with session_scope() as s:
                year = dt.datetime.utcnow().year
                n = s.query(LogisticsOrder).filter(LogisticsOrder.reference.like(f"CMD-{year}-%")).count()
                o = LogisticsOrder(reference=f"CMD-{year}-{n+1:03d}", product=product.strip(), dci=dci or None,
                                   supplier=supplier or None, country=country or None, quantity_ordered=qty,
                                   status=status, order_date=dt.datetime.combine(order_date, dt.time()),
                                   estimated_arrival=dt.datetime.combine(eta, dt.time()) if eta else None,
                                   order_value=value or None, currency=currency or "EUR", owner_id=user["id"])
                s.add(o)
                s.flush()
                record_audit(s, user["id"], "CREATE", "Logistique PCH", entity_type="LOGISTICS", entity_id=o.id,
                             summary=f"Commande {o.reference} — {product}")
            st.rerun()
