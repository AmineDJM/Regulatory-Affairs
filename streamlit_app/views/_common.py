"""Reusable detail-panel components: documents and comments."""
from __future__ import annotations

import streamlit as st

from amd import storage, ui
from amd.audit import record_audit
from amd.db import session_scope
from amd.labels import CONFIDENTIALITY, DOCUMENT_CATEGORY, label_of
from amd.models import Comment, Document, User


def document_panel(user, entity_type, entity_id, module_label, *, categories=None, can_upload=False, can_delete=False):
    st.markdown("#### 📎 Documents")
    with session_scope() as s:
        docs = (
            s.query(Document)
            .filter(Document.entity_type == entity_type, Document.entity_id == entity_id)
            .order_by(Document.created_at.desc())
            .all()
        )
        items = [
            {
                "id": d.id, "name": d.name, "category": d.category, "version": d.version,
                "size": d.size_bytes or 0, "conf": d.confidentiality, "key": d.file_key,
                "by": d.uploaded_by.name if d.uploaded_by else "—", "at": d.created_at,
            }
            for d in docs
        ]

    if not items:
        st.caption("Aucun document.")
    for it in items:
        c1, c2, c3 = st.columns([6, 2, 2])
        c1.markdown(
            f"**{it['name']}**  \n<span style='color:#64748b;font-size:12px'>"
            f"{label_of(DOCUMENT_CATEGORY, it['category'])} · v{it['version']} · "
            f"{round(it['size']/1024)} Ko · {it['by']} · {ui.fmt_date(it['at'])}</span>",
            unsafe_allow_html=True,
        )
        c2.markdown(ui.status_pill(CONFIDENTIALITY, it["conf"]), unsafe_allow_html=True)
        data = storage.read_file(it["key"]) if it["key"] else None
        if data is not None:
            c3.download_button("⬇️", data, file_name=it["name"], key=f"dl_{it['id']}", use_container_width=True)
        else:
            c3.caption("métadonnées")
        if can_delete:
            if c3.button("🗑️", key=f"del_{it['id']}", use_container_width=True):
                with session_scope() as s:
                    doc = s.get(Document, it["id"])
                    if doc:
                        if doc.file_key:
                            storage.delete_file(doc.file_key)
                        record_audit(s, user["id"], "DELETE", module_label, entity_type=entity_type,
                                     entity_id=entity_id, summary=f"Document « {doc.name} » supprimé")
                        s.delete(doc)
                st.rerun()

    if can_upload:
        with st.form(f"upload_{entity_id}", clear_on_submit=True):
            up = st.file_uploader("Ajouter un document", type=list(storage.ALLOWED_EXT))
            cols = st.columns(2)
            cat_options = categories or list(DOCUMENT_CATEGORY.keys())
            category = cols[0].selectbox("Catégorie", cat_options, format_func=lambda c: DOCUMENT_CATEGORY.get(c, c))
            conf = cols[1].selectbox("Confidentialité", list(CONFIDENTIALITY.keys()),
                                     format_func=lambda c: CONFIDENTIALITY[c][0])
            if st.form_submit_button("📤 Téléverser") and up is not None:
                data = up.getvalue()
                err = storage.validate_upload(up.name, len(data))
                if err:
                    st.error(err)
                else:
                    with session_scope() as s:
                        prev = s.query(Document).filter(Document.entity_type == entity_type,
                                                        Document.entity_id == entity_id,
                                                        Document.name == up.name).count()
                        key = storage.save_upload(entity_type, entity_id, up.name, data)
                        s.add(Document(name=up.name, category=category, entity_type=entity_type, entity_id=entity_id,
                                       file_key=key, mime_type=up.type, size_bytes=len(data), version=prev + 1,
                                       confidentiality=conf, uploaded_by_id=user["id"]))
                        record_audit(s, user["id"], "UPLOAD", module_label, entity_type=entity_type,
                                     entity_id=entity_id, summary=f"Document « {up.name} » téléversé")
                    st.success("Document ajouté.")
                    st.rerun()


def comment_panel(user, entity_type, entity_id):
    st.markdown("#### 💬 Commentaires")
    with session_scope() as s:
        comments = (
            s.query(Comment)
            .filter(Comment.entity_type == entity_type, Comment.entity_id == entity_id)
            .order_by(Comment.created_at.desc())
            .all()
        )
        items = [{"author": c.author.name if c.author else "Utilisateur", "body": c.body, "at": c.created_at} for c in comments]

    if not items:
        st.caption("Aucun commentaire.")
    for it in items:
        st.markdown(
            f"<div style='border-left:3px solid #e2e8f0;padding:2px 10px;margin:4px 0'>"
            f"<b>{it['author']}</b> <span style='color:#94a3b8;font-size:12px'>{ui.fmt_datetime(it['at'])}</span>"
            f"<br>{it['body']}</div>",
            unsafe_allow_html=True,
        )
    with st.form(f"comment_{entity_id}", clear_on_submit=True):
        body = st.text_area("Ajouter un commentaire", label_visibility="collapsed", placeholder="Votre commentaire…")
        if st.form_submit_button("Publier") and body.strip():
            with session_scope() as s:
                s.add(Comment(entity_type=entity_type, entity_id=entity_id, body=body.strip(), author_id=user["id"]))
            st.rerun()


def user_options(roles=None):
    """Return [(id, label)] of active users, optionally filtered by role."""
    with session_scope() as s:
        q = s.query(User).filter(User.is_active.is_(True))
        if roles:
            q = q.filter(User.role.in_(roles))
        return [(u.id, u.name) for u in q.order_by(User.name).all()]
