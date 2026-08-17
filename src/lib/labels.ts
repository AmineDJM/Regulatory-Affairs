import type { Action, Module } from "./rbac";

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
  DIRECTION: "Direction des opérations",
  HEAD_OF_REGULATORY: "Responsable Réglementaire",
  REGULATORY_ASSISTANT: "Assistante Réglementaire",
  HEAD_OF_SALES: "Responsable Ventes",
  SALES_USER: "Commercial",
  LOGISTICS_MANAGER: "Responsable Logistique",
  MEDICAL_PROMOTION_MANAGER: "Manager Promotion Médicale",
  MEDICAL_DELEGATE: "Délégué Médical",
  NATIONAL_SALES: "National Sales",
  PRODUCT_MANAGER: "Chef de produit",
  BUSINESS_DEVELOPMENT_MANAGER: "Manager Business Development",
  FINANCE_BUDGET_MANAGER: "Responsable Finance / Budget",
  MEDICAL_INFO_PHARMACIST: "Pharmacien resp. information médicale",
  DIRECTION_ASSISTANT: "Assistante de Direction",
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

/** Formes galéniques (menu déroulant des dossiers Regulatory). */
export const PHARMA_FORM: Record<string, string> = {
  COMPRIME: "Comprimé",
  COMPRIME_PELLICULE: "Comprimé pelliculé",
  GELULE: "Gélule",
  CAPSULE_MOLLE: "Capsule molle",
  SIROP: "Sirop",
  SUSPENSION_BUVABLE: "Suspension buvable",
  SOLUTION_BUVABLE: "Solution buvable",
  SOLUTION_INJECTABLE: "Solution injectable",
  POUDRE_INJECTABLE: "Poudre pour solution injectable",
  PERFUSION: "Solution pour perfusion",
  POMMADE: "Pommade",
  CREME: "Crème",
  GEL: "Gel",
  SUPPOSITOIRE: "Suppositoire",
  OVULE: "Ovule",
  COLLYRE: "Collyre",
  SPRAY_NASAL: "Spray nasal",
  AEROSOL: "Aérosol / Inhalateur",
  PATCH: "Patch transdermique",
  POUDRE_ORALE: "Poudre orale",
  GOUTTES: "Gouttes",
  AUTRE: "Autre",
};

/** Unités de dosage. */
export const DOSAGE_UNIT: Record<string, string> = {
  MG: "mg",
  G: "g",
  MCG: "µg",
  UI: "UI",
  PERCENT: "%",
  MG_ML: "mg/ml",
  MG_G: "mg/g",
  ML: "ml",
  MEQ: "mEq",
  MMOL: "mmol",
};

/** Catalogue Achats : catégories d'articles de fourniture de bureau. */
export const SUPPLY_CATEGORY: Record<string, string> = {
  PAPETERIE: "Papeterie",
  INFORMATIQUE: "Informatique & bureautique",
  MOBILIER: "Mobilier",
  CONSOMMABLE: "Consommables (encre, papier…)",
  CUISINE: "Cuisine & café",
  ENTRETIEN: "Entretien & hygiène",
  ELECTRIQUE: "Électrique & accessoires",
  AUTRE: "Autre",
};

/** Catalogue Achats : unités de conditionnement. */
export const SUPPLY_UNIT: Record<string, string> = {
  PIECE: "Pièce",
  BOITE: "Boîte",
  PAQUET: "Paquet",
  RAME: "Rame",
  CARTON: "Carton",
  LOT: "Lot",
  ROULEAU: "Rouleau",
  LITRE: "Litre",
  KG: "Kg",
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
  AWAITING_PRELIMINARY: { label: "Attente National Sales", tone: "warning" },
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
  CONGRESS_INTERNATIONAL: "Prises en charge Internationales",
  CONGRESS_NATIONAL: "Prises en charge Nationales",
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
  AWAITING_PRELIMINARY: { label: "Attente National Sales", tone: "warning" },
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

/** Échelle de segmentation à 5 niveaux (influence / potentiel / affinité). */
export const SEGMENT_LEVEL: Record<string, Display> = {
  VERY_HIGH: { label: "Très haut", tone: "purple" },
  HIGH: { label: "Haut", tone: "success" },
  MEDIUM: { label: "Moyen", tone: "info" },
  LOW: { label: "Bas", tone: "warning" },
  VERY_LOW: { label: "Très bas", tone: "neutral" },
};

export const MEDICAL_SECTOR: Record<string, Display> = {
  HOSPITAL: { label: "Hôpital / Public", tone: "info" },
  LIBERAL: { label: "Libéral / Privé", tone: "purple" },
  BOTH: { label: "Public + Privé", tone: "neutral" },
};

export const INSTITUTION_TYPE: Record<string, string> = {
  CHU: "CHU",
  EPH: "Établissement public hospitalier",
  EHS: "Établissement hospitalier spécialisé",
  CLINIQUE_PRIVEE: "Clinique privée",
  POLYCLINIQUE: "Polyclinique",
  CABINET: "Cabinet médical",
  CENTRE_SANTE: "Centre de santé",
  PHARMACIE: "Pharmacie",
  GROSSISTE: "Grossiste répartiteur",
  AUTRE: "Autre",
};

export const INSTITUTION_SECTOR: Record<string, Display> = {
  PUBLIC: { label: "Public", tone: "info" },
  PRIVE: { label: "Privé", tone: "purple" },
};

// Canal de distribution d'un produit : Ville (officine) / Hôpital / les deux.
export const PRODUCT_CHANNEL: Record<string, Display> = {
  RETAIL: { label: "Ville", tone: "purple" },
  HOSPITAL: { label: "Hôpital", tone: "info" },
  BOTH: { label: "Ville + Hôpital", tone: "neutral" },
};

// Demandes de l'information médicale (PRIM) → Regulatory.
export const REG_REQUEST_STATUS: Record<string, Display> = {
  OPEN: { label: "Ouverte", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "warning" },
  ANSWERED: { label: "Répondue", tone: "success" },
  CLOSED: { label: "Clôturée", tone: "neutral" },
};

export const REG_REQUEST_CATEGORY: Record<string, string> = {
  QUESTION: "Question réglementaire",
  DOCUMENT: "Demande de document",
  STATUS_UPDATE: "Point statut d'enregistrement",
  VARIATION: "Variation / modification",
  OTHER: "Autre",
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
  ID_DOCUMENT: "Pièce d'identité",
  MISSION_ORDER: "Ordre de mission",
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

/** Variation d'enregistrement (Regulatory) : passage en fabrication locale. */
export const MANUFACTURING_VARIATION: Record<string, string> = {
  NONE: "Aucune variation",
  SECONDARY_PACKAGING: "Packaging secondaire (fabrication locale)",
  PRIMARY_PACKAGING: "Packaging primaire (fabrication locale)",
  FULL_PROCESS: "Full process (fabrication locale)",
};
/** Variations impliquant une fabrication locale → le fabricant devient obligatoire. */
export const LOCAL_MANUFACTURING_VARIATIONS = ["SECONDARY_PACKAGING", "PRIMARY_PACKAGING", "FULL_PROCESS"];

/**
 * Statut de fabrication d'un produit Regulatory (remplace l'ancien « type de produit »).
 * On démarre en Importation ; une **variation** peut faire évoluer vers un packaging local.
 */
export const MANUFACTURING_STATUS: Record<string, string> = {
  IMPORTATION: "Importation",
  SECONDARY_PACKAGING: "Secondary Packaging",
  PRIMARY_PACKAGING: "Primary Packaging",
  FULL_PROCESS: "Full Process",
};
/** Cibles possibles d'une variation (tout sauf le point de départ « Importation »). */
export const VARIATION_TARGETS = ["SECONDARY_PACKAGING", "PRIMARY_PACKAGING", "FULL_PROCESS"];

/** Cycle de vie d'une variation de fabrication (dépôt → décision). */
export const VARIATION_STATUS: Record<string, Display> = {
  EN_ATTENTE: { label: "En attente", tone: "warning" },
  OBTENUE: { label: "DE de variation obtenue", tone: "success" },
  ANNULE: { label: "Annulé", tone: "neutral" },
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
  EXCEPTIONAL_EXIT: "Sortie exceptionnelle",
  SICK_LEAVE: "Arrêt maladie",
  ANNUAL_LEAVE: "Demande de congé annuel",
  UNPAID_LEAVE: "Congé sans solde",
  SPECIAL_LEAVE: "Congé exceptionnel (mariage, naissance, décès…)",
  MATERNITY_LEAVE: "Congé de maternité",
  HR_INTERVIEW: "Entrevue avec les RH",
  OTHER: "Autre demande",
};

export const HR_REQUEST_STATUS: Record<string, Display> = {
  PENDING: { label: "Soumise", tone: "warning" },
  IN_PROGRESS: { label: "En préparation", tone: "info" },
  READY: { label: "Prête", tone: "success" },
  DELIVERED: { label: "Remise", tone: "neutral" },
  APPROVED: { label: "Accordée", tone: "success" },
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
  CONGRESS_INTERNATIONAL: "Prise en charge Internationale",
  CONGRESS_NATIONAL: "Prise en charge Nationale",
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
  DOSSIER: "Projet",
  PROMO_MATERIAL: "Matériel promotionnel",
  HR_REQUEST: "Demande RH",
  EVENT: "Événement",
  MISSION_ASSIGNMENT: "Ordre de mission",
  PCH_TENDER: "Appel d'offres",
  CONSULTING_CONTRACT: "Contrat de consulting",
  AD_PRO_OTHER: "Demande Ad & Pro — autre",
  AD_PRO_ITEM: "Poste de dépense",
  DOCUMENT_REQUEST: "Demande de pièce",
  PAYMENT_REQUEST: "Demande de paiement",
};

/**
 * DEMANDE DE PAIEMENT — les états d'un dossier qui fait des allers-retours.
 *
 * « En attente » n'est pas « refusée » : la première reviendra, la seconde non. Les confondre,
 * c'est relancer les Finances pour rien, ou laisser mourir un dossier qui attendait une simple
 * trésorerie.
 */
export const PAYMENT_REQUEST_STATUS: Record<string, Display> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  SUBMITTED: { label: "Chez les Finances", tone: "info" },
  UNDER_REVIEW: { label: "En cours d'instruction", tone: "info" },
  ON_HOLD: { label: "Mise en attente", tone: "warning" },
  CHANGES_REQUESTED: { label: "À revoir — chez le demandeur", tone: "warning" },
  APPROVED: { label: "Bon à payer", tone: "success" },
  REJECTED: { label: "Refusée", tone: "danger" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

/** Le verdict des Finances sur UNE pièce — refuser un dossier entier pour une facture floue obligerait à tout redéposer. */
export const PAYMENT_PIECE_STATUS: Record<string, Display> = {
  PENDING: { label: "À examiner", tone: "neutral" },
  ACCEPTED: { label: "Acceptée", tone: "success" },
  CHANGES_REQUESTED: { label: "À revoir", tone: "warning" },
  REJECTED: { label: "Refusée", tone: "danger" },
};

/** Les Finances ne cherchent pas « la pièce n° 3 » : elles cherchent LA FACTURE. */
export const PAYMENT_PIECE_KIND: Record<string, string> = {
  INVOICE: "Facture",
  PURCHASE_ORDER: "Bon de commande",
  QUOTE: "Devis",
  DELIVERY_NOTE: "Bon de livraison",
  CONTRACT: "Contrat",
  PROOF: "Justificatif",
  OTHER: "Autre pièce",
};

export const PAYMENT_PIECE_KIND_OPTIONS: { value: string; label: string }[] =
  Object.entries(PAYMENT_PIECE_KIND).map(([value, label]) => ({ value, label }));

/** À défaut de date convenue, l'urgence — sans quoi la demande finit au bas de la pile. */
export const PAYMENT_URGENCY: Record<string, string> = {
  URGENT: "Urgent",
  THIS_WEEK: "Cette semaine",
  THIS_MONTH: "Ce mois-ci",
  WHEN_POSSIBLE: "Dès que possible",
};

export const PAYMENT_URGENCY_OPTIONS: { value: string; label: string }[] =
  Object.entries(PAYMENT_URGENCY).map(([value, label]) => ({ value, label }));

/**
 * DEMANDE DE PIÈCE — les cinq états d'un fil court.
 *
 * « Refusé » n'est pas une fin : la demande repart, avec son motif. C'est le cas le plus
 * fréquent — ce n'était pas la bonne pièce — et il ne doit pas obliger à tout recommencer.
 */
/**
 * SEGMENTS THÉRAPEUTIQUES — le marché qu'un produit vise.
 *
 * Une liste fermée et non un champ libre : « Oncologie », « oncologie » et « Onco » ne se
 * comptent pas ensemble, et c'est précisément le comptage qu'on vient chercher. Un produit peut
 * en servir PLUSIEURS — un anti-émétique sert l'oncologie et la gastro-entérologie.
 */
export const THERAPEUTIC_SEGMENTS: string[] = [
  "Oncologie",
  "Hématologie",
  "Cardiologie",
  "Diabétologie / Endocrinologie",
  "Gynécologie / Obstétrique",
  "Urologie / Néphrologie",
  "Neurologie",
  "Psychiatrie",
  "Pneumologie",
  "Gastro-entérologie",
  "Rhumatologie",
  "Dermatologie",
  "Ophtalmologie",
  "ORL",
  "Infectiologie",
  "Immunologie",
  "Anesthésie / Réanimation",
  "Pédiatrie",
  "Antalgie",
  "Nutrition",
];

/**
 * LES 58 WILAYAS D'ALGÉRIE — liste fermée, dans l'ordre du code administratif (1 → 58).
 *
 * Une liste fermée, et non un champ libre : « Alger », « ALGER », « alger » ou « Wilaya d'Alger »
 * doivent se compter et se filtrer ENSEMBLE — c'est tout l'intérêt d'une wilaya sur une fiche.
 * Le découpage compte 58 wilayas depuis la réforme de 2019 (les dix dernières, 49 → 58, ont été
 * érigées à partir d'anciennes circonscriptions du Sud). On stocke le seul nom : le code n'ajoute
 * rien à l'écran et compliquerait la reconnaissance à l'import.
 */
export const ALGERIA_WILAYAS: string[] = [
  "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", "Blida",
  "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", "Djelfa", "Jijel",
  "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa",
  "Mostaganem", "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", "Illizi", "Bordj Bou Arréridj",
  "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued", "Khenchela", "Souk Ahras", "Tipaza",
  "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa", "Relizane", "Timimoun",
  "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", "In Salah", "In Guezzam", "Touggourt",
  "Djanet", "El M'Ghair", "El Meniaa",
];

export const PIECE_REQUEST_STATUS: Record<string, Display> = {
  PENDING: { label: "En attente de dépôt", tone: "warning" },
  SUBMITTED: { label: "Déposé — à confirmer", tone: "info" },
  ACCEPTED: { label: "Pièce reçue", tone: "success" },
  DECLINED: { label: "Refusé — à redéposer", tone: "danger" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

/** Accompagnant ou délégué de référence assigné à une mission. */
export const MISSION_ROLE: Record<string, Display> = {
  ACCOMPAGNANT: { label: "Accompagnant", tone: "info" },
  DELEGATE_REFERENCE: { label: "Délégué de référence", tone: "purple" },
};

/** Statut de l'ordre de mission d'une assignation. */
export const MISSION_ORDER_STATUS: Record<string, Display> = {
  NONE: { label: "Sans ordre de mission", tone: "neutral" },
  REQUESTED: { label: "Ordre demandé", tone: "warning" },
  ISSUED: { label: "Ordre de mission émis", tone: "success" },
};

/** Types d'événements du calendrier (avec couleur de pastille par défaut). */
export const CALENDAR_EVENT_KIND: Record<string, Display & { color: string }> = {
  APPOINTMENT: { label: "Rendez-vous", tone: "info", color: "#2563eb" },
  MEETING: { label: "Réunion", tone: "purple", color: "#7c3aed" },
  REMINDER: { label: "Rappel", tone: "warning", color: "#d97706" },
  DEADLINE: { label: "Échéance", tone: "danger", color: "#dc2626" },
  INFO: { label: "Information", tone: "success", color: "#0891b2" },
  OTHER: { label: "Autre", tone: "neutral", color: "#64748b" },
};

/** Réponse à une invitation. */
export const CALENDAR_INVITE_STATUS: Record<string, Display> = {
  INVITED: { label: "Invité", tone: "neutral" },
  ACCEPTED: { label: "Accepté", tone: "success" },
  DECLINED: { label: "Refusé", tone: "danger" },
  TENTATIVE: { label: "Peut-être", tone: "warning" },
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

/**
 * CONTRAT DE CONSULTING — les cinq états d'une relation avec un prestataire.
 *
 * « Expiré » n'est pas « annulé » : le premier a produit ses effets jusqu'au bout, le second a
 * été rompu. Les confondre, c'est perdre l'historique de la relation — et se tromper le jour où
 * l'on se demande avec qui l'on a déjà travaillé.
 */
export const CONSULTING_STATUS: Record<string, Display> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  AWAITING_VALIDATION: { label: "En cours de validation", tone: "warning" },
  ACTIVE: { label: "Actif", tone: "success" },
  EXPIRED: { label: "Expiré", tone: "neutral" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};

/** Rythme de la rémunération : 200 000 DZD par mois et 200 000 DZD pour la mission entière ne sont pas la même dépense. */
export const CONSULTING_BILLING: Record<string, string> = {
  ONE_OFF: "Forfait unique",
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel",
  YEARLY: "Annuel",
  ON_DELIVERY: "À la livraison",
};

export const CONSULTING_BILLING_OPTIONS: { value: string; label: string }[] =
  Object.entries(CONSULTING_BILLING).map(([value, label]) => ({ value, label }));

/** DEMANDE « AUTRE » — circuit court : il n'y a pas de parcours propre, il y a un décideur. */
export const AD_PRO_OTHER_STATUS: Record<string, Display> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  AWAITING_DECISION: { label: "En attente de décision", tone: "warning" },
  APPROVED: { label: "Validée", tone: "info" },
  REFUSED: { label: "Refusée", tone: "danger" },
  DONE: { label: "Terminée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "danger" },
};

/** Ordre du circuit (hors annulation) — pour la frise de suivi. */
export const PROMO_MATERIAL_FLOW: string[] = [
  "PROSPECTION_REQUESTED", "QUOTES_UPLOADED", "AGENCY_CHOSEN", "BC_FINANCE_REVIEW", "BC_VALIDATED",
  "BC_SENT", "PAYMENT_INITIATED", "PAYMENT_DONE", "MATERIAL_PRODUCED", "CONFORMITY_REVIEW",
  "VISA_OBTAINED", "BAT_PRINTING", "FINAL_MATERIAL", "INVOICED", "SETTLED",
];

/** Nature du matériel promotionnel (enum MaterialType) — libellés + ordre du menu. */
export const MATERIAL_TYPE: Record<string, string> = {
  PRESENTOIRE: "Présentoir",
  STAND_BOOTH: "Stand / Booth",
  CARNET_BILAN: "Carnet bilan",
  SOUS_MAINS: "Sous-mains",
  BLOC_NOTE: "Bloc-notes",
  SAC_A_DOS: "Sac à dos",
  PORTE_CARTE_RDV: "Porte-carte RDV",
  BANNER: "Banner",
  FICHE_POSO: "Fiche POSO",
  ADV: "ADV",
  FICHE_CONSEILS: "Fiche conseils",
  FICHE_GAMME: "Fiche Gamme",
  POSTER: "Poster",
  VIDEO: "Vidéo",
  CADEAUX_FIN_ANNEE: "Cadeaux fin d'année",
  CARTES_INVITATIONS: "Cartes d'invitations",
  STYLOS: "Stylos",
  CLE_USB: "Clé USB",
  AUTRES: "Autres",
};

/** Options `{ value, label }` du menu « type de matériel » (dans l'ordre métier). */
export const MATERIAL_TYPE_OPTIONS: { value: string; label: string }[] = Object.entries(MATERIAL_TYPE).map(
  ([value, label]) => ({ value, label }),
);

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
  /**
   * Nouveauté livrée derrière un drapeau de version (`src/lib/features.ts`) : l'onglet
   * n'apparaît qu'aux comptes qui la voient (stade TEST → testeurs, stade PROD → tout le
   * monde). Absent = onglet visible dès que le module est autorisé.
   */
  feature?: string;
}

/** Navigation metadata: maps a sidebar entry to a module + route + icon name. */
export interface NavItem {
  module: Module;
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  group: "Pilotage" | "Pôles" | "Transverse" | "Système";
  /**
   * Pôle d'entreprise auquel l'entrée appartient (groupe « Pôles » uniquement). C'est ce qui
   * remplace les treize entrées à plat : l'utilisateur voit son entreprise, pas les modules.
   */
  pole?: "REGULATORY" | "ADMINISTRATION" | "SALES_MARKETING" | "BUSINESS_DEV" | "SUPPLY_CHAIN";
  /**
   * Garde SUPPLÉMENTAIRE au droit de module, résolue côté serveur dans le layout. Sert aux
   * écrans dont l'ouverture dépend d'un réglage et pas seulement d'un rôle (l'analyse CTD est
   * débloquée en Administration, rôle par rôle).
   */
  gate?: "regEnrollment";
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
// Espace personnel : travail + espace perso + tableau de bord + directives. (« Dossiers »,
// « Calendrier » et « Mon dossier RH » en sont ressortis → entrées/modules autonomes ;
// « Dashboard » y est entré.)
export const WORKSPACE_TABS: NavTab[] = [
  // « Aujourd'hui » : l'accueil qui répond à une seule question — que dois-je faire maintenant ?
  { module: "WORKSPACE", label: "Aujourd'hui", href: "/aujourdhui", feature: "home_today" },
  { module: "WORKSPACE", label: "Mon travail", href: "/mon-travail" },
  { module: "WORKSPACE", label: "Mon espace", href: "/mon-espace" },
  { module: "WORKSPACE", label: "Pièces demandées", href: "/pieces" },
  { module: "DASHBOARD", label: "Dashboard", href: "/dashboard" },
  { module: "DIRECTIVES", label: "Directives", href: "/directives" },
];
// BUDGETS — trois écrans au lieu d'un seul écran fourre-tout : on REGARDE (vue d'ensemble
// graphique), on TRAVAILLE (dépenses à imputer), on RÈGLE (enveloppe, catégories, total).
// PROMOTION MÉDICALE — l'ANNUAIRE est un sous-module à part entière : c'est un référentiel qui
// se consulte, s'exporte et s'importe pour lui-même, pas une section d'un écran de visites.
export const MEDICAL_TABS: NavTab[] = [
  { module: "MEDICAL", label: "Visites & segmentation", href: "/medical" },
  { module: "MEDICAL", label: "Annuaire", href: "/medical/annuaire" },
];

export const BUDGET_TABS: NavTab[] = [
  { module: "BUDGETS", label: "Vue d'ensemble", href: "/budgets" },
  { module: "BUDGETS", label: "Dépenses", href: "/budgets/depenses" },
  { module: "BUDGETS", label: "Départements", href: "/budgets/departements" },
  { module: "BUDGETS", label: "Réglages", href: "/budgets/reglages" },
];
// RH — quatre écrans au lieu d'une page à sept sections : ce qu'il faut TRAITER, l'ANNUAIRE
// de l'équipe, les CONGÉS (qui est absent, historique), et la structure (départements).
export const HR_TABS: NavTab[] = [
  { module: "RH", label: "À traiter", href: "/rh" },
  // La formation est une affaire RH, mais sa DEMANDE est ouverte à tous — l'onglet reste ici,
  // et la page laisse entrer quiconque a un espace de travail.
  { module: "RH", label: "Formations", href: "/formations" },
  { module: "RH", label: "Équipe", href: "/rh/equipe" },
  { module: "RH", label: "Congés", href: "/rh/conges" },
  { module: "RH", label: "Départements", href: "/rh/departements" },
];
// Mon dossier RH + Mes ordres de mission, sous une seule entrée de menu « Mon dossier RH ».
export const MON_DOSSIER_TABS: NavTab[] = [
  { module: "WORKSPACE", label: "Mon dossier RH", href: "/mon-dossier" },
  { module: "WORKSPACE", label: "Mes ordres de mission", href: "/missions" },
];
// « Ad & Pro » : sponsoring + congrès (international/national) + événements +
// matériel promotionnel, sous un seul module. Le matériel promotionnel a été
// déplacé ici depuis « Promotion médicale » (sa fonctionnalité est inchangée).
/**
 * VENTES · LOGISTIQUE · PCH — une seule entrée à onglets. Les trois modules parlent du même
 * mouvement (ce qu'on vend, ce qu'on livre, ce qu'on remporte en marché public) et se
 * consultaient l'un après l'autre ; chacun garde sa route et sa garde de module.
 */
export const COMMERCE_TABS: NavTab[] = [
  { module: "SALES", label: "Ventes", href: "/sales" },
  { module: "LOGISTICS", label: "Logistique", href: "/logistics" },
  { module: "PCH", label: "PCH — Marchés", href: "/pch" },
];

export const EVENTS_TABS: NavTab[] = [
  // UNE SEULE DEMANDE : la vue unifiée ouvre le pôle. Les écrans par nature restent derrière —
  // ils portent les champs propres (billets, visas, devis d'agence) et leurs circuits.
  { module: "SPONSORING", label: "Toutes les demandes", href: "/ad-pro" },
  { module: "SPONSORING", label: "Sponsoring", href: "/sponsoring" },
  { module: "CONGRESS_INTERNATIONAL", label: "Prises en charge Internationales", href: "/congress-international" },
  { module: "CONGRESS_NATIONAL", label: "Prises en charge Nationales", href: "/congress-national" },
  { module: "EVENTS", label: "Événements", href: "/events" },
  { module: "PROMO_MATERIAL", label: "Matériel promotionnel", href: "/promo-material" },
  // Le STOCK est un écran à part : on n'y vient pas pour suivre une campagne mais pour savoir
  // ce qu'il reste, et le tenir à jour. Deux questions différentes, deux écrans.
  { module: "PROMO_MATERIAL", label: "Stock promotionnel", href: "/promo-material/stock" },
  { module: "CONSULTING", label: "Consulting", href: "/consulting" },
  { module: "AD_PRO_OTHER", label: "Autres demandes", href: "/ad-pro/autres" },
];
// Module « Drive » (Drive personnel). L'onglet « Documents » a été retiré (tout est consolidé
// dans le Drive + les catégories partagées ; on y glisse des dossiers à la souris).
export const DOCS_TABS: NavTab[] = [
  { module: "DRIVE", label: "Drive", href: "/drive" },
];
// Promotion médicale (annuaire, segmentation) et Rapports terrain sont désormais DEUX modules
// distincts (accès configurables séparément dans Administration). Les onglets partagés sont retirés.
// Adventum Brain + Process Intelligence, dans un seul cockpit Super Admin.
export const BRAIN_TABS: NavTab[] = [
  { module: "ADVENTUM_BRAIN", label: "Adventum Brain", href: "/adventum-brain" },
  { module: "PROCESS_INTELLIGENCE", label: "Process Intelligence", href: "/process-intelligence" },
];
// Administration : console + Contrôle de l'IA + Score d'adoption.
export const ADMIN_TABS: NavTab[] = [
  { module: "ADMIN", label: "Administration", href: "/admin" },
  { module: "ADMIN", label: "Bases de données", href: "/admin/bases" },
  { module: "ADMIN", label: "Contrôle de l'IA", href: "/admin/ai" },
  { module: "ADMIN", label: "Coût IA & audit Regulatory", href: "/admin/regulatory-ia" },
  { module: "ADMIN", label: "Score d'adoption", href: "/admin/adoption" },
  { module: "ADMIN", label: "Diagnostic", href: "/admin/diagnostic" },
  { module: "ADMIN", label: "Test Center", href: "/admin/test-center" },
];

/**
 * Libellé lisible et **stable** par module, indépendant du menu (qui fusionne
 * désormais plusieurs modules sous une seule entrée). Utilisé par l'administration
 * (matrice d'accès) pour nommer chaque module, même ceux qui n'ont plus d'entrée
 * de menu dédiée. Typé `Record<Module, string>` → exhaustivité garantie.
 */
export const MODULE_LABELS: Record<Module, string> = {
  GENERAL_MEANS: "Moyens généraux",
  DASHBOARD: "Dashboard",
  WORKSPACE: "Espace de travail",
  MESSAGING: "Messagerie",
  REGULATORY: "Regulatory",
  SPONSORING: "Sponsoring",
  BUDGETS: "Budgets",
  FINANCES: "Finances",
  RH: "Ressources humaines",
  CONGRESS_INTERNATIONAL: "Prises en charge Internationales",
  CONGRESS_NATIONAL: "Prises en charge Nationales",
  EVENTS: "Événements",
  SALES: "Ventes",
  LOGISTICS: "Logistique",
  MEDICAL: "Promotion médicale",
  FIELD_REPORTS: "Rapports terrain",
  SALES_PLANNING: "Prévisions & Force de vente",
  BUSINESS_DEVELOPMENT: "Business Development",
  PCH: "PCH — Marchés",
  STOCKS: "Stocks PCH",
  MEDICAL_INFO: "Information médicale",
  PROMO_MATERIAL: "Matériel promotionnel",
  CONSULTING: "Consulting",
  AD_PRO_OTHER: "Ad & Pro — autres demandes",
  VALIDATIONS: "Demandes de validations",
  DIRECTIVES: "Directives",
  SUPPORT: "Demandes de support",
  DOSSIERS: "Projets",
  DOCUMENTS: "Documents",
  DRIVE: "Drive",
  ADMIN_REQUESTS: "Bureau du secrétariat",
  NOTIFICATIONS: "Notifications",
  PROCESS_INTELLIGENCE: "Process Intelligence",
  ADVENTUM_BRAIN: "Adventum Brain",
  ADMIN: "Administration",
};

/**
 * Les ACTIONS, en français. Un seul endroit : l'écran des accès, la fiche d'un employé et le
 * journal d'audit doivent nommer « Valider » de la même façon, sinon deux écrans décrivent le
 * même droit avec deux mots et personne ne sait s'il s'agit du même.
 */
export const ACTION_LABELS: Record<Action, string> = {
  VIEW: "Voir",
  CREATE: "Créer",
  UPDATE: "Modifier",
  DELETE: "Supprimer",
  VALIDATE: "Valider",
  EXPORT: "Exporter",
  UPLOAD: "Téléverser",
};

// Navigation simplifiée : modules fusionnés en onglets (`tabs`) pour réduire le
// nombre d'entrées. Messagerie & Notifications ne sont PLUS dans le menu — elles
// restent accessibles via leurs icônes dans la barre du haut (les routes /messages
// et /notifications et leurs modules RBAC sont inchangés).
export const NAVIGATION: NavItem[] = [
  // Pilotage — « Mon espace » regroupe désormais Mon travail, Mon espace, Dashboard, Calendrier
  // et Directives (onglets). `match` couvre ces routes pour l'état actif de la barre latérale.
  { module: "WORKSPACE", label: "Mon espace", href: "/mon-travail", icon: "LayoutGrid", group: "Pilotage", tabs: WORKSPACE_TABS, match: ["/mon-espace", "/dashboard", "/directives", "/pieces"] },
  { module: "WORKSPACE", label: "Calendrier", href: "/calendar", icon: "CalendarDays", group: "Pilotage" },
  { module: "WORKSPACE", label: "Mon dossier RH", href: "/mon-dossier", icon: "BadgeCheck", group: "Pilotage", tabs: MON_DOSSIER_TABS, match: ["/missions"] },
  // Assistant IA : MODULE À PART ENTIÈRE (l'ancienne bulle flottante a été retirée) —
  // page plein écran avec dictée vocale et lecture de pièces jointes.
  { module: "WORKSPACE", label: "Assistant IA", href: "/assistant", icon: "Sparkles", group: "Pilotage" },
  { module: "DOSSIERS", label: "Projets", href: "/dossiers", icon: "FolderKanban", group: "Pilotage" },
  // Messagerie Microsoft 365 — sous le module MESSAGING (droit déjà existant) ; l'ouverture réelle
  // dépend en plus du drapeau MICROSOFT_MAIL et de la liste pilote, vérifiés dans l'écran.
  // Elle est dans PILOTAGE et non dans Transverse : on relève ses mails en même temps qu'on
  // regarde son espace et son calendrier, pas en même temps qu'on range un fichier.
  { module: "MESSAGING", label: "Messagerie e-mail", href: "/messagerie", icon: "Mail", group: "Pilotage" },
  // « Courrier » (boîte mail intégrée) retiré de la plateforme — la messagerie e-mail se gère
  // désormais directement dans l'app Infomaniak. Le code back-end reste dormant (non exposé).
  // ─────────────────────────── PÔLES D'ENTREPRISE ───────────────────────────
  // Les routes ne changent PAS : seul le rangement change. Un lien de notification écrit il y a
  // six mois reste donc valide, sans redirection.

  // REGULATORY — deux portes, et deux seulement. Une assistante qui suit un dossier n'a pas à
  // traverser toute l'interface d'analyse CTD pour y arriver.
  { module: "REGULATORY", label: "Suivi des dossiers", href: "/regulatory", icon: "FileCheck2", group: "Pôles", pole: "REGULATORY" },
  { module: "REGULATORY", label: "Analyse CTD", href: "/regulatory/enregistrement", icon: "ScanSearch", group: "Pôles", pole: "REGULATORY", gate: "regEnrollment" },

  // ADMINISTRATION — l'administration de L'ENTREPRISE (à ne pas confondre avec la Console
  // d'Administration, qui est celle du logiciel et vit dans « Système »).
  { module: "GENERAL_MEANS", label: "Moyens généraux", href: "/moyens-generaux", icon: "ShoppingBasket", group: "Pôles", pole: "ADMINISTRATION" },
  { module: "FINANCES", label: "Finances", href: "/finances", icon: "Landmark", group: "Pôles", pole: "ADMINISTRATION" },
  { module: "RH", label: "Ressources humaines", href: "/rh", icon: "UsersRound", group: "Pôles", pole: "ADMINISTRATION", tabs: HR_TABS, match: ["/rh/equipe", "/rh/conges", "/rh/departements", "/rh/paie", "/formations"] },
  { module: "BUDGETS", label: "Budgets", href: "/budgets", icon: "Wallet", group: "Pôles", pole: "ADMINISTRATION", tabs: BUDGET_TABS, match: ["/budgets/depenses", "/budgets/departements", "/budgets/reglages"] },

  // SALES & MARKETING — tout ce qui touche au terrain et au business réalisé. L'annuaire des
  // praticiens vit DANS Promotion médicale : on ne consulte pas un annuaire pour lui-même, on
  // le consulte en préparant une visite.
  { module: "SALES", label: "Ventes", href: "/sales", icon: "TrendingUp", group: "Pôles", pole: "SALES_MARKETING" },
  { module: "MEDICAL", label: "Promotion médicale", href: "/medical", icon: "Stethoscope", group: "Pôles", pole: "SALES_MARKETING", tabs: MEDICAL_TABS, match: ["/medical/annuaire"] },
  { module: "SALES_PLANNING", label: "Force de vente", href: "/planning", icon: "Target", group: "Pôles", pole: "SALES_MARKETING" },
  { module: "FIELD_REPORTS", label: "Rapports terrain", href: "/field-reports", icon: "NotebookPen", group: "Pôles", pole: "SALES_MARKETING" },
  { module: "SPONSORING", label: "Ad & Pro", href: "/ad-pro", icon: "PartyPopper", group: "Pôles", pole: "SALES_MARKETING", tabs: EVENTS_TABS, match: ["/sponsoring", "/promo-material", "/promo-material/stock", "/consulting"] },
  { module: "MEDICAL_INFO", label: "Information médicale", href: "/information-medicale", icon: "ShieldPlus", group: "Pôles", pole: "SALES_MARKETING" },

  // BUSINESS DEVELOPMENT — l'AVANT-VENTE : ce qu'on étudie et ce qu'on vise. Les ventes
  // réalisées sont passées dans Sales & Marketing : analyser une opportunité et constater un
  // chiffre d'affaires ne sont pas le même métier.
  { module: "BUSINESS_DEVELOPMENT", label: "Market Intelligence", href: "/business-development", icon: "Lightbulb", group: "Pôles", pole: "BUSINESS_DEV", match: ["/business-development/marche", "/business-development/pipeline"] },
  { module: "PCH", label: "Marchés PCH", href: "/pch", icon: "Gavel", group: "Pôles", pole: "BUSINESS_DEV" },

  // SUPPLY CHAIN & LOGISTICS — l'exécution physique. Les modèles existaient déjà
  // (LogisticsOrder porte la commande de bout en bout) ; ils n'étaient simplement pas présentés
  // comme un pôle.
  { module: "LOGISTICS", label: "Commandes & logistique", href: "/logistics", icon: "Truck", group: "Pôles", pole: "SUPPLY_CHAIN" },
  { module: "STOCKS", label: "Stocks", href: "/stocks", icon: "Boxes", group: "Pôles", pole: "SUPPLY_CHAIN" },

  // Transverse — « Demandes de validations » est le bureau de validation : chacun
  // y demande une validation professionnelle (selon l'accès accordé par le Super
  // Admin), et les validateurs y traitent ce qui leur revient. Les validations en
  // attente restent aussi visibles dans « Mon espace » (Action Center).
  { module: "VALIDATIONS", label: "Demandes de validations", href: "/validations", icon: "ShieldCheck", group: "Transverse" },
  { module: "MESSAGING", label: "Réunions & appels", href: "/meetings", icon: "Video", group: "Transverse" },
  { module: "DRIVE", label: "Drive", href: "/drive", icon: "FolderOpen", group: "Transverse", tabs: DOCS_TABS },
  // Bureautique : même module que le Drive (les documents Y vivent), écran séparé parce que le
  // geste est différent — on vient écrire, pas ranger.
  { module: "DRIVE", label: "Bureautique", href: "/office", icon: "FileText", group: "Transverse" },
  { module: "ADMIN_REQUESTS", label: "Bureau du secrétariat", href: "/demandes", icon: "ClipboardList", group: "Transverse" },
  { module: "WORKSPACE", label: "Feedback", href: "/feedback", icon: "MessageSquarePlus", group: "Transverse" },
  // Système
  { module: "ADVENTUM_BRAIN", label: "Adventum Brain", href: "/adventum-brain", icon: "BrainCircuit", group: "Système", tabs: BRAIN_TABS },
  // « Console d'Administration » et non « Administration » : l'administration de
  // L'ENTREPRISE est un pôle métier (Moyens généraux / Finances / RH / Budgets). Les
  // confondre, c'est envoyer un directeur financier dans les réglages techniques.
  { module: "ADMIN", label: "Console d'Administration", href: "/admin", icon: "Settings", group: "Système", tabs: ADMIN_TABS },
];

/**
 * Première destination de navigation que `canView` autorise — pour un atterrissage
 * **sûr** après un refus (jamais une page qui refuserait à nouveau → anti-boucle
 * `ERR_TOO_MANY_REDIRECTS`). On ignore les **sous-pages d'admin** (`/admin/…`),
 * gardées par un contrôle plus strict que VIEW ; « /admin » (VIEW) reste valide.
 * Renvoie `null` si l'utilisateur ne peut voir aucune destination.
 */
/**
 * Module « propriétaire » d'un chemin — pour router une notification (via son lien) vers l'entrée
 * de menu concernée et y poser un badge. Renvoie le module de l'entrée (ou d'un onglet) dont le
 * href/match est le plus long préfixe du chemin ; `null` si aucune ne correspond.
 */
/**
 * LIBELLÉS HISTORIQUES → module.
 *
 * `ValidationRequest.module` stocke le LIBELLÉ tel qu'il était au moment de la demande. Renommer
 * une entrée de menu casserait donc l'accès temporaire d'un validateur sur toute demande créée
 * avant le renommage — il ouvrirait une page vide sans comprendre pourquoi.
 *
 * Cette table conserve les anciens noms. On n'en retire JAMAIS une ligne : les demandes
 * historiques, elles, ne se renomment pas.
 */
export const NAV_LEGACY_LABELS: Record<string, Module> = {
  "Regulatory": "REGULATORY",
  "Ventes & Marchés": "SALES",
  "Logistique": "LOGISTICS",
  "PCH — Marchés": "PCH",
  "Prévisions & Force de vente": "SALES_PLANNING",
  "Business Development": "BUSINESS_DEVELOPMENT",
  "Explorateur produits": "BUSINESS_DEVELOPMENT",
  "Administration": "ADMIN",
};

export function moduleForPath(path: string): Module | null {
  let bestLen = -1;
  let bestModule: Module | null = null;
  const consider = (href: string, module: Module) => {
    if (href && (path === href || path.startsWith(`${href}/`)) && href.length > bestLen) {
      bestLen = href.length;
      bestModule = module;
    }
  };
  for (const n of NAVIGATION) {
    if (n.tabs) for (const t of n.tabs) consider(t.href, t.module);
    consider(n.href, n.module);
    for (const m of n.match ?? []) consider(m, n.module);
  }
  return bestModule;
}

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
