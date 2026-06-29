import type { Module } from "./rbac";

/**
 * Centralised French display labels and badge tones for every enum value.
 * `tone` maps to the <Badge> component variants.
 */

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple";

interface Display {
  label: string;
  tone: BadgeTone;
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  DIRECTION: "Direction",
  HEAD_OF_REGULATORY: "Responsable Réglementaire",
  REGULATORY_ASSISTANT: "Assistante Réglementaire",
  HEAD_OF_SALES: "Responsable Ventes",
  SALES_USER: "Commercial",
  LOGISTICS_MANAGER: "Responsable Logistique",
  MEDICAL_PROMOTION_MANAGER: "Manager Promotion Médicale",
  MEDICAL_DELEGATE: "Délégué Médical",
  PRODUCT_MANAGER: "Chef de produit",
  BUSINESS_DEVELOPMENT_MANAGER: "Manager Business Development",
  FINANCE_BUDGET_MANAGER: "Responsable Finance / Budget",
  MEDICAL_INFO_PHARMACIST: "Pharmacien resp. information médicale",
  COORDINATOR: "Coordination / Coursier",
  VIEWER: "Lecteur",
};

export const PRIORITY: Record<string, Display> = {
  LOW: { label: "Basse", tone: "neutral" },
  MEDIUM: { label: "Moyenne", tone: "info" },
  HIGH: { label: "Haute", tone: "warning" },
  CRITICAL: { label: "Critique", tone: "danger" },
};

export const REGULATORY_CATEGORY: Record<string, Display> = {
  MEDICINE: { label: "Médicament", tone: "info" },
  MEDICAL_DEVICE: { label: "Dispositif médical", tone: "purple" },
};

export const SALE_TYPE: Record<string, Display> = {
  PRODUCT: { label: "Produit", tone: "info" },
  SERVICE: { label: "Service", tone: "purple" },
};

export const PRODUCT_TYPE: Record<string, string> = {
  IMPORTED: "Importé",
  LOCALLY_MANUFACTURED: "Fabriqué localement",
  TOLL_MANUFACTURING: "Façonnage",
  BIOSIMILAR: "Biosimilaire",
  GENERIC: "Générique",
  ORIGINATOR: "Princeps",
};

export const REGULATORY_STATUS: Record<string, Display> = {
  PRE_SUBMISSION: { label: "Pré-soumission", tone: "neutral" },
  IN_PREPARATION: { label: "Préparation dossier", tone: "info" },
  SUBMITTED: { label: "Déposé", tone: "info" },
  AWAITING_BV_PAYMENT: { label: "Attente paiement BV", tone: "warning" },
  AWAITING_ANPP: { label: "Attente ANPP", tone: "warning" },
  RESPONDING_TO_QUERIES: { label: "Réponse aux réserves", tone: "warning" },
  DECISION_OBTAINED: { label: "Décision obtenue", tone: "success" },
  BLOCKED: { label: "Bloqué", tone: "danger" },
  CLOSED: { label: "Clôturé", tone: "success" },
};

/** Statut SIMPLIFIÉ visible par le fournisseur dans le portail externe. */
export const EXTERNAL_REGULATORY_STATUS: Record<string, Display> = {
  IN_PREPARATION: { label: "Dossier en préparation", tone: "info" },
  SUBMITTED: { label: "Dossier déposé", tone: "info" },
  UNDER_REVIEW: { label: "En cours d'examen", tone: "warning" },
  INFO_REQUESTED: { label: "Compléments demandés", tone: "warning" },
  APPROVED: { label: "Enregistrement obtenu", tone: "success" },
  ON_HOLD: { label: "En attente", tone: "neutral" },
  CLOSED: { label: "Clôturé", tone: "neutral" },
};

export const STEP_STATUS: Record<string, Display> = {
  NOT_STARTED: { label: "Non commencé", tone: "neutral" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  DONE: { label: "Terminé", tone: "success" },
  BLOCKED: { label: "Bloqué", tone: "danger" },
  LATE: { label: "En retard", tone: "warning" },
};

export const REGULATORY_STEP_TYPE: Record<string, string> = {
  PRE_SUBMISSION: "Pré-soumission",
  CTD_PREPARATION: "Préparation dossier CTD",
  DOSSIER_REVIEW: "Vérification dossier",
  DOSSIER_SUBMISSION: "Dépôt dossier",
  BV1_PAYMENT: "Paiement 1er BV",
  BV1_RECEIPT: "Réception 1er BV",
  BV2_PAYMENT: "Paiement 2ème BV",
  BV2_RECEIPT: "Réception 2ème BV",
  BV3_PAYMENT: "Paiement 3ème BV",
  BV3_RECEIPT: "Réception 3ème BV",
  QUERY_RESPONSE: "Réponse aux réserves",
  COMPLEMENTS_REQUESTED: "Compléments demandés",
  COMPLEMENTS_SUBMITTED: "Compléments déposés",
  COMMISSION_REVIEW: "Passage commission",
  REGISTRATION_DECISION: "Décision d'enregistrement",
  AMM_RECEIVED: "AMM reçue",
  DOSSIER_CLOSED: "Dossier clôturé",
};

/** Ordered list of regulatory steps used when seeding & rendering timelines. */
export const REGULATORY_STEP_ORDER: string[] = [
  "PRE_SUBMISSION",
  "CTD_PREPARATION",
  "DOSSIER_REVIEW",
  "DOSSIER_SUBMISSION",
  "BV1_PAYMENT",
  "BV1_RECEIPT",
  "BV2_PAYMENT",
  "BV2_RECEIPT",
  "BV3_PAYMENT",
  "BV3_RECEIPT",
  "QUERY_RESPONSE",
  "COMPLEMENTS_REQUESTED",
  "COMPLEMENTS_SUBMITTED",
  "COMMISSION_REVIEW",
  "REGISTRATION_DECISION",
  "AMM_RECEIVED",
  "DOSSIER_CLOSED",
];

export const SPONSORING_STATUS: Record<string, Display> = {
  RECEIVED: { label: "Reçu", tone: "neutral" },
  IN_ANALYSIS: { label: "En analyse", tone: "info" },
  ACCEPTED: { label: "Accepté", tone: "success" },
  REFUSED: { label: "Refusé", tone: "danger" },
  AWAITING_DIRECTION: { label: "Attente Direction", tone: "warning" },
  PAID: { label: "Payé", tone: "success" },
  CLOSED: { label: "Clôturé", tone: "neutral" },
  AWAITING_PRELIMINARY: { label: "Attente validation préliminaire", tone: "warning" },
  PRELIMINARY_APPROVED: { label: "Analyse chef de produit", tone: "info" },
  AWAITING_FINAL: { label: "Attente décision Direction", tone: "warning" },
  APPROVED: { label: "Accordé", tone: "success" },
  APPEAL_PENDING: { label: "Appel — réexamen chef de produit", tone: "purple" },
  AWAITING_FINAL_APPEAL: { label: "Appel — décision Direction", tone: "warning" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

/** Types de sponsoring proposés en menu déroulant (valeur = libellé stocké). */
export const SPONSORING_TYPES: string[] = [
  "Congrès",
  "Séminaire",
  "Table ronde",
  "Formation / Atelier",
  "Webinaire",
  "Symposium",
  "Staff / Réunion de service",
  "Publication / Documentation",
  "Équipement / Matériel",
  "Autre",
];

export const BUDGET_CATEGORY: Record<string, string> = {
  REGULATORY: "Regulatory",
  SPONSORING: "Sponsoring",
  CONGRESS_INTERNATIONAL: "Congrès internationaux",
  CONGRESS_NATIONAL: "Congrès nationaux",
  MEDICAL_PROMOTION: "Promotion médicale",
  LOGISTICS: "Logistique",
  BUSINESS_DEVELOPMENT: "Business Development",
  MARKETING: "Marketing",
};

export const BUDGET_STATUS: Record<string, Display> = {
  ON_TRACK: { label: "Maîtrisé", tone: "success" },
  AT_RISK: { label: "À surveiller", tone: "warning" },
  OVER_BUDGET: { label: "Dépassé", tone: "danger" },
  CLOSED: { label: "Clôturé", tone: "neutral" },
};

export const CONGRESS_STATUS: Record<string, Display> = {
  CONSIDERED: { label: "Envisagé", tone: "neutral" },
  VALIDATED: { label: "Validé", tone: "info" },
  ORGANIZED: { label: "Organisé", tone: "info" },
  COMPLETED: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

export const CONGRESS_REQUEST_STATUS: Record<string, Display> = {
  AWAITING_PRELIMINARY: { label: "Attente validation préliminaire", tone: "warning" },
  PRELIMINARY_APPROVED: { label: "Analyse chef de produit", tone: "info" },
  AWAITING_FINAL: { label: "Attente validation définitive", tone: "warning" },
  APPROVED: { label: "Validé — pris en charge", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
  COMPLETED: { label: "Réalisé", tone: "success" },
};

export const NATIONAL_EVENT_TYPE: Record<string, string> = {
  CONGRESS: "Congrès",
  SEMINAR: "Séminaire",
  ROUND_TABLE: "Table ronde",
  WEBINAR: "Webinaire",
  WORKSHOP: "Atelier",
  SYMPOSIUM: "Symposium",
  STAFF: "Staff / réunion service",
  OTHER: "Autre",
};

export const PAYMENT_STATUS: Record<string, Display> = {
  UNPAID: { label: "Non payé", tone: "warning" },
  PARTIAL: { label: "Partiel", tone: "info" },
  PAID: { label: "Payé", tone: "success" },
  OVERDUE: { label: "En retard", tone: "danger" },
};

export const DELIVERY_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "neutral" },
  IN_TRANSIT: { label: "En transit", tone: "info" },
  DELIVERED: { label: "Livré", tone: "success" },
  RETURNED: { label: "Retourné", tone: "danger" },
};

export const LOGISTICS_STATUS: Record<string, Display> = {
  ORDERED: { label: "Commandé", tone: "neutral" },
  PRODUCTION: { label: "Production", tone: "info" },
  SHIPPED: { label: "Expédié", tone: "info" },
  ARRIVED_TERMINAL: { label: "Arrivé port/aéroport", tone: "warning" },
  CUSTOMS: { label: "Dédouanement", tone: "warning" },
  DELIVERED: { label: "Livré", tone: "success" },
  BLOCKED: { label: "Bloqué", tone: "danger" },
};

export const PCH_TENDER_STATUS: Record<string, Display> = {
  NOT_STARTED: { label: "Pas encore commencé", tone: "neutral" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  COMPLETED: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

export const PCH_ORDER_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  VALIDATED: { label: "Validé", tone: "info" },
  DELIVERED: { label: "Livré", tone: "success" },
  PAID: { label: "Payé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

export const STOCK_DIRECTION: Record<string, Display> = {
  IN: { label: "Entrée", tone: "success" },
  OUT: { label: "Sortie", tone: "danger" },
  ADJUST: { label: "Ajustement", tone: "neutral" },
};

export const EVENT_TYPE: Record<string, string> = {
  CONGRESS: "Congrès",
  SEMINAR: "Séminaire",
  ROUND_TABLE: "Table ronde",
  HOSPITAL_STAFF: "Staff hospitalier",
  SYMPOSIUM: "Symposium",
  WEBINAR: "Webinaire",
  TRAINING: "Formation",
  SCIENTIFIC_DAY: "Journée scientifique",
  OTHER: "Autre",
};

export const EVENT_SCOPE: Record<string, string> = { NATIONAL: "National", INTERNATIONAL: "International" };
export const EVENT_FORMAT: Record<string, string> = { PRESENTIAL: "Présentiel", WEBINAR: "Webinaire", HYBRID: "Hybride" };

export const EVENT_STATUS: Record<string, Display> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  AWAITING_VALIDATION: { label: "Attente validation", tone: "warning" },
  VALIDATED: { label: "Validé", tone: "info" },
  PREPARATION: { label: "En préparation", tone: "info" },
  REGISTRATION_OPEN: { label: "Inscriptions ouvertes", tone: "success" },
  FULL: { label: "Complet", tone: "warning" },
  COMPLETED: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

export const PARTICIPANT_ROLE: Record<string, string> = {
  DOCTOR: "Médecin",
  PROFESSOR: "Professeur",
  HEAD_OF_SERVICE: "Chef de service",
  PHARMACIST: "Pharmacien",
  OTHER: "Autre",
};

export const REGISTRATION_STATUS: Record<string, Display> = {
  REGISTERED: { label: "Inscrit", tone: "info" },
  CONFIRMED: { label: "Confirmé", tone: "success" },
  PENDING: { label: "En attente", tone: "warning" },
  REJECTED: { label: "Refusé", tone: "danger" },
  PRESENT: { label: "Présent", tone: "success" },
  ABSENT: { label: "Absent", tone: "neutral" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

export const FIELD_REPORT_STATUS: Record<string, Display> = {
  DRAFT: { label: "Brouillon", tone: "warning" },
  VALIDATED: { label: "Validé", tone: "success" },
  ARCHIVED: { label: "Archivé", tone: "neutral" },
};

export const VISIT_STATUS: Record<string, Display> = {
  PLANNED: { label: "Prévu", tone: "info" },
  COMPLETED: { label: "Réalisé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
  POSTPONED: { label: "Reporté", tone: "warning" },
};

export const INFLUENCE_LEVEL: Record<string, Display> = {
  LOW: { label: "Faible", tone: "neutral" },
  MEDIUM: { label: "Moyen", tone: "info" },
  HIGH: { label: "Élevé", tone: "warning" },
  KEY_OPINION_LEADER: { label: "Leader d'opinion", tone: "purple" },
};

export const MEDICAL_SECTOR: Record<string, Display> = {
  HOSPITAL: { label: "Hôpital / Public", tone: "info" },
  LIBERAL: { label: "Libéral / Privé", tone: "purple" },
  BOTH: { label: "Public + Privé", tone: "neutral" },
};

export const DOCTOR_TITLE: Record<string, string> = {
  PROFESSEUR: "Professeur",
  MAITRE_CONFERENCES: "Maître de conférences",
  MAITRE_ASSISTANT: "Maître-assistant",
  PRATICIEN_SPECIALISTE: "Praticien spécialiste",
  ASSISTANT: "Assistant",
  RESIDENT: "Résident",
  GENERALISTE: "Médecin généraliste",
  PHARMACIEN: "Pharmacien",
  AUTRE: "Autre",
};

/** Préfixe d'affichage devant le nom (Pr. Mouffok, Dr. …). */
export const DOCTOR_TITLE_PREFIX: Record<string, string> = {
  PROFESSEUR: "Pr.",
  MAITRE_CONFERENCES: "Dr.",
  MAITRE_ASSISTANT: "Dr.",
  PRATICIEN_SPECIALISTE: "Dr.",
  ASSISTANT: "Dr.",
  RESIDENT: "Dr.",
  GENERALISTE: "Dr.",
  PHARMACIEN: "",
  AUTRE: "",
};

/** Nom affiché d'un médecin avec son préfixe de titre (« Pr. Mouffok »). Helper
 *  pur partagé serveur + client (à ne pas exporter depuis un module "use client"). */
export function doctorDisplayName(d: { title: string; name: string }): string {
  const prefix = DOCTOR_TITLE_PREFIX[d.title] ?? "";
  return prefix ? `${prefix} ${d.name}` : d.name;
}

export const BD_TYPE: Record<string, string> = {
  GENERIC: "Générique",
  BIOSIMILAR: "Biosimilaire",
  ORIGINATOR: "Princeps",
  LICENSE: "Licence",
  DISTRIBUTION: "Distribution",
  TOLL_MANUFACTURING: "Façonnage",
};

export const BD_STATUS: Record<string, Display> = {
  IDEA: { label: "Idée", tone: "neutral" },
  RESEARCH: { label: "Recherche", tone: "info" },
  CONTACTED: { label: "Contacté", tone: "info" },
  NDA: { label: "NDA", tone: "purple" },
  OFFER_RECEIVED: { label: "Offre reçue", tone: "warning" },
  NEGOTIATION: { label: "Négociation", tone: "warning" },
  VALIDATED: { label: "Validé", tone: "success" },
  ABANDONED: { label: "Abandonné", tone: "danger" },
};

/** Statuts stratégiques d'un projet Business Development (Projet → Gamme → Produit). */
export const BD_PROJECT_STATUS: Record<string, Display> = {
  IDEA: { label: "Idée", tone: "neutral" },
  TO_ANALYZE: { label: "À analyser", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  AWAITING_SUPPLIER: { label: "En attente fournisseur", tone: "warning" },
  AWAITING_INTERNAL: { label: "En attente interne", tone: "warning" },
  RECOMMENDATION_READY: { label: "Recommandation prête", tone: "purple" },
  VALIDATED: { label: "Validé", tone: "success" },
  ABANDONED: { label: "Abandonné", tone: "danger" },
  CLOSED: { label: "Clôturé", tone: "neutral" },
};

export const BD_SOURCING: Record<string, string> = {
  MANUFACTURED: "Fabriqué",
  IMPORTED: "Importé",
  TO_STUDY: "À étudier",
};

export const DOCUMENT_CATEGORY: Record<string, string> = {
  CTD_FULL: "CTD complet",
  MODULE_1: "Module 1",
  MODULE_2: "Module 2",
  MODULE_3: "Module 3",
  MODULE_4: "Module 4",
  MODULE_5: "Module 5",
  GMP_CERTIFICATE: "Certificat GMP",
  CPP: "CPP",
  ORIGIN_AMM: "AMM pays d'origine",
  SUBMISSION_LETTER: "Lettre de soumission",
  BV_RECEIPT: "Reçu de paiement BV",
  QUERY_RECEIVED: "Réserves reçues (ANPP)",
  QUERY_RESPONSE: "Réponse aux réserves",
  REGISTRATION_DECISION: "Décision d'enregistrement",
  PROFORMA: "Proforma",
  INVOICE: "Facture / Invoice",
  PACKING_LIST: "Packing list",
  BL_AWB: "BL / AWB",
  ANALYSIS_CERTIFICATE: "Certificat d'analyse",
  ORIGIN_CERTIFICATE: "Certificat d'origine",
  CUSTOMS_DOCS: "Documents douane",
  DELIVERY_NOTE: "Bon de livraison",
  RECEPTION_REPORT: "PV de réception",
  REQUEST_LETTER: "Lettre de demande",
  PROGRAM: "Programme",
  QUOTE: "Devis",
  CONVENTION: "Convention",
  SUPPORTING_DOC: "Justificatif",
  PHOTO: "Photo",
  PRESENTATION: "Présentation",
  POST_EVENT_REPORT: "Rapport post-événement",
  SUPPLIER_OFFER: "Offre fournisseur",
  PURCHASE_ORDER: "Bon de commande",
  PAYMENT_SLIP: "Bordereau de paiement",
  PAYMENT_RECEIPT: "Quittance / reçu",
  PROMO_MATERIAL_FILE: "Matériel promotionnel",
  AD_VISA: "Visa publicitaire",
  OTHER: "Autre",
};

export const CONFIDENTIALITY: Record<string, Display> = {
  INTERNAL: { label: "Interne", tone: "neutral" },
  RESTRICTED: { label: "Restreint", tone: "warning" },
  CONFIDENTIAL: { label: "Confidentiel", tone: "danger" },
};

export const FINANCE_DIRECTION: Record<string, Display> = {
  IN: { label: "Encaissement", tone: "success" },
  OUT: { label: "Décaissement", tone: "danger" },
};

export const FINANCE_CATEGORY: Record<string, string> = {
  RECETTE: "Recette / Vente",
  CCA: "Compte courant associé",
  PRET: "Emprunt reçu",
  REMBOURSEMENT: "Remboursement emprunt",
  SALAIRE: "Salaires / Personnel",
  AVANCE: "Avance sur salaire",
  LOYER: "Loyer",
  VOYAGE: "Voyages / Déplacements",
  EVENEMENT: "Événement / Table ronde",
  BUREAUTIQUE: "Bureautique / Mobilier",
  FOURNISSEUR: "Achats fournisseurs",
  CHARGES: "Charges (élec, eau, internet…)",
  IMPOT: "Impôts & taxes",
  BANQUE: "Frais bancaires",
  AUTRE: "Autre",
};

export const FINANCE_METHOD: Record<string, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  CHEQUE: "Chèque",
  CARD: "Carte",
  OTHER: "Autre",
};

export const FINANCE_STATUS: Record<string, Display> = {
  PENDING: { label: "Prévu", tone: "warning" },
  SETTLED: { label: "Réalisé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

export const PAYROLL_STATUS: Record<string, Display> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  VALIDATED: { label: "Validé", tone: "info" },
  PAID: { label: "Payé", tone: "success" },
};

export const CONTRACT_TYPE: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  INTERIM: "Intérim",
  STAGE: "Stage",
  FREELANCE: "Freelance / Prestation",
  OTHER: "Autre",
};

export const HR_DOCUMENT_CATEGORY: Record<string, string> = {
  CONTRACT: "Contrat de travail",
  AMENDMENT: "Avenant",
  PAYSLIP: "Bulletin de paie",
  WORK_CERTIFICATE: "Attestation de travail",
  CNAS_CERTIFICATE: "Attestation CNAS",
  SALARY_STATEMENT: "Relevé des émoluments",
  DOMICILIATION: "Domiciliation de salaire",
  ID_DOCUMENT: "Pièce d'identité",
  DIPLOMA: "Diplôme",
  MEDICAL: "Certificat médical",
  OTHER: "Autre",
};

export const HR_REQUEST_TYPE: Record<string, string> = {
  WORK_CERTIFICATE: "Attestation de travail",
  CNAS_CERTIFICATE: "Attestation CNAS",
  SALARY_STATEMENT: "Relevé des émoluments",
  DOMICILIATION: "Domiciliation de salaire",
  LEAVE_CERTIFICATE: "Attestation de congé",
  LEAVE_TITLE: "Titre de congé",
  MISSION_ORDER: "Ordre de mission",
  EXPENSE_REPORT: "Note de frais",
  OTHER: "Autre demande",
};

export const HR_REQUEST_STATUS: Record<string, Display> = {
  PENDING: { label: "Soumise", tone: "warning" },
  IN_PROGRESS: { label: "En préparation", tone: "info" },
  READY: { label: "Prête", tone: "success" },
  DELIVERED: { label: "Remise", tone: "neutral" },
  REJECTED: { label: "Refusée", tone: "danger" },
};

export const LEAVE_TYPE: Record<string, string> = {
  ANNUAL: "Congé annuel",
  SICK: "Maladie",
  UNPAID: "Sans solde",
  MATERNITY: "Maternité / Paternité",
  SPECIAL: "Événement familial",
  RECOVERY: "Récupération",
  OTHER: "Autre",
};

export const LEAVE_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  APPROVED: { label: "Approuvé", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

export const TASK_STATUS: Record<string, Display> = {
  REQUESTED: { label: "Demandée", tone: "warning" },
  TODO: { label: "À faire", tone: "neutral" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  DONE: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
  DECLINED: { label: "Refusée", tone: "danger" },
};

export const ADVANCE_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  APPROVED: { label: "Approuvée", tone: "info" },
  REJECTED: { label: "Refusée", tone: "danger" },
  PAID: { label: "Réglée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const EXPENSE_ORDER_STATUS: Record<string, Display> = {
  PENDING: { label: "À régler", tone: "warning" },
  REVISION_REQUESTED: { label: "Révision budget demandée", tone: "purple" },
  PAID: { label: "Réglé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

export const ADMIN_REQUEST_TYPE: Record<string, string> = {
  TRAVEL: "Déplacement / Hôtel / Billet",
  MAIL: "Courrier / Document officiel",
  SIGNATURE: "Signature / Cachet / Scan",
  PURCHASE: "Achat interne / Fournitures",
  QUOTE: "Devis fournisseur",
  PAYMENT: "Paiement / Facture",
  DRIVER: "Mission chauffeur",
  GUEST_VISA: "Visa / Professeur / Invité",
  HR_SIMPLE: "Demande RH",
  OTHER: "Autre",
};

export const ADMIN_REQUEST_STATUS: Record<string, Display> = {
  NEW: { label: "Nouvelle", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  AWAITING_VALIDATION: { label: "Attente validation", tone: "warning" },
  AWAITING_EXTERNAL: { label: "Attente externe", tone: "warning" },
  AWAITING_PAYMENT: { label: "Attente paiement", tone: "warning" },
  AWAITING_DOCUMENT: { label: "Attente document", tone: "warning" },
  BLOCKED: { label: "Bloquée", tone: "danger" },
  DONE: { label: "Terminée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const ADMIN_APPROVAL_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  APPROVED: { label: "Validé", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  CHANGES_REQUESTED: { label: "Modif. demandée", tone: "info" },
};

export const DRIVER_MISSION_STATUS: Record<string, Display> = {
  NEW: { label: "Nouvelle", tone: "neutral" },
  ACCEPTED: { label: "Acceptée", tone: "info" },
  EN_ROUTE: { label: "En route", tone: "info" },
  DONE: { label: "Terminée", tone: "success" },
  PROBLEM: { label: "Problème", tone: "danger" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  FINANCE_TRANSACTION: "Finances",
  EMPLOYEE: "Employé",
  PAYROLL: "Paie",
  LEAVE_REQUEST: "Congé",
  TASK: "Tâche",
  SALARY_ADVANCE: "Avance sur salaire",
  EXPENSE_ORDER: "Ordre de dépense",
  DRIVE_NODE: "Fichier / Dossier",
  ADMIN_REQUEST: "Demande administrative",
  DRIVER_MISSION: "Mission chauffeur",
  REGULATORY_PRODUCT: "Regulatory",
  REGULATORY_STEP: "Étape Regulatory",
  SPONSORING: "Sponsoring",
  BUDGET: "Budget",
  CONGRESS_INTERNATIONAL: "Congrès international",
  CONGRESS_NATIONAL: "Congrès national",
  SALE: "Vente",
  LOGISTICS: "Logistique PCH",
  DOCTOR: "Médecin",
  VISIT: "Visite",
  DELEGATE_PLAN: "Plan de tournée",
  BD_OPPORTUNITY: "Business Development",
  BD_PROJECT: "Projet BD",
  FEEDBACK: "Feedback",
  VALIDATION_REQUEST: "Validation",
  SUPPLIER: "Fournisseur",
  MEDICAL_INFO_DECLARATION: "Information médicale",
  DIRECTIVE: "Directive",
  SUPPORT_REQUEST: "Demande de support",
  DOSSIER: "Dossier de suivi",
  PROMO_MATERIAL: "Matériel promotionnel",
};

export const PROMO_MATERIAL_STATUS: Record<string, Display> = {
  PROSPECTION_REQUESTED: { label: "Prospection demandée", tone: "warning" },
  QUOTES_UPLOADED: { label: "Devis déposés", tone: "info" },
  AGENCY_CHOSEN: { label: "Agence choisie", tone: "info" },
  BC_FINANCE_REVIEW: { label: "BC — validation finances", tone: "warning" },
  BC_VALIDATED: { label: "BC validé", tone: "purple" },
  BC_SENT: { label: "BC transmis à l'agence", tone: "purple" },
  PAYMENT_INITIATED: { label: "Bordereau de paiement", tone: "warning" },
  PAYMENT_DONE: { label: "Paiement effectué", tone: "info" },
  MATERIAL_PRODUCED: { label: "Matériel réalisé", tone: "info" },
  CONFORMITY_REVIEW: { label: "Vérification conformité", tone: "warning" },
  VISA_OBTAINED: { label: "Visa publicitaire obtenu", tone: "purple" },
  BAT_PRINTING: { label: "BAT / impression", tone: "info" },
  FINAL_MATERIAL: { label: "Matériel final", tone: "info" },
  INVOICED: { label: "Facturé", tone: "warning" },
  SETTLED: { label: "Réglé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

/** Ordre du circuit (hors annulation) — pour la frise de suivi. */
export const PROMO_MATERIAL_FLOW: string[] = [
  "PROSPECTION_REQUESTED", "QUOTES_UPLOADED", "AGENCY_CHOSEN", "BC_FINANCE_REVIEW", "BC_VALIDATED",
  "BC_SENT", "PAYMENT_INITIATED", "PAYMENT_DONE", "MATERIAL_PRODUCED", "CONFORMITY_REVIEW",
  "VISA_OBTAINED", "BAT_PRINTING", "FINAL_MATERIAL", "INVOICED", "SETTLED",
];

export const MEDICAL_INFO_STATUS: Record<string, Display> = {
  AWAITING_REVIEW: { label: "À déclarer", tone: "warning" },
  DOCS_REQUESTED: { label: "Pièces demandées", tone: "info" },
  READY: { label: "Prêt à valider", tone: "purple" },
  AWAITING_DIRECTION: { label: "Validation Direction", tone: "warning" },
  VALIDATED: { label: "Validé", tone: "success" },
};

export const DOC_REQUEST_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  FULFILLED: { label: "Déposée", tone: "success" },
};

export const DIRECTIVE_STATUS: Record<string, Display> = {
  OPEN: { label: "À traiter", tone: "warning" },
  ACKNOWLEDGED: { label: "Pris en compte", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  DONE: { label: "Traité", tone: "success" },
  ARCHIVED: { label: "Archivé", tone: "neutral" },
};

export const SUPPORT_CATEGORY: Record<string, Display> = {
  QUESTION: { label: "Question", tone: "info" },
  SUPPORT_MATERIAL: { label: "Support de visite", tone: "purple" },
  BROCHURE: { label: "Brochure", tone: "purple" },
  DOCUMENT: { label: "Document / PDF", tone: "info" },
  OTHER: { label: "Autre", tone: "neutral" },
};

export const SUPPORT_STATUS: Record<string, Display> = {
  OPEN: { label: "À traiter", tone: "warning" },
  IN_PROGRESS: { label: "Pris en charge", tone: "info" },
  ANSWERED: { label: "Répondu", tone: "success" },
  CLOSED: { label: "Clôturé", tone: "neutral" },
};

export const DOSSIER_STATUS: Record<string, Display> = {
  OPEN: { label: "Ouvert", tone: "warning" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  ON_HOLD: { label: "En attente", tone: "neutral" },
  DONE: { label: "Abouti", tone: "success" },
  ARCHIVED: { label: "Archivé", tone: "neutral" },
};

export const FEEDBACK_STATUS: Record<string, Display> = {
  NEW: { label: "À traiter", tone: "warning" },
  SEEN: { label: "Vu", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  DONE: { label: "Traité", tone: "success" },
};

export const VALIDATION_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  APPROVED: { label: "Validé", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  CHANGES_REQUESTED: { label: "Modif. demandée", tone: "info" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

export const VALIDATION_STEP_STATE: Record<string, Display> = {
  PENDING: { label: "En attente", tone: "warning" },
  APPROVED: { label: "Validé", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  CHANGES_REQUESTED: { label: "Modif. demandée", tone: "info" },
  SKIPPED: { label: "Ignoré", tone: "neutral" },
};

export const VALIDATION_MODE: Record<string, string> = {
  SEQUENTIAL: "Séquentiel",
  PARALLEL: "Parallèle",
};

export const NOTIFICATION_TYPE: Record<string, Display> = {
  DEADLINE_NEAR: { label: "Échéance proche", tone: "warning" },
  LATE: { label: "Retard", tone: "danger" },
  ASSIGNMENT: { label: "Assignation", tone: "info" },
  DOCUMENT_UPLOADED: { label: "Document", tone: "info" },
  VALIDATION_REQUIRED: { label: "Validation requise", tone: "warning" },
  BUDGET_EXCEEDED: { label: "Budget dépassé", tone: "danger" },
  PCH_DELAY: { label: "Retard PCH", tone: "danger" },
  REGULATORY_BLOCKED: { label: "Dossier bloqué", tone: "danger" },
  SPONSORING_VALIDATION: { label: "Sponsoring", tone: "warning" },
  BD_NEXT_ACTION: { label: "Action BD", tone: "info" },
  MEDICAL_TOUR: { label: "Tournée médicale", tone: "info" },
  GENERIC: { label: "Notification", tone: "neutral" },
};

export const AUDIT_ACTION: Record<string, Display> = {
  CREATE: { label: "Création", tone: "success" },
  UPDATE: { label: "Modification", tone: "info" },
  DELETE: { label: "Suppression", tone: "danger" },
  LOGIN: { label: "Connexion", tone: "neutral" },
  LOGOUT: { label: "Déconnexion", tone: "neutral" },
  EXPORT: { label: "Export", tone: "info" },
  IMPORT: { label: "Import", tone: "info" },
  UPLOAD: { label: "Upload", tone: "info" },
  VALIDATE: { label: "Validation", tone: "success" },
  REFUSE: { label: "Refus", tone: "danger" },
};

// ─────────────── Messagerie interne ───────────────

export const CONVERSATION_TYPE: Record<string, Display> = {
  DIRECT: { label: "Message direct", tone: "info" },
  GROUP: { label: "Groupe", tone: "purple" },
  CHANNEL: { label: "Canal", tone: "neutral" },
};

export const CONV_MEMBER_ROLE: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
};

export const CONV_NOTIFY_LEVEL: Record<string, string> = {
  ALL: "Tous les messages",
  MENTIONS: "Mentions uniquement",
  NONE: "Silencieux",
};

/** Un onglet d'une entrée fusionnée (sous-module + route). */
export interface NavTab {
  module: Module;
  label: string;
  href: string;
}

/** Navigation metadata: maps a sidebar entry to a module + route + icon name. */
export interface NavItem {
  module: Module;
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  group: "Pilotage" | "Pôles" | "Transverse" | "Système";
  /**
   * Entrée fusionnée : plusieurs sous-modules présentés en onglets sur la page.
   * L'entrée est visible si l'utilisateur a accès à **au moins un** onglet, et son
   * lien est résolu (dans le layout) vers le premier onglet autorisé. Aucune
   * fonctionnalité n'est retirée : chaque onglet reste sa propre route, gardée par
   * son propre module.
   */
  tabs?: NavTab[];
  /** Préfixes de chemin additionnels qui activent l'entrée (pour les entrées fusionnées). */
  match?: string[];
}

// (L'« Espace comptable » a été fusionné dans la page Finances : plus d'onglets.)
export const CONGRESS_TABS: NavTab[] = [
  { module: "CONGRESS_INTERNATIONAL", label: "Internationaux", href: "/congress-international" },
  { module: "CONGRESS_NATIONAL", label: "Nationaux", href: "/congress-national" },
];
export const PCH_OPS_TABS: NavTab[] = [
  { module: "LOGISTICS", label: "Logistique", href: "/logistics" },
  { module: "STOCKS", label: "Stocks", href: "/stocks" },
];
// Espace personnel fusionné : travail + tableau de bord perso + directives + dossiers.
export const WORKSPACE_TABS: NavTab[] = [
  { module: "WORKSPACE", label: "Mon travail", href: "/mon-travail" },
  { module: "WORKSPACE", label: "Mon espace", href: "/mon-espace" },
  { module: "DIRECTIVES", label: "Directives", href: "/directives" },
  { module: "DOSSIERS", label: "Dossiers", href: "/dossiers" },
];
// Sponsoring + congrès (international/national) + événements, sous un seul module.
export const EVENTS_TABS: NavTab[] = [
  { module: "SPONSORING", label: "Sponsoring", href: "/sponsoring" },
  { module: "CONGRESS_INTERNATIONAL", label: "Congrès internationaux", href: "/congress-international" },
  { module: "CONGRESS_NATIONAL", label: "Congrès nationaux", href: "/congress-national" },
  { module: "EVENTS", label: "Événements", href: "/events" },
];
// Drive (fichiers) + Documents (pièces liées aux dossiers) sous un seul module.
export const DOCS_TABS: NavTab[] = [
  { module: "DRIVE", label: "Drive", href: "/drive" },
  { module: "DOCUMENTS", label: "Documents", href: "/documents" },
];
// Promotion médicale + rapports terrain des délégués, sous le module Médical.
export const MEDICAL_TABS: NavTab[] = [
  { module: "MEDICAL", label: "Promotion médicale", href: "/medical" },
  { module: "MEDICAL", label: "Rapports terrain", href: "/field-reports" },
];
// Adventum Brain + Process Intelligence, dans un seul cockpit Super Admin.
export const BRAIN_TABS: NavTab[] = [
  { module: "ADVENTUM_BRAIN", label: "Adventum Brain", href: "/adventum-brain" },
  { module: "PROCESS_INTELLIGENCE", label: "Process Intelligence", href: "/process-intelligence" },
];
// Administration : console + Contrôle de l'IA + Score d'adoption.
export const ADMIN_TABS: NavTab[] = [
  { module: "ADMIN", label: "Administration", href: "/admin" },
  { module: "ADMIN", label: "Contrôle de l'IA", href: "/admin/ai" },
  { module: "ADMIN", label: "Score d'adoption", href: "/admin/adoption" },
];

/**
 * Libellé lisible et **stable** par module, indépendant du menu (qui fusionne
 * désormais plusieurs modules sous une seule entrée). Utilisé par l'administration
 * (matrice d'accès) pour nommer chaque module, même ceux qui n'ont plus d'entrée
 * de menu dédiée. Typé `Record<Module, string>` → exhaustivité garantie.
 */
export const MODULE_LABELS: Record<Module, string> = {
  DASHBOARD: "Dashboard",
  WORKSPACE: "Espace de travail",
  MESSAGING: "Messagerie",
  REGULATORY: "Regulatory",
  SPONSORING: "Sponsoring",
  BUDGETS: "Budgets",
  FINANCES: "Finances",
  RH: "Ressources humaines",
  CONGRESS_INTERNATIONAL: "Congrès internationaux",
  CONGRESS_NATIONAL: "Congrès nationaux",
  EVENTS: "Événements",
  SALES: "Ventes",
  LOGISTICS: "Logistique",
  MEDICAL: "Promotion médicale",
  BUSINESS_DEVELOPMENT: "Business Development",
  PCH: "PCH — Marchés",
  STOCKS: "Stocks PCH",
  MEDICAL_INFO: "Information médicale",
  PROMO_MATERIAL: "Matériel promotionnel",
  VALIDATIONS: "Validations",
  DIRECTIVES: "Directives",
  SUPPORT: "Demandes de support",
  DOSSIERS: "Dossiers",
  DOCUMENTS: "Documents",
  DRIVE: "Drive",
  ADMIN_REQUESTS: "Demandes administratives",
  NOTIFICATIONS: "Notifications",
  PROCESS_INTELLIGENCE: "Process Intelligence",
  ADVENTUM_BRAIN: "Adventum Brain",
  ADMIN: "Administration",
};

// Navigation simplifiée : modules fusionnés en onglets (`tabs`) pour réduire le
// nombre d'entrées. Messagerie & Notifications ne sont PLUS dans le menu — elles
// restent accessibles via leurs icônes dans la barre du haut (les routes /messages
// et /notifications et leurs modules RBAC sont inchangés).
export const NAVIGATION: NavItem[] = [
  // Pilotage
  { module: "WORKSPACE", label: "Mon espace", href: "/mon-travail", icon: "LayoutGrid", group: "Pilotage", tabs: WORKSPACE_TABS },
  { module: "WORKSPACE", label: "Courrier", href: "/courrier", icon: "Mail", group: "Pilotage" },
  { module: "WORKSPACE", label: "Mon dossier RH", href: "/mon-dossier", icon: "BadgeCheck", group: "Pilotage" },
  { module: "DASHBOARD", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", group: "Pilotage" },
  // Pôles
  { module: "REGULATORY", label: "Regulatory", href: "/regulatory", icon: "FileCheck2", group: "Pôles" },
  { module: "SPONSORING", label: "Sponsoring & Événements", href: "/sponsoring", icon: "PartyPopper", group: "Pôles", tabs: EVENTS_TABS },
  { module: "BUDGETS", label: "Budgets", href: "/budgets", icon: "Wallet", group: "Pôles" },
  { module: "FINANCES", label: "Finances", href: "/finances", icon: "Landmark", group: "Pôles" },
  { module: "RH", label: "Ressources humaines", href: "/rh", icon: "UsersRound", group: "Pôles" },
  { module: "SALES", label: "Ventes", href: "/sales", icon: "TrendingUp", group: "Pôles" },
  { module: "LOGISTICS", label: "Logistique & Stocks PCH", href: "/logistics", icon: "Truck", group: "Pôles", tabs: PCH_OPS_TABS },
  { module: "PCH", label: "PCH — Marchés", href: "/pch", icon: "Gavel", group: "Pôles" },
  { module: "MEDICAL", label: "Promotion médicale", href: "/medical", icon: "Stethoscope", group: "Pôles", tabs: MEDICAL_TABS },
  { module: "MEDICAL_INFO", label: "Information médicale", href: "/information-medicale", icon: "ShieldPlus", group: "Pôles" },
  { module: "PROMO_MATERIAL", label: "Matériel promotionnel", href: "/promo-material", icon: "Megaphone", group: "Pôles" },
  { module: "BUSINESS_DEVELOPMENT", label: "Business Development", href: "/business-development", icon: "Lightbulb", group: "Pôles" },
  // Transverse
  { module: "MESSAGING", label: "Réunions & appels", href: "/meetings", icon: "Video", group: "Transverse" },
  { module: "VALIDATIONS", label: "Validations", href: "/validations", icon: "ShieldCheck", group: "Transverse" },
  { module: "DRIVE", label: "Documents", href: "/drive", icon: "FolderOpen", group: "Transverse", tabs: DOCS_TABS },
  { module: "ADMIN_REQUESTS", label: "Demandes administratives", href: "/demandes", icon: "ClipboardList", group: "Transverse" },
  { module: "WORKSPACE", label: "Feedback", href: "/feedback", icon: "MessageSquarePlus", group: "Transverse" },
  // Système
  { module: "ADVENTUM_BRAIN", label: "Adventum Brain", href: "/adventum-brain", icon: "BrainCircuit", group: "Système", tabs: BRAIN_TABS },
  { module: "ADMIN", label: "Administration", href: "/admin", icon: "Settings", group: "Système", tabs: ADMIN_TABS },
];

/**
 * Première destination de navigation que `canView` autorise — pour un atterrissage
 * **sûr** après un refus (jamais une page qui refuserait à nouveau → anti-boucle
 * `ERR_TOO_MANY_REDIRECTS`). On ignore les **sous-pages d'admin** (`/admin/…`),
 * gardées par un contrôle plus strict que VIEW ; « /admin » (VIEW) reste valide.
 * Renvoie `null` si l'utilisateur ne peut voir aucune destination.
 */
export function firstAccessibleHref(canView: (module: Module) => boolean): string | null {
  for (const n of NAVIGATION) {
    if (n.href.startsWith("/admin/")) continue;
    if (n.tabs) {
      const t = n.tabs.find((tab) => canView(tab.module));
      if (t) return t.href;
    } else if (canView(n.module)) {
      return n.href;
    }
  }
  return null;
}
