import type { PowerTool } from "@/lib/assistant/power-tools";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasGlobalView } from "@/lib/rbac";
import { searchDrive } from "@/lib/queries/drive-search";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { getBlob } from "@/lib/drive-storage";
import { readFileByKey } from "@/lib/storage";
import { extractAttachmentText } from "@/lib/assistant-files";
import { toNumber } from "@/lib/utils";
import { chainOf, type ChainDoc } from "@/lib/legal/chain";
import {
  REMINDER_RECURRENCES, RECURRENCE_LABEL, algiersToUtc, formatAlgiersDue,
  type ReminderRecurrence,
} from "@/lib/assistant/reminders";
import { ROLE_LABELS } from "@/lib/labels";

/**
 * LES OUTILS EXÉCUTIFS — « My Chief of Staff », réservé au PDG et au Super Admin.
 *
 * Le Chief of Staff n'est pas un chatbot de plus : c'est l'interface de PILOTAGE. Ces outils lui
 * donnent ce qu'un chef de cabinet fait vraiment — fouiller le Drive et LIRE les pièces,
 * reconstituer l'HISTOIRE COMPLÈTE d'un dossier (devis → BC → validateurs → facture → règlement,
 * avec les dates), dresser le BILAN FACTUEL du travail d'une personne, et PLANIFIER (« rappelle-moi
 * mardi », « tous les dimanches relance Regulatory »).
 *
 * Trois règles, non négociables :
 *   • la PERMISSION se vérifie CÔTÉ SERVEUR, ici, à chaque appel — la liste d'outils envoyée au
 *     modèle n'est qu'une suggestion (`allowed`, revérifié par `executePowerTool`) ;
 *   • les PREUVES accompagnent chaque réponse : références, dates, auteurs, LIENS internes —
 *     jamais « le paiement est bloqué » sans dire lequel, depuis quand, chez qui ;
 *   • quand une donnée n'existe pas, l'outil le DIT (« aucune trace de… ») — il n'infère pas.
 */

/** Le siège exécutif : PDG (DIRECTION) et Super Admin — c'est LE module My Chief of Staff. */
const EXEC = (u: CurrentUser): boolean => u.role === "SUPER_ADMIN" || u.role === "DIRECTION";

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

const DOC_TEXT_CAP = 9_000;

/** Un instant, en heure d'Alger, lisible. */
function fr(d: Date | null | undefined): string {
  if (!d) return "—";
  const alg = new Date(d.getTime() + 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(alg.getUTCDate())}/${p(alg.getUTCMonth() + 1)}/${alg.getUTCFullYear()} ${p(alg.getUTCHours())}:${p(alg.getUTCMinutes())}`;
}

// ───────────────────────── L'HISTOIRE COMPLÈTE D'UN DOSSIER ─────────────────────────

interface TimelineEntry { at: Date; label: string; who?: string | null }

/** Les validations qui visent une entité : validateurs nommés, décisions, dates. */
async function validationsOf(entityType: string, entityId: string) {
  const rows = await prisma.validationRequest.findMany({
    where: { entityType: entityType as never, entityId },
    select: {
      reference: true, status: true,
      steps: { select: { status: true, decidedAt: true, validator: { select: { name: true } } }, orderBy: { order: "asc" } },
    },
  });
  return rows.flatMap((v) =>
    v.steps.map((s) => ({
      validateur: s.validator.name,
      decision: s.status,
      date: s.decidedAt ? fr(s.decidedAt) : "en attente",
      demande: v.reference,
    })),
  );
}

/** Le journal d'audit d'une entité — la matière première de la timeline. */
async function auditOf(entityType: string, entityId: string): Promise<TimelineEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: entityType as never, entityId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
  return rows.map((h) => ({ at: h.createdAt, label: h.summary ?? h.action, who: h.actor?.name }));
}

/** Les pièces jointes d'une entité, avec leurs liens. */
async function documentsOf(entityType: string, entityId: string) {
  const docs = await prisma.document.findMany({
    where: { entityType: entityType as never, entityId },
    select: { id: true, name: true, category: true, createdAt: true, uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  return docs.map((d) => ({
    documentId: d.id, nom: d.name, categorie: d.category,
    deposePar: d.uploadedBy?.name ?? null, le: fr(d.createdAt),
  }));
}

function renderTimeline(entries: TimelineEntry[]): { date: string; evenement: string; par?: string | null }[] {
  return [...entries]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((e) => ({ date: fr(e.at), evenement: e.label, ...(e.who ? { par: e.who } : {}) }));
}

// ───────────────────────── LES OUTILS ─────────────────────────

export const EXECUTIVE_TOOLS: PowerTool[] = [
  {
    def: {
      name: "search_drive",
      description:
        "Cherche un FICHIER ou un DOSSIER dans le Drive de l'entreprise par un mot du nom. Renvoie le chemin complet et le lien " +
        "de chaque résultat. À utiliser dès que l'utilisateur cherche « le contrat X », « la facture de… », « le scan de… » sans savoir où il est rangé.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Un ou plusieurs mots du nom du fichier ou du dossier." } },
        required: ["query"],
      },
    },
    allowed: EXEC,
    label: "Drive fouillé",
    run: async (input, user) => {
      const query = str(input, "query");
      if (query.length < 2) return "Donnez au moins deux caractères du nom.";
      const out = await searchDrive(user, query);
      if (out.rows.length === 0) return `Aucun fichier ni dossier ne contient « ${query} » dans le Drive visible.`;
      return JSON.stringify({
        resultats: out.rows.slice(0, 25).map((r) => ({ nom: r.name, chemin: r.path, lien: r.href, driveNodeId: r.id })),
        tronque: out.truncated,
      });
    },
  },

  {
    def: {
      name: "read_document",
      description:
        "LIT le contenu d'un fichier — PDF, Word, Excel, PowerPoint, CSV, texte. Deux portes : `driveNodeId` (un fichier du Drive, " +
        "obtenu via search_drive) ou `documentId` (une pièce jointe d'un dossier, obtenue via inspect_record). Renvoie le texte extrait, " +
        "pour résumer, extraire un chiffre, retrouver une clause. Un scan sans OCR est signalé comme illisible — ne rien inventer.",
      input_schema: {
        type: "object",
        properties: {
          driveNodeId: { type: "string", description: "Identifiant d'un fichier du Drive." },
          documentId: { type: "string", description: "Identifiant d'une pièce jointe (table Document)." },
        },
      },
    },
    allowed: EXEC,
    label: "Document lu",
    run: async (input, user) => {
      const nodeId = str(input, "driveNodeId");
      const documentId = str(input, "documentId");

      if (nodeId) {
        // Le droit du Drive se vérifie NŒUD PAR NŒUD — être PDG n'ouvre pas un fichier privé
        // qu'aucun partage ne lui donne : le même contrôle que l'écran.
        if (!canViewDrive(await resolveDriveAccess(user, nodeId))) return "Ce fichier du Drive ne vous est pas ouvert.";
        const node = await prisma.driveNode.findUnique({ where: { id: nodeId }, select: { name: true, type: true, isTrashed: true } });
        if (!node || node.isTrashed || node.type !== "FILE") return "Fichier introuvable dans le Drive.";
        const version = await prisma.fileVersion.findFirst({
          where: { nodeId }, orderBy: { version: "desc" }, select: { blobId: true },
        });
        const bytes = version ? await getBlob(version.blobId) : null;
        if (!bytes) return "Le contenu de ce fichier est indisponible.";
        const t = await extractAttachmentText(node.name, bytes);
        if (!t.text) return `« ${node.name} » n'est pas extractible (${t.note ?? "scan sans OCR ou format non textuel"}).`;
        return JSON.stringify({ nom: node.name, lien: `/drive/${nodeId}`, texte: t.text.slice(0, DOC_TEXT_CAP), tronque: t.text.length > DOC_TEXT_CAP });
      }

      if (documentId) {
        const doc = await prisma.document.findUnique({
          where: { id: documentId }, select: { name: true, fileKey: true },
        });
        if (!doc?.fileKey) return "Pièce introuvable ou sans fichier.";
        const bytes = await readFileByKey(doc.fileKey).catch(() => null);
        if (!bytes) return "Le fichier de cette pièce est indisponible.";
        const t = await extractAttachmentText(doc.name, bytes);
        if (!t.text) return `« ${doc.name} » n'est pas extractible (${t.note ?? "scan sans OCR ou format non textuel"}).`;
        return JSON.stringify({ nom: doc.name, texte: t.text.slice(0, DOC_TEXT_CAP), tronque: t.text.length > DOC_TEXT_CAP });
      }

      return "Donnez `driveNodeId` (via search_drive) ou `documentId` (via inspect_record).";
    },
  },

  {
    def: {
      name: "inspect_record",
      description:
        "L'HISTOIRE COMPLÈTE d'un dossier à partir de sa RÉFÉRENCE : demande de paiement (PAY-…), règlement/ordre de dépense, " +
        "document Legal (devis, BC, facture — par référence ou fragment de titre), matériel promotionnel, demande du secrétariat. " +
        "Renvoie la fiche, la TIMELINE reconstruite (qui a fait quoi, quand), les VALIDATEURS nommés avec leurs dates, les pièces " +
        "jointes, la chaîne devis→BC→facture→règlement quand elle existe, et les LIENS cliquables. " +
        "À utiliser pour « donne-moi toute l'histoire de cet achat », « qui a validé ? », « est-ce qu'on a payé ? ».",
      input_schema: {
        type: "object",
        properties: { reference: { type: "string", description: "Référence exacte (PAY-2026-014, ORD-…, REF du BC) ou fragment de titre d'un document Legal." } },
        required: ["reference"],
      },
    },
    allowed: EXEC,
    label: "Dossier reconstitué",
    run: async (input, user) => {
      void user;
      const ref = str(input, "reference");
      if (ref.length < 2) return "Donnez une référence ou un fragment de titre.";

      // 1) Demande de paiement.
      const pay = await prisma.paymentRequest.findFirst({
        where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
        include: { pieces: { select: { kind: true, status: true, note: true } } },
      });
      if (pay) {
        const [timeline, validators, docs, order] = await Promise.all([
          auditOf("PAYMENT_REQUEST", pay.id),
          validationsOf("PAYMENT_REQUEST", pay.id),
          documentsOf("PAYMENT_REQUEST", pay.id),
          pay.expenseOrderId
            ? prisma.expenseOrder.findUnique({
                where: { id: pay.expenseOrderId },
                select: { reference: true, status: true, centralStatus: true, paidDate: true, amount: true },
              })
            : Promise.resolve(null),
        ]);
        return JSON.stringify({
          type: "Demande de paiement",
          reference: pay.reference, objet: pay.title, beneficiaire: pay.payee,
          montantDzd: Math.round(toNumber(pay.amount)), statut: pay.status,
          echeance: pay.dueDate ? fr(pay.dueDate) : null,
          pieces: pay.pieces.map((p) => ({ nature: p.kind, etat: p.status, note: p.note })),
          validateurs: validators,
          reglement: order
            ? {
                reference: order.reference, statut: order.status, centreDePaiement: order.centralStatus,
                payeLe: order.paidDate ? fr(order.paidDate) : null, montantDzd: Math.round(toNumber(order.amount)),
                lien: "/centre-de-paiement",
              }
            : "Aucun règlement créé — le bon à payer n'a pas encore été donné.",
          documentsJoints: docs,
          timeline: renderTimeline(timeline),
          lien: `/validations/paiements/${pay.id}`,
        });
      }

      // 2) Ordre de dépense (règlement).
      const order = await prisma.expenseOrder.findFirst({
        where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { label: { contains: ref, mode: "insensitive" } }] },
        include: { requestedBy: { select: { name: true } } },
      });
      if (order) {
        const timeline = await auditOf("EXPENSE_ORDER", order.id);
        return JSON.stringify({
          type: "Règlement (ordre de dépense)",
          reference: order.reference, objet: order.label,
          montantDzd: Math.round(toNumber(order.amount)),
          statut: order.status, centreDePaiement: order.centralStatus,
          demandePar: order.requestedBy?.name ?? null,
          payeLe: order.paidDate ? fr(order.paidDate) : "pas encore payé",
          timeline: renderTimeline(timeline),
          liens: ["/finances/ordres-de-depense", "/centre-de-paiement"],
        });
      }

      // 3) Document Legal — et sa CHAÎNE devis → BC → facture → règlement.
      const legal = await prisma.legalDocument.findFirst({
        where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
        select: { id: true, title: true, reference: true, kind: true, counterparty: true, amount: true, startDate: true, endDate: true, status: true, chainFromId: true, expenseOrderId: true },
      });
      if (legal) {
        // La chaîne se remonte par requêtes bornées — le fil est court, une boucle serait un gel.
        const byId = new Map<string, { id: string; kind: string; title: string; reference: string | null; chainFromId: string | null; amount: unknown; startDate: Date | null }>();
        const select = { id: true, kind: true, title: true, reference: true, chainFromId: true, amount: true, startDate: true } as const;
        byId.set(legal.id, { ...legal });
        for (let hop = 0; hop < 8; hop += 1) {
          const wanted = [...byId.values()].map((r) => r.chainFromId).filter((x): x is string => Boolean(x) && !byId.has(x!));
          const children = await prisma.legalDocument.findMany({ where: { OR: [{ id: { in: wanted.length ? wanted : ["-"] } }, { chainFromId: { in: [...byId.keys()] } }], id: { notIn: [...byId.keys()] } }, select });
          if (children.length === 0) break;
          for (const c of children) byId.set(c.id, c);
        }
        const docsChain: ChainDoc[] = [...byId.values()].map((r) => ({ id: r.id, kind: r.kind, chainFromId: r.chainFromId }));
        const fil = chainOf(docsChain, legal.id).map((d) => {
          const row = byId.get(d.id)!;
          return { nature: row.kind, reference: row.reference, titre: row.title, montantDzd: row.amount != null ? Math.round(toNumber(row.amount as never)) : null, lien: `/legal/${row.id}` };
        });
        const [timeline, validators, docs, settlement] = await Promise.all([
          auditOf("LEGAL_DOCUMENT", legal.id),
          validationsOf("LEGAL_DOCUMENT", legal.id),
          documentsOf("LEGAL_DOCUMENT", legal.id),
          legal.expenseOrderId
            ? prisma.expenseOrder.findUnique({ where: { id: legal.expenseOrderId }, select: { reference: true, status: true, centralStatus: true, paidDate: true } })
            : Promise.resolve(null),
        ]);
        return JSON.stringify({
          type: "Document Legal", nature: legal.kind,
          reference: legal.reference, titre: legal.title, partie: legal.counterparty,
          montantDzd: legal.amount != null ? Math.round(toNumber(legal.amount)) : null,
          statut: legal.status,
          chaineAchat: fil.length > 1 ? fil : "Pièce isolée — aucun lien devis/BC/facture déclaré.",
          reglement: settlement
            ? { reference: settlement.reference, statut: settlement.status, centreDePaiement: settlement.centralStatus, payeLe: settlement.paidDate ? fr(settlement.paidDate) : null }
            : null,
          validateurs: validators,
          documentsJoints: docs,
          timeline: renderTimeline(timeline),
          lien: `/legal/${legal.id}`,
        });
      }

      // 4) Matériel promotionnel.
      const promo = await prisma.promoMaterial.findFirst({
        where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
        select: { id: true, reference: true, title: true, circuitState: true, tracksDone: true, status: true, chosenAgency: true, amount: true, chosenAmount: true },
      });
      if (promo) {
        const [timeline, docs] = await Promise.all([auditOf("PROMO_MATERIAL", promo.id), documentsOf("PROMO_MATERIAL", promo.id)]);
        return JSON.stringify({
          type: "Matériel promotionnel",
          reference: promo.reference, titre: promo.title,
          circuit: promo.circuitState ?? promo.status,
          chantiersClos: promo.tracksDone ?? "",
          agence: promo.chosenAgency,
          montantDzd: Math.round(toNumber(promo.chosenAmount ?? promo.amount ?? 0)) || null,
          documentsJoints: docs,
          timeline: renderTimeline(timeline),
          lien: `/promo-material/${promo.id}`,
        });
      }

      // 5) Demande du secrétariat.
      const req = await prisma.administrativeRequest.findFirst({
        where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
        select: { id: true, reference: true, title: true, type: true, status: true, assignedTo: { select: { name: true } } },
      });
      if (req) {
        const [timeline, docs] = await Promise.all([auditOf("ADMIN_REQUEST", req.id), documentsOf("ADMIN_REQUEST", req.id)]);
        return JSON.stringify({
          type: "Demande du secrétariat",
          reference: req.reference, titre: req.title, nature: req.type, statut: req.status,
          responsable: req.assignedTo?.name ?? null,
          documentsJoints: docs,
          timeline: renderTimeline(timeline),
          lien: `/demandes/${req.id}`,
        });
      }

      return `Aucun dossier ne porte la référence « ${ref} » — ni demande de paiement, ni règlement, ni document Legal, ni matériel promotionnel, ni demande du secrétariat. Je préfère le dire plutôt que d'inventer.`;
    },
  },

  {
    def: {
      name: "person_report",
      description:
        "Le BILAN FACTUEL du travail d'une personne : tâches (ouvertes, terminées, en retard), demandes déposées, validations rendues, " +
        "activité récente. FAITS et MÉTRIQUES seulement — jamais de jugement : la conclusion appartient au lecteur. " +
        "À utiliser pour « fais-moi un bilan du travail de X », « qui est en retard sur quoi ? ».",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom (ou fragment) de la personne." },
          months: { type: "number", description: "Fenêtre en mois (défaut 3)." },
        },
        required: ["name"],
      },
    },
    allowed: EXEC,
    label: "Bilan d'une personne",
    run: async (input, user) => {
      void user;
      const name = str(input, "name");
      if (name.length < 2) return "Donnez le nom de la personne.";
      const months = Math.min(12, Math.max(1, Number(input.months) || 3));
      const since = new Date(Date.now() - months * 30 * 86_400_000);

      const person = await prisma.user.findFirst({
        where: { name: { contains: name, mode: "insensitive" }, isActive: true },
        select: { id: true, name: true, role: true },
      });
      if (!person) return `Aucun compte actif ne porte le nom « ${name} ».`;

      const now = new Date();
      const [emp, tasksOpen, tasksDone, tasksLate, requests, validationsDecided, auditCount, lastAudit] = await Promise.all([
        prisma.employee.findFirst({
          where: { userId: person.id },
          select: { fullName: true, position: true, departmentRef: { select: { name: true } }, manager: { select: { fullName: true } } },
        }),
        prisma.task.count({ where: { assignedToId: person.id, status: { notIn: ["DONE", "CANCELLED"] } } }),
        prisma.task.count({ where: { assignedToId: person.id, status: "DONE", updatedAt: { gte: since } } }),
        prisma.task.findMany({
          where: { assignedToId: person.id, status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { lt: now } },
          select: { title: true, dueDate: true },
          orderBy: { dueDate: "asc" }, take: 10,
        }),
        prisma.administrativeRequest.count({ where: { requesterId: person.id, createdAt: { gte: since } } }),
        prisma.validationStep.count({ where: { validatorId: person.id, decidedAt: { gte: since } } }),
        prisma.auditLog.count({ where: { actorId: person.id, createdAt: { gte: since } } }),
        prisma.auditLog.findFirst({ where: { actorId: person.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, summary: true } }),
      ]);

      return JSON.stringify({
        personne: person.name,
        role: ROLE_LABELS[person.role] ?? person.role,
        poste: emp?.position ?? null,
        departement: emp?.departmentRef?.name ?? null,
        responsable: emp?.manager?.fullName ?? null,
        fenetre: `${months} mois`,
        faits: {
          tachesOuvertes: tasksOpen,
          tachesTermineesSurLaFenetre: tasksDone,
          tachesEnRetard: tasksLate.map((t) => ({ titre: t.title, echeance: t.dueDate ? fr(t.dueDate) : null })),
          demandesDeposees: requests,
          validationsRendues: validationsDecided,
          actionsAuJournal: auditCount,
          derniereActivite: lastAudit ? { le: fr(lastAudit.createdAt), quoi: lastAudit.summary } : "aucune trace au journal",
        },
        rappel: "Faits et métriques uniquement — les retards peuvent tenir à des dépendances externes : vérifier avant de conclure.",
      });
    },
  },

  // ───────────────────────── PLANIFICATION ─────────────────────────

  {
    def: {
      name: "plan_reminder",
      description:
        "PLANIFIE un rappel : « rappelle-moi mardi à 10 h de vérifier X », « tous les dimanches relance Regulatory ». " +
        "`date` = première échéance (AAAA-MM-JJ, heure d'Alger), `time` = HH:MM (défaut 09:00). `recurrence` : NONE (une fois), DAILY, WEEKLY, MONTHLY. " +
        "`target_role` (optionnel) = rôle à RELANCER à chaque échéance (ex. HEAD_OF_REGULATORY pour Regulatory) — sans lui, seul l'utilisateur est prévenu. " +
        "`link` (optionnel) = page interne à rouvrir. Calculer soi-même la date exacte à partir de la date du jour donnée en contexte.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Ce qu'il faut rappeler, en quelques mots." },
          date: { type: "string", description: "Première échéance, AAAA-MM-JJ (heure d'Alger)." },
          time: { type: "string", description: "Heure HH:MM (défaut 09:00)." },
          recurrence: { type: "string", enum: [...REMINDER_RECURRENCES], description: "NONE, DAILY, WEEKLY ou MONTHLY." },
          target_role: { type: "string", description: "Rôle à relancer à chaque échéance (code rôle interne)." },
          note: { type: "string", description: "Le message de la relance / le détail du rappel." },
          link: { type: "string", description: "Lien interne (/regulatory, /legal/…)." },
        },
        required: ["title", "date"],
      },
    },
    allowed: EXEC,
    label: "Rappel planifié",
    run: async (input, user) => {
      const title = str(input, "title");
      if (!title) return "Donnez l'objet du rappel.";
      const dueAt = algiersToUtc(str(input, "date"), str(input, "time"));
      if (!dueAt) return "Date illisible — attendu : AAAA-MM-JJ et HH:MM (heure d'Alger).";
      if (dueAt.getTime() < Date.now() - 60_000) return "Cette échéance est déjà passée — donnez une date à venir.";
      const recurrence = (REMINDER_RECURRENCES as readonly string[]).includes(str(input, "recurrence"))
        ? (str(input, "recurrence") as ReminderRecurrence) : "NONE";
      const roleRaw = str(input, "target_role");
      if (roleRaw && !(roleRaw in ROLE_LABELS)) {
        return `Rôle « ${roleRaw} » inconnu. Rôles possibles : ${Object.keys(ROLE_LABELS).join(", ")}.`;
      }
      const link = str(input, "link");
      // Un lien de rappel reste INTERNE : un rappel qui ouvrirait un site externe serait une
      // porte de sortie déguisée.
      if (link && !link.startsWith("/")) return "Le lien doit être une page interne (commencer par « / »).";

      const created = await prisma.assistantReminder.create({
        data: {
          userId: user.id, title, dueAt, recurrence,
          targetRole: roleRaw || null,
          note: str(input, "note") || null,
          link: link || null,
        },
        select: { id: true },
      });
      return JSON.stringify({
        cree: created.id,
        rappel: title,
        premiereEcheance: formatAlgiersDue(dueAt),
        recurrence: RECURRENCE_LABEL[recurrence],
        relanceLeRole: roleRaw ? ROLE_LABELS[roleRaw] ?? roleRaw : null,
        note: "À l'échéance : pop-up pour vous" + (roleRaw ? ` et relance envoyée au rôle « ${ROLE_LABELS[roleRaw] ?? roleRaw} »` : "") + ".",
      });
    },
  },

  {
    def: {
      name: "list_reminders",
      description: "Liste les rappels PLANIFIÉS de l'utilisateur (actifs), avec leur échéance, leur récurrence et leur identifiant (pour cancel_reminder).",
      input_schema: { type: "object", properties: {} },
    },
    allowed: EXEC,
    label: "Rappels listés",
    run: async (_input, user) => {
      const rows = await prisma.assistantReminder.findMany({
        where: { userId: user.id, active: true },
        orderBy: { dueAt: "asc" },
        take: 50,
      });
      if (rows.length === 0) return "Aucun rappel planifié.";
      return JSON.stringify(rows.map((r) => ({
        id: r.id, rappel: r.title,
        prochaineEcheance: formatAlgiersDue(r.dueAt),
        recurrence: RECURRENCE_LABEL[r.recurrence as ReminderRecurrence] ?? r.recurrence,
        relanceLeRole: r.targetRole ? ROLE_LABELS[r.targetRole] ?? r.targetRole : null,
      })));
    },
  },

  {
    def: {
      name: "cancel_reminder",
      description: "ANNULE un rappel planifié (le sien uniquement). `id` vient de list_reminders.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Identifiant du rappel à annuler." } },
        required: ["id"],
      },
    },
    allowed: EXEC,
    label: "Rappel annulé",
    run: async (input, user) => {
      const id = str(input, "id");
      // `updateMany` filtré par propriétaire : on n'annule pas le rappel d'un autre en devinant
      // son identifiant.
      const done = await prisma.assistantReminder.updateMany({
        where: { id, userId: user.id, active: true },
        data: { active: false },
      });
      return done.count > 0 ? "Rappel annulé." : "Rappel introuvable (ou déjà éteint).";
    },
  },
];

/** Le briefing du mode exécutif — annonce les pouvoirs, sinon le modèle ne les utilise pas. */
export function executiveBriefing(user: CurrentUser): string {
  if (!EXEC(user)) return "";
  void hasGlobalView;
  return `

MY CHIEF OF STAFF — MODE EXÉCUTIF. Vous servez le pilotage de l'entreprise. Ton DIRECT, EXÉCUTIF,
CHIFFRÉ : une question simple reçoit une réponse en une ou deux phrases avec le chiffre et sa
source ; une question complexe reçoit une synthèse structurée. Jamais de paragraphe de politesse.

Vos gestes de chef de cabinet :
- \`inspect_record\` — l'HISTOIRE COMPLÈTE d'un dossier par sa référence : timeline, validateurs et
  dates, pièces, chaîne devis→BC→facture→règlement, liens cliquables. TOUJOURS l'appeler pour
  « toute l'histoire de… », « qui a validé ? », « est-ce qu'on a payé ? ».
- \`search_drive\` puis \`read_document\` — retrouver un fichier n'importe où et LIRE son contenu
  (PDF, Word, Excel, PowerPoint). Ne jamais résumer un document sans l'avoir lu.
- \`person_report\` — bilan factuel du travail d'une personne. Présenter les FAITS, marquer la
  différence entre faits et interprétation, rappeler les dépendances externes possibles.
- \`plan_reminder\` / \`list_reminders\` / \`cancel_reminder\` — « rappelle-moi mardi 10 h »,
  « tous les dimanches relance Regulatory » (recurrence WEEKLY + target_role). Calculer la date
  exacte depuis la date du jour fournie en contexte.
- \`decide_payment\` — trancher un paiement au centre (autoriser, refuser, demander une révision ou
  une argumentation). TOUJOURS soumis à la carte de confirmation.

RÈGLES DE PREUVE : chaque affirmation importante cite sa référence, sa date et son lien interne.
Si la donnée n'existe pas, dire « je ne trouve aucune trace de… » — jamais l'affirmer en creux.
Signaler toute contradiction entre deux sources au lieu d'en choisir une en silence.`;
}
