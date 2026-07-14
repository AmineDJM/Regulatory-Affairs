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

import type { AdminRequestType, CongressRequestStatus, Priority, CalendarEventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRef, createWithRetry } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles, broadcastNotification, type BroadcastAudience } from "@/lib/notify";
import { createEventForUser, algiersInputToUtc, CALENDAR_KINDS } from "@/lib/calendar";
import { createDossierRecord } from "@/lib/dossiers-core";
import { findDirectConversation } from "@/lib/messaging";
import { getMailAccount, listMessages, getMessage, sendMail } from "@/lib/mail";
import {
  callClaude, aiConfigured,
  type ClaudeMessage, type ClaudeContentBlock, type ClaudeToolDef,
} from "@/lib/ai";
import {
  userCan, accessibleModules, type Module,
  scopeMedicalDoctors, scopeRegulatory, scopeAdminRequests,
} from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import {
  ROLE_LABELS, TASK_STATUS, PRIORITY, ADMIN_REQUEST_TYPE, ADMIN_REQUEST_STATUS,
  MEDICAL_SECTOR, INFLUENCE_LEVEL, REGULATORY_STATUS, EVENT_STATUS, EVENT_TYPE,
  doctorDisplayName,
} from "@/lib/labels";
import { regulatoryKnowledgeDigest } from "@/lib/regulatory/anpp-knowledge";

// ───────────────────────────── Types publics ─────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type AssistantActionPayload =
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
  error?: string;
}

// ───────────────────────────── Libellés modules ─────────────────────────────

const MODULE_FR: Partial<Record<Module, string>> = {
  DASHBOARD: "Tableau de bord", WORKSPACE: "Mon espace / tâches", MESSAGING: "Messagerie",
  REGULATORY: "Regulatory (AMM/ANPP)", SPONSORING: "Sponsoring", BUDGETS: "Budgets",
  FINANCES: "Finances", RH: "Ressources humaines", CONGRESS_INTERNATIONAL: "Congrès internationaux",
  CONGRESS_NATIONAL: "Congrès nationaux", EVENTS: "Events (billetterie)", SALES: "Ventes",
  LOGISTICS: "Logistique PCH", PCH: "Marchés PCH", STOCKS: "Stocks PCH",
  MEDICAL: "Promotion médicale", BUSINESS_DEVELOPMENT: "Business Development",
  VALIDATIONS: "Demandes de validations", DRIVE: "Drive", ADMIN_REQUESTS: "Bureau du secrétariat",
  PROCESS_INTELLIGENCE: "Process Intelligence", ADMIN: "Administration",
};

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
      "Recherche des produits Regulatory (DCI, nom commercial, référence) que l'utilisateur a le droit de voir. Ne jamais inventer un produit.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "DCI, nom commercial ou référence." } },
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
];

// Outils d'ÉCRITURE réservés au Super Admin (interceptés + confirmés, comme les autres).
const SUPERADMIN_WRITE_TOOLS: ClaudeToolDef[] = [
  {
    name: "create_notification",
    description:
      "RÉSERVÉ AU SUPER ADMIN : PROPOSE l'envoi d'une NOTIFICATION (diffusion) — à TOUS les comptes actifs, à un RÔLE précis, ou à des PERSONNES précises. N'exécute rien : confirmation requise. Pour des personnes précises, donner leurs noms séparés par des virgules (les résoudre via search_people si besoin). Pour un rôle, donner le libellé du rôle (ex. « Délégué médical », « Coordination », « Comptable »). La notification arrive dans la cloche + en push sur le téléphone des destinataires.",
    input_schema: {
      type: "object",
      properties: {
        audience: { type: "string", enum: ["ALL", "ROLE", "USERS"], description: "ALL = tous les comptes actifs ; ROLE = un rôle ; USERS = des personnes précises." },
        role: { type: "string", description: "Si audience=ROLE : libellé ou code du rôle ciblé." },
        recipientNames: { type: "string", description: "Si audience=USERS : noms des destinataires, séparés par des virgules." },
        title: { type: "string", description: "Titre de la notification." },
        body: { type: "string", description: "Texte du message (optionnel)." },
        link: { type: "string", description: "Lien interne optionnel (ex. /mon-espace, /notifications)." },
      },
      required: ["audience", "title"],
    },
  },
];

const WRITE_TOOLS: ClaudeToolDef[] = [
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
      "PROPOSE l'ouverture d'un DOSSIER DE SUIVI pour un sujet à déléguer et suivre dans le temps (ex. « rechercher des prix d'hôtels », « propositions d'hôtels », « analyse IQVIA », « comparer des billets »). À privilégier quand on confie à quelqu'un une recherche / analyse / veille que l'on veut suivre avec des fichiers et une discussion. N'exécute rien : confirmation requise. Résoudre le responsable avec search_people si un nom est cité.",
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
  return `Tu es « Assistant IA », l'assistant interne d'AMD Internal OS, l'outil de gestion d'Adventum Pharma
(laboratoire pharmaceutique algérien ; devise DZD ; principal client la PCH — Pharmacie Centrale des Hôpitaux).
Tu aides l'employé à comprendre l'application, à retrouver ses informations et à passer à l'action.
${user.role === "SUPER_ADMIN" ? `
TU ES L'ASSISTANT DU SUPER ADMIN — le plus puissant de l'application. Tu as une VISION GLOBALE de
toute l'entreprise (tous les modules, tous les comptes, toutes les données). Tu peux lister tous les
comptes et leur charge (list_accounts), interroger n'importe quel pôle, et RELANCER/PILOTER n'importe
qui (créer une tâche pour un collaborateur, lui envoyer un message). Tu peux aussi DIFFUSER UNE
NOTIFICATION (create_notification) à tous les comptes, à un rôle précis, ou à des personnes précises
(elle arrive dans la cloche + en push sur leur téléphone). Sers le pilotage de l'entreprise : détecte les
blocages, désigne les responsables, propose des relances. Les actions restent soumises à confirmation.
` : ""}
CONTEXTE :
${buildContext(user)}

CE QUE TU PEUX FAIRE :
- Répondre aux questions sur le travail de l'utilisateur et sur l'application (modules, démarches, statuts).
- Consulter et résumer ses E-MAILS (sa propre boîte connectée dans Courrier) via list_emails / read_email,
  et chercher un message précis. Tu peux résumer la boîte, repérer ce qui demande une réponse, retrouver un
  mail d'un expéditeur, etc. — toujours UNIQUEMENT sa boîte à lui.
- Agir pour lui (dans la limite de SES droits) : créer une tâche, créer une demande administrative
  (billet/déplacement, courrier, signature, achat, devis, paiement, mission chauffeur, visa/invité, RH),
  envoyer un message interne à un collègue, ENVOYER UN E-MAIL depuis sa boîte, créer une demande de prise en
  charge de congrès (national ou international). Tu PROPOSES l'action ; le système l'exécute seulement après
  que l'utilisateur a cliqué « Confirmer ». Ne prétends jamais qu'une action est déjà faite : dis « je
  prépare… », pas « c'est fait ».

RÈGLES IMPÉRATIVES :
- Fonde TOUJOURS tes réponses sur les outils de lecture ; n'invente JAMAIS un médecin, un produit, un
  établissement, une personne, un chiffre ou une référence. Si une information est introuvable ou incertaine,
  dis-le clairement et préfixe l'élément incertain par « à confirmer ».
- Respecte les droits : si un outil renvoie « accès non autorisé », explique que ce domaine n'est pas dans
  les permissions de l'utilisateur, sans contourner.
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
      if (!userCan(user, "MEDICAL", "VIEW")) return "Accès non autorisé au module Promotion médicale.";
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
      const products = await prisma.regulatoryProduct.findMany({
        where: {
          AND: [
            scopeRegulatory(user),
            q ? { OR: [{ dci: { contains: q, mode: "insensitive" } }, { brandName: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : {},
          ],
        },
        select: { reference: true, dci: true, brandName: true, status: true },
        take: 12, orderBy: { createdAt: "desc" },
      });
      if (products.length === 0) return "Aucun produit trouvé (ne pas inventer).";
      return JSON.stringify(products.map((p) => ({
        reference: p.reference, dci: p.dci, nomCommercial: p.brandName ?? null, statut: REGULATORY_STATUS[p.status]?.label ?? p.status,
      })));
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
    default:
      return `Outil inconnu : ${name}.`;
  }
}

const READ_LABEL: Record<string, string> = {
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
};

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
      kind: "create_dossier", module: "DOSSIERS", title: "Ouvrir un dossier de suivi", fields, warnings,
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
      { label: "Type", value: scope === "INTL" ? "Congrès international" : "Congrès / événement national" },
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

    return {
      kind: "create_notification", module: "ADMIN", title: "Diffuser une notification", fields, warnings,
      payload: { kind: "create_notification", audience: audience as BroadcastAudience, role, userIds, recipientNames, title, body, link },
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

const MAX_TURNS = 6;
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
export async function runAssistant(user: CurrentUser, history: ChatTurn[], opts: { model?: string } = {}): Promise<AssistantResult> {
  if (!aiConfigured()) return { configured: false, ok: false, reply: "", trace: [] };

  const messages = toMessages(history);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { configured: true, ok: false, reply: "", trace: [], error: "Message utilisateur manquant." };
  }

  const system = systemPrompt(user);
  // Le Super Admin dispose d'outils exclusifs (vision globale de tous les comptes).
  const tools = [
    ...READ_TOOLS,
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
    });
    if (count === 0) return { ok: false, error: "Aucun destinataire correspondant — rien n'a été envoyé." };
    const who = payload.audience === "ALL" ? "tous les comptes"
      : payload.audience === "ROLE" ? `le rôle ${ROLE_LABELS[(payload.role ?? "") as keyof typeof ROLE_LABELS] ?? payload.role}`
      : (payload.recipientNames ?? "les destinataires choisis");
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Assistant IA", summary: `Notification « ${title} » diffusée via l'assistant à ${count} destinataire(s) (${who})` });
    return { ok: true, message: `Notification envoyée à ${count} destinataire(s) — ${who}.`, link: "/notifications", revalidate: ["/notifications"] };
  }

  return { ok: false, error: "Action non reconnue." };
}
