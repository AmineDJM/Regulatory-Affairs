/**
 * Assistant IA (Chatbot) — boucle agent **serveur uniquement**.
 *
 * L'assistant comprend l'application et les données de l'utilisateur (toujours
 * filtrées par ses droits RBAC), répond à ses questions, et **propose** des
 * actions concrètes (créer une tâche, une demande administrative). Conformément
 * au choix « Confirmer chaque action avant exécution », l'assistant n'exécute
 * jamais lui-même une action : il l'intercepte et la renvoie au client pour une
 * confirmation explicite (voir `assistant-actions.ts` pour l'exécution réelle,
 * ré-autorisée et journalisée).
 *
 * Outils de LECTURE : exécutés automatiquement pendant la boucle, ils ne
 * renvoient que des données déjà visibles par l'utilisateur (scopes RBAC).
 * Outils d'ÉCRITURE : jamais exécutés ici — interceptés et transformés en
 * « action proposée » soumise à confirmation.
 *
 * La clé API reste serveur uniquement ; sans `ANTHROPIC_API_KEY`, l'appelant
 * affiche « IA non configurée ».
 */

import type { AdminRequestType, CongressRequestStatus, Priority, CalendarEventKind, HrRequestType, RegulatoryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { companyIdForNew, currentCompanyWhereFor } from "@/lib/company";
import { buildRef, createWithRetry } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles, broadcastNotification, type BroadcastAudience } from "@/lib/notify";
import { createEventForUser, algiersInputToUtc, CALENDAR_KINDS } from "@/lib/calendar";
import { createDossierRecord } from "@/lib/dossiers-core";
import { createSponsoring } from "@/lib/actions/sponsoring-actions";
import { createEvent } from "@/lib/actions/event-actions";
import { createPromoMaterial } from "@/lib/actions/promo-material-actions";
import { findDirectConversation } from "@/lib/messaging";
import { getMailAccount, listMessages, getMessage, sendMail } from "@/lib/mail";
import {
  callClaude, callClaudeStream, aiConfigured,
  type ClaudeMessage, type ClaudeContentBlock, type ClaudeToolDef,
} from "@/lib/ai";
import {
  userCan, accessibleModules, hasGlobalView, type Module,
  scopeMedicalDoctors, scopeRegulatory, scopeAdminRequests,
} from "@/lib/rbac";
import { updateRequestStatus, assignRequest, addRequestComment } from "@/lib/actions/admin-request-actions";
import { createLegalDocument, updateLegalDocument } from "@/lib/actions/legal-actions";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/actions/calendar-actions";
import { createInstitution, updateInstitution } from "@/lib/actions/medical-actions";
import { createStockHospital, createStockAnnex } from "@/lib/actions/stock-snapshot-actions";
import {
  powerToolsFor, executePowerTool, powerToolLabels, powerToolsBriefing,
} from "@/lib/assistant/power-tools";
import { executiveBriefing } from "@/lib/assistant/executive-tools";
import { toNumber } from "@/lib/utils";
import {
  sitsOnPaymentCentre, applyDecision, CENTRAL_STATUS_LABEL, CENTRAL_DECISION_LABEL,
  type CentralStatus,
} from "@/lib/payments/authorization";
import { decidePayment } from "@/lib/actions/payment-centre-actions";
import type { CurrentUser } from "@/lib/session";
import {
  ROLE_LABELS, TASK_STATUS, PRIORITY, ADMIN_REQUEST_TYPE, ADMIN_REQUEST_STATUS,
  MEDICAL_SECTOR, INFLUENCE_LEVEL, REGULATORY_STATUS, EVENT_STATUS, EVENT_TYPE,
  MODULE_LABELS, doctorDisplayName,
} from "@/lib/labels";
import { regulatoryKnowledgeDigest } from "@/lib/regulatory/anpp-knowledge";
import { getAppSettings } from "@/lib/settings";
import { DATASETS, isExportDataset, exportDatasetToDrive } from "@/lib/assistant/exports";
import {
  WRITABLE_SETTINGS, parseSettingValue, parseRegFieldValue, regFieldSpec, settingSpec,
  renderSettingValue,
} from "@/lib/assistant/admin-write";

// ───────────────────────────── Types publics ─────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type AssistantActionPayload =
  | {
      /**
       * MODIFIER UN DOSSIER RÉGULATORY, champ par champ.
       *
       * Le champ et la valeur sont RELUS par `parseRegFieldValue` avant d'atteindre la base : la
       * confirmation de l'utilisateur ne remplace pas la validation, personne ne relit une
       * énumération dans une carte de confirmation.
       */
      kind: "update_regulatory_product";
      productId: string;
      reference: string;
      field: string;
      fieldLabel: string;
      /** Valeur déjà validée et convertie, prête à écrire. */
      value: string | string[] | boolean | Date | null;
      /** Valeur actuelle, pour le journal et pour la carte de confirmation. */
      before: string;
      after: string;
    }
  | {
      /**
       * MODIFIER UN RÉGLAGE DE LA PLATEFORME (Super Admin).
       *
       * Même principe : seule la liste blanche de `WRITABLE_SETTINGS` est atteignable, et la
       * valeur est bornée avant d'être proposée.
       */
      kind: "update_platform_setting";
      settingKey: string;
      settingLabel: string;
      value: string | number | boolean | string[];
      before: string;
      after: string;
    }
  | {
      /**
       * Rattacher des produits Regulatory à une entité — éventuellement PLUSIEURS d'un coup.
       * L'assistant décrit le lot par un FILTRE, jamais par une liste devinée : on relit le
       * filtre au moment d'exécuter, donc ce qui est modifié est exactement ce qui a été montré.
       */
      kind: "set_products_company";
      companyId: string;
      companyName: string;
      /** Filtre du lot, tel qu'il a servi à compter et à lister l'aperçu. */
      query?: string | null;
      category?: string | null;
      onlyWithoutCompany?: boolean;
      /** Références concernées, pour que la confirmation montre ce qui va changer. */
      references: string[];
    }
  | {
      kind: "create_task";
      title: string;
      description?: string | null;
      assigneeId?: string | null;
      assigneeName?: string | null;
      dueDate?: string | null;
      priority?: string | null;
    }
  | {
      kind: "create_admin_request";
      type: string;
      title: string;
      description?: string | null;
      assigneeId?: string | null;
      assigneeName?: string | null;
      concernedId?: string | null;
      concernedName?: string | null;
      deadline?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      priority?: string | null;
    }
  | {
      kind: "send_message";
      recipientId?: string | null;
      recipientName?: string | null;
      body: string;
    }
  | {
      kind: "send_email";
      to: string;
      cc?: string | null;
      subject: string;
      body: string;
    }
  | {
      kind: "create_congress_request";
      scope: "INTL" | "NATIONAL";
      name: string;
      specialty?: string | null;
      city?: string | null;
      country?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      estimatedBudget?: number | null;
      doctorId?: string | null;
      doctorName?: string | null;
      note?: string | null;
    }
  | {
      kind: "create_dossier";
      title: string;
      description?: string | null;
      category?: string | null;
      assigneeId?: string | null;
      assigneeName?: string | null;
      priority?: string | null;
      dueDate?: string | null;
    }
  | {
      kind: "create_notification";
      audience: BroadcastAudience;
      role?: string | null;
      userIds?: string[];
      recipientNames?: string | null;
      title: string;
      body?: string | null;
      link?: string | null;
      popup?: boolean;
    }
  | {
      kind: "create_calendar_event";
      title: string;
      date: string;
      time?: string | null;
      durationMin?: number | null;
      allDay?: boolean;
      eventKind?: string | null;
      location?: string | null;
      meetLink?: string | null;
      description?: string | null;
      inviteeIds?: string[];
      inviteeNames?: string | null;
    }
  | {
      kind: "create_hr_request";
      type: string; // HrRequestType
      details?: string | null;
      expenseMonth?: string | null; // YYYY-MM (note de frais)
      periodStart?: string | null;
      periodEnd?: string | null;
    }
  | {
      kind: "create_sponsoring_request";
      institution: string;
      type?: string | null;
      specialty?: string | null;
      city?: string | null;
      amountRequested?: number | null;
      product?: string | null;
      description?: string | null;
      doctorName?: string | null;
    }
  | {
      kind: "create_event_request";
      name: string;
      specialty?: string | null;
      city?: string | null;
      country?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      estimatedBudget?: number | null;
      description?: string | null;
    }
  | {
      kind: "create_promo_material_request";
      title: string;
      materialType?: string | null;
      amount?: number | null;
      description?: string | null;
    }
  | {
      /**
       * TRANCHER UN PAIEMENT AU CENTRE — autoriser, refuser, demander une révision du montant ou
       * une argumentation. Toujours confirmé par la carte ; l'exécution repasse par l'action du
       * centre (`decidePayment`), qui revérifie QUI siège et si la décision a encore un sens.
       */
      kind: "decide_payment";
      orderId: string;
      reference: string;
      label: string;
      amountDzd: number;
      decision: "APPROVE" | "REFUSE" | "REQUEST_CHANGES" | "REQUEST_INFO";
      note?: string | null;
      proposedAmount?: number | null;
    }
  | {
      /**
       * MODIFIER UNE TÂCHE — réassigner, changer l'échéance / la priorité / le statut, commenter.
       * La cible est résolue à la proposition (identifiant stocké) et le droit revérifié à
       * l'exécution : sa propre tâche, ou n'importe laquelle pour une vue globale.
       */
      kind: "update_task";
      taskId: string;
      taskTitle: string;
      assigneeId?: string | null;
      assigneeName?: string | null;
      dueDate?: string | null;
      clearDueDate?: boolean;
      priority?: string | null;
      status?: string | null;
      comment?: string | null;
    }
  | {
      /**
       * MODIFIER UNE DEMANDE DU SECRÉTARIAT — statut, responsable, commentaire. L'exécution
       * repasse par les actions du module (`updateRequestStatus`, `assignRequest`,
       * `addRequestComment`) : mêmes gardes, mêmes notifications, même archivage.
       */
      kind: "update_request";
      requestId: string;
      reference: string;
      status?: string | null;
      assigneeId?: string | null;
      assigneeName?: string | null;
      comment?: string | null;
    }
  | {
      /**
       * DÉCLARER UNE PIÈCE LEGAL (devis, BC, facture, contrat…) — éventuellement CHAÎNÉE à sa
       * pièce amont (le BC de son devis, la facture de son BC). Exécution via
       * `createLegalDocument` : mêmes contrôles que le formulaire.
       */
      kind: "create_legal_document";
      docKind: string;
      title: string;
      reference?: string | null;
      counterparty?: string | null;
      amount?: number | null;
      startDate?: string | null;
      endDate?: string | null;
      notes?: string | null;
      chainFromId?: string | null;
      chainFromLabel?: string | null;
    }
  | {
      /**
       * MODIFIER UNE PIÈCE LEGAL. `updateLegalDocument` REMPLACE tous les champs : l'exécution
       * relit donc la fiche et n'écrase que ce qui a été demandé — jamais un champ par omission.
       */
      kind: "update_legal_document";
      documentId: string;
      currentTitle: string;
      updates: {
        title?: string | null;
        reference?: string | null;
        counterparty?: string | null;
        amount?: number | null;
        startDate?: string | null;
        endDate?: string | null;
        notes?: string | null;
        chainFromId?: string | null;
      };
      changes: string[];
    }
  | {
      /**
       * DÉPLACER / ANNULER UN RENDEZ-VOUS du calendrier. Même règle que l'écran : seul
       * l'organisateur (ou une vue globale) modifie. L'exécution relit l'événement et
       * n'écrase que ce qui change.
       */
      kind: "update_calendar_event";
      eventId: string;
      eventTitle: string;
      cancel?: boolean;
      date?: string | null;
      time?: string | null;
      durationMin?: number | null;
      location?: string | null;
      changes: string[];
    }
  | {
      /** AJOUTER UN HÔPITAL — à la liste des lieux de stock (STOCKS) ou à l'annuaire médical. */
      kind: "create_hospital";
      registre: "STOCKS" | "ANNUAIRE";
      name: string;
      annexKind?: "HOSPITAL" | "ANNEX";
      institutionType?: string | null;
      sector?: string | null;
      wilaya?: string | null;
      city?: string | null;
    }
  | {
      /** MODIFIER UN ÉTABLISSEMENT de l'annuaire médical (l'exécution relit puis fusionne). */
      kind: "update_hospital";
      institutionId: string;
      name: string;
      updates: {
        newName?: string | null;
        type?: string | null;
        sector?: string | null;
        wilaya?: string | null;
        city?: string | null;
        phone?: string | null;
        email?: string | null;
        notes?: string | null;
        isActive?: boolean | null;
      };
      changes: string[];
    }
  | {
      /**
       * MODIFIER UN SALAIRE — NIVEAU CRITIQUE. Chaque champ porte son AVANT (relu au moment de
       * la proposition) et son APRÈS ; l'exécution revérifie que la fiche n'a pas bougé entre
       * les deux (sinon elle refuse : on ne signe pas un montant sur une photo périmée).
       */
      kind: "update_salary";
      employeeId: string;
      employeeName: string;
      fields: {
        field: "baseSalary" | "netToPay" | "grossSalary" | "employerCost";
        label: string;
        before: number | null;
        after: number;
      }[];
      note?: string | null;
    };

export type AssistantActionKind = AssistantActionPayload["kind"];

export interface ProposedAction {
  kind: AssistantActionKind;
  /** Module RBAC qui garde l'exécution (affiché + revérifié). */
  module: Module;
  /** Titre court de la carte de confirmation. */
  title: string;
  /** Champs résolus à afficher (libellé → valeur). */
  fields: { label: string; value: string }[];
  /** Avertissements (ex. destinataire introuvable). */
  warnings: string[];
  /**
   * Niveau de gravité de l'action, pour l'UI de confirmation. `CRITICAL` (paie, salaires)
   * exige une CONFIRMATION FORTE : la carte fait RESSAISIR le montant avant d'armer le bouton.
   * `SENSITIVE` (paiements, réglages plateforme) est marqué visuellement. Absent = confirmation
   * standard. Ce niveau n'accorde AUCUN droit — il ne fait que durcir l'UI.
   */
  level?: "SENSITIVE" | "CRITICAL";
  /** CRITICAL uniquement : la valeur exacte que l'utilisateur doit RESSAISIR pour confirmer. */
  confirmText?: string;
  /** Charge utile revérifiée et exécutée côté serveur après confirmation. */
  payload: AssistantActionPayload;
}

export interface AssistantResult {
  configured: boolean;
  ok: boolean;
  reply: string;
  /** Étapes de lecture effectuées (transparence dans l'UI). */
  trace: string[];
  /** Action à confirmer avant exécution, le cas échéant. */
  proposal?: ProposedAction;
  /** Fil de conversation dans lequel l'échange a été mémorisé (mémoire personnelle). */
  threadId?: string | null;
  error?: string;
}

// ───────────────────────────── Libellés modules ─────────────────────────────

const MODULE_FR: Partial<Record<Module, string>> = {
  DASHBOARD: "Tableau de bord", WORKSPACE: "Mon espace / tâches", MESSAGING: "Messagerie",
  REGULATORY: "Regulatory (AMM/ANPP)", SPONSORING: "Sponsoring", BUDGETS: "Budgets",
  FINANCES: "Finances", RH: "Ressources humaines", CONGRESS_INTERNATIONAL: "Prises en charge Internationales",
  CONGRESS_NATIONAL: "Prises en charge Nationales", EVENTS: "Events (billetterie)", SALES: "Ventes",
  LOGISTICS: "Logistique PCH", PCH: "Marchés PCH", STOCKS: "Stocks PCH",
  MEDICAL: "Annuaire", BUSINESS_DEVELOPMENT: "Business Development", PROMO_MATERIAL: "Matériel promotionnel",
  VALIDATIONS: "Demandes de validations", DRIVE: "Drive", ADMIN_REQUESTS: "Bureau du secrétariat",
  PROCESS_INTELLIGENCE: "Process Intelligence", ADMIN: "Administration",
};

// Libellés FR des types de demande RH (self-service) — pour l'outil + la carte de confirmation.
const HR_REQUEST_FR: Record<string, string> = {
  WORK_CERTIFICATE: "Attestation de travail", CNAS_CERTIFICATE: "Attestation CNAS",
  SALARY_STATEMENT: "Relevé des émoluments", DOMICILIATION: "Domiciliation de salaire",
  LEAVE_CERTIFICATE: "Attestation de congé", LEAVE_TITLE: "Titre de congé",
  MISSION_ORDER: "Ordre de mission", EXPENSE_REPORT: "Note de frais",
  EXCEPTIONAL_EXIT: "Sortie exceptionnelle", SICK_LEAVE: "Arrêt maladie",
  ANNUAL_LEAVE: "Congé annuel", UNPAID_LEAVE: "Congé sans solde",
  SPECIAL_LEAVE: "Congé exceptionnel", MATERNITY_LEAVE: "Congé de maternité",
  HR_INTERVIEW: "Entrevue RH", OTHER: "Autre demande RH",
};
const HR_REQUEST_TYPES = Object.keys(HR_REQUEST_FR);
// Types exigeant une PÉRIODE (début requis) et, pour les congés, une fin.
const HR_LEAVE_TYPES = new Set(["ANNUAL_LEAVE", "UNPAID_LEAVE", "SPECIAL_LEAVE", "MATERNITY_LEAVE", "SICK_LEAVE"]);
const HR_PERIOD_TYPES = new Set([...HR_LEAVE_TYPES, "EXCEPTIONAL_EXIT"]);
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ───────────────────────────── Définition des outils ─────────────────────────────

const READ_TOOLS: ClaudeToolDef[] = [
  {
    name: "search_people",
    description:
      "Recherche un collègue dans l'annuaire interne par son nom (ou prénom). À utiliser pour résoudre une personne avant de lui assigner une tâche ou une demande (ex. « Radia »). Renvoie id, nom, fonction, département.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nom ou prénom recherché." } },
      required: ["query"],
    },
  },
  {
    name: "my_overview",
    description:
      "Aperçu de l'espace de travail de l'utilisateur courant : modules accessibles, nombre de tâches ouvertes, de demandes en cours, de notifications non lues. À utiliser pour répondre à « où en suis-je ? ».",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_my_tasks",
    description: "Liste les tâches de l'utilisateur (assignées ou créées par lui). Par défaut les tâches non terminées.",
    input_schema: {
      type: "object",
      properties: { includeDone: { type: "boolean", description: "Inclure les tâches terminées." } },
    },
  },
  {
    name: "list_my_requests",
    description: "Liste les demandes administratives visibles par l'utilisateur (les siennes, celles qui le concernent ou qu'il traite).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_doctors",
    description:
      "Recherche des médecins dans l'annuaire de la promotion médicale (uniquement ceux que l'utilisateur a le droit de voir). Ne jamais inventer un médecin : s'il est introuvable, le dire. Renvoie grade, spécialité, secteur, établissement, influence.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nom du médecin, spécialité ou établissement." } },
    },
  },
  {
    name: "search_products",
    description:
      "Liste ou recherche les produits Regulatory que l'utilisateur a le droit de voir. " +
      "La recherche porte sur la DCI, le nom commercial, la référence, la CLASSE THÉRAPEUTIQUE (« oncologie », « biosimilaire »…), la forme galénique, le laboratoire partenaire et l'entité. " +
      "Sans `query`, renvoie TOUT le portefeuille (utiliser pour « donne-moi tous les produits »). " +
      "Augmenter `limit` pour un inventaire complet. Ne jamais inventer un produit.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Terme libre : DCI, nom commercial, référence, classe thérapeutique, forme, laboratoire ou entité. Omettre pour tout lister." },
        limit: { type: "number", description: "Nombre maximum de produits (défaut 40, maximum 300)." },
        category: { type: "string", enum: ["MEDICINE", "MEDICAL_DEVICE"], description: "Restreindre aux médicaments ou aux dispositifs médicaux." },
        withoutCompany: { type: "boolean", description: "Vrai pour ne remonter que les produits SANS entité rattachée." },
      },
    },
  },
  {
    name: "search_events",
    description: "Recherche des événements (congrès, séminaires, webinars) et leur statut / nombre d'inscrits.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Nom ou ville de l'événement." } },
    },
  },
  {
    name: "list_emails",
    description:
      "Liste les e-mails récents de la **boîte mail de l'utilisateur** (sa propre boîte connectée dans Courrier). À utiliser pour « résume mes mails », « ai-je reçu un mail de X ? ». Renvoie pour chaque message : uid, expéditeur, adresse, objet, date, lu/non lu. Si aucune boîte n'est connectée, le signaler.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", description: "Nombre de messages récents (défaut 15, max 30)." } },
    },
  },
  {
    name: "read_email",
    description:
      "Lit le contenu complet d'un e-mail de la boîte de l'utilisateur, identifié par son `uid` (obtenu via list_emails). Renvoie expéditeur, adresse, destinataires, objet, date, corps texte et noms des pièces jointes.",
    input_schema: {
      type: "object",
      properties: { uid: { type: "number", description: "Identifiant uid du message (depuis list_emails)." } },
      required: ["uid"],
    },
  },
];

/**
 * EXPORTER EN EXCEL — disponible à tout le monde, borné par les DROITS DE LECTURE.
 *
 * Ce n'est pas un outil de Super Admin : c'est une lecture de plus, et `canExport` refuse tout
 * jeu de données que la personne ne pourrait pas ouvrir à l'écran. Le classeur atterrit dans son
 * Drive personnel — un export contient souvent des coordonnées, il doit vivre là où les
 * autorisations existent déjà plutôt que dans un lien qui traîne.
 */
const EXPORT_TOOL: ClaudeToolDef = {
  name: "export_excel",
  description:
    "Génère un vrai fichier EXCEL (.xlsx) et le dépose dans le Drive personnel de l'utilisateur, "
    + "dossier « Exports IA ». À utiliser dès qu'on demande « exporte », « sors-moi un Excel », "
    + "« mets ça dans un tableur ». Jeux de données : regulatory (dossiers réglementaires), "
    + "annuaire (médecins), courriers (registre), recrutement (demandes), employes (effectif, SANS "
    + "aucune rémunération), comptes (comptes de la plateforme — direction seulement). "
    + "Le contenu ne dépasse jamais ce que l'utilisateur a le droit de lire. Après l'appel, DONNER "
    + "le nom du fichier et le nombre de lignes, et dire qu'il est dans le Drive (dossier « Exports IA »).",
  input_schema: {
    type: "object",
    properties: {
      dataset: {
        type: "string",
        enum: ["regulatory", "annuaire", "courriers", "recrutement", "employes", "comptes"],
        description: "Le jeu de données à exporter.",
      },
      limit: { type: "number", description: "Nombre maximum de lignes (défaut 2000, maximum 5000)." },
    },
    required: ["dataset"],
  },
};

/** Outils EXCLUSIFS au Super Admin — vision globale, tous comptes confondus. */
const SUPERADMIN_TOOLS: ClaudeToolDef[] = [
  {
    name: "list_accounts",
    description:
      "RÉSERVÉ AU SUPER ADMIN : liste TOUS les comptes de l'entreprise (nom, fonction, rôle, actif/inactif) avec leur charge réelle (tâches ouvertes, demandes administratives à traiter). À utiliser pour « montre-moi tous les comptes », « qui est surchargé ? », « qui pilote quoi ? ». Le Super Admin peut ensuite relancer n'importe qui (créer une tâche, envoyer un message).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Filtre optionnel par nom ou fonction." } },
    },
  },
  {
    name: "read_platform_settings",
    description:
      "RÉSERVÉ AU SUPER ADMIN : lit les RÉGLAGES ACTUELS de la plateforme (limites de téléversement, "
      + "capacité et quota du Drive, mode et total du budget, analyse CTD, rôles superviseurs Regulatory, "
      + "segments thérapeutiques, rôles d'accès divers, modules masqués). "
      + "À APPELER AVANT toute modification d'une LISTE (rôles, segments, modules) : update_platform_setting "
      + "REMPLACE la valeur, donc pour AJOUTER quelqu'un il faut d'abord connaître la liste existante.",
    input_schema: { type: "object", properties: {} },
  },
];

// Outils d'ÉCRITURE réservés au Super Admin (interceptés + confirmés, comme les autres).
const SUPERADMIN_WRITE_TOOLS: ClaudeToolDef[] = [
  {
    name: "create_notification",
    description:
      "RÉSERVÉ AU SUPER ADMIN : PROPOSE l'envoi d'une NOTIFICATION (diffusion) — à TOUS les comptes actifs, à un RÔLE précis, ou à des PERSONNES précises. N'exécute rien : confirmation requise. Pour des personnes précises, donner leurs noms séparés par des virgules (les résoudre via search_people si besoin). Pour un rôle, donner le libellé du rôle (ex. « Délégué médical », « Coordination », « Comptable »). La notification arrive dans la cloche + en push sur le téléphone des destinataires. Mettre popup=true pour une ANNONCE IMPORTANTE affichée en POP-UP PLEIN ÉCRAN (grande fenêtre centrée, accusé de réception « J'ai compris ») — à réserver aux messages vraiment importants.",
    input_schema: {
      type: "object",
      properties: {
        audience: { type: "string", enum: ["ALL", "ROLE", "USERS"], description: "ALL = tous les comptes actifs ; ROLE = un rôle ; USERS = des personnes précises." },
        role: { type: "string", description: "Si audience=ROLE : libellé ou code du rôle ciblé." },
        recipientNames: { type: "string", description: "Si audience=USERS : noms des destinataires, séparés par des virgules." },
        title: { type: "string", description: "Titre de la notification." },
        body: { type: "string", description: "Texte du message (optionnel)." },
        link: { type: "string", description: "Lien interne optionnel (ex. /mon-espace, /notifications)." },
        popup: { type: "boolean", description: "true = pop-up plein écran (annonce importante) ; false/absent = cloche + push seulement." },
      },
      required: ["audience", "title"],
    },
  },
  {
    name: "update_platform_setting",
    description:
      "RÉSERVÉ AU SUPER ADMIN : PROPOSE la modification d'un RÉGLAGE de la plateforme. N'exécute rien : "
      + "confirmation requise. Réglages modifiables : maxUploadMb, maxDriveUploadMb, driveCapacityGb, "
      + "driveUserQuotaGb, budgetTotalMode (FIXED/FLEXIBLE), budgetFixedTotal, regEnrollmentEnabled (oui/non), "
      + "regulatorySupervisorRoles, regulatoryTherapeuticSegments, regEnrollmentRoles, driveSpaceCreatorRoles, "
      + "fieldReportsOverviewRoles, orgChartViewerRoles, hiddenModules. "
      + "Les listes de rôles et de modules se donnent par leur NOM FRANÇAIS, séparés par des virgules "
      + "(ex. « Direction, Responsable Réglementaire »). Une liste vide retire tout le monde. "
      + "Ces réglages REMPLACENT la valeur existante : lire d'abord la valeur actuelle avec "
      + "read_platform_settings si l'utilisateur veut AJOUTER quelqu'un plutôt que tout remplacer.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Clé exacte du réglage." },
        value: { type: "string", description: "Nouvelle valeur (nombre, oui/non, ou liste séparée par des virgules)." },
      },
      required: ["key", "value"],
    },
  },
];

const WRITE_TOOLS: ClaudeToolDef[] = [
  {
    name: "update_regulatory_product",
    description:
      "PROPOSE la modification d'UN champ d'UN dossier Regulatory, identifié par sa RÉFÉRENCE (REG-AAAA-NNN). "
      + "N'exécute rien : confirmation requise. Utiliser search_products AVANT pour retrouver la référence exacte. "
      + "Champs modifiables : status, priority, category, channel, brandName, dosage, dosageUnit, "
      + "pharmaceuticalForm, packaging, therapeuticClass, therapeuticSegments, partnerLab, countryOfOrigin, "
      + "deHolder, manufacturer, targetSubmissionDate, targetDate, comments, isLocked. "
      + "Une date se donne en AAAA-MM-JJ (vide pour l'effacer) ; les segments en liste séparée par des virgules ; "
      + "isLocked en oui/non — ATTENTION, un dossier verrouillé devient invisible pour toute l'équipe. "
      + "Pour rattacher des produits à une ENTITÉ, utiliser set_products_company (qui traite un lot).",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Référence du dossier (ex. REG-2026-014)." },
        field: { type: "string", description: "Nom exact du champ à modifier." },
        value: { type: "string", description: "Nouvelle valeur." },
      },
      required: ["reference", "field", "value"],
    },
  },
  {
    name: "set_products_company",
    description:
      "PROPOSE de rattacher des produits Regulatory à une ENTITÉ (société du groupe), en une fois. " +
      "N'exécute rien : l'utilisateur confirme après avoir vu la liste exacte. " +
      "Utiliser search_products AVANT, pour vérifier que le filtre remonte bien les produits voulus. " +
      "Le filtre (`query`, `category`, `onlyWithoutCompany`) est relu à l'exécution : il doit désigner EXACTEMENT le lot voulu.",
    input_schema: {
      type: "object",
      properties: {
        companyName: { type: "string", description: "Nom ou nom court de l'entité de destination (ex. « Adventum », « Pharmagène »)." },
        query: { type: "string", description: "Même terme que search_products : DCI, classe thérapeutique (« oncologie », « biosimilaire »), laboratoire…" },
        category: { type: "string", enum: ["MEDICINE", "MEDICAL_DEVICE"], description: "Restreindre aux médicaments ou dispositifs." },
        onlyWithoutCompany: { type: "boolean", description: "Vrai pour ne rattacher que les produits qui n'ont PAS encore d'entité." },
      },
      required: ["companyName"],
    },
  },
  {
    name: "create_task",
    description:
      "PROPOSE la création d'une tâche (pour soi ou pour un collègue). N'exécute rien : l'action sera confirmée par l'utilisateur. Résoudre d'abord le collègue avec search_people si besoin.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Intitulé clair de la tâche." },
        description: { type: "string", description: "Détails utiles." },
        assigneeName: { type: "string", description: "Nom du collègue à qui assigner (sinon soi-même)." },
        dueDate: { type: "string", description: "Échéance au format AAAA-MM-JJ." },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      },
      required: ["title"],
    },
  },
  {
    name: "create_admin_request",
    description:
      "PROPOSE la création d'une demande administrative (déplacement/billet, courrier, signature, achat, devis, paiement, mission chauffeur, visa/invité, RH simple, autre). N'exécute rien : confirmation requise. Pour un billet d'avion pour un invité, utiliser type=TRAVEL, détailler passager et trajet dans la description, et renseigner startDate/endDate.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"],
        },
        title: { type: "string", description: "Titre court de la demande." },
        description: { type: "string", description: "Tous les détails (passager, trajet, montant estimé…)." },
        assigneeName: { type: "string", description: "Collègue chargé de traiter la demande (ex. assistante de direction)." },
        concernedName: { type: "string", description: "Personne concernée par la demande, si différente." },
        startDate: { type: "string", description: "Date de début / départ au format AAAA-MM-JJ." },
        endDate: { type: "string", description: "Date de fin / retour au format AAAA-MM-JJ." },
        deadline: { type: "string", description: "Échéance au format AAAA-MM-JJ." },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      },
      required: ["type", "title"],
    },
  },
  {
    name: "create_dossier",
    description:
      "PROPOSE l'ouverture d'un PROJET pour un sujet à déléguer et suivre dans le temps (ex. « rechercher des prix d'hôtels », « propositions d'hôtels », « analyse IQVIA », « comparer des billets »). À privilégier quand on confie à quelqu'un une recherche / analyse / veille que l'on veut suivre avec des fichiers et une discussion. N'exécute rien : confirmation requise. Résoudre le responsable avec search_people si un nom est cité.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Sujet du dossier, clair et court." },
        description: { type: "string", description: "Le brief : ce qui est attendu, le contexte, l'échéance souhaitée." },
        category: { type: "string", description: "Catégorie libre (Recherche, Hôtels, Billets, Analyse IQVIA, Veille…)." },
        assigneeName: { type: "string", description: "Nom du responsable à qui confier le dossier (sinon laissé à assigner)." },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        dueDate: { type: "string", description: "Échéance au format AAAA-MM-JJ." },
      },
      required: ["title"],
    },
  },
  {
    name: "send_message",
    description:
      "PROPOSE l'envoi d'un message interne (messagerie) à un collègue. N'exécute rien : confirmation requise. Résoudre le destinataire avec search_people d'abord. Réservé aux utilisateurs ayant la messagerie.",
    input_schema: {
      type: "object",
      properties: {
        recipientName: { type: "string", description: "Nom du collègue destinataire." },
        body: { type: "string", description: "Texte du message à envoyer." },
      },
      required: ["recipientName", "body"],
    },
  },
  {
    name: "send_email",
    description:
      "PROPOSE l'envoi d'un e-mail depuis la boîte mail de l'utilisateur (module Courrier). N'exécute rien : confirmation requise. Le destinataire `to` doit être une ADRESSE e-mail (ex. nom@domaine.dz). Pour écrire à un collègue en INTERNE, préférer send_message. Pour répondre à un mail reçu, le lire d'abord avec read_email pour récupérer l'adresse de l'expéditeur.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Adresse e-mail du destinataire." },
        cc: { type: "string", description: "Adresse(s) en copie, séparées par des virgules (optionnel)." },
        subject: { type: "string", description: "Objet du mail." },
        body: { type: "string", description: "Corps du mail (texte)." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "create_congress_request",
    description:
      "PROPOSE une demande de prise en charge de congrès (scope NATIONAL ou INTL), au stade préliminaire (validation Direction ensuite). N'exécute rien : confirmation requise. Réservé aux utilisateurs ayant le module congrès correspondant. Pour un médecin invité, le retrouver avec search_doctors (jamais d'invention).",
    input_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["NATIONAL", "INTL"], description: "National ou international." },
        name: { type: "string", description: "Nom de l'événement / congrès." },
        specialty: { type: "string", description: "Spécialité concernée." },
        city: { type: "string", description: "Ville." },
        country: { type: "string", description: "Pays (international)." },
        startDate: { type: "string", description: "Date de début AAAA-MM-JJ." },
        endDate: { type: "string", description: "Date de fin AAAA-MM-JJ." },
        estimatedBudget: { type: "number", description: "Budget estimé en DZD." },
        doctorName: { type: "string", description: "Médecin invité (optionnel), tel que retrouvé via search_doctors." },
        note: { type: "string", description: "Précisions / motif." },
      },
      required: ["scope", "name"],
    },
  },
  {
    name: "create_calendar_event",
    description:
      "PROPOSE la création d'un rendez-vous / réunion / rappel dans le CALENDRIER (fuseau d'Alger), avec invitations de collègues. N'exécute rien : confirmation requise. La date/heure est interprétée à l'heure d'Alger. Pour inviter des collègues, donner leurs noms dans inviteeNames (séparés par des virgules) ; les retrouver avec search_people en cas de doute.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Intitulé du rendez-vous." },
        date: { type: "string", description: "Date AAAA-MM-JJ (heure d'Alger)." },
        time: { type: "string", description: "Heure HH:mm (heure d'Alger). Défaut 09:00 si absent." },
        durationMin: { type: "number", description: "Durée en minutes (optionnel)." },
        allDay: { type: "boolean", description: "Journée entière (sans heure)." },
        kind: { type: "string", enum: ["APPOINTMENT", "MEETING", "REMINDER", "DEADLINE", "INFO", "OTHER"], description: "Type d'événement." },
        location: { type: "string", description: "Lieu (optionnel)." },
        meetLink: { type: "string", description: "Lien visio (optionnel)." },
        description: { type: "string", description: "Détails / ordre du jour (optionnel)." },
        inviteeNames: { type: "string", description: "Noms des collègues à inviter, séparés par des virgules (optionnel)." },
      },
      required: ["title", "date"],
    },
  },
  {
    name: "create_hr_request",
    description:
      "PROPOSE une DEMANDE RH en libre-service POUR LE COMPTE DE L'UTILISATEUR (son propre dossier RH) : note de frais, ordre de mission, titre/attestation de congé, congé annuel/sans solde/exceptionnel/maternité, arrêt maladie, sortie exceptionnelle, attestation de travail/CNAS, relevé des émoluments, domiciliation, entrevue RH. N'exécute rien : confirmation requise. Choisir le `type` exact. Pour une NOTE DE FRAIS, `expenseMonth` (AAAA-MM) est obligatoire. Pour un CONGÉ/absence, indiquer `periodStart` (et `periodEnd` pour les congés). Ne rien inventer : demander les dates/mois manquants à l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: HR_REQUEST_TYPES, description: "Type de demande RH. Ex. EXPENSE_REPORT = note de frais, MISSION_ORDER = ordre de mission, ANNUAL_LEAVE = congé annuel." },
        details: { type: "string", description: "Précisions / motif / objet de la demande." },
        expenseMonth: { type: "string", description: "Mois concerné par la note de frais, AAAA-MM (obligatoire pour EXPENSE_REPORT)." },
        periodStart: { type: "string", description: "Début du congé / de l'absence, AAAA-MM-JJ (congés & absences)." },
        periodEnd: { type: "string", description: "Fin du congé, AAAA-MM-JJ (congés à jours entiers)." },
      },
      required: ["type"],
    },
  },
  {
    name: "create_sponsoring_request",
    description:
      "PROPOSE une demande de prise en charge de SPONSORING (institution / association / service), au stade préliminaire (validation Direction ensuite). N'exécute rien : confirmation requise. Réservé aux utilisateurs ayant le module Sponsoring. Pour un médecin lié, le retrouver via search_doctors (jamais d'invention).",
    input_schema: {
      type: "object",
      properties: {
        institution: { type: "string", description: "Institution / association / service bénéficiaire (obligatoire)." },
        type: { type: "string", description: "Type de sponsoring (ex. congrès, formation, association…)." },
        specialty: { type: "string", description: "Spécialité concernée." },
        city: { type: "string", description: "Ville." },
        amountRequested: { type: "number", description: "Montant demandé en DZD." },
        product: { type: "string", description: "Produit concerné." },
        doctorName: { type: "string", description: "Médecin lié (optionnel), tel que retrouvé via search_doctors." },
        description: { type: "string", description: "Objet / motif de la demande." },
      },
      required: ["institution"],
    },
  },
  {
    name: "create_event_request",
    description:
      "PROPOSE la création d'un ÉVÉNEMENT (congrès/séminaire/webinar organisé par l'entreprise). N'exécute rien : confirmation requise. Réservé aux utilisateurs ayant le module Events.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de l'événement (obligatoire)." },
        specialty: { type: "string", description: "Spécialité concernée." },
        city: { type: "string", description: "Ville." },
        country: { type: "string", description: "Pays." },
        startDate: { type: "string", description: "Date de début AAAA-MM-JJ." },
        endDate: { type: "string", description: "Date de fin AAAA-MM-JJ." },
        estimatedBudget: { type: "number", description: "Budget estimé en DZD." },
        description: { type: "string", description: "Détails / objet." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_promo_material_request",
    description:
      "PROPOSE une demande de MATÉRIEL PROMOTIONNEL (Ad & Pro) : lance la prospection d'agences via l'assistante de direction. N'exécute rien : confirmation requise. Réservé au Marketing (module Matériel promotionnel).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Intitulé du matériel demandé (obligatoire)." },
        materialType: { type: "string", description: "Type de matériel (optionnel)." },
        amount: { type: "number", description: "Montant estimé en DZD (optionnel)." },
        description: { type: "string", description: "Précisions / cahier des charges." },
      },
      required: ["title"],
    },
  },
  {
    name: "decide_payment",
    description:
      "PROPOSE de trancher un PAIEMENT au CENTRE DE PAIEMENT : autoriser (APPROVE), refuser (REFUSE), demander une révision du montant " +
      "(REQUEST_CHANGES, avec proposedAmount) ou une argumentation (REQUEST_INFO). Réservé à qui SIÈGE au centre (PDG, Super Admin). " +
      "N'exécute rien : la carte de confirmation montre le paiement, le montant et la décision avant tout. " +
      "`reference` = la référence de l'ordre (visible au centre de paiement ou via inspect_record).",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Référence de l'ordre de dépense à trancher." },
        decision: { type: "string", enum: ["APPROVE", "REFUSE", "REQUEST_CHANGES", "REQUEST_INFO"], description: "La décision." },
        note: { type: "string", description: "Le motif — OBLIGATOIRE sauf pour APPROVE : le demandeur le lira." },
        proposedAmount: { type: "number", description: "Montant proposé en DZD (REQUEST_CHANGES uniquement) — une proposition, jamais une réécriture." },
      },
      required: ["reference", "decision"],
    },
  },
  {
    name: "update_task",
    description:
      "PROPOSE la MODIFICATION d'une tâche existante : réassigner à quelqu'un, changer l'échéance, la priorité ou le statut, ajouter un commentaire. " +
      "N'exécute rien : confirmation requise. `task` = fragment du titre (la tâche la plus récente qui correspond est retenue — vérifier avec inspect_record en cas de doute). " +
      "Ne donner QUE les champs à changer. Statuts : TODO, IN_PROGRESS, DONE (clore), CANCELLED (annuler), TODO pour rouvrir.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Fragment du titre de la tâche à modifier." },
        assigneeName: { type: "string", description: "Nouveau responsable (résoudre via search_people)." },
        dueDate: { type: "string", description: "Nouvelle échéance AAAA-MM-JJ." },
        clearDueDate: { type: "boolean", description: "true pour RETIRER l'échéance." },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"], description: "Nouveau statut (DONE = clore, TODO = rouvrir)." },
        comment: { type: "string", description: "Commentaire à ajouter au fil de la tâche." },
      },
      required: ["task"],
    },
  },
  {
    name: "update_request",
    description:
      "PROPOSE la MODIFICATION d'une demande du secrétariat (REQ-…) : statut, responsable, commentaire. N'exécute rien : confirmation requise. " +
      "Statuts : NEW, IN_PROGRESS, AWAITING_VALIDATION, AWAITING_EXTERNAL, AWAITING_PAYMENT, AWAITING_DOCUMENT, BLOCKED, DONE, CANCELLED.",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Référence de la demande (REQ-AAAA-NNN) ou fragment du titre." },
        status: { type: "string", enum: ["NEW", "IN_PROGRESS", "AWAITING_VALIDATION", "AWAITING_EXTERNAL", "AWAITING_PAYMENT", "AWAITING_DOCUMENT", "BLOCKED", "DONE", "CANCELLED"] },
        assigneeName: { type: "string", description: "Nouveau responsable (résoudre via search_people)." },
        comment: { type: "string", description: "Commentaire à ajouter au fil de la demande." },
      },
      required: ["reference"],
    },
  },
  {
    name: "create_legal_document",
    description:
      "PROPOSE de DÉCLARER une pièce au module Legal : devis (QUOTE), bon de commande (PURCHASE_ORDER), facture (INVOICE), contrat (CONTRACT), " +
      "accord (AGREEMENT), NDA, assurance (INSURANCE), licence (LICENSE), bail (LEASE), autre (OTHER). N'exécute rien : confirmation requise. " +
      "`chain_from` (référence ou titre de la pièce AMONT) CHAÎNE la pièce : le BC à son devis, la facture à son BC — c'est ce qui rend la chaîne d'achat lisible.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["QUOTE", "PURCHASE_ORDER", "INVOICE", "CONTRACT", "AGREEMENT", "NDA", "INSURANCE", "LICENSE", "LEASE", "OTHER"], description: "Nature de la pièce." },
        title: { type: "string", description: "Titre exact de la pièce (obligatoire)." },
        reference: { type: "string", description: "Référence / numéro de la pièce (ex. n° du BC)." },
        counterparty: { type: "string", description: "La partie / le fournisseur." },
        amount: { type: "number", description: "Montant en DZD." },
        startDate: { type: "string", description: "Date de début / d'émission AAAA-MM-JJ." },
        endDate: { type: "string", description: "Date de fin / d'échéance AAAA-MM-JJ." },
        notes: { type: "string", description: "Notes." },
        chain_from: { type: "string", description: "Référence ou titre de la pièce AMONT (devis pour un BC, BC pour une facture)." },
      },
      required: ["kind", "title"],
    },
  },
  {
    name: "update_legal_document",
    description:
      "PROPOSE la MODIFICATION d'une pièce Legal existante (titre, référence, partie, montant, dates, notes, chaînage). " +
      "N'exécute rien : confirmation requise. Ne donner QUE les champs à changer — les autres restent tels quels.",
    input_schema: {
      type: "object",
      properties: {
        document: { type: "string", description: "Référence ou fragment de titre de la pièce à modifier." },
        title: { type: "string", description: "Nouveau titre." },
        reference: { type: "string", description: "Nouvelle référence." },
        counterparty: { type: "string", description: "Nouvelle partie." },
        amount: { type: "number", description: "Nouveau montant en DZD." },
        startDate: { type: "string", description: "Nouvelle date de début AAAA-MM-JJ." },
        endDate: { type: "string", description: "Nouvelle date de fin AAAA-MM-JJ." },
        notes: { type: "string", description: "Nouvelles notes." },
        chain_from: { type: "string", description: "Référence / titre de la pièce amont à chaîner." },
      },
      required: ["document"],
    },
  },
  {
    name: "update_calendar_event",
    description:
      "PROPOSE de DÉPLACER ou d'ANNULER un rendez-vous du calendrier (le sien, ou n'importe lequel pour une vue globale). " +
      "N'exécute rien : confirmation requise. `event` = fragment du titre. Pour déplacer : date et/ou time. `cancel`=true pour annuler.",
    input_schema: {
      type: "object",
      properties: {
        event: { type: "string", description: "Fragment du titre du rendez-vous." },
        cancel: { type: "boolean", description: "true = ANNULER le rendez-vous." },
        date: { type: "string", description: "Nouvelle date AAAA-MM-JJ (heure d'Alger)." },
        time: { type: "string", description: "Nouvelle heure HH:MM (heure d'Alger)." },
        durationMin: { type: "number", description: "Nouvelle durée en minutes." },
        location: { type: "string", description: "Nouveau lieu." },
      },
      required: ["event"],
    },
  },
  {
    name: "create_hospital",
    description:
      "PROPOSE d'AJOUTER un hôpital : `registre`=STOCKS pour la liste des lieux de stock (hôpitaux / annexes PCH du module Stocks), " +
      "`registre`=ANNUAIRE pour l'annuaire médical (établissements : CHU, EPH, clinique…). N'exécute rien : confirmation requise. " +
      "Vérifier d'abord avec search_hospitals qu'il n'existe pas déjà.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de l'hôpital / établissement (obligatoire)." },
        registre: { type: "string", enum: ["STOCKS", "ANNUAIRE"], description: "STOCKS = lieux de stock ; ANNUAIRE = annuaire médical." },
        kind: { type: "string", enum: ["HOSPITAL", "ANNEX"], description: "STOCKS uniquement : hôpital ou annexe PCH (défaut HOSPITAL)." },
        type: { type: "string", enum: ["CHU", "EPH", "EHS", "CLINIQUE_PRIVEE", "POLYCLINIQUE", "CABINET", "CENTRE_SANTE", "PHARMACIE", "GROSSISTE", "AUTRE"], description: "ANNUAIRE uniquement : type d'établissement." },
        sector: { type: "string", enum: ["PUBLIC", "PRIVE"], description: "ANNUAIRE uniquement : secteur." },
        wilaya: { type: "string", description: "ANNUAIRE uniquement : wilaya." },
        city: { type: "string", description: "ANNUAIRE uniquement : ville." },
      },
      required: ["name", "registre"],
    },
  },
  {
    name: "update_hospital",
    description:
      "PROPOSE la MODIFICATION d'un établissement de l'ANNUAIRE MÉDICAL (nom, type, secteur, wilaya, ville, téléphone, e-mail, notes, actif). " +
      "N'exécute rien : confirmation requise. Ne donner QUE les champs à changer.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom actuel (fragment) de l'établissement." },
        newName: { type: "string", description: "Nouveau nom." },
        type: { type: "string", enum: ["CHU", "EPH", "EHS", "CLINIQUE_PRIVEE", "POLYCLINIQUE", "CABINET", "CENTRE_SANTE", "PHARMACIE", "GROSSISTE", "AUTRE"] },
        sector: { type: "string", enum: ["PUBLIC", "PRIVE"] },
        wilaya: { type: "string" },
        city: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        notes: { type: "string" },
        active: { type: "boolean", description: "false pour désactiver l'établissement." },
      },
      required: ["name"],
    },
  },
  {
    name: "update_salary",
    description:
      "PROPOSE une MODIFICATION DE SALAIRE sur la fiche RH d'un employé — NIVEAU CRITIQUE : la carte de confirmation montre l'AVANT, " +
      "l'APRÈS et l'ÉCART, et exige une confirmation renforcée. N'exécute rien. " +
      "TOUJOURS appeler read_payroll AVANT pour connaître les montants actuels et calculer le nouveau montant exact (ex. +10 %). " +
      "Donner UNIQUEMENT les montants à changer, en DZD.",
    input_schema: {
      type: "object",
      properties: {
        employee_name: { type: "string", description: "Nom de l'employé (registre RH)." },
        base_salary: { type: "number", description: "Nouveau salaire de base en DZD." },
        net_to_pay: { type: "number", description: "Nouveau net à payer en DZD." },
        gross_salary: { type: "number", description: "Nouveau brut en DZD." },
        employer_cost: { type: "number", description: "Nouveau coût employeur en DZD." },
        note: { type: "string", description: "Motif / date d'effet (libre) — journalisé." },
      },
      required: ["employee_name"],
    },
  },
];

const WRITE_TOOL_NAMES = new Set([...WRITE_TOOLS, ...SUPERADMIN_WRITE_TOOLS].map((t) => t.name));

// ───────────────────────────── Contexte + system prompt ─────────────────────────────

function buildContext(user: CurrentUser): string {
  const mods = accessibleModules(user)
    .map((m) => MODULE_FR[m])
    .filter(Boolean)
    .join(", ");
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Utilisateur : ${user.name} (${ROLE_LABELS[user.role] ?? user.role}).`,
    `Date du jour : ${today}.`,
    `Modules auxquels il a accès : ${mods || "aucun"}.`,
  ].join("\n");
}

function systemPrompt(user: CurrentUser): string {
  // Le bot devient EXPERT du cadre réglementaire ANPP (Algérie) dès que l'utilisateur a
  // accès au module Regulatory — connaissance intégrée, réponses fondées sur les textes.
  const regExpertise = userCan(user, "REGULATORY", "VIEW") ? `\n\n${regulatoryKnowledgeDigest()}\n` : "";
  // Sans cette annonce, le modèle IGNORE qu'il dispose des lectures chiffrées et continue de
  // renvoyer vers les pages — précisément le défaut que ces outils corrigent.
  const powers = powerToolsBriefing(user) + executiveBriefing(user);
  return `Tu es « Assistant IA », l'assistant interne d'AMD Internal OS, l'outil de gestion d'Adventum Pharma
(laboratoire pharmaceutique algérien ; devise DZD ; principal client la PCH — Pharmacie Centrale des Hôpitaux).
Tu aides l'employé à comprendre l'application, à retrouver ses informations et à passer à l'action.
${user.role === "SUPER_ADMIN" ? `
TU ES L'ASSISTANT DU SUPER ADMIN — le plus puissant de l'application. Tu as une VISION GLOBALE de
toute l'entreprise (tous les modules, tous les comptes, toutes les données). Tu peux lister tous les
comptes et leur charge (list_accounts), interroger n'importe quel pôle, et RELANCER/PILOTER n'importe
qui (créer une tâche pour un collaborateur, lui envoyer un message). Tu peux aussi DIFFUSER UNE
NOTIFICATION (create_notification) à tous les comptes, à un rôle précis, ou à des personnes précises
(elle arrive dans la cloche + en push sur leur téléphone) — ou en POP-UP PLEIN ÉCRAN pour une annonce
importante (popup=true, accusé de réception « J'ai compris »). Sers le pilotage de l'entreprise : détecte les
blocages, désigne les responsables, propose des relances. Les actions restent soumises à confirmation.

TU RÈGLES AUSSI LA PLATEFORME. read_platform_settings te donne les réglages ACTUELS ;
update_platform_setting les modifie (limites de téléversement, capacité et quota du Drive, mode et
total du budget, analyse CTD, rôles superviseurs Regulatory, segments thérapeutiques, rôles d'accès,
MODULES MASQUÉS). Deux règles à ne jamais oublier :
- une LISTE (rôles, segments, modules) est REMPLACÉE, pas complétée : quand on te dit « ajoute X »,
  lis d'abord la valeur actuelle et propose la liste COMPLÈTE, ancienne + X ;
- masquer un module le retire pour TOUT LE MONDE, menu et adresse comprises. Dis-le avant de le proposer.
Ne dis JAMAIS « je ne peux pas modifier les paramètres » — ces outils existent.
` : ""}
CONTEXTE :
${buildContext(user)}${powers}

CE QUE TU PEUX FAIRE :
- Répondre aux questions sur le travail de l'utilisateur et sur l'application (modules, démarches, statuts).
- Consulter et résumer ses E-MAILS (sa propre boîte connectée dans Courrier) via list_emails / read_email,
  et chercher un message précis. Tu peux résumer la boîte, repérer ce qui demande une réponse, retrouver un
  mail d'un expéditeur, etc. — toujours UNIQUEMENT sa boîte à lui.
- LIRE LES PIÈCES JOINTES fournies par l'utilisateur (Excel complet, PowerPoint, Word, PDF, CSV, texte…) :
  quand un message contient une section « Contenu des pièces jointes fournies », APPUIE-TOI directement sur
  ce contenu pour répondre — résumer, extraire ou recalculer des chiffres d'un tableur, synthétiser une
  présentation, comparer des documents. Si une pièce est signalée non lisible (scan sans OCR, format hérité),
  dis-le simplement.
- Agir pour lui (dans la limite de SES droits) : créer une tâche, créer une demande administrative
  (billet/déplacement, courrier, signature, achat, devis, paiement, mission chauffeur, visa/invité, RH),
  envoyer un message interne à un collègue, ENVOYER UN E-MAIL depuis sa boîte, créer une demande de prise en
  charge de congrès (national ou international). Tu PROPOSES l'action ; le système l'exécute seulement après
  que l'utilisateur a cliqué « Confirmer ». Ne prétends jamais qu'une action est déjà faite : dis « je
  prépare… », pas « c'est fait ».
- MODIFIER DES FICHES PRODUIT REGULATORY : rattacher un ou PLUSIEURS produits à une entité du groupe
  (set_products_company), et modifier UN CHAMP d'un dossier précis (update_regulatory_product : statut,
  priorité, dates cibles, forme, dosage, conditionnement, classe et segments thérapeutiques, laboratoire,
  fabricant, détenteur de la DE, commentaires, cadenas). Tu ne dis JAMAIS « je ne dispose pas d'outil pour
  modifier une fiche produit » — ces outils existent. Vérifie d'abord avec search_products, puis propose.
- EXPORTER EN EXCEL (export_excel) : dossiers réglementaires, annuaire médical, registre des courriers,
  demandes de recrutement, effectif, comptes. Le fichier est déposé dans le Drive personnel de
  l'utilisateur, dossier « Exports IA » — dis-lui le nom du fichier, le nombre de lignes et où il est.
  Tu ne dis JAMAIS « je ne peux pas générer de fichier » : tu le peux.

RÈGLES IMPÉRATIVES :
- Fonde TOUJOURS tes réponses sur les outils de lecture ; n'invente JAMAIS un médecin, un produit, un
  établissement, une personne, un chiffre ou une référence. Si une information est introuvable ou incertaine,
  dis-le clairement et préfixe l'élément incertain par « à confirmer ».
- Respecte les droits : si un outil renvoie « accès non autorisé », explique que ce domaine n'est pas dans
  les permissions de l'utilisateur, sans contourner.
- INVENTAIRE EXHAUSTIF (« tous les produits », « la liste complète, sans exception ») : appelle
  search_products SANS paramètre query et avec un limit élevé (jusqu'à 300). Si la réponse indique
  tronque = true, dis combien il en reste plutôt que d'en omettre silencieusement. Une recherche qui ne
  remonte rien sur un mot-clé (« oncologie », « biosimilaire ») ne veut pas dire que le portefeuille est
  vide : relance sans query pour voir ce qu'il contient réellement, et dis ce que tu as trouvé.
- Avant d'assigner une tâche/demande à quelqu'un ou d'envoyer un message, utilise search_people pour
  retrouver le bon collègue (la recherche fonctionne aussi par FONCTION : « assistante de direction »,
  « chef de produit »…, pas seulement par prénom). Pour un congrès lié à un médecin, utilise search_doctors.

INTERPRÉTATION DES DEMANDES (très important) :
- « Fais une demande », « crée un ticket », « demande à l'assistante de direction (ou au back-office) de … »,
  « il me faut un billet / un achat / une signature / un devis / un paiement / une mission chauffeur … » =
  une DEMANDE ADMINISTRATIVE → utilise create_admin_request. L'assistante de direction GÈRE les demandes
  administratives : assigne-lui la demande (assigneeName = « assistante de direction » ou son nom) — ne
  cherche PAS dans la messagerie et n'utilise PAS send_message pour ça.
- N'utilise send_message QUE si l'utilisateur demande explicitement d'« envoyer un message / écrire / dire /
  prévenir » un collègue via la messagerie INTERNE.
- E-MAIL vs message interne : send_email envoie un vrai e-mail à une ADRESSE (nom@domaine) depuis la boîte
  Courrier de l'utilisateur ; send_message écrit à un collègue dans la messagerie interne. Pour « envoie un
  mail à … », utilise send_email ; si tu n'as pas l'adresse (ex. « réponds à ce mail »), lis d'abord le
  message avec read_email pour récupérer l'adresse de l'expéditeur. Ne devine jamais une adresse e-mail.
- DATES — sois prudent : la date du jour est indiquée dans le contexte. Quand une date demandée est DÉJÀ
  PASSÉE (antérieure à aujourd'hui), SIGNALE-LE clairement dans ta réponse et demande à l'utilisateur de
  confirmer ou de corriger AVANT de proposer l'action. Renseigne toujours les dates au format AAAA-MM-JJ
  dans les champs prévus (startDate/endDate) pour qu'elles soient vérifiées.
- Pour un billet (ex. « billet pour le Pr X, Alger → Paris du 10 au 15 janvier »), utilise
  create_admin_request type=TRAVEL : titre court, description (passager, trajet) et startDate/endDate.
- Pour tout sujet qualité ou pharmacovigilance, reste prudent et demande confirmation renforcée à l'humain ;
  ne crée rien automatiquement.
${regExpertise}
STYLE DE RÉPONSE — IMPÉRATIF :
- Écris en TEXTE SIMPLE, lisible, SANS Markdown : PAS d'astérisques (** ou *), PAS de dièses (#), PAS de
  tableaux, PAS de balises de code. Pour mettre en avant, écris normalement ; pour une liste, utilise des
  tirets « - » en début de ligne. Les emojis sobres sont autorisés.
- Sois concret, professionnel et bref. Réponds en français. Les montants sont en DZD.`;
}

// ───────────────────────────── Exécuteurs d'outils de lecture ─────────────────────────────

function asStr(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Un nombre venu du modèle — `null` s'il n'en a pas donné, ou s'il a écrit autre chose. */
function asNum(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

interface PersonMatch { id: string; name: string; title: string | null; department: string | null; role: string }

async function findPeople(query: string, limit = 8): Promise<PersonMatch[]> {
  const q = query.trim();
  if (!q) return [];
  // Recherche par NOM **ou par FONCTION** (title) : « l'assistante de direction »,
  // « le chef de produit »… se résolvent par leur intitulé de poste, pas seulement
  // par leur prénom.
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ name: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
    select: { id: true, name: true, title: true, role: true, department: { select: { name: true } } },
    take: limit,
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name, title: u.title, department: u.department?.name ?? null, role: u.role }));
}

/** Résout un nom OU une fonction en un utilisateur unique pour l'assignation. */
async function resolvePerson(query: string): Promise<{ id: string; name: string } | { ambiguous: PersonMatch[] } | null> {
  const q = query.trim().toLowerCase();
  const matches = await findPeople(query, 8);
  if (matches.length === 0) return null;
  // Correspondance exacte sur le nom ou la fonction → prioritaire.
  const exact = matches.filter((m) => m.name.toLowerCase() === q || (m.title ?? "").toLowerCase() === q);
  if (exact.length === 1) return { id: exact[0].id, name: exact[0].name };
  if (matches.length === 1) return { id: matches[0].id, name: matches[0].name };
  return { ambiguous: matches };
}

export async function executeReadTool(name: string, input: Record<string, unknown>, user: CurrentUser): Promise<string> {
  // Outils de POUVOIR (budget, finances, RH, file de décisions) : le droit est revérifié
  // à l'exécution — la liste envoyée au modèle est une suggestion, pas une autorisation.
  const power = await executePowerTool(name, input, user);
  if (power !== null) return power;

  switch (name) {
    case "search_people": {
      const people = await findPeople(asStr(input, "query"));
      if (people.length === 0) return "Aucun collègue trouvé pour cette recherche.";
      return JSON.stringify(people.map((p) => ({ id: p.id, nom: p.name, fonction: p.title, departement: p.department, role: ROLE_LABELS[p.role] ?? p.role })));
    }
    case "my_overview": {
      const [openTasks, openRequests, unread] = await Promise.all([
        prisma.task.count({ where: { assignedToId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } } }),
        prisma.administrativeRequest.count({ where: { AND: [scopeAdminRequests(user), { status: { notIn: ["DONE", "CANCELLED"] } }] } }),
        prisma.notification.count({ where: { userId: user.id, isRead: false } }),
      ]);
      const mods = accessibleModules(user).map((m) => MODULE_FR[m]).filter(Boolean);
      return JSON.stringify({ tachesOuvertes: openTasks, demandesEnCours: openRequests, notificationsNonLues: unread, modulesAccessibles: mods });
    }
    case "list_my_tasks": {
      const includeDone = input.includeDone === true;
      const tasks = await prisma.task.findMany({
        where: {
          OR: [{ assignedToId: user.id }, { createdById: user.id }],
          ...(includeDone ? {} : { status: { in: ["TODO", "IN_PROGRESS"] } }),
        },
        select: { title: true, status: true, priority: true, dueDate: true, assignedTo: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 20,
      });
      if (tasks.length === 0) return "Aucune tâche.";
      return JSON.stringify(tasks.map((t) => ({
        titre: t.title, statut: TASK_STATUS[t.status]?.label ?? t.status, priorite: PRIORITY[t.priority]?.label ?? t.priority,
        echeance: t.dueDate?.toISOString().slice(0, 10) ?? null, assigneA: t.assignedTo?.name ?? null,
      })));
    }
    case "list_my_requests": {
      const reqs = await prisma.administrativeRequest.findMany({
        where: scopeAdminRequests(user),
        select: { reference: true, title: true, type: true, status: true, assignedTo: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      if (reqs.length === 0) return "Aucune demande administrative.";
      return JSON.stringify(reqs.map((r) => ({
        reference: r.reference, titre: r.title, type: ADMIN_REQUEST_TYPE[r.type] ?? r.type,
        statut: ADMIN_REQUEST_STATUS[r.status]?.label ?? r.status, responsable: r.assignedTo?.name ?? null,
      })));
    }
    case "search_doctors": {
      if (!userCan(user, "MEDICAL", "VIEW")) return "Accès non autorisé au module Annuaire.";
      const q = asStr(input, "query");
      const doctors = await prisma.medicalDoctor.findMany({
        where: {
          AND: [
            scopeMedicalDoctors(user),
            q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { specialty: { contains: q, mode: "insensitive" } }, { institution: { contains: q, mode: "insensitive" } }] } : {},
          ],
        },
        select: { name: true, title: true, specialty: true, sector: true, institution: true, city: true, influenceLevel: true },
        take: 12, orderBy: { name: "asc" },
      });
      if (doctors.length === 0) return "Aucun médecin trouvé (ne pas inventer : signaler à l'utilisateur que le médecin est introuvable dans son périmètre).";
      return JSON.stringify(doctors.map((d) => ({
        nom: doctorDisplayName(d), specialite: d.specialty ?? null, secteur: MEDICAL_SECTOR[d.sector]?.label ?? d.sector,
        etablissement: d.institution ?? null, ville: d.city ?? null, influence: INFLUENCE_LEVEL[d.influenceLevel]?.label ?? d.influenceLevel,
      })));
    }
    case "search_products": {
      if (!userCan(user, "REGULATORY", "VIEW")) return "Accès non autorisé au module Regulatory.";
      const q = asStr(input, "query");
      // Un inventaire complet doit être possible : « donne-moi tous les produits » échouait
      // parce que la recherche s'arrêtait à 12 lignes et ne regardait que DCI / nom / référence.
      const rawLimit = Number(input.limit);
      const take = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40, 1), 300);
      const category = asStr(input, "category");
      const withoutCompany = input.withoutCompany === true;

      const like = (field: string) => ({ [field]: { contains: q, mode: "insensitive" as const } });
      const products = await prisma.regulatoryProduct.findMany({
        where: {
          AND: [
            scopeRegulatory(user),
            // La classe thérapeutique porte « oncologie », « biosimilaire », « anticorps
            // monoclonal » : sans elle, ces recherches ne remontaient rien.
            q
              ? {
                  OR: [
                    like("dci"), like("brandName"), like("reference"), like("therapeuticClass"),
                    like("pharmaceuticalForm"), like("partnerLab"), like("countryOfOrigin"),
                    { company: { is: { name: { contains: q, mode: "insensitive" } } } },
                    { company: { is: { shortName: { contains: q, mode: "insensitive" } } } },
                  ],
                }
              : {},
            category === "MEDICINE" || category === "MEDICAL_DEVICE" ? { category } : {},
            withoutCompany ? { companyId: null } : {},
          ],
        },
        select: {
          reference: true, dci: true, brandName: true, status: true, therapeuticClass: true,
          category: true, companyId: true, company: { select: { name: true, shortName: true } },
        },
        take, orderBy: { createdAt: "desc" },
      });
      const total = await prisma.regulatoryProduct.count({ where: { AND: [scopeRegulatory(user)] } }).catch(() => products.length);
      if (products.length === 0) {
        return `Aucun produit ne correspond${q ? ` à « ${q} »` : ""}. Le portefeuille compte ${total} produit(s) au total (ne pas inventer).`;
      }
      return JSON.stringify({
        total_portefeuille: total,
        renvoyes: products.length,
        tronque: products.length >= take,
        produits: products.map((p) => ({
          reference: p.reference, dci: p.dci, nomCommercial: p.brandName ?? null,
          classeTherapeutique: p.therapeuticClass ?? null,
          categorie: p.category,
          entite: p.company?.shortName ?? p.company?.name ?? null,
          statut: REGULATORY_STATUS[p.status]?.label ?? p.status,
        })),
      });
    }
    case "search_events": {
      if (!userCan(user, "EVENTS", "VIEW")) return "Accès non autorisé au module Events.";
      const q = asStr(input, "query");
      const events = await prisma.event.findMany({
        where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {},
        select: { name: true, type: true, status: true, startDate: true, city: true, _count: { select: { registrations: true } } },
        take: 12, orderBy: { startDate: "desc" },
      });
      if (events.length === 0) return "Aucun événement trouvé.";
      return JSON.stringify(events.map((e) => ({
        nom: e.name, type: EVENT_TYPE[e.type] ?? e.type, statut: EVENT_STATUS[e.status]?.label ?? e.status,
        date: e.startDate?.toISOString().slice(0, 10) ?? null, ville: e.city ?? null, inscrits: e._count.registrations,
      })));
    }
    case "list_emails": {
      const account = await getMailAccount(user.id);
      if (!account) return "Aucune boîte mail connectée. L'utilisateur peut connecter sa boîte dans le module Courrier.";
      const limit = Math.min(typeof input.limit === "number" ? input.limit : 15, 30);
      try {
        const msgs = await listMessages(account, "INBOX", limit);
        if (msgs.length === 0) return "Boîte de réception vide.";
        return JSON.stringify(msgs.map((m) => ({
          uid: m.uid, de: m.from || m.fromAddr, adresse: m.fromAddr, objet: m.subject,
          date: m.date ? m.date.slice(0, 16).replace("T", " ") : null, lu: m.seen,
        })));
      } catch (e) {
        return `Impossible de lire la boîte mail : ${(e as Error)?.message ?? "erreur de connexion"}.`;
      }
    }
    case "read_email": {
      const account = await getMailAccount(user.id);
      if (!account) return "Aucune boîte mail connectée.";
      const uid = typeof input.uid === "number" ? input.uid : Number(asStr(input, "uid"));
      if (!Number.isFinite(uid)) return "uid manquant ou invalide (l'obtenir d'abord via list_emails).";
      try {
        const msg = await getMessage(account, "INBOX", uid);
        if (!msg) return "E-mail introuvable.";
        const content = (msg.text || (msg.html ? msg.html.replace(/<[^>]+>/g, " ") : "") || "").replace(/\s+/g, " ").trim().slice(0, 4000);
        return JSON.stringify({
          de: msg.from || msg.fromAddr, adresse: msg.fromAddr, a: msg.to, objet: msg.subject,
          date: msg.date, contenu: content, piecesJointes: msg.attachments.map((a) => a.filename),
        });
      } catch (e) {
        return `Impossible de lire l'e-mail : ${(e as Error)?.message ?? "erreur de connexion"}.`;
      }
    }
    case "list_accounts": {
      if (user.role !== "SUPER_ADMIN") return "Accès réservé au Super Admin.";
      const q = asStr(input, "query");
      const [users, openTasks, openReqs] = await Promise.all([
        prisma.user.findMany({
          where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } : {},
          select: { id: true, name: true, role: true, title: true, isActive: true },
          orderBy: { name: "asc" }, take: 100,
        }),
        prisma.task.groupBy({ by: ["assignedToId"], where: { status: { in: ["TODO", "IN_PROGRESS"] } }, _count: true }),
        prisma.administrativeRequest.groupBy({ by: ["assignedToId"], where: { status: { notIn: ["DONE", "CANCELLED"] } }, _count: true }),
      ]);
      const taskMap = new Map(openTasks.map((t) => [t.assignedToId, t._count]));
      const reqMap = new Map(openReqs.map((r) => [r.assignedToId, r._count]));
      if (users.length === 0) return "Aucun compte trouvé.";
      return JSON.stringify(users.map((u) => ({
        nom: u.name, fonction: u.title ?? (ROLE_LABELS[u.role] ?? u.role), role: ROLE_LABELS[u.role] ?? u.role,
        actif: u.isActive, tachesOuvertes: taskMap.get(u.id) ?? 0, demandesACharge: reqMap.get(u.id) ?? 0,
      })));
    }
    case "read_platform_settings": {
      if (user.role !== "SUPER_ADMIN") return "Accès réservé au Super Admin.";
      const s = await getAppSettings();
      // On rend les LIBELLÉS en plus des codes : sans eux, le modèle propose « HEAD_OF_REGULATORY »
      // à un humain qui a dit « le responsable réglementaire », et la carte de confirmation
      // devient illisible.
      return JSON.stringify({
        reglages: s,
        libellesRoles: ROLE_LABELS,
        modifiables: WRITABLE_SETTINGS.map((w) => ({ cle: w.key, libelle: w.label, type: w.kind, apropos: w.hint })),
      });
    }
    case "export_excel": {
      const dataset = asStr(input, "dataset");
      if (!isExportDataset(dataset)) {
        return `Jeu de données inconnu. Disponibles : ${Object.keys(DATASETS).join(", ")}.`;
      }
      const r = await exportDatasetToDrive(user, dataset, { limit: asNum(input, "limit") ?? undefined });
      if (!r.ok) return r.error ?? "Export impossible.";
      await recordAudit({
        actorId: user.id, action: "EXPORT", module: "Assistant IA",
        summary: `Export « ${DATASETS[dataset].label} » (${r.count} ligne(s)) via l'assistant → Drive / ${r.filename}`,
      });
      return JSON.stringify({
        fichier: r.filename, lignes: r.count,
        emplacement: "Drive personnel, dossier « Exports IA »",
        lien: `/drive/${r.nodeId}`,
      });
    }
    default:
      return `Outil inconnu : ${name}.`;
  }
}

const READ_LABEL: Record<string, string> = {
  ...powerToolLabels(),
  search_people: "Annuaire interne consulté",
  my_overview: "Espace de travail consulté",
  list_my_tasks: "Tâches consultées",
  list_my_requests: "Demandes administratives consultées",
  search_doctors: "Annuaire médical consulté",
  search_products: "Produits Regulatory consultés",
  search_events: "Événements consultés",
  list_emails: "Boîte mail consultée",
  read_email: "E-mail lu",
  list_accounts: "Tous les comptes consultés",
  read_platform_settings: "Réglages de la plateforme consultés",
  export_excel: "Classeur Excel généré",
};

/**
 * Le filtre d'un rattachement en masse — **partagé** entre l'aperçu et l'exécution.
 *
 * C'est le cœur de la garantie : la confirmation montre le résultat de CE filtre, et
 * l'exécution le rejoue. Deux filtres écrits séparément finiraient par diverger, et on
 * modifierait autre chose que ce qui a été montré.
 *
 * `excludeCompanyId` retire ceux qui sont déjà dans l'entité visée : les compter reviendrait à
 * annoncer un travail déjà fait.
 */
function productBulkWhere(
  user: CurrentUser,
  f: { query?: string | null; category?: string | null; onlyWithoutCompany?: boolean; excludeCompanyId?: string },
) {
  const q = (f.query ?? "").trim();
  const like = (field: string) => ({ [field]: { contains: q, mode: "insensitive" as const } });
  // `category` arrive du modèle en `string` : on ne le transmet à Prisma qu'après l'avoir
  // reconnu comme une valeur d'énumération réelle — sinon on filtre sur une valeur inventée.
  const cat: RegulatoryCategory | null =
    f.category === "MEDICINE" || f.category === "MEDICAL_DEVICE" ? f.category : null;
  return {
    AND: [
      scopeRegulatory(user),
      q
        ? {
            OR: [
              like("dci"), like("brandName"), like("reference"), like("therapeuticClass"),
              like("pharmaceuticalForm"), like("partnerLab"),
            ],
          }
        : {},
      cat ? { category: cat } : {},
      f.onlyWithoutCompany ? { companyId: null } : {},
      f.excludeCompanyId ? { NOT: { companyId: f.excludeCompanyId } } : {},
    ],
  };
}

// ───────────────────────────── Construction d'une action proposée ─────────────────────────────

function normPriority(p: string): Priority | null {
  const up = p.toUpperCase();
  return (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).includes(up as Priority) ? (up as Priority) : null;
}

function isoDate(s: string): string | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ajoute un avertissement si une date ISO (AAAA-MM-JJ) est déjà passée. */
function pastWarning(label: string, iso: string | null, warnings: string[]): void {
  if (iso && iso < todayIso()) warnings.push(`${label} (${iso}) est déjà passée — à confirmer ou corriger avant d'envoyer.`);
}

/** Résout un médecin unique dans le périmètre de l'utilisateur (jamais inventé). */
async function findDoctor(query: string, user: CurrentUser): Promise<{ id: string; name: string } | null> {
  const q = query.trim();
  if (!q || !userCan(user, "MEDICAL", "VIEW")) return null;
  const d = await prisma.medicalDoctor.findFirst({
    where: { AND: [scopeMedicalDoctors(user), { name: { contains: q, mode: "insensitive" } }] },
    select: { id: true, name: true, title: true },
  });
  return d ? { id: d.id, name: doctorDisplayName(d) } : null;
}

export async function buildProposal(toolName: string, input: Record<string, unknown>, user: CurrentUser): Promise<ProposedAction | { error: string }> {
  const warnings: string[] = [];

  /** Résout un nom d'assignation et alimente les avertissements. */
  async function resolve(label: string, raw: string): Promise<{ id: string | null; name: string | null }> {
    const name = raw.trim();
    if (!name) return { id: null, name: null };
    const r = await resolvePerson(name);
    if (!r) {
      warnings.push(`${label} « ${name} » introuvable dans l'annuaire — à préciser.`);
      return { id: null, name };
    }
    if ("ambiguous" in r) {
      warnings.push(`Plusieurs « ${name} » : ${r.ambiguous.map((m) => m.name).join(", ")}. À préciser.`);
      return { id: null, name };
    }
    return { id: r.id, name: r.name };
  }

  if (toolName === "update_regulatory_product") {
    if (!userCan(user, "REGULATORY", "UPDATE")) {
      return { error: "Vous n'avez pas le droit de modifier les dossiers Regulatory." };
    }
    const reference = asStr(input, "reference");
    const field = asStr(input, "field");
    if (!reference) return { error: "Précisez la référence du dossier (REG-AAAA-NNN)." };

    const spec = regFieldSpec(field);
    if (!spec) {
      return { error: `Champ « ${field } » inconnu ou non modifiable par l'assistant.` };
    }
    const parsed = parseRegFieldValue(field, input.value);
    if (!parsed.ok) return { error: parsed.error };

    // Le dossier est cherché DANS LE PÉRIMÈTRE de la personne : deviner une référence ne doit
    // pas permettre de modifier le portefeuille d'une autre entité.
    const product = await prisma.regulatoryProduct.findFirst({
      where: { AND: [{ reference }, scopeRegulatory(user), await currentCompanyWhereFor(user.id)] },
      select: { id: true, reference: true, dci: true, ...({ [field]: true } as Record<string, true>) },
    }) as (Record<string, unknown> & { id: string; reference: string; dci: string }) | null;
    if (!product) {
      return { error: `Dossier « ${reference} » introuvable dans votre périmètre. Vérifiez la référence avec search_products.` };
    }

    const before = renderSettingValue(product[field]);
    const after = renderSettingValue(parsed.value instanceof Date ? parsed.value.toISOString().slice(0, 10) : parsed.value);
    if (before === after) return { error: `« ${spec.label} » vaut déjà ${after || "(vide)"} sur ${reference}.` };
    if (spec.warning) warnings.push(spec.warning);

    return {
      kind: "update_regulatory_product",
      module: "REGULATORY",
      title: `modifier ${spec.label.toLowerCase()} sur ${reference}`,
      fields: [
        { label: "Dossier", value: `${reference} — ${product.dci}` },
        { label: spec.label, value: `${before || "(vide)"} → ${after || "(vide)"}` },
      ],
      warnings,
      payload: {
        kind: "update_regulatory_product",
        productId: product.id, reference: product.reference,
        field, fieldLabel: spec.label,
        value: parsed.value, before, after,
      },
    };
  }

  if (toolName === "update_platform_setting") {
    // Les réglages gouvernent la plateforme entière : ils restent au Super Admin, exactement
    // comme la console d'administration d'où ils se règlent autrement.
    if (user.role !== "SUPER_ADMIN") return { error: "Les réglages de la plateforme sont réservés au Super Admin." };
    const key = asStr(input, "key");
    const spec = settingSpec(key);
    if (!spec) {
      return { error: `Réglage « ${key} » inconnu. Réglages modifiables : ${WRITABLE_SETTINGS.map((w) => `${w.key} (${w.label})`).join(", ")}.` };
    }
    const parsed = parseSettingValue(key, input.value, {
      roleLabels: ROLE_LABELS,
      moduleLabels: MODULE_LABELS as Record<string, string>,
    });
    if (!parsed.ok) return { error: parsed.error };

    const current = (await getAppSettings()) as unknown as Record<string, unknown>;
    const labels = spec.kind === "roles" ? ROLE_LABELS : spec.kind === "modules" ? (MODULE_LABELS as Record<string, string>) : {};
    const before = renderSettingValue(current[key], labels);
    const after = renderSettingValue(parsed.value, labels);
    if (before === after) return { error: `« ${spec.label} » vaut déjà ${after}.` };
    if (spec.warning) warnings.push(spec.warning);
    // Une liste REMPLACE : le dire, parce que « ajoute la Direction » et « mets la Direction »
    // s'écrivent pareil dans une conversation et ne veulent pas dire la même chose.
    if (Array.isArray(parsed.value)) warnings.push("Cette liste REMPLACE l'ancienne — elle ne s'y ajoute pas.");

    return {
      kind: "update_platform_setting",
      module: "ADMIN",
      level: "SENSITIVE",
      title: `modifier le réglage « ${spec.label} »`,
      fields: [
        { label: spec.label, value: `${before} → ${after}` },
        { label: "À propos", value: spec.hint },
      ],
      warnings,
      payload: {
        kind: "update_platform_setting",
        settingKey: key, settingLabel: spec.label,
        value: parsed.value, before, after,
      },
    };
  }

  if (toolName === "set_products_company") {
    // Écrire sur les dossiers réglementaires exige le droit de les MODIFIER, pas de les lire.
    if (!userCan(user, "REGULATORY", "UPDATE")) {
      return { error: "Vous n'avez pas le droit de modifier les dossiers Regulatory." };
    }
    const companyName = asStr(input, "companyName");
    if (!companyName) return { error: "Précisez l'entité de destination." };

    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true },
    });
    const needle = companyName.trim().toLowerCase();
    const matches = companies.filter(
      (c) => c.name.toLowerCase().includes(needle) || (c.shortName ?? "").toLowerCase().includes(needle),
    );
    if (matches.length === 0) {
      return { error: `Entité « ${companyName} » introuvable. Entités actives : ${companies.map((c) => c.shortName || c.name).join(", ") || "aucune"}.` };
    }
    if (matches.length > 1) {
      return { error: `Plusieurs entités correspondent à « ${companyName} » : ${matches.map((c) => c.name).join(", ")}. Précisez laquelle.` };
    }
    const company = matches[0];

    const query = asStr(input, "query");
    const category = asStr(input, "category");
    const onlyWithoutCompany = input.onlyWithoutCompany === true;
    const where = productBulkWhere(user, { query, category, onlyWithoutCompany, excludeCompanyId: company.id });

    const affected = await prisma.regulatoryProduct.findMany({
      where, select: { reference: true, dci: true, brandName: true }, orderBy: { reference: "asc" }, take: 400,
    });
    if (affected.length === 0) {
      return { error: `Aucun produit à rattacher : soit le filtre ne remonte rien, soit tous sont déjà rattachés à ${company.name}.` };
    }
    // La confirmation montre CE QUI change, pas un nombre : rattacher trente dossiers
    // réglementaires à la mauvaise entité se répare mal.
    const preview = affected.slice(0, 25).map((p) => `${p.reference} — ${p.brandName || p.dci}`);
    if (affected.length > preview.length) preview.push(`… et ${affected.length - preview.length} autre(s)`);
    if (affected.length >= 400) {
      warnings.push("Plus de 400 produits concernés : seuls les 400 premiers seront traités. Affinez le filtre.");
    }

    const fields = [
      { label: "Entité de destination", value: company.name },
      { label: "Produits concernés", value: String(affected.length) },
      { label: "Filtre", value: [query ? `« ${query} »` : "tout le portefeuille", category || null, onlyWithoutCompany ? "sans entité seulement" : null].filter(Boolean).join(" · ") },
      { label: "Détail", value: preview.join(" · ") },
    ];

    return {
      kind: "set_products_company",
      module: "REGULATORY",
      title: `Rattacher ${affected.length} produit(s) à l'entité ${company.shortName || company.name}`,
      fields,
      warnings,
      payload: {
        kind: "set_products_company",
        companyId: company.id,
        companyName: company.shortName || company.name,
        query: query || null,
        category: category || null,
        onlyWithoutCompany,
        references: affected.map((p) => p.reference),
      },
    };
  }

  if (toolName === "create_task") {
    const title = asStr(input, "title");
    if (!title) return { error: "Intitulé de tâche manquant." };
    const assignee = await resolve("Destinataire", asStr(input, "assigneeName"));
    const due = asStr(input, "dueDate") ? isoDate(asStr(input, "dueDate")) : null;
    const priority = asStr(input, "priority") ? normPriority(asStr(input, "priority")) : null;
    const fields = [
      { label: "Tâche", value: title },
      { label: "Assignée à", value: assignee.name ?? `${user.name} (vous)` },
    ];
    if (asStr(input, "description")) fields.push({ label: "Détails", value: asStr(input, "description") });
    if (due) fields.push({ label: "Échéance", value: due });
    if (priority) fields.push({ label: "Priorité", value: PRIORITY[priority]?.label ?? priority });
    return {
      kind: "create_task", module: "WORKSPACE", title: "Créer une tâche", fields, warnings,
      payload: {
        kind: "create_task", title, description: asStr(input, "description") || null,
        assigneeId: assignee.id, assigneeName: assignee.name, dueDate: due, priority,
      },
    };
  }

  if (toolName === "create_dossier") {
    const title = asStr(input, "title");
    if (!title) return { error: "Sujet du dossier manquant." };
    const assignee = await resolve("Responsable", asStr(input, "assigneeName"));
    const due = asStr(input, "dueDate") ? isoDate(asStr(input, "dueDate")) : null;
    const priority = asStr(input, "priority") ? normPriority(asStr(input, "priority")) : null;
    const category = asStr(input, "category") || null;
    const fields = [{ label: "Dossier", value: title }];
    if (category) fields.push({ label: "Catégorie", value: category });
    fields.push({ label: "Responsable", value: assignee.name ?? "à assigner" });
    if (asStr(input, "description")) fields.push({ label: "Brief", value: asStr(input, "description") });
    if (due) fields.push({ label: "Échéance", value: due });
    if (priority) fields.push({ label: "Priorité", value: PRIORITY[priority]?.label ?? priority });
    return {
      kind: "create_dossier", module: "DOSSIERS", title: "Ouvrir un projet", fields, warnings,
      payload: {
        kind: "create_dossier", title, description: asStr(input, "description") || null, category,
        assigneeId: assignee.id, assigneeName: assignee.name, priority, dueDate: due,
      },
    };
  }

  if (toolName === "create_admin_request") {
    const type = asStr(input, "type").toUpperCase();
    const validTypes = ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"];
    const title = asStr(input, "title");
    if (!validTypes.includes(type)) return { error: "Type de demande invalide." };
    if (!title) return { error: "Titre de demande manquant." };
    const assignee = await resolve("Responsable", asStr(input, "assigneeName"));
    const concerned = await resolve("Personne concernée", asStr(input, "concernedName"));
    const startDate = asStr(input, "startDate") ? isoDate(asStr(input, "startDate")) : null;
    const endDate = asStr(input, "endDate") ? isoDate(asStr(input, "endDate")) : null;
    const deadline = asStr(input, "deadline") ? isoDate(asStr(input, "deadline")) : null;
    const priority = asStr(input, "priority") ? normPriority(asStr(input, "priority")) : null;
    pastWarning("La date de début", startDate, warnings);
    pastWarning("La date de fin", endDate, warnings);
    pastWarning("L'échéance", deadline, warnings);
    const fields = [
      { label: "Type", value: ADMIN_REQUEST_TYPE[type] ?? type },
      { label: "Objet", value: title },
    ];
    if (asStr(input, "description")) fields.push({ label: "Détails", value: asStr(input, "description") });
    if (assignee.name) fields.push({ label: "À traiter par", value: assignee.name });
    if (concerned.name) fields.push({ label: "Concerne", value: concerned.name });
    if (startDate || endDate) fields.push({ label: "Dates", value: [startDate, endDate].filter(Boolean).join(" → ") });
    if (deadline) fields.push({ label: "Échéance", value: deadline });
    if (priority) fields.push({ label: "Priorité", value: PRIORITY[priority]?.label ?? priority });
    return {
      kind: "create_admin_request", module: "ADMIN_REQUESTS", title: "Créer une demande administrative", fields, warnings,
      payload: {
        kind: "create_admin_request", type, title, description: asStr(input, "description") || null,
        assigneeId: assignee.id, assigneeName: assignee.name, concernedId: concerned.id, concernedName: concerned.name,
        deadline, startDate, endDate, priority,
      },
    };
  }

  if (toolName === "send_message") {
    if (!userCan(user, "MESSAGING", "VIEW")) return { error: "Vous n'avez pas accès à la messagerie." };
    const body = asStr(input, "body");
    if (!body) return { error: "Le message est vide." };
    const recipient = await resolve("Destinataire", asStr(input, "recipientName"));
    if (!recipient.id) return { error: `Destinataire « ${asStr(input, "recipientName")} » introuvable ou ambigu — précisez le bon collègue (search_people).` };
    return {
      kind: "send_message", module: "MESSAGING", title: "Envoyer un message", warnings,
      fields: [
        { label: "À", value: recipient.name ?? "" },
        { label: "Message", value: body },
      ],
      payload: { kind: "send_message", recipientId: recipient.id, recipientName: recipient.name, body },
    };
  }

  if (toolName === "send_email") {
    const to = asStr(input, "to");
    const subject = asStr(input, "subject");
    const body = asStr(input, "body");
    const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
    if (!to || !isEmail(to)) return { error: "Adresse e-mail du destinataire manquante ou invalide." };
    if (!body) return { error: "Le corps de l'e-mail est vide." };
    const cc = asStr(input, "cc");
    if (cc && !cc.split(",").every((p) => isEmail(p.trim()))) return { error: "Adresse(s) en copie invalide(s)." };
    const account = await getMailAccount(user.id);
    if (!account) warnings.push(`Aucune boîte mail n'est connectée pour ${user.name}. Ouvrez « Courrier » et connectez votre boîte (une seule fois) ; l'envoi se fera depuis votre propre adresse.`);
    const fields = [
      { label: "De", value: account?.email ?? `${user.name} — boîte à connecter dans Courrier` },
      { label: "À", value: to },
    ];
    if (cc) fields.push({ label: "Cc", value: cc });
    fields.push({ label: "Objet", value: subject || "(sans objet)" });
    fields.push({ label: "Message", value: body });
    return {
      kind: "send_email", module: "WORKSPACE", title: "Envoyer un e-mail", fields, warnings,
      payload: { kind: "send_email", to, cc: cc || null, subject, body },
    };
  }

  if (toolName === "create_congress_request") {
    const scope = asStr(input, "scope").toUpperCase() === "INTL" ? "INTL" : "NATIONAL";
    const mod: Module = scope === "INTL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL";
    if (!userCan(user, mod, "CREATE")) return { error: `Vous n'avez pas accès aux demandes de congrès ${scope === "INTL" ? "internationaux" : "nationaux"}.` };
    const name = asStr(input, "name");
    if (!name) return { error: "Nom de l'événement manquant." };
    const startDate = asStr(input, "startDate") ? isoDate(asStr(input, "startDate")) : null;
    const endDate = asStr(input, "endDate") ? isoDate(asStr(input, "endDate")) : null;
    pastWarning("La date de début", startDate, warnings);
    pastWarning("La date de fin", endDate, warnings);
    const budgetRaw = input.estimatedBudget;
    const estimatedBudget = typeof budgetRaw === "number" && Number.isFinite(budgetRaw) ? budgetRaw : null;
    let doctorId: string | null = null, doctorName: string | null = null;
    const doctorQuery = asStr(input, "doctorName");
    if (doctorQuery) {
      const d = await findDoctor(doctorQuery, user);
      if (d) { doctorId = d.id; doctorName = d.name; }
      else warnings.push(`Médecin « ${doctorQuery} » introuvable dans votre périmètre — la demande sera créée sans médecin lié.`);
    }
    const fields = [
      { label: "Type", value: scope === "INTL" ? "Prise en charge Internationale" : "Congrès / événement national" },
      { label: "Événement", value: name },
    ];
    if (asStr(input, "specialty")) fields.push({ label: "Spécialité", value: asStr(input, "specialty") });
    const place = [asStr(input, "city"), scope === "INTL" ? asStr(input, "country") : ""].filter(Boolean).join(", ");
    if (place) fields.push({ label: "Lieu", value: place });
    if (startDate || endDate) fields.push({ label: "Dates", value: [startDate, endDate].filter(Boolean).join(" → ") });
    if (doctorName) fields.push({ label: "Médecin", value: doctorName });
    if (estimatedBudget !== null) fields.push({ label: "Budget estimé", value: `${estimatedBudget.toLocaleString("fr-FR")} DZD` });
    if (asStr(input, "note")) fields.push({ label: "Note", value: asStr(input, "note") });
    return {
      kind: "create_congress_request", module: mod, title: "Créer une demande de congrès", fields, warnings,
      payload: {
        kind: "create_congress_request", scope, name,
        specialty: asStr(input, "specialty") || null, city: asStr(input, "city") || null,
        country: scope === "INTL" ? (asStr(input, "country") || null) : null,
        startDate, endDate, estimatedBudget, doctorId, doctorName, note: asStr(input, "note") || null,
      },
    };
  }

  if (toolName === "create_hr_request") {
    // Libre-service RH : tout employé peut faire une demande pour SON dossier (vérif. du dossier à l'exécution).
    if (!userCan(user, "WORKSPACE", "VIEW")) return { error: "Vous n'avez pas accès aux demandes RH." };
    const type = asStr(input, "type").toUpperCase();
    if (!HR_REQUEST_TYPES.includes(type)) return { error: "Type de demande RH inconnu." };
    const expenseMonth = asStr(input, "expenseMonth").trim() || null;
    if (type === "EXPENSE_REPORT" && !(expenseMonth && YM_RE.test(expenseMonth))) {
      return { error: "Pour une note de frais, précisez le mois concerné (AAAA-MM)." };
    }
    const periodStart = asStr(input, "periodStart") ? isoDate(asStr(input, "periodStart")) : null;
    const periodEnd = asStr(input, "periodEnd") ? isoDate(asStr(input, "periodEnd")) : null;
    if (HR_PERIOD_TYPES.has(type) && !periodStart) return { error: "Indiquez la date de début du congé / de l'absence (AAAA-MM-JJ)." };
    if (HR_LEAVE_TYPES.has(type) && !periodEnd) return { error: "Indiquez la date de fin du congé (AAAA-MM-JJ)." };
    if (periodStart && periodEnd && periodEnd < periodStart) return { error: "La date de fin précède la date de début." };
    pastWarning("Le début de la période", periodStart, warnings);
    const details = asStr(input, "details").trim() || null;
    const fields = [{ label: "Demande RH", value: HR_REQUEST_FR[type] }];
    if (type === "EXPENSE_REPORT" && expenseMonth) fields.push({ label: "Mois", value: expenseMonth });
    if (periodStart || periodEnd) fields.push({ label: "Période", value: [periodStart, periodEnd].filter(Boolean).join(" → ") });
    if (details) fields.push({ label: "Précisions", value: details });
    return {
      kind: "create_hr_request", module: "RH", title: "Créer une demande RH", fields, warnings,
      payload: { kind: "create_hr_request", type, details, expenseMonth: type === "EXPENSE_REPORT" ? expenseMonth : null, periodStart, periodEnd },
    };
  }

  if (toolName === "create_sponsoring_request") {
    if (!userCan(user, "SPONSORING", "CREATE")) return { error: "Vous n'avez pas accès aux demandes de sponsoring." };
    const institution = asStr(input, "institution").trim();
    if (!institution) return { error: "L'institution / bénéficiaire est obligatoire." };
    let doctorName: string | null = null;
    const doctorQuery = asStr(input, "doctorName");
    if (doctorQuery) {
      const d = await findDoctor(doctorQuery, user);
      if (d) doctorName = d.name;
      else warnings.push(`Médecin « ${doctorQuery} » introuvable dans votre périmètre — la demande sera créée sans médecin lié.`);
    }
    const amountRaw = input.amountRequested;
    const amountRequested = typeof amountRaw === "number" && Number.isFinite(amountRaw) ? amountRaw : null;
    const fields = [{ label: "Bénéficiaire", value: institution }];
    if (asStr(input, "type")) fields.push({ label: "Type", value: asStr(input, "type") });
    if (asStr(input, "specialty")) fields.push({ label: "Spécialité", value: asStr(input, "specialty") });
    if (asStr(input, "city")) fields.push({ label: "Ville", value: asStr(input, "city") });
    if (asStr(input, "product")) fields.push({ label: "Produit", value: asStr(input, "product") });
    if (doctorName) fields.push({ label: "Médecin", value: doctorName });
    if (amountRequested !== null) fields.push({ label: "Montant demandé", value: `${amountRequested.toLocaleString("fr-FR")} DZD` });
    if (asStr(input, "description")) fields.push({ label: "Objet", value: asStr(input, "description") });
    return {
      kind: "create_sponsoring_request", module: "SPONSORING", title: "Créer une demande de sponsoring", fields, warnings,
      payload: {
        kind: "create_sponsoring_request", institution,
        type: asStr(input, "type") || null, specialty: asStr(input, "specialty") || null, city: asStr(input, "city") || null,
        amountRequested, product: asStr(input, "product") || null, description: asStr(input, "description") || null, doctorName,
      },
    };
  }

  if (toolName === "create_event_request") {
    if (!userCan(user, "EVENTS", "CREATE")) return { error: "Vous n'avez pas accès aux événements." };
    const name = asStr(input, "name").trim();
    if (!name) return { error: "Le nom de l'événement est obligatoire." };
    const startDate = asStr(input, "startDate") ? isoDate(asStr(input, "startDate")) : null;
    const endDate = asStr(input, "endDate") ? isoDate(asStr(input, "endDate")) : null;
    pastWarning("La date de début", startDate, warnings);
    if (startDate && endDate && endDate < startDate) warnings.push("La date de fin précède la date de début.");
    const budgetRaw = input.estimatedBudget;
    const estimatedBudget = typeof budgetRaw === "number" && Number.isFinite(budgetRaw) ? budgetRaw : null;
    const fields = [{ label: "Événement", value: name }];
    if (asStr(input, "specialty")) fields.push({ label: "Spécialité", value: asStr(input, "specialty") });
    const place = [asStr(input, "city"), asStr(input, "country")].filter(Boolean).join(", ");
    if (place) fields.push({ label: "Lieu", value: place });
    if (startDate || endDate) fields.push({ label: "Dates", value: [startDate, endDate].filter(Boolean).join(" → ") });
    if (estimatedBudget !== null) fields.push({ label: "Budget estimé", value: `${estimatedBudget.toLocaleString("fr-FR")} DZD` });
    if (asStr(input, "description")) fields.push({ label: "Détails", value: asStr(input, "description") });
    return {
      kind: "create_event_request", module: "EVENTS", title: "Créer un événement", fields, warnings,
      payload: {
        kind: "create_event_request", name,
        specialty: asStr(input, "specialty") || null, city: asStr(input, "city") || null, country: asStr(input, "country") || null,
        startDate, endDate, estimatedBudget, description: asStr(input, "description") || null,
      },
    };
  }

  if (toolName === "create_promo_material_request") {
    if (!userCan(user, "PROMO_MATERIAL", "CREATE")) return { error: "La demande de matériel promotionnel est réservée au Marketing." };
    const title = asStr(input, "title").trim();
    if (!title) return { error: "L'intitulé du matériel est obligatoire." };
    const amountRaw = input.amount;
    const amount = typeof amountRaw === "number" && Number.isFinite(amountRaw) ? amountRaw : null;
    const fields = [{ label: "Matériel", value: title }];
    if (asStr(input, "materialType")) fields.push({ label: "Type", value: asStr(input, "materialType") });
    if (amount !== null) fields.push({ label: "Montant estimé", value: `${amount.toLocaleString("fr-FR")} DZD` });
    if (asStr(input, "description")) fields.push({ label: "Précisions", value: asStr(input, "description") });
    return {
      kind: "create_promo_material_request", module: "PROMO_MATERIAL", title: "Créer une demande de matériel promotionnel", fields, warnings,
      payload: { kind: "create_promo_material_request", title, materialType: asStr(input, "materialType") || null, amount, description: asStr(input, "description") || null },
    };
  }

  if (toolName === "decide_payment") {
    // Qui SIÈGE au centre — la même règle que l'écran. Le modèle ne décide jamais d'un droit.
    if (!sitsOnPaymentCentre(user)) return { error: "Seuls le PDG et le Super Admin siègent au centre de paiement." };
    const ref = asStr(input, "reference").trim();
    if (!ref) return { error: "Donnez la référence du paiement à trancher." };
    const decision = asStr(input, "decision") as "APPROVE" | "REFUSE" | "REQUEST_CHANGES" | "REQUEST_INFO";
    if (!["APPROVE", "REFUSE", "REQUEST_CHANGES", "REQUEST_INFO"].includes(decision)) return { error: "Décision inconnue." };
    const note = asStr(input, "note").trim();
    if (decision !== "APPROVE" && !note) return { error: "Dites pourquoi : sans motif, le demandeur ne peut que deviner." };

    const order = await prisma.expenseOrder.findFirst({
      where: { reference: { equals: ref, mode: "insensitive" } },
      select: { id: true, reference: true, label: true, amount: true, centralStatus: true, beneficiary: true },
    });
    if (!order) return { error: `Aucun ordre de dépense ne porte la référence « ${ref} ».` };
    if (!applyDecision(order.centralStatus as CentralStatus, decision)) {
      return { error: `Ce paiement est « ${CENTRAL_STATUS_LABEL[order.centralStatus as CentralStatus]} » — cette décision n'a plus de sens à ce stade.` };
    }
    const amountDzd = Math.round(toNumber(order.amount));
    const proposedRaw = input.proposedAmount;
    const proposedAmount = decision === "REQUEST_CHANGES" && typeof proposedRaw === "number" && Number.isFinite(proposedRaw) && proposedRaw > 0
      ? Math.round(proposedRaw) : null;

    const fields = [
      { label: "Paiement", value: `${order.reference} — ${order.label}` },
      { label: "Montant", value: `${amountDzd.toLocaleString("fr-FR")} DZD` },
      { label: "Décision", value: CENTRAL_DECISION_LABEL[decision] },
    ];
    if (order.beneficiary) fields.push({ label: "Bénéficiaire", value: order.beneficiary });
    if (proposedAmount != null) fields.push({ label: "Montant proposé", value: `${proposedAmount.toLocaleString("fr-FR")} DZD (proposition — le demandeur corrige et resoumet)` });
    if (note) fields.push({ label: "Motif", value: note });
    return {
      kind: "decide_payment", module: "PAYMENT_CENTRE", title: `Centre de paiement — ${CENTRAL_DECISION_LABEL[decision].toLowerCase()}`, fields, warnings,
      level: "SENSITIVE",
      payload: {
        kind: "decide_payment", orderId: order.id, reference: order.reference, label: order.label,
        amountDzd, decision, note: note || null, proposedAmount,
      },
    };
  }

  if (toolName === "create_calendar_event") {
    if (!userCan(user, "WORKSPACE", "CREATE")) return { error: "Vous n'avez pas accès au calendrier." };
    const title = asStr(input, "title");
    if (!title) return { error: "Intitulé du rendez-vous manquant." };
    const date = isoDate(asStr(input, "date"));
    if (!date) return { error: "Date du rendez-vous manquante ou invalide (AAAA-MM-JJ)." };
    pastWarning("La date du rendez-vous", date, warnings);
    const allDay = input.allDay === true;
    const time = allDay ? null : (asStr(input, "time").match(/^\d{1,2}:\d{2}$/) ? asStr(input, "time") : "09:00");
    const durRaw = input.durationMin;
    const durationMin = typeof durRaw === "number" && Number.isFinite(durRaw) && durRaw > 0 ? Math.round(durRaw) : null;
    const eventKind = (asStr(input, "kind") || "APPOINTMENT").toUpperCase();

    const inviteeIds: string[] = [];
    const inviteeResolved: string[] = [];
    const names = asStr(input, "inviteeNames").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    for (const n of names) {
      const r = await resolve("Invité", n);
      if (r.id) { inviteeIds.push(r.id); inviteeResolved.push(r.name ?? n); }
    }

    const fields = [
      { label: "Rendez-vous", value: title },
      { label: "Quand", value: allDay ? `${date} (journée entière)` : `${date} à ${time} (heure d'Alger)` },
    ];
    if (durationMin) fields.push({ label: "Durée", value: `${durationMin} min` });
    if (asStr(input, "location")) fields.push({ label: "Lieu", value: asStr(input, "location") });
    if (inviteeResolved.length) fields.push({ label: "Invités", value: inviteeResolved.join(", ") });
    if (asStr(input, "description")) fields.push({ label: "Détails", value: asStr(input, "description") });
    return {
      kind: "create_calendar_event", module: "WORKSPACE", title: "Planifier un rendez-vous", fields, warnings,
      payload: {
        kind: "create_calendar_event", title, date, time, durationMin, allDay,
        eventKind, location: asStr(input, "location") || null, meetLink: asStr(input, "meetLink") || null,
        description: asStr(input, "description") || null, inviteeIds, inviteeNames: inviteeResolved.join(", ") || null,
      },
    };
  }

  if (toolName === "create_notification") {
    if (user.role !== "SUPER_ADMIN") return { error: "Seul le Super Admin peut diffuser des notifications." };
    const title = asStr(input, "title");
    if (!title) return { error: "Titre de la notification manquant." };
    const audience = asStr(input, "audience").toUpperCase();
    if (!["ALL", "ROLE", "USERS"].includes(audience)) return { error: "Audience invalide (ALL, ROLE ou USERS)." };
    const body = asStr(input, "body") || null;
    const link = asStr(input, "link") || null;
    const popup = input.popup === true || asStr(input, "popup").toLowerCase() === "true";

    const fields = [{ label: "Titre", value: title }];
    let role: string | null = null;
    const userIds: string[] = [];
    let recipientNames: string | null = null;

    if (audience === "ROLE") {
      role = normalizeRole(asStr(input, "role"));
      if (!role) return { error: "Rôle ciblé manquant ou inconnu — précisez le rôle (ex. « Délégué médical »)." };
      fields.push({ label: "Audience", value: `Rôle : ${ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}` });
    } else if (audience === "USERS") {
      const names = asStr(input, "recipientNames").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) return { error: "Aucun destinataire précisé (audience=USERS)." };
      const resolvedNames: string[] = [];
      for (const n of names) {
        const r = await resolve("Destinataire", n);
        if (r.id) { userIds.push(r.id); resolvedNames.push(r.name ?? n); }
      }
      if (userIds.length === 0) return { error: "Aucun destinataire valide trouvé — précisez les noms (search_people)." };
      recipientNames = resolvedNames.join(", ");
      fields.push({ label: "Audience", value: `${userIds.length} personne(s) : ${recipientNames}` });
    } else {
      fields.push({ label: "Audience", value: "Tous les comptes actifs" });
    }
    if (body) fields.push({ label: "Message", value: body });
    if (link) fields.push({ label: "Lien", value: link });
    if (popup) fields.push({ label: "Format", value: "Pop-up plein écran (accusé de réception requis)" });

    return {
      kind: "create_notification", module: "ADMIN", title: popup ? "Diffuser une annonce (pop-up)" : "Diffuser une notification", fields, warnings,
      payload: { kind: "create_notification", audience: audience as BroadcastAudience, role, userIds, recipientNames, title, body, link, popup },
    };
  }

  if (toolName === "update_task") {
    const needle = asStr(input, "task");
    if (needle.length < 2) return { error: "Donnez un fragment du titre de la tâche." };
    // Sa propre tâche, ou n'importe laquelle pour une vue globale — la même frontière que
    // l'écran « Mon espace » : personne ne modifie la tâche d'un autre sans vue globale.
    const scope = hasGlobalView(user) ? {} : { OR: [{ assignedToId: user.id }, { createdById: user.id }] };
    const task = await prisma.task.findFirst({
      where: { AND: [scope, { title: { contains: needle, mode: "insensitive" as const } }] },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!task) return { error: `Aucune tâche « ${needle} » dans votre périmètre.` };

    const fields: { label: string; value: string }[] = [{ label: "Tâche", value: task.title }];
    const payload: Extract<AssistantActionPayload, { kind: "update_task" }> = { kind: "update_task", taskId: task.id, taskTitle: task.title };

    const assigneeRaw = asStr(input, "assigneeName");
    if (assigneeRaw) {
      const a = await resolve("Nouveau responsable", assigneeRaw);
      if (!a.id) return { error: `Responsable « ${assigneeRaw} » introuvable ou ambigu (search_people).` };
      payload.assigneeId = a.id; payload.assigneeName = a.name;
      fields.push({ label: "Assignée à", value: `${task.assignedTo?.name ?? "personne"} → ${a.name}` });
    }
    if (input.clearDueDate === true) {
      payload.clearDueDate = true;
      fields.push({ label: "Échéance", value: `${task.dueDate?.toISOString().slice(0, 10) ?? "(aucune)"} → (retirée)` });
    } else if (asStr(input, "dueDate")) {
      const due = isoDate(asStr(input, "dueDate"));
      if (!due) return { error: "Échéance illisible (AAAA-MM-JJ)." };
      pastWarning("La nouvelle échéance", due, warnings);
      payload.dueDate = due;
      fields.push({ label: "Échéance", value: `${task.dueDate?.toISOString().slice(0, 10) ?? "(aucune)"} → ${due}` });
    }
    const prio = asStr(input, "priority") ? normPriority(asStr(input, "priority")) : null;
    if (prio) {
      payload.priority = prio;
      fields.push({ label: "Priorité", value: `${PRIORITY[task.priority]?.label ?? task.priority} → ${PRIORITY[prio]?.label ?? prio}` });
    }
    const status = asStr(input, "status").toUpperCase();
    if (status) {
      if (!["TODO", "IN_PROGRESS", "DONE", "CANCELLED"].includes(status)) return { error: "Statut de tâche inconnu." };
      payload.status = status;
      fields.push({ label: "Statut", value: `${TASK_STATUS[task.status]?.label ?? task.status} → ${TASK_STATUS[status as keyof typeof TASK_STATUS]?.label ?? status}` });
    }
    const comment = asStr(input, "comment");
    if (comment) { payload.comment = comment; fields.push({ label: "Commentaire", value: comment }); }

    if (fields.length === 1) return { error: "Aucun changement demandé — précisez quoi modifier (responsable, échéance, priorité, statut, commentaire)." };
    return { kind: "update_task", module: "WORKSPACE", title: `Modifier la tâche « ${task.title.slice(0, 60)} »`, fields, warnings, payload };
  }

  if (toolName === "update_request") {
    if (!userCan(user, "ADMIN_REQUESTS", "VIEW")) return { error: "Vous n'avez pas accès aux demandes du secrétariat." };
    const ref = asStr(input, "reference");
    if (ref.length < 2) return { error: "Donnez la référence (REQ-…) ou un fragment du titre." };
    const req = await prisma.administrativeRequest.findFirst({
      where: { AND: [scopeAdminRequests(user), { deletedAt: null }, { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] }] },
      select: { id: true, reference: true, title: true, status: true, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!req) return { error: `Aucune demande « ${ref} » dans votre périmètre.` };

    const fields: { label: string; value: string }[] = [{ label: "Demande", value: `${req.reference} — ${req.title}` }];
    const payload: Extract<AssistantActionPayload, { kind: "update_request" }> = { kind: "update_request", requestId: req.id, reference: req.reference };

    const status = asStr(input, "status").toUpperCase();
    if (status) {
      const valid = ["NEW", "IN_PROGRESS", "AWAITING_VALIDATION", "AWAITING_EXTERNAL", "AWAITING_PAYMENT", "AWAITING_DOCUMENT", "BLOCKED", "DONE", "CANCELLED"];
      if (!valid.includes(status)) return { error: "Statut de demande inconnu." };
      payload.status = status;
      fields.push({ label: "Statut", value: `${ADMIN_REQUEST_STATUS[req.status]?.label ?? req.status} → ${ADMIN_REQUEST_STATUS[status as keyof typeof ADMIN_REQUEST_STATUS]?.label ?? status}` });
    }
    const assigneeRaw = asStr(input, "assigneeName");
    if (assigneeRaw) {
      const a = await resolve("Nouveau responsable", assigneeRaw);
      if (!a.id) return { error: `Responsable « ${assigneeRaw} » introuvable ou ambigu (search_people).` };
      payload.assigneeId = a.id; payload.assigneeName = a.name;
      fields.push({ label: "Responsable", value: `${req.assignedTo?.name ?? "personne"} → ${a.name}` });
    }
    const comment = asStr(input, "comment");
    if (comment) { payload.comment = comment; fields.push({ label: "Commentaire", value: comment }); }

    if (fields.length === 1) return { error: "Aucun changement demandé — précisez quoi modifier (statut, responsable, commentaire)." };
    warnings.push("L'exécution repasse par les règles du secrétariat : si vous n'êtes pas gestionnaire de cette demande, elle sera refusée.");
    return { kind: "update_request", module: "ADMIN_REQUESTS", title: `Modifier la demande ${req.reference}`, fields, warnings, payload };
  }

  if (toolName === "create_legal_document") {
    if (!userCan(user, "LEGAL", "CREATE")) return { error: "Vous n'avez pas le droit de déclarer une pièce Legal." };
    const KINDS_FR: Record<string, string> = {
      QUOTE: "Devis", PURCHASE_ORDER: "Bon de commande", INVOICE: "Facture", CONTRACT: "Contrat",
      AGREEMENT: "Accord", NDA: "NDA", INSURANCE: "Assurance", LICENSE: "Licence", LEASE: "Bail", OTHER: "Autre",
    };
    const docKind = asStr(input, "kind").toUpperCase();
    if (!(docKind in KINDS_FR)) return { error: "Nature de pièce inconnue." };
    const title = asStr(input, "title");
    if (!title) return { error: "Le titre de la pièce est obligatoire." };
    const startDate = asStr(input, "startDate") ? isoDate(asStr(input, "startDate")) : null;
    const endDate = asStr(input, "endDate") ? isoDate(asStr(input, "endDate")) : null;
    if (startDate && endDate && endDate < startDate) return { error: "La date de fin précède la date de début." };
    const amountRaw = input.amount;
    const amount = typeof amountRaw === "number" && Number.isFinite(amountRaw) && amountRaw >= 0 ? amountRaw : null;

    // La pièce AMONT se résout MAINTENANT — jamais un identifiant deviné au moment d'exécuter.
    let chainFromId: string | null = null;
    let chainFromLabel: string | null = null;
    const chainRaw = asStr(input, "chain_from");
    if (chainRaw) {
      const prev = await prisma.legalDocument.findFirst({
        where: { OR: [{ reference: { equals: chainRaw, mode: "insensitive" } }, { title: { contains: chainRaw, mode: "insensitive" } }] },
        select: { id: true, title: true, reference: true, kind: true },
        orderBy: { createdAt: "desc" },
      });
      if (!prev) return { error: `Pièce amont « ${chainRaw} » introuvable au Legal — vérifier avec search_everything ou inspect_record.` };
      chainFromId = prev.id;
      chainFromLabel = `${KINDS_FR[prev.kind] ?? prev.kind} ${prev.reference ?? ""} — ${prev.title}`.trim();
    }

    const fields = [
      { label: "Nature", value: KINDS_FR[docKind] },
      { label: "Titre", value: title },
    ];
    if (asStr(input, "reference")) fields.push({ label: "Référence", value: asStr(input, "reference") });
    if (asStr(input, "counterparty")) fields.push({ label: "Partie", value: asStr(input, "counterparty") });
    if (amount != null) fields.push({ label: "Montant", value: `${amount.toLocaleString("fr-FR")} DZD` });
    if (startDate || endDate) fields.push({ label: "Dates", value: [startDate, endDate].filter(Boolean).join(" → ") });
    if (chainFromLabel) fields.push({ label: "Chaînée à", value: chainFromLabel });

    return {
      kind: "create_legal_document", module: "LEGAL", title: `Déclarer ${KINDS_FR[docKind].toLowerCase()} au Legal`, fields, warnings,
      payload: {
        kind: "create_legal_document", docKind, title,
        reference: asStr(input, "reference") || null, counterparty: asStr(input, "counterparty") || null,
        amount, startDate, endDate, notes: asStr(input, "notes") || null,
        chainFromId, chainFromLabel,
      },
    };
  }

  if (toolName === "update_legal_document") {
    if (!userCan(user, "LEGAL", "UPDATE")) return { error: "Vous n'avez pas le droit de modifier une pièce Legal." };
    const needle = asStr(input, "document");
    if (needle.length < 2) return { error: "Donnez la référence ou un fragment du titre de la pièce." };
    // La restriction par LECTEURS s'applique aussi ici : on ne modifie pas un document qu'on
    // n'a pas le droit d'ouvrir.
    const doc = await prisma.legalDocument.findFirst({
      where: {
        AND: [
          { OR: [{ reference: { equals: needle, mode: "insensitive" } }, { title: { contains: needle, mode: "insensitive" } }] },
          ...(user.role === "SUPER_ADMIN" ? [] : [{
            OR: [{ readers: { none: {} } }, { readers: { some: { userId: user.id } } }, { createdById: user.id }],
          }]),
        ],
      },
      select: { id: true, title: true, reference: true, kind: true, counterparty: true, amount: true, startDate: true, endDate: true },
      orderBy: { createdAt: "desc" },
    });
    if (!doc) return { error: `Aucune pièce Legal « ${needle} » qui vous soit ouverte.` };

    const updates: Extract<AssistantActionPayload, { kind: "update_legal_document" }>["updates"] = {};
    const changes: string[] = [];
    const fields: { label: string; value: string }[] = [{ label: "Pièce", value: `${doc.reference ?? doc.kind} — ${doc.title}` }];
    const push = (label: string, before: string, after: string) => {
      fields.push({ label, value: `${before || "(vide)"} → ${after || "(vide)"}` });
      changes.push(label);
    };

    if (asStr(input, "title")) { updates.title = asStr(input, "title"); push("Titre", doc.title, updates.title); }
    if (asStr(input, "reference")) { updates.reference = asStr(input, "reference"); push("Référence", doc.reference ?? "", updates.reference); }
    if (asStr(input, "counterparty")) { updates.counterparty = asStr(input, "counterparty"); push("Partie", doc.counterparty ?? "", updates.counterparty); }
    if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
      updates.amount = input.amount;
      push("Montant", doc.amount != null ? `${Math.round(toNumber(doc.amount)).toLocaleString("fr-FR")} DZD` : "", `${input.amount.toLocaleString("fr-FR")} DZD`);
    }
    if (asStr(input, "startDate")) {
      const d = isoDate(asStr(input, "startDate"));
      if (!d) return { error: "Date de début illisible (AAAA-MM-JJ)." };
      updates.startDate = d; push("Début", doc.startDate?.toISOString().slice(0, 10) ?? "", d);
    }
    if (asStr(input, "endDate")) {
      const d = isoDate(asStr(input, "endDate"));
      if (!d) return { error: "Date de fin illisible (AAAA-MM-JJ)." };
      updates.endDate = d; push("Fin", doc.endDate?.toISOString().slice(0, 10) ?? "", d);
    }
    if (asStr(input, "notes")) { updates.notes = asStr(input, "notes"); changes.push("Notes"); fields.push({ label: "Notes", value: updates.notes }); }
    const chainRaw = asStr(input, "chain_from");
    if (chainRaw) {
      const prev = await prisma.legalDocument.findFirst({
        where: { id: { not: doc.id }, OR: [{ reference: { equals: chainRaw, mode: "insensitive" } }, { title: { contains: chainRaw, mode: "insensitive" } }] },
        select: { id: true, title: true, reference: true },
        orderBy: { createdAt: "desc" },
      });
      if (!prev) return { error: `Pièce amont « ${chainRaw} » introuvable au Legal.` };
      updates.chainFromId = prev.id;
      push("Chaînée à", "", `${prev.reference ?? ""} ${prev.title}`.trim());
    }
    if (changes.length === 0) return { error: "Aucun changement demandé — précisez quoi modifier." };

    return {
      kind: "update_legal_document", module: "LEGAL", title: `Modifier « ${doc.title.slice(0, 60)} »`, fields, warnings,
      payload: { kind: "update_legal_document", documentId: doc.id, currentTitle: doc.title, updates, changes },
    };
  }

  if (toolName === "update_calendar_event") {
    if (!userCan(user, "WORKSPACE", "VIEW")) return { error: "Vous n'avez pas accès au calendrier." };
    const needle = asStr(input, "event");
    if (needle.length < 2) return { error: "Donnez un fragment du titre du rendez-vous." };
    // Même frontière que l'écran : l'organisateur, ou une vue globale.
    const scope = hasGlobalView(user) ? {} : { organizerId: user.id };
    const event = await prisma.calendarEvent.findFirst({
      where: { AND: [scope, { title: { contains: needle, mode: "insensitive" as const } }, { startAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }] },
      select: { id: true, title: true, startAt: true, allDay: true, location: true, organizer: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    });
    if (!event) return { error: `Aucun rendez-vous à venir « ${needle} » que vous puissiez modifier.` };

    const cancel = input.cancel === true;
    const changes: string[] = [];
    const fields: { label: string; value: string }[] = [
      { label: "Rendez-vous", value: event.title },
      { label: "Actuellement", value: `${event.startAt.toISOString().slice(0, 10)}${event.allDay ? " (journée entière)" : ""} — organisé par ${event.organizer.name}` },
    ];
    const payload: Extract<AssistantActionPayload, { kind: "update_calendar_event" }> = {
      kind: "update_calendar_event", eventId: event.id, eventTitle: event.title, changes,
    };
    if (cancel) {
      payload.cancel = true;
      changes.push("Annulation");
      fields.push({ label: "Action", value: "ANNULER le rendez-vous (les invités seront prévenus par la disparition de l'événement)" });
    } else {
      const date = asStr(input, "date") ? isoDate(asStr(input, "date")) : null;
      const time = asStr(input, "time").match(/^\d{1,2}:\d{2}$/) ? asStr(input, "time") : null;
      if (date) { payload.date = date; changes.push("Date"); }
      if (time) { payload.time = time; changes.push("Heure"); }
      if (date || time) fields.push({ label: "Déplacé à", value: `${date ?? "même jour"} ${time ?? "même heure"} (heure d'Alger)` });
      if (typeof input.durationMin === "number" && input.durationMin > 0) {
        payload.durationMin = Math.round(input.durationMin); changes.push("Durée");
        fields.push({ label: "Durée", value: `${payload.durationMin} min` });
      }
      if (asStr(input, "location")) { payload.location = asStr(input, "location"); changes.push("Lieu"); fields.push({ label: "Lieu", value: payload.location }); }
      if (changes.length === 0) return { error: "Aucun changement demandé — donnez une nouvelle date/heure, une durée, un lieu, ou cancel=true." };
      pastWarning("La nouvelle date", date, warnings);
    }
    return {
      kind: "update_calendar_event", module: "WORKSPACE",
      title: cancel ? `Annuler « ${event.title.slice(0, 50)} »` : `Déplacer « ${event.title.slice(0, 50)} »`,
      fields, warnings, payload,
    };
  }

  if (toolName === "create_hospital") {
    const name = asStr(input, "name");
    if (!name) return { error: "Le nom de l'hôpital est obligatoire." };
    const registre = asStr(input, "registre").toUpperCase() === "ANNUAIRE" ? "ANNUAIRE" : "STOCKS";

    if (registre === "STOCKS") {
      // La liste des lieux de stock est tenue par le Super Admin — la même règle que l'écran.
      if (user.role !== "SUPER_ADMIN") return { error: "Seul le Super Admin ajoute un lieu à la liste des stocks. Pour l'annuaire médical, utiliser registre=ANNUAIRE." };
      const kind = asStr(input, "kind").toUpperCase() === "ANNEX" ? "ANNEX" : "HOSPITAL";
      const existing = await prisma.stockAnnex.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (existing) return { error: `« ${existing.name} » existe déjà dans les lieux de stock.` };
      return {
        kind: "create_hospital", module: "STOCKS", title: `Ajouter ${kind === "ANNEX" ? "une annexe PCH" : "un hôpital"} aux stocks`, warnings,
        fields: [
          { label: "Nom", value: name },
          { label: "Nature", value: kind === "ANNEX" ? "Annexe PCH" : "Hôpital" },
          { label: "Registre", value: "Lieux de stock (module Stocks)" },
        ],
        payload: { kind: "create_hospital", registre: "STOCKS", name, annexKind: kind },
      };
    }

    if (!userCan(user, "MEDICAL", "CREATE")) return { error: "Vous n'avez pas le droit d'ajouter un établissement à l'annuaire médical." };
    const dupe = await prisma.medicalInstitution.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { name: true } });
    if (dupe) warnings.push(`Un établissement « ${dupe.name} » existe déjà dans l'annuaire — vérifier qu'il ne s'agit pas d'un doublon.`);
    const fields = [
      { label: "Nom", value: name },
      { label: "Registre", value: "Annuaire médical (établissements)" },
    ];
    if (asStr(input, "type")) fields.push({ label: "Type", value: asStr(input, "type") });
    if (asStr(input, "sector")) fields.push({ label: "Secteur", value: asStr(input, "sector") });
    const place = [asStr(input, "city"), asStr(input, "wilaya")].filter(Boolean).join(", ");
    if (place) fields.push({ label: "Lieu", value: place });
    return {
      kind: "create_hospital", module: "MEDICAL", title: "Ajouter un établissement à l'annuaire", fields, warnings,
      payload: {
        kind: "create_hospital", registre: "ANNUAIRE", name,
        institutionType: asStr(input, "type") || null, sector: asStr(input, "sector") || null,
        wilaya: asStr(input, "wilaya") || null, city: asStr(input, "city") || null,
      },
    };
  }

  if (toolName === "update_hospital") {
    if (!userCan(user, "MEDICAL", "UPDATE")) return { error: "Vous n'avez pas le droit de modifier l'annuaire des établissements." };
    const needle = asStr(input, "name");
    if (needle.length < 2) return { error: "Donnez le nom (fragment) de l'établissement." };
    const inst = await prisma.medicalInstitution.findFirst({
      where: { name: { contains: needle, mode: "insensitive" } },
      select: { id: true, name: true, type: true, sector: true, wilaya: true, city: true, phone: true, email: true, isActive: true },
    });
    if (!inst) return { error: `Aucun établissement « ${needle} » dans l'annuaire.` };

    const updates: Extract<AssistantActionPayload, { kind: "update_hospital" }>["updates"] = {};
    const changes: string[] = [];
    const fields: { label: string; value: string }[] = [{ label: "Établissement", value: inst.name }];
    const push = (label: string, before: string, after: string) => {
      fields.push({ label, value: `${before || "(vide)"} → ${after || "(vide)"}` });
      changes.push(label);
    };
    if (asStr(input, "newName")) { updates.newName = asStr(input, "newName"); push("Nom", inst.name, updates.newName); }
    if (asStr(input, "type")) { updates.type = asStr(input, "type").toUpperCase(); push("Type", inst.type, updates.type); }
    if (asStr(input, "sector")) { updates.sector = asStr(input, "sector").toUpperCase(); push("Secteur", inst.sector, updates.sector); }
    if (asStr(input, "wilaya")) { updates.wilaya = asStr(input, "wilaya"); push("Wilaya", inst.wilaya ?? "", updates.wilaya); }
    if (asStr(input, "city")) { updates.city = asStr(input, "city"); push("Ville", inst.city ?? "", updates.city); }
    if (asStr(input, "phone")) { updates.phone = asStr(input, "phone"); push("Téléphone", inst.phone ?? "", updates.phone); }
    if (asStr(input, "email")) { updates.email = asStr(input, "email"); push("E-mail", inst.email ?? "", updates.email); }
    if (asStr(input, "notes")) { updates.notes = asStr(input, "notes"); changes.push("Notes"); fields.push({ label: "Notes", value: updates.notes }); }
    if (typeof input.active === "boolean") { updates.isActive = input.active; push("Actif", inst.isActive ? "oui" : "non", input.active ? "oui" : "non"); }
    if (changes.length === 0) return { error: "Aucun changement demandé — précisez quoi modifier." };

    return {
      kind: "update_hospital", module: "MEDICAL", title: `Modifier « ${inst.name} »`, fields, warnings,
      payload: { kind: "update_hospital", institutionId: inst.id, name: inst.name, updates, changes },
    };
  }

  if (toolName === "update_salary") {
    // La même porte que la paie RH (`canRunPayroll`) : le droit de MODIFIER le module RH.
    if (!userCan(user, "RH", "UPDATE")) return { error: "La modification des salaires est réservée aux détenteurs du droit RH (modification)." };
    const name = asStr(input, "employee_name");
    if (name.length < 2) return { error: "Donnez le nom de l'employé." };
    const emp = await prisma.employee.findFirst({
      where: { fullName: { contains: name, mode: "insensitive" }, isActive: true },
      select: { id: true, fullName: true, position: true, baseSalary: true, netToPay: true, grossSalary: true, employerCost: true },
    });
    if (!emp) return { error: `Aucun employé actif « ${name} » dans le registre RH.` };

    const SALARY_FIELDS = [
      { key: "base_salary", field: "baseSalary" as const, label: "Salaire de base", before: toNumber(emp.baseSalary) },
      { key: "net_to_pay", field: "netToPay" as const, label: "Net à payer", before: emp.netToPay != null ? toNumber(emp.netToPay) : null },
      { key: "gross_salary", field: "grossSalary" as const, label: "Salaire brut", before: emp.grossSalary != null ? toNumber(emp.grossSalary) : null },
      { key: "employer_cost", field: "employerCost" as const, label: "Coût employeur", before: emp.employerCost != null ? toNumber(emp.employerCost) : null },
    ];
    const fields: { label: string; value: string }[] = [{ label: "Employé", value: `${emp.fullName}${emp.position ? ` — ${emp.position}` : ""}` }];
    const changed: Extract<AssistantActionPayload, { kind: "update_salary" }>["fields"] = [];
    for (const s of SALARY_FIELDS) {
      const v = input[s.key];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      if (v <= 0) return { error: `${s.label} : le montant doit être positif.` };
      const after = Math.round(v);
      const pct = s.before != null && s.before > 0 ? Math.round(((after - s.before) / s.before) * 1000) / 10 : null;
      changed.push({ field: s.field, label: s.label, before: s.before != null ? Math.round(s.before) : null, after });
      fields.push({
        label: s.label,
        value: `${s.before != null ? Math.round(s.before).toLocaleString("fr-FR") : "(non renseigné)"} → ${after.toLocaleString("fr-FR")} DZD`
          + (pct != null ? ` (écart ${pct > 0 ? "+" : ""}${pct.toLocaleString("fr-FR")} %)` : ""),
      });
    }
    if (changed.length === 0) return { error: "Aucun montant fourni — donnez au moins un montant (base_salary, net_to_pay, gross_salary ou employer_cost). Lire d'abord read_payroll." };
    const note = asStr(input, "note") || null;
    if (note) fields.push({ label: "Motif / effet", value: note });
    warnings.push("NIVEAU CRITIQUE : cette modification change la rémunération sur la fiche RH. La confirmation exige la re-saisie du nouveau montant.");
    warnings.push("La fiche change ; la paie du mois se saisit toujours dans RH → Paie (la ligne du mois en cours n'est pas réécrite).");

    return {
      kind: "update_salary", module: "RH", title: `Modifier le salaire de ${emp.fullName}`, fields, warnings,
      level: "CRITICAL",
      confirmText: String(changed[0].after),
      payload: { kind: "update_salary", employeeId: emp.id, employeeName: emp.fullName, fields: changed, note },
    };
  }

  return { error: `Action non prise en charge : ${toolName}.` };
}

/** Normalise un rôle (libellé FR ou code) vers un code de rôle interne, ou null. */
function normalizeRole(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const codes = Object.keys(ROLE_LABELS);
  const upper = s.toUpperCase().replace(/[\s-]+/g, "_");
  const byCode = codes.find((k) => k.toUpperCase() === upper);
  if (byCode) return byCode;
  const lower = s.toLowerCase();
  const byLabel = codes.find((k) => (ROLE_LABELS[k as keyof typeof ROLE_LABELS] ?? "").toLowerCase() === lower);
  if (byLabel) return byLabel;
  return codes.find((k) => (ROLE_LABELS[k as keyof typeof ROLE_LABELS] ?? "").toLowerCase().includes(lower)) ?? null;
}

// ───────────────────────────── Boucle agent ─────────────────────────────

/**
 * Nombre d'allers-retours modèle ↔ outils avant d'abandonner.
 *
 * Six ne suffisait pas : une question du type « donne-moi tous les produits Regulatory »
 * consomme déjà plusieurs tours (chercher, élargir, recouper l'entité) et l'utilisateur
 * recevait « je n'ai pas pu finaliser la demande » alors que l'assistant travaillait
 * correctement. Chaque tour supplémentaire ne coûte que s'il est utilisé — la boucle
 * s'arrête dès que le modèle répond sans appeler d'outil.
 */
const MAX_TURNS = 16;
const HISTORY_LIMIT = 24;

function toMessages(history: ChatTurn[]): ClaudeMessage[] {
  return history
    .slice(-HISTORY_LIMIT)
    .filter((t) => t.content.trim().length > 0)
    .map((t) => ({ role: t.role, content: t.content }));
}

function textOf(blocks: ClaudeContentBlock[]): string {
  return blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
}

/**
 * Exécute la boucle : Claude peut appeler des outils de lecture (exécutés et
 * réinjectés), puis répond. Si Claude appelle un outil d'écriture, on intercepte
 * et on renvoie une action à confirmer (rien n'est exécuté).
 */
export async function runAssistant(
  user: CurrentUser,
  history: ChatTurn[],
  opts: { model?: string; personalContext?: string | null } = {},
): Promise<AssistantResult> {
  if (!aiConfigured()) return { configured: false, ok: false, reply: "", trace: [] };

  const messages = toMessages(history);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { configured: true, ok: false, reply: "", trace: [], error: "Message utilisateur manquant." };
  }

  // Contexte PERSONNEL (identité, rattachement, N+1, mémoire des échanges passés) — fourni
  // par l'appelant, qui l'a résolu pour CE compte uniquement. Voir lib/assistant-memory.ts.
  const system = opts.personalContext
    ? `${systemPrompt(user)}\n\nCONTEXTE PERSONNEL\n${opts.personalContext}`
    : systemPrompt(user);
  // Le Super Admin dispose d'outils exclusifs (vision globale de tous les comptes).
  const tools = [
    ...READ_TOOLS,
    // Lectures chiffrées (budget, finances, RH, file de décisions) ouvertes par les DROITS de
    // cette personne — pas par son rôle. L'administrateur les a toutes ; un compte à qui l'on
    // ouvre les Budgets gagne l'outil budget sans qu'on touche au code.
    ...powerToolsFor(user),
    // L'export est borné par les DROITS DE LECTURE, pas par le rôle : `canExport` refuse
    // tout jeu de données que la personne ne pourrait pas ouvrir à l'écran.
    EXPORT_TOOL,
    ...(user.role === "SUPER_ADMIN" ? [...SUPERADMIN_TOOLS, ...SUPERADMIN_WRITE_TOOLS] : []),
    ...WRITE_TOOLS,
  ];
  const trace: string[] = [];

  try {
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await callClaude(messages, { system, tools, maxTokens: 1400, temperature: 0.2, model: opts.model });
    if (!res.ok || !res.content) {
      return { configured: res.configured, ok: false, reply: "", trace, error: res.error ?? "Réponse IA indisponible." };
    }

    const blocks = res.content;
    const toolUses = blocks.filter((b) => b.type === "tool_use") as Extract<ClaudeContentBlock, { type: "tool_use" }>[];

    // Pas d'outil → réponse finale.
    if (res.stopReason !== "tool_use" || toolUses.length === 0) {
      return { configured: true, ok: true, reply: textOf(blocks) || "D'accord.", trace };
    }

    // Action d'écriture demandée → on intercepte la première et on propose (rien n'est exécuté).
    const write = toolUses.find((t) => WRITE_TOOL_NAMES.has(t.name));
    if (write) {
      const proposal = await buildProposal(write.name, write.input, user);
      if ("error" in proposal) {
        // On réinjecte l'erreur pour laisser Claude se corriger.
        messages.push({ role: "assistant", content: blocks });
        messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: write.id, content: proposal.error, is_error: true }] });
        continue;
      }
      const reply = textOf(blocks) || `Je propose de ${proposal.title.toLowerCase()}. Confirmez-vous ?`;
      return { configured: true, ok: true, reply, trace, proposal };
    }

    // Outils de lecture → exécuter tous et réinjecter.
    const results: ClaudeContentBlock[] = [];
    for (const tu of toolUses) {
      const out = await executeReadTool(tu.name, tu.input, user).catch((e) => {
        console.error("[assistant] read tool failed", tu.name, e);
        return "Erreur lors de la lecture des données.";
      });
      if (READ_LABEL[tu.name] && !trace.includes(READ_LABEL[tu.name])) trace.push(READ_LABEL[tu.name]);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
    }
    messages.push({ role: "assistant", content: blocks });
    messages.push({ role: "user", content: results });
  }

  return { configured: true, ok: true, reply: "Je n'ai pas pu finaliser la demande en peu d'étapes. Reformulez en précisant l'objectif.", trace };
  } catch (err) {
    console.error("[assistant] runAssistant failed", err);
    return { configured: true, ok: false, reply: "", trace, error: "Une erreur est survenue côté assistant. Reformulez votre demande ou réessayez dans un instant." };
  }
}

/** Événements poussés au navigateur pendant que l'assistant travaille. */
export type AssistantStreamEvent =
  | { type: "trace"; label: string }
  | { type: "delta"; text: string }
  /** Le texte déjà affiché n'était qu'un préambule à un appel d'outil : le client l'efface. */
  | { type: "reset" }
  | { type: "done"; result: AssistantResult };

/**
 * VARIANTE STREAMING de `runAssistant` — même boucle agent, même garde-fous, mais la réponse
 * est poussée **au fil de sa génération** au lieu d'arriver en un bloc.
 *
 * Ce que voit l'utilisateur, dans l'ordre réel des événements :
 *   • `trace` — « je consulte vos validations… » dès qu'un outil de lecture est exécuté ;
 *   • `delta` — le texte, mot à mot, tel que le modèle l'écrit ;
 *   • `done`  — le résultat complet (réponse, trace, proposition d'action à confirmer).
 *
 * Les garanties de `runAssistant` sont inchangées : une action d'écriture est TOUJOURS
 * interceptée et proposée, jamais exécutée. Ne lève jamais.
 */
export async function runAssistantStream(
  user: CurrentUser,
  history: ChatTurn[],
  emit: (e: AssistantStreamEvent) => void,
  opts: { model?: string; personalContext?: string | null } = {},
): Promise<AssistantResult> {
  if (!aiConfigured()) return { configured: false, ok: false, reply: "", trace: [] };

  const messages = toMessages(history);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { configured: true, ok: false, reply: "", trace: [], error: "Message utilisateur manquant." };
  }

  const system = opts.personalContext
    ? `${systemPrompt(user)}\n\nCONTEXTE PERSONNEL\n${opts.personalContext}`
    : systemPrompt(user);
  const tools = [
    ...READ_TOOLS,
    // Lectures chiffrées (budget, finances, RH, file de décisions) ouvertes par les DROITS de
    // cette personne — pas par son rôle. L'administrateur les a toutes ; un compte à qui l'on
    // ouvre les Budgets gagne l'outil budget sans qu'on touche au code.
    ...powerToolsFor(user),
    // L'export est borné par les DROITS DE LECTURE, pas par le rôle : `canExport` refuse
    // tout jeu de données que la personne ne pourrait pas ouvrir à l'écran.
    EXPORT_TOOL,
    ...(user.role === "SUPER_ADMIN" ? [...SUPERADMIN_TOOLS, ...SUPERADMIN_WRITE_TOOLS] : []),
    ...WRITE_TOOLS,
  ];
  const trace: string[] = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // Le texte part AU FIL DE L'EAU. Si le tour se révèle finalement être un appel d'outil,
      // ce qui a été écrit n'était qu'un préambule : on demande alors au client de l'effacer
      // (`reset`) avant que la vraie réponse n'arrive. En pratique le modèle appelle ses outils
      // sans préambule, donc `reset` ne se déclenche presque jamais — mais l'affichage reste
      // juste dans tous les cas.
      let streamed = false;
      const res = await callClaudeStream(messages, (chunk) => {
        streamed = true;
        emit({ type: "delta", text: chunk });
      }, { system, tools, maxTokens: 1400, temperature: 0.2, model: opts.model });
      if (!res.ok || !res.content) {
        return { configured: res.configured, ok: false, reply: "", trace, error: res.error ?? "Réponse IA indisponible." };
      }

      const blocks = res.content;
      const toolUses = blocks.filter((b) => b.type === "tool_use") as Extract<ClaudeContentBlock, { type: "tool_use" }>[];

      // Pas d'outil → c'est la réponse finale : on la diffuse d'un trait mesuré.
      if (res.stopReason !== "tool_use" || toolUses.length === 0) {
        const reply = textOf(blocks) || "D'accord.";
        // Rien n'a été diffusé (réponse vide côté modèle) → on envoie le repli d'un trait.
        if (!streamed) emit({ type: "delta", text: reply });
        return { configured: true, ok: true, reply, trace };
      }

      // Action d'écriture → interceptée et proposée (rien n'est exécuté).
      const write = toolUses.find((t) => WRITE_TOOL_NAMES.has(t.name));
      if (write) {
        const proposal = await buildProposal(write.name, write.input, user);
        if ("error" in proposal) {
          if (streamed) emit({ type: "reset" });
          messages.push({ role: "assistant", content: blocks });
          messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: write.id, content: proposal.error, is_error: true }] });
          continue;
        }
        const reply = textOf(blocks) || `Je propose de ${proposal.title.toLowerCase()}. Confirmez-vous ?`;
        if (!streamed) emit({ type: "delta", text: reply });
        return { configured: true, ok: true, reply, trace, proposal };
      }

      // Outils de lecture : le préambule éventuel est effacé, puis on annonce chaque étape.
      if (streamed) emit({ type: "reset" });
      const results: ClaudeContentBlock[] = [];
      for (const tu of toolUses) {
        const out = await executeReadTool(tu.name, tu.input, user).catch((e) => {
          console.error("[assistant] read tool failed", tu.name, e);
          return "Erreur lors de la lecture des données.";
        });
        const label = READ_LABEL[tu.name];
        if (label && !trace.includes(label)) { trace.push(label); emit({ type: "trace", label }); }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      messages.push({ role: "assistant", content: blocks });
      messages.push({ role: "user", content: results });
    }

    return { configured: true, ok: true, reply: "Je n'ai pas pu finaliser la demande en peu d'étapes. Reformulez en précisant l'objectif.", trace };
  } catch (err) {
    console.error("[assistant] runAssistantStream failed", err);
    return { configured: true, ok: false, reply: "", trace, error: "Une erreur est survenue côté assistant. Reformulez votre demande ou réessayez dans un instant." };
  }
}

// ───────────────────────────── Exécution (après confirmation) ─────────────────────────────

export interface ExecuteResult {
  ok: boolean;
  message?: string;
  link?: string;
  error?: string;
  /** Chemins à revalider — appliqués par le wrapper « use server ». */
  revalidate?: string[];
}

async function activeUserId(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
  return u && u.isActive ? u.id : null;
}

/** Référence ROBUSTE (dérivée du maximum réel, jamais `count()+1` qui entre en collision après une
 *  suppression → violation d'unicité → « L'action n'a pas pu être exécutée »). */
async function nextRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.administrativeRequest.findMany({
    where: { reference: { startsWith: `REQ-${year}-` } },
    select: { reference: true },
  });
  return buildRef("REQ", year, refs.map((r) => r.reference));
}

function priorityOf(p: string | null | undefined): Priority {
  const up = (p ?? "").toUpperCase();
  return (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).includes(up as Priority) ? (up as Priority) : "MEDIUM";
}

function dateValue(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Exécute une action confirmée. **Toujours ré-autorisé** par rapport aux droits
 * réels (jamais sur la seule confiance du client) puis journalisé. Le wrapper
 * `executeAssistantAction` (« use server ») fournit l'utilisateur authentifié et
 * applique la revalidation. C'est le seul point d'écriture du chatbot.
 */
export async function performAction(user: CurrentUser, payload: AssistantActionPayload): Promise<ExecuteResult> {
  if (payload?.kind === "update_regulatory_product") {
    if (!userCan(user, "REGULATORY", "UPDATE")) return { ok: false, error: "Vous n'avez pas le droit de modifier les dossiers Regulatory." };
    const spec = regFieldSpec(payload.field);
    if (!spec) return { ok: false, error: "Champ non modifiable." };

    // On REVÉRIFIE le périmètre à l'exécution : entre l'aperçu et le clic, le dossier a pu
    // changer d'entité — ou la personne, de portée.
    const target = await prisma.regulatoryProduct.findFirst({
      where: { AND: [{ id: payload.productId }, scopeRegulatory(user), await currentCompanyWhereFor(user.id)] },
      select: { id: true, reference: true },
    });
    if (!target) return { ok: false, error: "Ce dossier n'est plus dans votre périmètre." };

    await prisma.regulatoryProduct.update({
      where: { id: target.id },
      data: { [payload.field]: payload.value, updatedById: user.id } as Record<string, unknown>,
    });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Assistant IA",
      entityType: "REGULATORY_PRODUCT", entityId: target.id,
      field: payload.fieldLabel, oldValue: payload.before, newValue: payload.after,
      summary: `${target.reference} — ${payload.fieldLabel} : ${payload.before || "(vide)"} → ${payload.after || "(vide)"} (via l'assistant)`,
    });
    return {
      ok: true,
      message: `${target.reference} — ${payload.fieldLabel} : ${payload.after || "(vide)"}.`,
      link: `/regulatory/${target.id}`,
      revalidate: ["/regulatory", `/regulatory/${target.id}`],
    };
  }

  if (payload?.kind === "update_platform_setting") {
    if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Les réglages de la plateforme sont réservés au Super Admin." };
    if (!settingSpec(payload.settingKey)) return { ok: false, error: "Réglage non modifiable." };

    // La ligne « global » est créée si elle n'existe pas encore : une plateforme neuve tourne
    // sur les valeurs par défaut, sans enregistrement en base.
    await prisma.appSetting.upsert({
      where: { id: "global" },
      update: { [payload.settingKey]: payload.value } as Record<string, unknown>,
      create: { id: "global", [payload.settingKey]: payload.value } as Record<string, unknown> & { id: string },
    });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Assistant IA",
      field: payload.settingLabel, oldValue: payload.before, newValue: payload.after,
      summary: `Réglage « ${payload.settingLabel} » : ${payload.before} → ${payload.after} (via l'assistant)`,
    });
    return {
      ok: true,
      message: `« ${payload.settingLabel} » : ${payload.after}.`,
      link: "/admin/settings",
      // Un réglage touche la plateforme entière (menu compris quand il s'agit des modules
      // masqués) : on rafraîchit la mise en page, pas une page.
      revalidate: ["/", "/admin/settings"],
    };
  }

  if (payload?.kind === "set_products_company") {
    if (!userCan(user, "REGULATORY", "UPDATE")) return { ok: false, error: "Vous n'avez pas le droit de modifier les dossiers Regulatory." };
    const company = await prisma.company.findFirst({
      where: { id: payload.companyId, isActive: true },
      select: { id: true, name: true, shortName: true },
    });
    if (!company) return { ok: false, error: "Entité introuvable ou désactivée." };

    // On REJOUE le filtre montré à la confirmation, puis on l'INTERSECTE avec les références
    // affichées : le filtre garantit qu'on reste dans le périmètre de la personne, la liste
    // garantit qu'on ne touche pas un produit créé entre l'aperçu et le clic.
    const where = productBulkWhere(user, {
      query: payload.query, category: payload.category,
      onlyWithoutCompany: payload.onlyWithoutCompany, excludeCompanyId: company.id,
    });
    const refs = Array.isArray(payload.references) ? payload.references.filter((r) => typeof r === "string") : [];
    if (refs.length === 0) return { ok: false, error: "Aucun produit à rattacher." };

    const targets = await prisma.regulatoryProduct.findMany({
      where: { AND: [where, { reference: { in: refs } }] },
      select: { id: true, reference: true },
    });
    if (targets.length === 0) return { ok: false, error: "Ces produits ne sont plus concernés (déjà rattachés, ou hors de votre périmètre)." };

    await prisma.regulatoryProduct.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { companyId: company.id },
    });
    const label = company.shortName || company.name;
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Assistant IA", entityType: "REGULATORY_PRODUCT",
      entityId: targets[0].id,
      summary: `${targets.length} produit(s) rattaché(s) à l'entité ${label} via l'assistant : ${targets.map((t) => t.reference).join(", ")}`,
    });
    return {
      ok: true,
      message: `${targets.length} produit(s) rattaché(s) à ${label}.`,
      link: "/regulatory",
      revalidate: ["/regulatory", "/regulatory/produits"],
    };
  }

  if (payload?.kind === "create_task") {
    if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit de créer une tâche." };
    const title = (payload.title ?? "").trim();
    if (!title) return { ok: false, error: "Intitulé de tâche manquant." };

    const assignedToId = (await activeUserId(payload.assigneeId)) ?? user.id;
    const created = await prisma.task.create({
      data: {
        title, description: payload.description?.trim() || null,
        assignedToId, createdById: user.id,
        dueDate: dateValue(payload.dueDate), priority: priorityOf(payload.priority),
      },
      select: { id: true },
    });
    if (assignedToId !== user.id) {
      await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Nouvelle tâche assignée", body: title, link: "/mon-espace" });
    }
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Assistant IA", entityType: "TASK",
      entityId: created.id, summary: `Tâche « ${title} » créée via l'assistant`,
    });
    return { ok: true, message: `Tâche « ${title} » créée.`, link: "/mon-espace", revalidate: ["/mon-espace", "/mon-travail"] };
  }

  if (payload?.kind === "create_dossier") {
    if (!userCan(user, "DOSSIERS", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit d'ouvrir un dossier." };
    const title = (payload.title ?? "").trim();
    if (!title) return { ok: false, error: "Sujet du dossier manquant." };
    const assignedToId = await activeUserId(payload.assigneeId);
    const { id, reference } = await createDossierRecord(
      {
        title,
        description: payload.description?.trim() || null,
        category: payload.category?.trim() || null,
        priority: priorityOf(payload.priority),
        assignedToId,
        dueDate: dateValue(payload.dueDate),
      },
      user.id,
    );
    return { ok: true, message: `Dossier ${reference} ouvert.`, link: `/dossiers/${id}`, revalidate: ["/dossiers", "/mon-travail"] };
  }

  if (payload?.kind === "create_admin_request") {
    if (!userCan(user, "ADMIN_REQUESTS", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit de créer une demande administrative." };
    const validTypes: AdminRequestType[] = ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"];
    const type = (payload.type ?? "").toUpperCase() as AdminRequestType;
    const title = (payload.title ?? "").trim();
    if (!validTypes.includes(type)) return { ok: false, error: "Type de demande invalide." };
    if (!title) return { ok: false, error: "Titre de demande manquant." };

    const assignedToId = await activeUserId(payload.assigneeId);
    const concernedUserId = await activeUserId(payload.concernedId);
    const extraFields: Record<string, string> = {};
    if (payload.startDate) extraFields.dateDebut = payload.startDate;
    if (payload.endDate) extraFields.dateFin = payload.endDate;
    // Référence recalculée à CHAQUE tentative (robuste à une collision concurrente / post-suppression).
    const created = await createWithRetry(async () => {
      const reference = await nextRequestRef();
      return prisma.administrativeRequest.create({
        data: {
          reference, title, type,
          description: payload.description?.trim() || null,
          priority: priorityOf(payload.priority),
          deadline: dateValue(payload.deadline) ?? dateValue(payload.startDate),
          fields: Object.keys(extraFields).length ? extraFields : undefined,
          assignedToId, concernedUserId, requesterId: user.id, createdById: user.id,
          // Entité : même règle que par formulaire — la portée en cours, sinon la société
          // d'appartenance. Une demande créée par l'assistant n'échappe pas au cloisonnement.
          companyId: await companyIdForNew(user.id),
        },
        select: { id: true, reference: true },
      });
    });
    // Effets de bord NON bloquants : une notification/un audit en échec ne doit pas faire croire
    // que la demande n'a pas été créée (elle l'est).
    if (assignedToId && assignedToId !== user.id) {
      await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Nouvelle demande administrative", body: `${created.reference} — ${title}`, link: `/demandes/${created.id}` }).catch(() => undefined);
    }
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Assistant IA", entityType: "ADMIN_REQUEST",
      entityId: created.id, summary: `Demande ${created.reference} — ${title} créée via l'assistant`,
    }).catch(() => undefined);
    return { ok: true, message: `Demande ${created.reference} — « ${title} » créée.`, link: `/demandes/${created.id}`, revalidate: ["/demandes", "/demandes/assistant"] };
  }

  if (payload?.kind === "send_message") {
    if (!userCan(user, "MESSAGING", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit d'envoyer un message." };
    const body = (payload.body ?? "").trim().slice(0, 8000);
    if (!body) return { ok: false, error: "Message vide." };
    const recipientId = await activeUserId(payload.recipientId);
    if (!recipientId || recipientId === user.id) return { ok: false, error: "Destinataire invalide." };

    let convId = await findDirectConversation(user.id, recipientId);
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: { type: "DIRECT", createdById: user.id, members: { create: [{ userId: user.id }, { userId: recipientId }] } },
        select: { id: true },
      });
      convId = conv.id;
    }
    const msg = await prisma.message.create({ data: { conversationId: convId, senderId: user.id, kind: "TEXT", body }, select: { createdAt: true } });
    await prisma.conversation.update({ where: { id: convId }, data: { lastMessageAt: msg.createdAt } });
    await prisma.conversationMember.updateMany({ where: { conversationId: convId, userId: user.id }, data: { lastReadAt: msg.createdAt } });
    await notifyUser({ userId: recipientId, type: "GENERIC", title: "Nouveau message", body: body.slice(0, 80), link: "/messages" });
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", entityId: convId, summary: `Message envoyé via l'assistant à ${payload.recipientName ?? "un collègue"}` });
    return { ok: true, message: `Message envoyé à ${payload.recipientName ?? "votre collègue"}.`, link: "/messages", revalidate: ["/messages"] };
  }

  if (payload?.kind === "send_email") {
    // L'autorisation est inhérente : on n'envoie que depuis la propre boîte connectée de l'utilisateur.
    const account = await getMailAccount(user.id);
    if (!account) return { ok: false, error: "Aucune boîte mail connectée. Connectez votre boîte dans Courrier." };
    const to = (payload.to ?? "").trim();
    const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
    if (!isEmail(to)) return { ok: false, error: "Adresse destinataire invalide." };
    const body = (payload.body ?? "").trim().slice(0, 50000);
    if (!body) return { ok: false, error: "E-mail vide." };
    const cc = (payload.cc ?? "").trim();
    try {
      await sendMail(account, { to, cc: cc || undefined, subject: (payload.subject ?? "").trim() || "(sans objet)", text: body });
    } catch (e) {
      return { ok: false, error: `Envoi impossible : ${(e as Error)?.message ?? "erreur SMTP"}.` };
    }
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", summary: `E-mail envoyé via l'assistant à ${to}` });
    return { ok: true, message: `E-mail envoyé à ${to}.`, link: "/courrier", revalidate: ["/courrier"] };
  }

  if (payload?.kind === "create_calendar_event") {
    if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Vous n'avez pas accès au calendrier." };
    const title = (payload.title ?? "").trim();
    if (!title) return { ok: false, error: "Intitulé du rendez-vous manquant." };
    const allDay = payload.allDay === true;
    const startAt = algiersInputToUtc(`${payload.date}T${allDay ? "00:00" : (payload.time || "09:00")}`);
    if (!startAt) return { ok: false, error: "Date de rendez-vous invalide." };
    const endAt = payload.durationMin && payload.durationMin > 0 ? new Date(startAt.getTime() + payload.durationMin * 60000) : null;
    const kind = ((CALENDAR_KINDS as string[]).includes((payload.eventKind ?? "").toUpperCase()) ? (payload.eventKind as string).toUpperCase() : "APPOINTMENT") as CalendarEventKind;
    const inviteeIds = (payload.inviteeIds ?? []).filter(Boolean);
    await createEventForUser(user.id, {
      title, description: payload.description?.trim() || null, location: payload.location?.trim() || null,
      kind, startAt, endAt, allDay, meetLink: payload.meetLink?.trim() || null, inviteeIds,
    });
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", summary: `Rendez-vous « ${title} » planifié via l'assistant` });
    return { ok: true, message: `Rendez-vous « ${title} » ajouté au calendrier.`, link: "/calendar", revalidate: ["/calendar"] };
  }

  if (payload?.kind === "create_congress_request") {
    const scope = payload.scope === "INTL" ? "INTL" : "NATIONAL";
    const mod: Module = scope === "INTL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL";
    if (!userCan(user, mod, "CREATE")) return { ok: false, error: "Vous n'avez pas le droit de créer cette demande de congrès." };
    const name = (payload.name ?? "").trim();
    if (!name) return { ok: false, error: "Nom de l'événement manquant." };

    let invitedDoctorIds: string[] = [];
    if (payload.doctorId) {
      const d = await prisma.medicalDoctor.findFirst({ where: { AND: [scopeMedicalDoctors(user), { id: payload.doctorId }] }, select: { id: true } });
      if (d) invitedDoctorIds = [d.id];
    }
    const common = {
      name, specialty: payload.specialty?.trim() || null,
      estimatedBudget: payload.estimatedBudget ?? null,
      invitedDoctorIds, participantIds: [] as string[],
      requesterId: user.id, requestStatus: "AWAITING_PRELIMINARY" as CongressRequestStatus, createdById: user.id,
      companyId: await companyIdForNew(user.id),
    };
    const created = scope === "INTL"
      ? await prisma.congressInternational.create({
          data: { ...common, country: payload.country?.trim() || null, city: payload.city?.trim() || null, startDate: dateValue(payload.startDate), endDate: dateValue(payload.endDate) },
          select: { id: true },
        })
      : await prisma.congressNational.create({
          data: { ...common, city: payload.city?.trim() || null, date: dateValue(payload.startDate), eventType: "CONGRESS" },
          select: { id: true },
        });
    const path = scope === "INTL" ? "/congress-international" : "/congress-national";
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", entityType: scope === "INTL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL", entityId: created.id, summary: `Demande de congrès « ${name} » créée via l'assistant` });
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Demande de congrès à valider (préliminaire)", body: name, link: `${path}/${created.id}` });
    return { ok: true, message: `Demande de congrès « ${name} » créée (en attente de validation préliminaire de la Direction).`, link: `${path}/${created.id}`, revalidate: [path] };
  }

  if (payload?.kind === "create_hr_request") {
    const type = (payload.type ?? "").toUpperCase();
    if (!HR_REQUEST_TYPES.includes(type)) return { ok: false, error: "Type de demande RH inconnu." };
    // Libre-service : la demande est créée pour le dossier RH de l'utilisateur (jamais pour un autre).
    const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true, fullName: true } });
    if (!employee) return { ok: false, error: "Aucun dossier RH n'est lié à votre compte. Contactez les RH." };
    const expenseMonth = type === "EXPENSE_REPORT" ? (payload.expenseMonth ?? "").trim() : "";
    if (type === "EXPENSE_REPORT" && !YM_RE.test(expenseMonth)) return { ok: false, error: "Mois de la note de frais manquant ou invalide (AAAA-MM)." };
    const periodStart = dateValue(payload.periodStart);
    const periodEnd = dateValue(payload.periodEnd);
    if (HR_PERIOD_TYPES.has(type) && !periodStart) return { ok: false, error: "Date de début du congé / de l'absence manquante." };
    if (HR_LEAVE_TYPES.has(type) && !periodEnd) return { ok: false, error: "Date de fin du congé manquante." };
    if (periodStart && periodEnd && periodEnd < periodStart) return { ok: false, error: "La date de fin précède la date de début." };
    const periodDays = periodStart && periodEnd ? Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1 : null;
    await prisma.hrDocumentRequest.create({
      data: {
        employeeId: employee.id, type: type as HrRequestType, details: payload.details?.trim() || null,
        expenseMonth: type === "EXPENSE_REPORT" ? expenseMonth : null,
        periodStart, periodEnd, periodDays,
      },
    });
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", entityType: "EMPLOYEE", entityId: employee.id, summary: `Demande RH « ${HR_REQUEST_FR[type]} » créée via l'assistant` });
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "GENERIC", title: "Nouvelle demande RH", body: `${employee.fullName} — ${HR_REQUEST_FR[type]}`, link: `/rh/${employee.id}` });
    return { ok: true, message: `Demande RH « ${HR_REQUEST_FR[type]} » créée (en attente de traitement RH).`, link: "/mon-dossier", revalidate: ["/mon-dossier", "/rh"] };
  }

  if (payload?.kind === "create_sponsoring_request") {
    if (!userCan(user, "SPONSORING", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit de créer une demande de sponsoring." };
    const institution = (payload.institution ?? "").trim();
    if (!institution) return { ok: false, error: "L'institution / bénéficiaire est obligatoire." };
    const fd = new FormData();
    fd.set("institution", institution);
    if (payload.type) fd.set("type", payload.type);
    if (payload.specialty) fd.set("specialty", payload.specialty);
    if (payload.city) fd.set("city", payload.city);
    if (payload.product) fd.set("product", payload.product);
    if (payload.doctorName) fd.set("doctor", payload.doctorName);
    if (payload.description) fd.set("description", payload.description);
    if (payload.amountRequested != null) fd.set("amountRequested", String(payload.amountRequested));
    const r = await createSponsoring(undefined, fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La demande de sponsoring n'a pas pu être créée." };
    return { ok: true, message: `Demande de sponsoring « ${institution} » créée (en attente de validation).`, link: "/sponsoring", revalidate: ["/sponsoring"] };
  }

  if (payload?.kind === "create_event_request") {
    if (!userCan(user, "EVENTS", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit de créer un événement." };
    const name = (payload.name ?? "").trim();
    if (!name) return { ok: false, error: "Le nom de l'événement est obligatoire." };
    const fd = new FormData();
    fd.set("name", name);
    if (payload.specialty) fd.set("specialty", payload.specialty);
    if (payload.city) fd.set("city", payload.city);
    if (payload.country) fd.set("country", payload.country);
    if (payload.startDate) fd.set("startDate", payload.startDate);
    if (payload.endDate) fd.set("endDate", payload.endDate);
    if (payload.description) fd.set("description", payload.description);
    if (payload.estimatedBudget != null) fd.set("estimatedBudget", String(payload.estimatedBudget));
    const r = await createEvent(fd);
    if (!r.ok) return { ok: false, error: r.error ?? "L'événement n'a pas pu être créé." };
    return { ok: true, message: `Événement « ${name} » créé.`, link: "/events", revalidate: ["/events"] };
  }

  if (payload?.kind === "create_promo_material_request") {
    if (!userCan(user, "PROMO_MATERIAL", "CREATE")) return { ok: false, error: "La demande de matériel promotionnel est réservée au Marketing." };
    const title = (payload.title ?? "").trim();
    if (!title) return { ok: false, error: "L'intitulé du matériel est obligatoire." };
    const fd = new FormData();
    fd.set("title", title);
    if (payload.materialType) fd.set("materialType", payload.materialType);
    if (payload.description) fd.set("description", payload.description);
    if (payload.amount != null) fd.set("amount", String(payload.amount));
    const r = await createPromoMaterial(undefined, fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La demande de matériel promotionnel n'a pas pu être créée." };
    return { ok: true, message: `Demande de matériel promotionnel « ${title} » créée (prospection d'agences lancée).`, revalidate: ["/demandes"] };
  }

  if (payload?.kind === "decide_payment") {
    // L'exécution repasse par L'ACTION DU CENTRE — la même que l'écran : elle revérifie qui
    // siège, si la décision a encore un sens (transition), écrit le fil et prévient qui attend.
    // Ne pas dupliquer cette logique ici : deux implémentations divergeraient un jour de paie.
    if (!sitsOnPaymentCentre(user)) return { ok: false, error: "Seuls le PDG et le Super Admin siègent au centre de paiement." };
    const fd = new FormData();
    fd.set("id", payload.orderId);
    fd.set("decision", payload.decision);
    if (payload.note) fd.set("body", payload.note);
    if (payload.proposedAmount != null) fd.set("proposedAmount", String(payload.proposedAmount));
    const r = await decidePayment(fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La décision n'a pas pu être enregistrée." };
    return {
      ok: true,
      message: `${CENTRAL_DECISION_LABEL[payload.decision]} — ${payload.reference} (${payload.amountDzd.toLocaleString("fr-FR")} DZD).`,
      link: "/centre-de-paiement",
      revalidate: ["/centre-de-paiement", "/finances/ordres-de-depense"],
    };
  }

  if (payload?.kind === "create_notification") {
    // Diffusion réservée au Super Admin (revérifiée ici, jamais sur la confiance du client).
    if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Seul le Super Admin peut diffuser des notifications." };
    const title = (payload.title ?? "").trim();
    if (!title) return { ok: false, error: "Titre de la notification manquant." };
    const count = await broadcastNotification({
      audience: payload.audience,
      role: payload.role ?? undefined,
      userIds: payload.userIds ?? undefined,
      title,
      body: payload.body?.trim() || undefined,
      link: payload.link?.trim() || undefined,
      popup: payload.popup === true,
    });
    if (count === 0) return { ok: false, error: "Aucun destinataire correspondant — rien n'a été envoyé." };
    const who = payload.audience === "ALL" ? "tous les comptes"
      : payload.audience === "ROLE" ? `le rôle ${ROLE_LABELS[(payload.role ?? "") as keyof typeof ROLE_LABELS] ?? payload.role}`
      : (payload.recipientNames ?? "les destinataires choisis");
    const fmt = payload.popup === true ? " en pop-up plein écran" : "";
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", summary: `Notification « ${title} »${fmt} diffusée via l'assistant à ${count} destinataire(s) (${who})` });
    return { ok: true, message: `Notification envoyée${fmt} à ${count} destinataire(s) — ${who}.`, link: "/notifications", revalidate: ["/notifications"] };
  }

  if (payload?.kind === "update_task") {
    // Même frontière qu'à la proposition, REVÉRIFIÉE : la tâche a pu changer de main entre-temps.
    const task = await prisma.task.findFirst({
      where: {
        AND: [
          { id: payload.taskId },
          hasGlobalView(user) ? {} : { OR: [{ assignedToId: user.id }, { createdById: user.id }] },
        ],
      },
      select: { id: true, title: true, assignedToId: true, status: true },
    });
    if (!task) return { ok: false, error: "Cette tâche n'est plus dans votre périmètre." };

    const data: Record<string, unknown> = {};
    const summary: string[] = [];
    if (payload.assigneeId) {
      const a = await activeUserId(payload.assigneeId);
      if (!a) return { ok: false, error: "Le nouveau responsable n'est plus actif." };
      data.assignedToId = a;
      summary.push(`réassignée à ${payload.assigneeName ?? "un collègue"}`);
    }
    if (payload.clearDueDate) { data.dueDate = null; summary.push("échéance retirée"); }
    else if (payload.dueDate) { data.dueDate = dateValue(payload.dueDate); summary.push(`échéance ${payload.dueDate}`); }
    if (payload.priority) { data.priority = priorityOf(payload.priority); summary.push(`priorité ${payload.priority}`); }
    if (payload.status && ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"].includes(payload.status)) {
      data.status = payload.status;
      if (payload.status === "DONE") data.completedAt = new Date();
      summary.push(`statut ${payload.status}`);
    }
    if (Object.keys(data).length > 0) await prisma.task.update({ where: { id: task.id }, data });
    if (payload.comment?.trim()) {
      await prisma.taskComment.create({ data: { taskId: task.id, authorId: user.id, body: payload.comment.trim().slice(0, 4000) } });
      summary.push("commentaire ajouté");
    }
    // Prévenir qui porte la tâche — l'ancien assigné n'apprend pas un retrait par hasard,
    // le nouveau apprend son arrivée tout de suite.
    const notifyTargets = new Set<string>();
    if (data.assignedToId && data.assignedToId !== user.id) notifyTargets.add(data.assignedToId as string);
    if (task.assignedToId && task.assignedToId !== user.id) notifyTargets.add(task.assignedToId);
    await Promise.all([...notifyTargets].map((uid) =>
      notifyUser({ userId: uid, type: "GENERIC", title: "Tâche mise à jour", body: `${task.title} — ${summary.join(", ")}`, link: "/mon-espace" }).catch(() => undefined),
    ));
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Assistant IA", entityType: "TASK", entityId: task.id,
      summary: `Tâche « ${task.title} » — ${summary.join(", ")} (via l'assistant)`,
    }).catch(() => undefined);
    return { ok: true, message: `Tâche « ${task.title} » : ${summary.join(", ")}.`, link: "/mon-espace", revalidate: ["/mon-espace", "/mon-travail"] };
  }

  if (payload?.kind === "update_request") {
    // L'exécution repasse par LES ACTIONS DU MODULE : mêmes gardes (gestionnaire), mêmes
    // notifications au demandeur, même archivage sur DONE. On ne réécrit pas ces règles ici.
    const done: string[] = [];
    if (payload.assigneeId) {
      const fd = new FormData();
      fd.set("id", payload.requestId);
      fd.set("assignedToId", payload.assigneeId);
      const r = await assignRequest(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Réassignation refusée." };
      done.push(`réassignée à ${payload.assigneeName ?? "un collègue"}`);
    }
    if (payload.status) {
      const fd = new FormData();
      fd.set("id", payload.requestId);
      fd.set("status", payload.status);
      const r = await updateRequestStatus(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Changement de statut refusé." };
      done.push(`statut ${payload.status}`);
    }
    if (payload.comment?.trim()) {
      const fd = new FormData();
      fd.set("id", payload.requestId);
      fd.set("body", payload.comment.trim());
      const r = await addRequestComment(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Commentaire refusé." };
      done.push("commentaire ajouté");
    }
    if (done.length === 0) return { ok: false, error: "Aucun changement à appliquer." };
    return { ok: true, message: `Demande ${payload.reference} : ${done.join(", ")}.`, link: `/demandes/${payload.requestId}`, revalidate: ["/demandes", `/demandes/${payload.requestId}`] };
  }

  if (payload?.kind === "create_legal_document") {
    // `createLegalDocument` revérifie LEGAL CREATE, la validité des dates et la pièce amont.
    const fd = new FormData();
    fd.set("kind", payload.docKind);
    fd.set("title", payload.title);
    if (payload.reference) fd.set("reference", payload.reference);
    if (payload.counterparty) fd.set("counterparty", payload.counterparty);
    if (payload.amount != null) fd.set("amount", String(payload.amount));
    if (payload.startDate) fd.set("startDate", payload.startDate);
    if (payload.endDate) fd.set("endDate", payload.endDate);
    if (payload.notes) fd.set("notes", payload.notes);
    if (payload.chainFromId) fd.set("chainFromId", payload.chainFromId);
    const r = await createLegalDocument(undefined, fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La pièce n'a pas pu être déclarée." };
    return {
      ok: true,
      message: `Pièce « ${payload.title} » déclarée au Legal${payload.chainFromLabel ? ` (chaînée à ${payload.chainFromLabel})` : ""}.`,
      link: r.id ? `/legal/${r.id}` : "/legal",
      revalidate: ["/legal"],
    };
  }

  if (payload?.kind === "update_legal_document") {
    // `updateLegalDocument` REMPLACE tous les champs : on relit la fiche et l'on ne change que
    // ce qui a été confirmé — jamais un champ effacé par omission.
    const current = await prisma.legalDocument.findUnique({
      where: { id: payload.documentId },
      select: { id: true, title: true, reference: true, kind: true, counterparty: true, amount: true, startDate: true, endDate: true, notes: true, folderId: true, chainFromId: true },
    });
    if (!current) return { ok: false, error: "Cette pièce Legal n'existe plus." };
    const u = payload.updates;
    const fd = new FormData();
    fd.set("id", current.id);
    fd.set("kind", current.kind);
    fd.set("title", u.title ?? current.title);
    fd.set("reference", u.reference ?? current.reference ?? "");
    fd.set("counterparty", u.counterparty ?? current.counterparty ?? "");
    fd.set("amount", u.amount != null ? String(u.amount) : current.amount != null ? String(toNumber(current.amount)) : "");
    fd.set("startDate", u.startDate ?? (current.startDate ? current.startDate.toISOString().slice(0, 10) : ""));
    fd.set("endDate", u.endDate ?? (current.endDate ? current.endDate.toISOString().slice(0, 10) : ""));
    fd.set("notes", u.notes ?? current.notes ?? "");
    fd.set("folderId", current.folderId ?? "");
    fd.set("chainFromId", u.chainFromId ?? current.chainFromId ?? "");
    const r = await updateLegalDocument(fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La modification a été refusée." };
    return {
      ok: true,
      message: `Pièce « ${u.title ?? current.title} » modifiée (${payload.changes.join(", ")}).`,
      link: `/legal/${current.id}`,
      revalidate: ["/legal", `/legal/${current.id}`],
    };
  }

  if (payload?.kind === "update_calendar_event") {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: payload.eventId },
      select: {
        id: true, title: true, description: true, location: true, kind: true, startAt: true, endAt: true,
        allDay: true, color: true, meetLink: true, organizerId: true,
        invitees: { select: { userId: true } },
      },
    });
    if (!event) return { ok: false, error: "Ce rendez-vous n'existe plus." };
    if (event.organizerId !== user.id && !hasGlobalView(user)) {
      return { ok: false, error: "Seul l'organisateur (ou une vue globale) peut modifier ce rendez-vous." };
    }
    if (payload.cancel) {
      const fd = new FormData();
      fd.set("id", event.id);
      const r = await deleteCalendarEvent(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'annulation a été refusée." };
      await recordAudit({ actorId: user.id, action: "DELETE", module: "Assistant IA", summary: `Rendez-vous « ${event.title} » annulé via l'assistant` }).catch(() => undefined);
      return { ok: true, message: `Rendez-vous « ${event.title} » annulé.`, link: "/calendar", revalidate: ["/calendar"] };
    }
    // `updateCalendarEvent` remplace tout : on reconstruit l'état complet, overrides compris.
    const currentStartAlgiers = new Date(event.startAt.getTime() + 3_600_000);
    const p = (n: number) => String(n).padStart(2, "0");
    const curDate = `${currentStartAlgiers.getUTCFullYear()}-${p(currentStartAlgiers.getUTCMonth() + 1)}-${p(currentStartAlgiers.getUTCDate())}`;
    const curTime = `${p(currentStartAlgiers.getUTCHours())}:${p(currentStartAlgiers.getUTCMinutes())}`;
    const newDate = payload.date ?? curDate;
    const newTime = event.allDay ? "00:00" : (payload.time ?? curTime);
    const durMs = payload.durationMin != null
      ? payload.durationMin * 60_000
      : event.endAt ? event.endAt.getTime() - event.startAt.getTime() : null;
    const startAt = algiersInputToUtc(`${newDate}T${newTime}`);
    if (!startAt) return { ok: false, error: "Nouvelle date invalide." };
    const fd = new FormData();
    fd.set("id", event.id);
    fd.set("title", event.title);
    fd.set("description", event.description ?? "");
    fd.set("location", payload.location ?? event.location ?? "");
    fd.set("kind", event.kind);
    fd.set("allDay", event.allDay ? "true" : "");
    fd.set("start", event.allDay ? newDate : `${newDate}T${newTime}`);
    if (durMs != null && !event.allDay) {
      const end = new Date(startAt.getTime() + durMs);
      const endAlg = new Date(end.getTime() + 3_600_000);
      fd.set("end", `${endAlg.getUTCFullYear()}-${p(endAlg.getUTCMonth() + 1)}-${p(endAlg.getUTCDate())}T${p(endAlg.getUTCHours())}:${p(endAlg.getUTCMinutes())}`);
    }
    fd.set("color", event.color ?? "");
    fd.set("meetLink", event.meetLink ?? "");
    for (const inv of event.invitees) fd.append("inviteeIds", inv.userId);
    const r = await updateCalendarEvent(undefined, fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La modification a été refusée." };
    await recordAudit({ actorId: user.id, action: "UPDATE", module: "Assistant IA", summary: `Rendez-vous « ${event.title} » déplacé via l'assistant (${payload.changes.join(", ")})` }).catch(() => undefined);
    return { ok: true, message: `Rendez-vous « ${event.title} » mis à jour (${payload.changes.join(", ")}).`, link: "/calendar", revalidate: ["/calendar"] };
  }

  if (payload?.kind === "create_hospital") {
    const name = (payload.name ?? "").trim();
    if (!name) return { ok: false, error: "Nom manquant." };
    if (payload.registre === "STOCKS") {
      // `createStockHospital` / `createStockAnnex` revérifient : Super Admin uniquement.
      const fd = new FormData();
      fd.set("name", name);
      const r = payload.annexKind === "ANNEX" ? await createStockAnnex(fd) : await createStockHospital(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'ajout a été refusé." };
      return { ok: true, message: `« ${name} » ajouté aux lieux de stock.`, link: "/stocks", revalidate: ["/stocks"] };
    }
    const fd = new FormData();
    fd.set("name", name);
    if (payload.institutionType) fd.set("type", payload.institutionType);
    if (payload.sector) fd.set("sector", payload.sector);
    if (payload.wilaya) fd.set("wilaya", payload.wilaya);
    if (payload.city) fd.set("city", payload.city);
    const r = await createInstitution(fd);
    if (!r.ok) return { ok: false, error: r.error ?? "L'ajout a été refusé." };
    return { ok: true, message: `Établissement « ${name} » ajouté à l'annuaire médical.`, link: "/medical", revalidate: ["/medical"] };
  }

  if (payload?.kind === "update_hospital") {
    const current = await prisma.medicalInstitution.findUnique({
      where: { id: payload.institutionId },
      select: { id: true, name: true, type: true, sector: true, wilaya: true, city: true, region: true, address: true, phone: true, email: true, notes: true, isActive: true },
    });
    if (!current) return { ok: false, error: "Cet établissement n'existe plus." };
    const u = payload.updates;
    // `updateInstitution` remplace tout : l'état complet, overrides compris.
    const fd = new FormData();
    fd.set("id", current.id);
    fd.set("name", u.newName ?? current.name);
    fd.set("type", u.type ?? current.type);
    fd.set("sector", u.sector ?? current.sector);
    fd.set("wilaya", u.wilaya ?? current.wilaya ?? "");
    fd.set("city", u.city ?? current.city ?? "");
    fd.set("region", current.region ?? "");
    fd.set("address", current.address ?? "");
    fd.set("phone", u.phone ?? current.phone ?? "");
    fd.set("email", u.email ?? current.email ?? "");
    fd.set("notes", u.notes ?? current.notes ?? "");
    if (u.isActive != null) fd.set("isActive", u.isActive ? "on" : "off");
    const r = await updateInstitution(fd);
    if (!r.ok) return { ok: false, error: r.error ?? "La modification a été refusée." };
    await recordAudit({ actorId: user.id, action: "UPDATE", module: "Assistant IA", summary: `Établissement « ${current.name} » modifié via l'assistant (${payload.changes.join(", ")})` }).catch(() => undefined);
    return { ok: true, message: `Établissement « ${u.newName ?? current.name} » modifié (${payload.changes.join(", ")}).`, link: "/medical", revalidate: ["/medical"] };
  }

  if (payload?.kind === "update_salary") {
    // NIVEAU CRITIQUE. Trois verrous, dans l'ordre : le DROIT (paie RH), la FRAÎCHEUR (les
    // montants « avant » montrés sur la carte doivent être ENCORE vrais — sinon on signerait
    // sur une photo périmée), puis l'écriture, champ par champ confirmé, avec audit détaillé.
    if (!userCan(user, "RH", "UPDATE")) return { ok: false, error: "La modification des salaires est réservée aux détenteurs du droit RH (modification)." };
    if (!Array.isArray(payload.fields) || payload.fields.length === 0) return { ok: false, error: "Aucun montant à modifier." };
    const emp = await prisma.employee.findFirst({
      where: { id: payload.employeeId, isActive: true },
      select: { id: true, fullName: true, baseSalary: true, netToPay: true, grossSalary: true, employerCost: true },
    });
    if (!emp) return { ok: false, error: "Cet employé n'est plus actif au registre RH." };

    const currentOf: Record<string, number | null> = {
      baseSalary: toNumber(emp.baseSalary),
      netToPay: emp.netToPay != null ? toNumber(emp.netToPay) : null,
      grossSalary: emp.grossSalary != null ? toNumber(emp.grossSalary) : null,
      employerCost: emp.employerCost != null ? toNumber(emp.employerCost) : null,
    };
    const data: Record<string, number> = {};
    const summary: string[] = [];
    for (const f of payload.fields) {
      if (!(f.field in currentOf)) return { ok: false, error: "Champ de salaire inconnu." };
      const now = currentOf[f.field] != null ? Math.round(currentOf[f.field] as number) : null;
      if (now !== f.before) {
        return { ok: false, error: `${f.label} a changé depuis la proposition (${now?.toLocaleString("fr-FR") ?? "vide"} DZD désormais). Relire read_payroll et reproposer.` };
      }
      if (typeof f.after !== "number" || !Number.isFinite(f.after) || f.after <= 0) return { ok: false, error: `${f.label} : montant invalide.` };
      data[f.field] = Math.round(f.after);
      summary.push(`${f.label} : ${f.before != null ? f.before.toLocaleString("fr-FR") : "(vide)"} → ${Math.round(f.after).toLocaleString("fr-FR")} DZD`);
    }
    await prisma.employee.update({ where: { id: emp.id }, data });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Assistant IA", entityType: "EMPLOYEE", entityId: emp.id,
      oldValue: payload.fields.map((f) => `${f.label}=${f.before ?? "∅"}`).join(" · "),
      newValue: payload.fields.map((f) => `${f.label}=${f.after}`).join(" · "),
      summary: `SALAIRE de ${emp.fullName} modifié via l'assistant — ${summary.join(" ; ")}${payload.note ? ` (${payload.note})` : ""}`,
    });
    return {
      ok: true,
      message: `Salaire de ${emp.fullName} mis à jour — ${summary.join(" ; ")}. La paie mensuelle se saisit toujours dans RH → Paie.`,
      link: "/rh",
      revalidate: ["/rh"],
    };
  }

  return { ok: false, error: "Action non reconnue." };
}
