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

import type { AdminRequestType, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
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
      priority?: string | null;
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
  VALIDATIONS: "Validations", DRIVE: "Drive", ADMIN_REQUESTS: "Demandes administratives",
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
      "PROPOSE la création d'une demande administrative (déplacement/billet, courrier, signature, achat, devis, paiement, mission chauffeur, visa/invité, RH simple, autre). N'exécute rien : confirmation requise. Pour un billet d'avion pour un invité, utiliser type=TRAVEL et détailler passager, trajet et dates dans la description.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"],
        },
        title: { type: "string", description: "Titre court de la demande." },
        description: { type: "string", description: "Tous les détails (passager, trajet, dates, montant estimé…)." },
        assigneeName: { type: "string", description: "Collègue chargé de traiter la demande (ex. assistante de direction)." },
        concernedName: { type: "string", description: "Personne concernée par la demande, si différente." },
        deadline: { type: "string", description: "Échéance au format AAAA-MM-JJ." },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      },
      required: ["type", "title"],
    },
  },
];

const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

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
  return `Tu es « Assistant IA », l'assistant interne d'AMD Internal OS, l'outil de gestion d'Adventum Pharma
(laboratoire pharmaceutique algérien ; devise DZD ; principal client la PCH — Pharmacie Centrale des Hôpitaux).
Tu aides l'employé à comprendre l'application, à retrouver ses informations et à passer à l'action.

CONTEXTE :
${buildContext(user)}

CE QUE TU PEUX FAIRE :
- Répondre aux questions sur le travail de l'utilisateur et sur l'application (modules, démarches, statuts).
- Agir pour lui : créer une tâche, créer une demande administrative (billet/déplacement, courrier, signature,
  achat, devis, paiement, mission chauffeur, visa/invité, RH). Tu PROPOSES l'action ; le système l'exécute
  seulement après que l'utilisateur a cliqué « Confirmer ». Ne prétends jamais qu'une action est déjà faite.

RÈGLES IMPÉRATIVES :
- Fonde TOUJOURS tes réponses sur les outils de lecture ; n'invente JAMAIS un médecin, un produit, un
  établissement, une personne, un chiffre ou une référence. Si une information est introuvable ou incertaine,
  dis-le clairement et préfixe l'élément incertain par « à confirmer ».
- Respecte les droits : si un outil renvoie « accès non autorisé », explique que ce domaine n'est pas dans
  les permissions de l'utilisateur, sans contourner.
- Avant d'assigner une tâche/demande à quelqu'un, utilise search_people pour retrouver le bon collègue.
- Pour un billet pour un invité (ex. « billet pour le Pr X de Alger vers Rio du 2 au 5 janvier 2027 »),
  utilise create_admin_request type=TRAVEL : titre court + description complète (passager, trajet, dates).
- Pour tout sujet qualité ou pharmacovigilance, reste prudent et demande confirmation renforcée à l'humain ;
  ne crée rien automatiquement.
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
  const users = await prisma.user.findMany({
    where: { isActive: true, name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, title: true, role: true, department: { select: { name: true } } },
    take: limit,
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name, title: u.title, department: u.department?.name ?? null, role: u.role }));
}

/** Résout un nom en un utilisateur unique pour l'assignation. */
async function resolvePerson(name: string): Promise<{ id: string; name: string } | { ambiguous: PersonMatch[] } | null> {
  const matches = await findPeople(name, 8);
  if (matches.length === 0) return null;
  const exact = matches.filter((m) => m.name.toLowerCase() === name.trim().toLowerCase());
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

  if (toolName === "create_admin_request") {
    const type = asStr(input, "type").toUpperCase();
    const validTypes = ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"];
    const title = asStr(input, "title");
    if (!validTypes.includes(type)) return { error: "Type de demande invalide." };
    if (!title) return { error: "Titre de demande manquant." };
    const assignee = await resolve("Responsable", asStr(input, "assigneeName"));
    const concerned = await resolve("Personne concernée", asStr(input, "concernedName"));
    const deadline = asStr(input, "deadline") ? isoDate(asStr(input, "deadline")) : null;
    const priority = asStr(input, "priority") ? normPriority(asStr(input, "priority")) : null;
    const fields = [
      { label: "Type", value: ADMIN_REQUEST_TYPE[type] ?? type },
      { label: "Objet", value: title },
    ];
    if (asStr(input, "description")) fields.push({ label: "Détails", value: asStr(input, "description") });
    if (assignee.name) fields.push({ label: "À traiter par", value: assignee.name });
    if (concerned.name) fields.push({ label: "Concerne", value: concerned.name });
    if (deadline) fields.push({ label: "Échéance", value: deadline });
    if (priority) fields.push({ label: "Priorité", value: PRIORITY[priority]?.label ?? priority });
    return {
      kind: "create_admin_request", module: "ADMIN_REQUESTS", title: "Créer une demande administrative", fields, warnings,
      payload: {
        kind: "create_admin_request", type, title, description: asStr(input, "description") || null,
        assigneeId: assignee.id, assigneeName: assignee.name, concernedId: concerned.id, concernedName: concerned.name,
        deadline, priority,
      },
    };
  }

  return { error: `Action non prise en charge : ${toolName}.` };
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
export async function runAssistant(user: CurrentUser, history: ChatTurn[]): Promise<AssistantResult> {
  if (!aiConfigured()) return { configured: false, ok: false, reply: "", trace: [] };

  const messages = toMessages(history);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { configured: true, ok: false, reply: "", trace: [], error: "Message utilisateur manquant." };
  }

  const system = systemPrompt(user);
  const tools = [...READ_TOOLS, ...WRITE_TOOLS];
  const trace: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await callClaude(messages, { system, tools, maxTokens: 1400, temperature: 0.2 });
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

async function nextRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.administrativeRequest.count({ where: { reference: { startsWith: `REQ-${year}-` } } });
  return `REQ-${year}-${String(count + 1).padStart(3, "0")}`;
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

  if (payload?.kind === "create_admin_request") {
    if (!userCan(user, "ADMIN_REQUESTS", "CREATE")) return { ok: false, error: "Vous n'avez pas le droit de créer une demande administrative." };
    const validTypes: AdminRequestType[] = ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "HR_SIMPLE", "OTHER"];
    const type = (payload.type ?? "").toUpperCase() as AdminRequestType;
    const title = (payload.title ?? "").trim();
    if (!validTypes.includes(type)) return { ok: false, error: "Type de demande invalide." };
    if (!title) return { ok: false, error: "Titre de demande manquant." };

    const assignedToId = await activeUserId(payload.assigneeId);
    const concernedUserId = await activeUserId(payload.concernedId);
    const reference = await nextRequestRef();
    const created = await prisma.administrativeRequest.create({
      data: {
        reference, title, type,
        description: payload.description?.trim() || null,
        priority: priorityOf(payload.priority), deadline: dateValue(payload.deadline),
        assignedToId, concernedUserId, requesterId: user.id, createdById: user.id,
      },
      select: { id: true },
    });
    if (assignedToId && assignedToId !== user.id) {
      await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Nouvelle demande administrative", body: `${reference} — ${title}`, link: `/demandes/${created.id}` });
    }
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Assistant IA", entityType: "ADMIN_REQUEST",
      entityId: created.id, summary: `Demande ${reference} — ${title} créée via l'assistant`,
    });
    return { ok: true, message: `Demande ${reference} — « ${title} » créée.`, link: `/demandes/${created.id}`, revalidate: ["/demandes", "/demandes/assistant"] };
  }

  return { ok: false, error: "Action non reconnue." };
}
