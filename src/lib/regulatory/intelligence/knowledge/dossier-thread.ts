import { prisma } from "@/lib/prisma";
import { sanitizeForModel } from "@/lib/ai-text";
import type { ChatCitation, ChatTurn } from "./dossier-chat";
import type { AgentAttachment, AgentFile } from "./dossier-agent";

/**
 * FIL PERSISTANT DU DOSSIER — « Discuter avec ce dossier » est une MESSAGERIE, pas un widget
 * volatile : on quitte l'app, on revient, la discussion est là. Un fil par (dossier, utilisateur).
 *
 * Le point décisif est la MÉMOIRE DES PIÈCES : chaque pièce soumise garde son texte extrait en
 * base, et les tours suivants la re-présentent à l'agent. Sans cela, « vas-y » après l'envoi d'une
 * lettre de réserves échouait — l'historique ne transportait que le texte affiché, jamais la pièce.
 */

export interface AttachmentRecord {
  filename: string;
  /** Texte extrait (tronqué) — absent si la pièce était illisible. */
  text?: string;
  /** Motif d'illisibilité (échec d'extraction/OCR) — la pièce reste tracée dans le fil. */
  error?: string;
}

/** Message tel que le PANNEAU l'affiche — même forme que son état local, rechargeable à l'identique. */
export interface ThreadMessageView {
  role: "user" | "assistant";
  text: string;
  citations?: ChatCitation[];
  files?: AgentFile[];
  attachedNames?: string[];
  error?: boolean;
}

const THREAD_LOAD_LIMIT = 80; // messages renvoyés au panneau (les plus récents)
const THREAD_SCAN_LIMIT = 40; // messages relus pour construire histoire + pièces de l'agent
const HISTORY_TURNS = 8;
const HISTORY_TURN_CHARS = 2000;
const PRIOR_ATTACHMENT_LIMIT = 4; // pièces de la discussion re-présentées à chaque tour
const PRIOR_ATTACHMENT_CHARS = 12_000; // par pièce re-présentée (la pièce du tour courant garde son plein budget)
export const STORED_ATTACHMENT_CHARS = 28_000; // texte conservé en base par pièce

type StoredRow = {
  role: string;
  content: string;
  citations: unknown;
  files: unknown;
  attachments: unknown;
  error: boolean;
};

function parseAttachments(raw: unknown): AttachmentRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is AttachmentRecord => !!a && typeof (a as AttachmentRecord).filename === "string");
}

function toView(row: StoredRow): ThreadMessageView {
  const attachments = parseAttachments(row.attachments);
  const citations = Array.isArray(row.citations) ? (row.citations as ChatCitation[]) : undefined;
  const files = Array.isArray(row.files) ? (row.files as AgentFile[]) : undefined;
  return {
    role: row.role === "user" ? "user" : "assistant",
    text: row.content,
    ...(citations && citations.length > 0 ? { citations } : {}),
    ...(files && files.length > 0 ? { files } : {}),
    ...(attachments.length > 0 ? { attachedNames: attachments.map((a) => a.filename) } : {}),
    ...(row.error ? { error: true } : {}),
  };
}

/** Le fil complet (borné aux plus récents), en ordre chronologique, prêt à afficher. */
export async function loadThread(dossierId: string, userId: string): Promise<ThreadMessageView[]> {
  const rows = await prisma.regulatoryDossierChatMessage.findMany({
    where: { dossierId, userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: THREAD_LOAD_LIMIT,
    select: { role: true, content: true, citations: true, files: true, attachments: true, error: true },
  });
  return rows.reverse().map(toView);
}

/**
 * Enregistre un message du fil. NE LÈVE JAMAIS : la messagerie est un confort — une panne
 * d'écriture ne doit pas priver le pharmacien de la réponse déjà calculée.
 */
export async function appendThreadMessage(
  dossierId: string,
  userId: string,
  msg: {
    role: "user" | "assistant";
    content: string;
    citations?: ChatCitation[];
    files?: AgentFile[];
    attachments?: AttachmentRecord[];
    error?: boolean;
  },
): Promise<void> {
  try {
    await prisma.regulatoryDossierChatMessage.create({
      data: {
        dossierId,
        userId,
        role: msg.role,
        content: sanitizeForModel(msg.content).slice(0, 40_000),
        citations: msg.citations && msg.citations.length > 0 ? (msg.citations as unknown as object[]) : undefined,
        files: msg.files && msg.files.length > 0 ? (msg.files as unknown as object[]) : undefined,
        attachments:
          msg.attachments && msg.attachments.length > 0
            ? msg.attachments.map((a) => ({
                filename: a.filename.slice(0, 300),
                ...(a.text ? { text: sanitizeForModel(a.text).slice(0, STORED_ATTACHMENT_CHARS) } : {}),
                ...(a.error ? { error: a.error.slice(0, 500) } : {}),
              }))
            : undefined,
        error: msg.error ?? false,
      },
    });
  } catch (err) {
    console.error("[dossier-thread] écriture du fil échouée :", err instanceof Error ? err.message : err);
  }
}

/** Efface le fil (« Nouvelle discussion ») — celui de CET utilisateur sur CE dossier uniquement. */
export async function clearThread(dossierId: string, userId: string): Promise<void> {
  await prisma.regulatoryDossierChatMessage.deleteMany({ where: { dossierId, userId } });
}

/**
 * Ce que l'agent doit REVOIR du fil : les derniers tours (texte) + les PIÈCES déjà soumises.
 * Les pièces sont dédupliquées par nom (la plus récente gagne) et bornées — c'est ce qui permet
 * « vas-y » ou « et le point 3 ? » sans re-téléverser la lettre.
 */
export function threadMemory(rows: { role: string; content: string; attachments: unknown; error: boolean }[]): {
  history: ChatTurn[];
  priorAttachments: AgentAttachment[];
} {
  const chronological = rows.filter((r) => !r.error);
  const history: ChatTurn[] = chronological.slice(-HISTORY_TURNS).map((r) => ({
    role: r.role === "user" ? "user" : "assistant",
    content: r.content.slice(0, HISTORY_TURN_CHARS),
  }));

  const seen = new Set<string>();
  const priorAttachments: AgentAttachment[] = [];
  // Du plus récent au plus ancien : en cas de re-soumission du même fichier, la dernière version gagne.
  for (let i = chronological.length - 1; i >= 0 && priorAttachments.length < PRIOR_ATTACHMENT_LIMIT; i--) {
    for (const att of parseAttachments(chronological[i].attachments)) {
      const key = att.filename.trim().toLowerCase();
      if (!att.text || seen.has(key)) continue;
      seen.add(key);
      priorAttachments.push({ filename: att.filename, text: att.text.slice(0, PRIOR_ATTACHMENT_CHARS) });
      if (priorAttachments.length >= PRIOR_ATTACHMENT_LIMIT) break;
    }
  }
  return { history, priorAttachments };
}

/** Variante branchée sur la base — relit le fil et en tire histoire + pièces pour l'agent. */
export async function loadThreadMemory(dossierId: string, userId: string): Promise<{
  history: ChatTurn[];
  priorAttachments: AgentAttachment[];
}> {
  const rows = await prisma.regulatoryDossierChatMessage.findMany({
    where: { dossierId, userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: THREAD_SCAN_LIMIT,
    select: { role: true, content: true, attachments: true, error: true },
  });
  return threadMemory(rows.reverse());
}
