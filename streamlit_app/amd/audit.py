"""Audit log + internal notification helpers."""
from __future__ import annotations

from sqlalchemy.orm import Session

from .models import AuditLog, Notification, User


def record_audit(
    session: Session,
    actor_id: str | None,
    action: str,
    module: str,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    field: str | None = None,
    old_value=None,
    new_value=None,
    summary: str | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_id=actor_id, action=action, module=module, entity_type=entity_type,
            entity_id=entity_id, field=field,
            old_value=None if old_value is None else str(old_value),
            new_value=None if new_value is None else str(new_value),
            summary=summary,
        )
    )


def notify(session: Session, user_id: str, type_: str, title: str, body: str | None = None, link: str | None = None) -> None:
    session.add(Notification(user_id=user_id, type=type_, title=title, body=body, link=link))


def notify_roles(session: Session, roles: list[str], type_: str, title: str, body: str | None = None, link: str | None = None) -> None:
    users = session.query(User).filter(User.role.in_(roles), User.is_active.is_(True)).all()
    for u in users:
        session.add(Notification(user_id=u.id, type=type_, title=title, body=body, link=link))
