"""View registry for AMD Internal OS.

Each module exposes a ``render()`` function. NAV maps a module key to its
sidebar metadata; ``app.py`` builds the RBAC-filtered navigation from it.
"""
from . import (
    admin,
    budgets,
    business_development,
    congress_international,
    congress_national,
    dashboard,
    documents,
    logistics,
    medical,
    notifications,
    regulatory,
    sales,
    sponsoring,
)

# module key -> (title, icon, group, render_fn)
NAV = {
    "DASHBOARD": ("Dashboard", "📊", "Pilotage", dashboard.render),
    "REGULATORY": ("Regulatory", "💊", "Pôles", regulatory.render),
    "SPONSORING": ("Sponsoring", "🤝", "Pôles", sponsoring.render),
    "BUDGETS": ("Budgets", "💰", "Pôles", budgets.render),
    "CONGRESS_INTERNATIONAL": ("Congrès internationaux", "🌍", "Pôles", congress_international.render),
    "CONGRESS_NATIONAL": ("Congrès nationaux", "📍", "Pôles", congress_national.render),
    "SALES": ("Ventes", "📈", "Pôles", sales.render),
    "LOGISTICS": ("Logistique PCH", "🚚", "Pôles", logistics.render),
    "MEDICAL": ("Promotion médicale", "🩺", "Pôles", medical.render),
    "BUSINESS_DEVELOPMENT": ("Business Development", "🚀", "Pôles", business_development.render),
    "DOCUMENTS": ("Documents", "📁", "Transverse", documents.render),
    "NOTIFICATIONS": ("Notifications", "🔔", "Transverse", notifications.render),
    "ADMIN": ("Administration", "⚙️", "Système", admin.render),
}
