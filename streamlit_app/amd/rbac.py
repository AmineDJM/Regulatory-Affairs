"""Role-based access control + row-level scoping (port of the Next.js rbac.ts).

Two layers, both enforced server-side:
  1. ``can(role, module, action)`` — static permission matrix.
  2. ``scope_*`` — return SQLAlchemy filter conditions so a user only ever
     receives rows they are allowed to see (``None`` = all, ``false()`` = none).
"""
from __future__ import annotations

from sqlalchemy import false, or_

from .models import (
    BusinessDevelopmentOpportunity,
    MedicalDoctor,
    MedicalVisit,
    RegulatoryProduct,
    Sale,
    User,
)

MODULES = [
    "DASHBOARD", "REGULATORY", "SPONSORING", "BUDGETS", "CONGRESS_INTERNATIONAL",
    "CONGRESS_NATIONAL", "SALES", "LOGISTICS", "MEDICAL", "BUSINESS_DEVELOPMENT",
    "DOCUMENTS", "NOTIFICATIONS", "ADMIN",
]
ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"]

ALL = list(ACTIONS)
READ = ["VIEW", "EXPORT"]
CONTRIBUTE = ["VIEW", "CREATE", "UPDATE", "UPLOAD", "EXPORT"]
MANAGE = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"]

PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "SUPER_ADMIN": {m: ALL for m in MODULES},
    "DIRECTION": {
        "DASHBOARD": READ, "REGULATORY": READ + ["VALIDATE"], "SPONSORING": READ + ["VALIDATE"],
        "BUDGETS": READ + ["VALIDATE"], "CONGRESS_INTERNATIONAL": READ + ["VALIDATE"],
        "CONGRESS_NATIONAL": READ + ["VALIDATE"], "SALES": READ, "LOGISTICS": READ,
        "MEDICAL": READ, "BUSINESS_DEVELOPMENT": READ + ["VALIDATE"], "DOCUMENTS": READ,
        "NOTIFICATIONS": ["VIEW"], "ADMIN": ["VIEW", "EXPORT"],
    },
    "HEAD_OF_REGULATORY": {
        "DASHBOARD": READ, "REGULATORY": MANAGE, "DOCUMENTS": CONTRIBUTE,
        "BUDGETS": READ, "NOTIFICATIONS": ["VIEW"],
    },
    "REGULATORY_ASSISTANT": {
        "DASHBOARD": READ, "REGULATORY": CONTRIBUTE, "DOCUMENTS": CONTRIBUTE, "NOTIFICATIONS": ["VIEW"],
    },
    "HEAD_OF_SALES": {
        "DASHBOARD": READ, "SALES": MANAGE, "LOGISTICS": READ, "DOCUMENTS": CONTRIBUTE, "NOTIFICATIONS": ["VIEW"],
    },
    "SALES_USER": {"DASHBOARD": READ, "SALES": CONTRIBUTE, "NOTIFICATIONS": ["VIEW"]},
    "LOGISTICS_MANAGER": {
        "DASHBOARD": READ, "LOGISTICS": MANAGE, "DOCUMENTS": CONTRIBUTE, "SALES": READ, "NOTIFICATIONS": ["VIEW"],
    },
    "MEDICAL_PROMOTION_MANAGER": {
        "DASHBOARD": READ, "MEDICAL": MANAGE, "CONGRESS_NATIONAL": CONTRIBUTE,
        "DOCUMENTS": CONTRIBUTE, "NOTIFICATIONS": ["VIEW"],
    },
    "MEDICAL_DELEGATE": {"DASHBOARD": READ, "MEDICAL": CONTRIBUTE, "NOTIFICATIONS": ["VIEW"]},
    "BUSINESS_DEVELOPMENT_MANAGER": {
        "DASHBOARD": READ, "BUSINESS_DEVELOPMENT": MANAGE, "DOCUMENTS": CONTRIBUTE, "NOTIFICATIONS": ["VIEW"],
    },
    "FINANCE_BUDGET_MANAGER": {
        "DASHBOARD": READ, "BUDGETS": MANAGE, "SPONSORING": READ, "SALES": READ,
        "LOGISTICS": READ, "DOCUMENTS": READ, "NOTIFICATIONS": ["VIEW"],
    },
    "VIEWER": {"DASHBOARD": ["VIEW"], "DOCUMENTS": ["VIEW"], "NOTIFICATIONS": ["VIEW"]},
}

GLOBAL_VIEW_ROLES = {"SUPER_ADMIN", "DIRECTION"}


def can(role: str, module: str, action: str) -> bool:
    return action in PERMISSIONS.get(role, {}).get(module, [])


def accessible_modules(role: str) -> list[str]:
    return [m for m in MODULES if can(role, m, "VIEW")]


def has_global_view(role: str) -> bool:
    return role in GLOBAL_VIEW_ROLES


def can_validate(role: str, module: str) -> bool:
    return can(role, module, "VALIDATE")


# ── Row-level scoping (returns a SQLAlchemy condition, None=all, false()=none) ──

def scope_regulatory(user: dict):
    role, uid = user["role"], user["id"]
    if has_global_view(role) or role == "HEAD_OF_REGULATORY":
        return None
    if role == "REGULATORY_ASSISTANT":
        return or_(
            RegulatoryProduct.responsible_id == uid,
            RegulatoryProduct.assistant_id == uid,
            RegulatoryProduct.assigned_users.any(User.id == uid),
        )
    return false()


def scope_medical_doctors(user: dict):
    role, uid = user["role"], user["id"]
    if has_global_view(role) or role == "MEDICAL_PROMOTION_MANAGER":
        return None
    if role == "MEDICAL_DELEGATE":
        return MedicalDoctor.delegate_id == uid
    return false()


def scope_medical_visits(user: dict):
    role, uid = user["role"], user["id"]
    if has_global_view(role) or role == "MEDICAL_PROMOTION_MANAGER":
        return None
    if role == "MEDICAL_DELEGATE":
        return MedicalVisit.delegate_id == uid
    return false()


def scope_sales(user: dict):
    role, uid = user["role"], user["id"]
    if has_global_view(role) or role in ("HEAD_OF_SALES", "LOGISTICS_MANAGER", "FINANCE_BUDGET_MANAGER"):
        return None
    if role == "SALES_USER":
        return Sale.sales_user_id == uid
    return false()


def scope_business_development(user: dict):
    role, uid = user["role"], user["id"]
    if has_global_view(role) or role == "BUSINESS_DEVELOPMENT_MANAGER":
        return None
    return false()


def apply_scope(query, condition):
    """Apply a scope condition to a query (no-op when condition is None)."""
    if condition is None:
        return query
    return query.filter(condition)
