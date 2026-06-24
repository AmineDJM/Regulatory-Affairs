"""Shared Streamlit UI helpers: formatting, KPI cards, status pills, tables."""
from __future__ import annotations

import datetime as dt
import io

import pandas as pd
import streamlit as st

from .labels import TONES

# ───────────────────────────── formatting ─────────────────────────────

def fmt_currency(value, currency: str = "DZD") -> str:
    if value is None or value == "":
        return "—"
    try:
        return f"{int(round(float(value))):,}".replace(",", " ") + f" {currency}"
    except (ValueError, TypeError):
        return "—"


def fmt_compact(value) -> str:
    if value is None:
        return "—"
    v = float(value)
    if abs(v) >= 1_000_000:
        return f"{v / 1_000_000:.1f} M"
    if abs(v) >= 1_000:
        return f"{v / 1_000:.0f} k"
    return f"{v:.0f}"


def fmt_number(value) -> str:
    if value is None:
        return "—"
    return f"{int(value):,}".replace(",", " ")


def fmt_date(value) -> str:
    if value is None:
        return "—"
    if isinstance(value, str):
        return value
    return value.strftime("%d/%m/%Y")


def fmt_datetime(value) -> str:
    if value is None:
        return "—"
    return value.strftime("%d/%m/%Y %H:%M")


def days_until(value) -> int | None:
    if value is None:
        return None
    delta = value - dt.datetime.utcnow()
    return delta.days


# ───────────────────────────── pills / badges ─────────────────────────────

def pill_html(label: str, tone: str = "neutral") -> str:
    color = TONES.get(tone, TONES["neutral"])
    return (
        f"<span style='background:{color}1a;color:{color};border:1px solid {color}33;"
        f"padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;"
        f"white-space:nowrap;display:inline-block'>{label}</span>"
    )


def status_pill(mapping: dict, value) -> str:
    if value is None:
        return "<span style='color:#94a3b8'>—</span>"
    entry = mapping.get(value, (str(value), "neutral"))
    label, tone = entry if isinstance(entry, tuple) else (entry, "neutral")
    return pill_html(label, tone)


def render_pill(mapping: dict, value) -> None:
    st.markdown(status_pill(mapping, value), unsafe_allow_html=True)


# ───────────────────────────── KPI cards ─────────────────────────────

def kpi_row(cards: list[dict]) -> None:
    """cards: list of {label, value, hint?, tone?}."""
    cols = st.columns(len(cards))
    for col, card in zip(cols, cards):
        tone = card.get("tone", "info")
        color = TONES.get(tone, TONES["info"])
        hint = card.get("hint", "")
        col.markdown(
            f"""
            <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;
                        background:#fff;height:100%">
              <div style="font-size:13px;color:#64748b;font-weight:500">{card['label']}</div>
              <div style="font-size:26px;font-weight:700;color:#0f172a;line-height:1.3">{card['value']}</div>
              <div style="font-size:12px;color:{color};font-weight:600">{hint}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def page_header(title: str, description: str = "") -> None:
    st.markdown(f"## {title}")
    if description:
        st.caption(description)


def section(title: str) -> None:
    st.markdown(
        f"<div style='font-size:12px;font-weight:700;text-transform:uppercase;"
        f"letter-spacing:.05em;color:#64748b;margin:8px 0 4px'>{title}</div>",
        unsafe_allow_html=True,
    )


# ───────────────────────────── tables ─────────────────────────────

def status_styler(df: pd.DataFrame, column_maps: dict[str, dict]):
    """Return a pandas Styler colouring status columns by their FR label."""
    label_colors: dict[str, dict[str, str]] = {}
    for col, mapping in column_maps.items():
        lc = {}
        for value, entry in mapping.items():
            label, tone = entry if isinstance(entry, tuple) else (entry, "neutral")
            lc[label] = TONES.get(tone, TONES["neutral"])
        label_colors[col] = lc

    def color_cell(val, col):
        color = label_colors.get(col, {}).get(val)
        if color:
            return f"background-color:{color}1a;color:{color};font-weight:600"
        return ""

    styler = df.style
    for col in column_maps:
        if col in df.columns:
            styler = styler.map(lambda v, c=col: color_cell(v, c), subset=[col])
    return styler


def show_table(df: pd.DataFrame, column_maps: dict[str, dict] | None = None, height: int | None = None) -> None:
    if df.empty:
        st.info("Aucune donnée à afficher.")
        return
    data = status_styler(df, column_maps) if column_maps else df
    kwargs: dict = {"use_container_width": True, "hide_index": True}
    if height is not None:
        kwargs["height"] = height
    st.dataframe(data, **kwargs)


def export_buttons(df: pd.DataFrame, filename: str) -> None:
    """CSV + Excel download buttons for a dataframe."""
    c1, c2 = st.columns(2)
    csv = df.to_csv(index=False).encode("utf-8-sig")
    c1.download_button("⬇️ CSV", csv, file_name=f"{filename}.csv", mime="text/csv", use_container_width=True)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Export")
    c2.download_button(
        "⬇️ Excel", buffer.getvalue(), file_name=f"{filename}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
    )


def text_filter(df: pd.DataFrame, columns: list[str], placeholder: str = "Rechercher…", key: str = "q") -> pd.DataFrame:
    """Render a search box and filter the dataframe across the given columns."""
    query = st.text_input("Recherche", placeholder=placeholder, key=key, label_visibility="collapsed")
    if not query:
        return df
    q = query.lower()
    mask = pd.Series(False, index=df.index)
    for col in columns:
        if col in df.columns:
            mask = mask | df[col].astype(str).str.lower().str.contains(q, na=False)
    return df[mask]
