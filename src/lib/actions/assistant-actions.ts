"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { aiConfigured, aiModel, aiModelCheap } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import { getUnreadDigest } from "@/lib/assistant-nudge";
import { extractAttachmentText, buildAttachmentContext, type AttachmentText } from "@/lib/assistant-files";
import type { AssistantAttachment, AssistantFileOption } from "@/lib/assistant-attachments";
import {
  runAssistant, performAction,
  type AssistantActionPayload, type AssistantResult, type ChatTurn, type ExecuteResult, type ProposedAction,
} from "@/lib/assistant";

const MAX_ATTACHMENTS = 6;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 Mo par pièce jointe

/**
 * Résout une pièce jointe en `{ name, buffer }` :
 *  • upload → décodage base64 (borné en taille) ;
 *  • drive  → lecture du blob de la version courante, APRÈS contrôle d'accès Drive.
 * Renvoie null si inaccessible/invalide (jamais d'exception).
 */
async function resolveAttachment(user: Awaited<ReturnType<typeof requireUser>>, a: AssistantAttachment): Promise<{ name: string; buffer: Buffer } | null> {
  try {
    if (a.kind === "upload") {
      if (!a.name || !a.dataB64) return null;
      const buffer = Buffer.from(a.dataB64, "base64");
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) return null;
      return { name: a.name, buffer };
    }
    // drive : le fichier doit être ACCESSIBLE au demandeur (aucun re-téléversement).
    if (!canViewDrive(await resolveDriveAccess(user, a.nodeId))) return null;
    const node = await prisma.driveNode.findUnique({ where: { id: a.nodeId }, select: { name: true, type: true } });
    if (!node || node.type !== "FILE") return null;
    const version = await prisma.fileVersion.findFirst({ where: { nodeId: a.nodeId }, orderBy: { version: "desc" }, select: { blobId: true } });
    if (!version) return null;
    const bytes = await getBlob(version.blobId);
    if (!bytes) return null;
    return { name: node.name, buffer: bytes };
  } catch (err) {
    console.error("[assistant] resolveAttachment failed", err);
    return null;
  }
}

/**
 * Injecte le contenu des pièces jointes dans le DERNIER message utilisateur : chaque fichier
 * est résolu (upload ou Drive) puis extrait en texte (Excel complet, PPTX, Word, PDF, CSV…).
 * Renvoie l'historique augmenté (l'original si rien d'exploitable).
 */
async function withAttachmentContext(user: Awaited<ReturnType<typeof requireUser>>, history: ChatTurn[], attachments: AssistantAttachment[]): Promise<ChatTurn[]> {
  const texts: AttachmentText[] = [];
  for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
    const resolved = await resolveAttachment(user, a);
    if (!resolved) { texts.push({ name: a.kind === "upload" ? a.name : "fichier", text: "", note: "Fichier inaccessible.", truncated: false }); continue; }
    texts.push(await extractAttachmentText(resolved.name, resolved.buffer));
  }
  const ctx = buildAttachmentContext(texts);
  if (!ctx) return history;
  // Rattache au dernier tour utilisateur (ou en crée un si l'historique n'en a pas).
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      return history.map((t, j) => (j === i ? { ...t, content: `${t.content}\n\n${ctx}` } : t));
    }
  }
  return [...history, { role: "user", content: ctx }];
}

export interface NudgeResult {
  signature: string;
  suggestion: { summary: string; proposal?: ProposedAction } | null;
}

/**
 * Tour de conversation : exécute la boucle agent côté serveur (clé jamais exposée).
 * Ne lève JAMAIS d'exception vers le client — toute erreur revient en résultat
 * structuré (fini le « Appel à l'assistant impossible »).
 */
export async function assistantChat(history: ChatTurn[], attachments?: AssistantAttachment[]): Promise<AssistantResult> {
  try {
    const user = await requireUser();
    // Tout employé a accès à l'assistant (espace de travail universel).
    if (!userCan(user, "WORKSPACE", "VIEW")) {
      return { configured: true, ok: false, reply: "", trace: [], error: "Non autorisé." };
    }
    // Interrupteur du Centre de contrôle IA (Super Admin).
    if (!(await aiFeatureEnabled("assistant"))) {
      return { configured: true, ok: false, reply: "", trace: [], error: "L'assistant IA est actuellement désactivé par l'administrateur." };
    }
    let turns = Array.isArray(history) ? history : [];
    // Pièces jointes (téléversées OU référencées depuis le Drive) : leur contenu est extrait
    // côté serveur et injecté dans le message — l'assistant « lit » Excel/PPTX/Word/PDF, etc.
    if (Array.isArray(attachments) && attachments.length > 0) {
      turns = await withAttachmentContext(user, turns, attachments);
    }
    const t0 = Date.now();
    const res = await runAssistant(user, turns);
    await logAiUsage({
      feature: "assistant", userId: user.id, model: aiModel(),
      ok: res.ok, latencyMs: Date.now() - t0, errorCode: res.ok ? null : res.error ?? "error",
    });
    return res;
  } catch (err) {
    console.error("[assistant] assistantChat failed", err);
    return { configured: true, ok: false, reply: "", trace: [], error: "L'assistant a rencontré un problème. Réessayez dans un instant." };
  }
}

/**
 * Exécute une action **après confirmation explicite** de l'utilisateur. L'identité
 * provient de la session (jamais du client) ; `performAction` ré-autorise et
 * journalise. On applique ensuite la revalidation des pages concernées. Ne lève
 * jamais : renvoie un résultat structuré.
 */
/**
 * Suggestion PROACTIVE de l'assistant flottant : analyse les messages internes NON
 * LUS et propose, le cas échéant, UNE action à confirmer. L'IA n'est appelée que si
 * le contenu non lu a changé (`prevSignature`) → coût maîtrisé. Gracieux sans clé.
 * Ne lève jamais.
 */
export async function assistantNudge(prevSignature: string): Promise<NudgeResult> {
  try {
    const user = await requireUser();
    const digest = await getUnreadDigest(user.id);
    if (digest.count === 0) return { signature: "0", suggestion: null };
    // Rien de nouveau depuis la dernière analyse → pas d'appel IA.
    if (digest.signature === prevSignature) return { signature: digest.signature, suggestion: null };
    if (!aiConfigured()) return { signature: digest.signature, suggestion: null };
    // Suggestions proactives désactivables indépendamment depuis le Centre de contrôle IA.
    if (!(await aiFeatureEnabled("nudge"))) return { signature: digest.signature, suggestion: null };

    const prompt =
      `Messages internes récents NON LUS reçus par l'utilisateur (analyse le contexte global : plusieurs messages peuvent être liés) :\n\n${digest.text}\n\n` +
      `S'il y a UNE action concrète et utile à proposer (créer une tâche, répondre à un collègue, créer une demande administrative, envoyer un e-mail…), prépare-la (un seul outil d'écriture). ` +
      `Sinon réponds EXACTEMENT « RAS ». Sois bref.`;
    // Suggestion proactive = enjeu faible, fort volume → palier ÉCO (le nudge ne fait que
    // PROPOSER ; toute action d'écriture reste interceptée et confirmée par l'humain).
    const t0 = Date.now();
    const res = await runAssistant(user, [{ role: "user", content: prompt }], { model: aiModelCheap() });
    await logAiUsage({
      feature: "nudge", userId: user.id, model: aiModelCheap(),
      ok: res.ok, latencyMs: Date.now() - t0, errorCode: res.ok ? null : res.error ?? "error",
    });
    if (!res.configured || !res.ok) return { signature: digest.signature, suggestion: null };
    const reply = (res.reply ?? "").trim();
    if (!res.proposal && (reply.length === 0 || /^ras\b/i.test(reply))) return { signature: digest.signature, suggestion: null };
    return { signature: digest.signature, suggestion: { summary: reply || "J'ai repéré une action possible à partir de vos messages.", proposal: res.proposal } };
  } catch (err) {
    console.error("[assistant] assistantNudge failed", err);
    return { signature: "0", suggestion: null };
  }
}

export async function executeAssistantAction(payload: AssistantActionPayload): Promise<ExecuteResult> {
  try {
    const user = await requireUser();
    const result = await performAction(user, payload);
    if (result.ok && result.revalidate) {
      for (const path of result.revalidate) revalidatePath(path);
    }
    return { ok: result.ok, message: result.message, link: result.link, error: result.error };
  } catch (err) {
    console.error("[assistant] executeAssistantAction failed", err);
    return { ok: false, error: "L'action n'a pas pu être exécutée. Réessayez dans un instant." };
  }
}

/**
 * Fichiers du Drive personnel proposés au « glisser » dans l'assistant (sélecteur) : on les
 * référence directement, SANS téléchargement + re-téléversement. Recherche optionnelle par nom.
 */
export async function listAssistantFiles(query?: string): Promise<AssistantFileOption[]> {
  try {
    const user = await requireUser();
    if (!userCan(user, "DRIVE", "VIEW")) return [];
    const q = (query ?? "").trim();
    const files = await prisma.driveNode.findMany({
      where: { ownerId: user.id, type: "FILE", isTrashed: false, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, name: true, mimeType: true, size: true },
    });
    return files;
  } catch (err) {
    console.error("[assistant] listAssistantFiles failed", err);
    return [];
  }
}
