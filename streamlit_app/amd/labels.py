"""French labels and colour tones for every enum value.

``tone`` maps to a hex colour used for status pills and table styling.
"""
from __future__ import annotations

# Tone palette (corporate pharma).
TONES = {
    "neutral": "#64748b",
    "info": "#2563eb",
    "success": "#16a34a",
    "warning": "#d97706",
    "danger": "#dc2626",
    "purple": "#7c3aed",
}

ROLE_LABELS = {
    "SUPER_ADMIN": "Super Admin",
    "DIRECTION": "Direction",
    "HEAD_OF_REGULATORY": "Responsable Réglementaire",
    "REGULATORY_ASSISTANT": "Assistante Réglementaire",
    "HEAD_OF_SALES": "Responsable Ventes",
    "SALES_USER": "Commercial",
    "LOGISTICS_MANAGER": "Responsable Logistique",
    "MEDICAL_PROMOTION_MANAGER": "Manager Promotion Médicale",
    "MEDICAL_DELEGATE": "Délégué Médical",
    "BUSINESS_DEVELOPMENT_MANAGER": "Manager Business Development",
    "FINANCE_BUDGET_MANAGER": "Responsable Finance / Budget",
    "VIEWER": "Lecteur",
}

PRIORITY = {
    "LOW": ("Basse", "neutral"),
    "MEDIUM": ("Moyenne", "info"),
    "HIGH": ("Haute", "warning"),
    "CRITICAL": ("Critique", "danger"),
}

PRODUCT_TYPE = {
    "IMPORTED": "Importé",
    "LOCALLY_MANUFACTURED": "Fabriqué localement",
    "TOLL_MANUFACTURING": "Façonnage",
    "BIOSIMILAR": "Biosimilaire",
    "GENERIC": "Générique",
    "ORIGINATOR": "Princeps",
}

REGULATORY_STATUS = {
    "PRE_SUBMISSION": ("Pré-soumission", "neutral"),
    "IN_PREPARATION": ("Préparation dossier", "info"),
    "SUBMITTED": ("Déposé", "info"),
    "AWAITING_BV_PAYMENT": ("Attente paiement BV", "warning"),
    "AWAITING_ANPP": ("Attente ANPP", "warning"),
    "RESPONDING_TO_QUERIES": ("Réponse aux réserves", "warning"),
    "DECISION_OBTAINED": ("Décision obtenue", "success"),
    "BLOCKED": ("Bloqué", "danger"),
    "CLOSED": ("Clôturé", "success"),
}

STEP_STATUS = {
    "NOT_STARTED": ("Non commencé", "neutral"),
    "IN_PROGRESS": ("En cours", "info"),
    "DONE": ("Terminé", "success"),
    "BLOCKED": ("Bloqué", "danger"),
    "LATE": ("En retard", "warning"),
}

REGULATORY_STEP_TYPE = {
    "PRE_SUBMISSION": "Pré-soumission",
    "CTD_PREPARATION": "Préparation dossier CTD",
    "DOSSIER_REVIEW": "Vérification dossier",
    "DOSSIER_SUBMISSION": "Dépôt dossier",
    "BV1_PAYMENT": "Paiement 1er BV",
    "BV1_RECEIPT": "Réception 1er BV",
    "BV2_PAYMENT": "Paiement 2ème BV",
    "BV2_RECEIPT": "Réception 2ème BV",
    "BV3_PAYMENT": "Paiement 3ème BV",
    "BV3_RECEIPT": "Réception 3ème BV",
    "QUERY_RESPONSE": "Réponse aux réserves",
    "COMPLEMENTS_REQUESTED": "Compléments demandés",
    "COMPLEMENTS_SUBMITTED": "Compléments déposés",
    "COMMISSION_REVIEW": "Passage commission",
    "REGISTRATION_DECISION": "Décision d'enregistrement",
    "AMM_RECEIVED": "AMM reçue",
    "DOSSIER_CLOSED": "Dossier clôturé",
}

REGULATORY_STEP_ORDER = list(REGULATORY_STEP_TYPE.keys())

SPONSORING_STATUS = {
    "RECEIVED": ("Reçu", "neutral"),
    "IN_ANALYSIS": ("En analyse", "info"),
    "ACCEPTED": ("Accepté", "success"),
    "REFUSED": ("Refusé", "danger"),
    "AWAITING_DIRECTION": ("Attente Direction", "warning"),
    "PAID": ("Payé", "success"),
    "CLOSED": ("Clôturé", "neutral"),
}

BUDGET_CATEGORY = {
    "REGULATORY": "Regulatory",
    "SPONSORING": "Sponsoring",
    "CONGRESS_INTERNATIONAL": "Congrès internationaux",
    "CONGRESS_NATIONAL": "Congrès nationaux",
    "MEDICAL_PROMOTION": "Promotion médicale",
    "LOGISTICS": "Logistique",
    "BUSINESS_DEVELOPMENT": "Business Development",
    "MARKETING": "Marketing",
}

BUDGET_STATUS = {
    "ON_TRACK": ("Maîtrisé", "success"),
    "AT_RISK": ("À surveiller", "warning"),
    "OVER_BUDGET": ("Dépassé", "danger"),
    "CLOSED": ("Clôturé", "neutral"),
}

CONGRESS_STATUS = {
    "CONSIDERED": ("Envisagé", "neutral"),
    "VALIDATED": ("Validé", "info"),
    "ORGANIZED": ("Organisé", "info"),
    "COMPLETED": ("Terminé", "success"),
    "CANCELLED": ("Annulé", "danger"),
}

PAYMENT_STATUS = {
    "UNPAID": ("Non payé", "warning"),
    "PARTIAL": ("Partiel", "info"),
    "PAID": ("Payé", "success"),
    "OVERDUE": ("En retard", "danger"),
}

DELIVERY_STATUS = {
    "PENDING": ("En attente", "neutral"),
    "IN_TRANSIT": ("En transit", "info"),
    "DELIVERED": ("Livré", "success"),
    "RETURNED": ("Retourné", "danger"),
}

LOGISTICS_STATUS = {
    "ORDERED": ("Commandé", "neutral"),
    "PRODUCTION": ("Production", "info"),
    "SHIPPED": ("Expédié", "info"),
    "ARRIVED_TERMINAL": ("Arrivé port/aéroport", "warning"),
    "CUSTOMS": ("Dédouanement", "warning"),
    "DELIVERED": ("Livré", "success"),
    "BLOCKED": ("Bloqué", "danger"),
}

VISIT_STATUS = {
    "PLANNED": ("Prévu", "info"),
    "COMPLETED": ("Réalisé", "success"),
    "CANCELLED": ("Annulé", "danger"),
    "POSTPONED": ("Reporté", "warning"),
}

INFLUENCE_LEVEL = {
    "LOW": ("Faible", "neutral"),
    "MEDIUM": ("Moyen", "info"),
    "HIGH": ("Élevé", "warning"),
    "KEY_OPINION_LEADER": ("Leader d'opinion", "purple"),
}

BD_TYPE = {
    "GENERIC": "Générique",
    "BIOSIMILAR": "Biosimilaire",
    "ORIGINATOR": "Princeps",
    "LICENSE": "Licence",
    "DISTRIBUTION": "Distribution",
    "TOLL_MANUFACTURING": "Façonnage",
}

BD_STATUS = {
    "IDEA": ("Idée", "neutral"),
    "RESEARCH": ("Recherche", "info"),
    "CONTACTED": ("Contacté", "info"),
    "NDA": ("NDA", "purple"),
    "OFFER_RECEIVED": ("Offre reçue", "warning"),
    "NEGOTIATION": ("Négociation", "warning"),
    "VALIDATED": ("Validé", "success"),
    "ABANDONED": ("Abandonné", "danger"),
}

DOCUMENT_CATEGORY = {
    "CTD_FULL": "CTD complet", "MODULE_1": "Module 1", "MODULE_2": "Module 2",
    "MODULE_3": "Module 3", "MODULE_4": "Module 4", "MODULE_5": "Module 5",
    "GMP_CERTIFICATE": "Certificat GMP", "CPP": "CPP", "ORIGIN_AMM": "AMM pays d'origine",
    "SUBMISSION_LETTER": "Lettre de soumission", "BV_RECEIPT": "Reçu de paiement BV",
    "QUERY_RESPONSE": "Réponse aux réserves", "REGISTRATION_DECISION": "Décision d'enregistrement",
    "PROFORMA": "Proforma", "INVOICE": "Facture / Invoice", "PACKING_LIST": "Packing list",
    "BL_AWB": "BL / AWB", "ANALYSIS_CERTIFICATE": "Certificat d'analyse",
    "ORIGIN_CERTIFICATE": "Certificat d'origine", "CUSTOMS_DOCS": "Documents douane",
    "DELIVERY_NOTE": "Bon de livraison", "RECEPTION_REPORT": "PV de réception",
    "REQUEST_LETTER": "Lettre de demande", "PROGRAM": "Programme", "QUOTE": "Devis",
    "CONVENTION": "Convention", "SUPPORTING_DOC": "Justificatif", "PHOTO": "Photo",
    "PRESENTATION": "Présentation", "POST_EVENT_REPORT": "Rapport post-événement",
    "SUPPLIER_OFFER": "Offre fournisseur", "OTHER": "Autre",
}

CONFIDENTIALITY = {
    "INTERNAL": ("Interne", "neutral"),
    "RESTRICTED": ("Restreint", "warning"),
    "CONFIDENTIAL": ("Confidentiel", "danger"),
}

ENTITY_TYPE_LABELS = {
    "REGULATORY_PRODUCT": "Regulatory", "SPONSORING": "Sponsoring", "BUDGET": "Budget",
    "CONGRESS_INTERNATIONAL": "Congrès international", "CONGRESS_NATIONAL": "Congrès national",
    "SALE": "Vente", "LOGISTICS": "Logistique PCH", "DOCTOR": "Médecin", "VISIT": "Visite",
    "BD_OPPORTUNITY": "Business Development",
}

NOTIFICATION_TYPE = {
    "DEADLINE_NEAR": ("Échéance proche", "warning"),
    "LATE": ("Retard", "danger"),
    "ASSIGNMENT": ("Assignation", "info"),
    "DOCUMENT_UPLOADED": ("Document", "info"),
    "VALIDATION_REQUIRED": ("Validation requise", "warning"),
    "BUDGET_EXCEEDED": ("Budget dépassé", "danger"),
    "PCH_DELAY": ("Retard PCH", "danger"),
    "REGULATORY_BLOCKED": ("Dossier bloqué", "danger"),
    "SPONSORING_VALIDATION": ("Sponsoring", "warning"),
    "BD_NEXT_ACTION": ("Action BD", "info"),
    "MEDICAL_TOUR": ("Tournée médicale", "info"),
    "GENERIC": ("Notification", "neutral"),
}

AUDIT_ACTION = {
    "CREATE": ("Création", "success"), "UPDATE": ("Modification", "info"),
    "DELETE": ("Suppression", "danger"), "LOGIN": ("Connexion", "neutral"),
    "LOGOUT": ("Déconnexion", "neutral"), "EXPORT": ("Export", "info"),
    "IMPORT": ("Import", "info"), "UPLOAD": ("Upload", "info"),
    "VALIDATE": ("Validation", "success"), "REFUSE": ("Refus", "danger"),
}


def label_of(mapping: dict, value, default: str | None = None) -> str:
    """Return the FR label for a value from a label map (string or (label, tone) tuples)."""
    if value is None:
        return default or "—"
    entry = mapping.get(value)
    if entry is None:
        return str(value)
    return entry[0] if isinstance(entry, tuple) else entry


def tone_of(mapping: dict, value) -> str:
    entry = mapping.get(value)
    if isinstance(entry, tuple):
        return entry[1]
    return "neutral"


def color_of(mapping: dict, value) -> str:
    return TONES.get(tone_of(mapping, value), TONES["neutral"])
