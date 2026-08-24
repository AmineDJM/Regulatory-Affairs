"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { aiConfigured, aiModel, aiModelCheap, askClaudeCheap } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import { getUnreadDigest } from "@/lib/assistant-nudge";
import { executeIntentGuarded, cancelActionIntent } from "@/lib/assistant/action-intents";
import { featureEnabled, FEATURES } from "@/lib/features";
import {
  personalContext, createThread, appendExchange, listThreads, getThreadMessages,
  deleteThread as deleteThreadScoped, forgetEverything,
  distillationDue, countMessages, recentMessages, getMemory, saveMemory,
  type ThreadSummary, type StoredMessage,
} from "@/lib/assistant-memory";
import { getDailyBrief } from "@/lib/daily-brief";
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
 * DISTILLATION DE LA MÉMOIRE — la « grande mémoire » de l'assistant.
 *
 * Tous les ~12 messages, on relit les échanges RÉCENTS DE CETTE PERSONNE (helpers scopés) et
 * on réécrit une note durable : ses sujets, ses dossiers, ses habitudes, ses préférences de
 * formulation. Cette note est réinjectée au prochain tour via `personalContext`.
 * Appel économique et épisodique ; toute erreur est silencieuse (la mémoire est un confort,
 * jamais un point de rupture du chat).
 */
async function maybeDistillMemory(userId: string): Promise<void> {
  try {
    if (!aiConfigured()) return;
    if (!(await distillationDue(userId))) return;
    const [msgs, previous] = await Promise.all([recentMessages(userId, 60), getMemory(userId)]);
    if (msgs.length === 0) return;
    const transcript = msgs
      .map((m) => `${m.role === "user" ? "Personne" : "Assistant"} : ${m.content.slice(0, 800)}`)
      .join("\n");
    const res = await askClaudeCheap(
      `${previous ? `NOTE ACTUELLE (à mettre à jour, pas à jeter) :\n${previous}\n\n` : ""}` +
      `ÉCHANGES RÉCENTS :\n${transcript}\n\n` +
      `Rédige la note de mémoire à jour (12 lignes maximum, en français, sans Markdown).`,
      {
        system:
          "Tu tiens la mémoire durable d'un assistant interne, pour UNE seule personne. " +
          "Retiens ce qui reste vrai dans le temps : son périmètre, ses dossiers et produits suivis, " +
          "ses interlocuteurs habituels, ses préférences de travail et de formulation, ses échéances récurrentes. " +
          "Ignore le bavardage et tout ce qui est déjà périmé. Écris des phrases courtes et factuelles.",
        maxTokens: 500,
      },
    );
    if (!res.ok || !res.text) return;
    await saveMemory(userId, res.text, await countMessages(userId));
  } catch (e) {
    console.error("[assistant] distillation de la mémoire impossible (non bloquant)", e);
  }
}

/**
 * Mémorise un échange dans le fil de CETTE personne et renvoie l'identifiant du fil.
 *
 * Un fil inconnu — ou appartenant à quelqu'un d'autre — n'est jamais écrit : on en ouvre
 * simplement un nouveau. C'est la seule écriture de mémoire de l'assistant, partagée par
 * l'action serveur et la route de flux, pour que la règle de cloisonnement n'existe qu'en
 * un seul endroit.
 */
export async function rememberExchange(
  userId: string, threadId: string | null, userMessage: string, reply: string,
): Promise<string | null> {
  try {
    let tid = threadId;
    if (tid) {
      const ok = await appendExchange(userId, tid, userMessage, reply);
      if (!ok) tid = null; // fil inconnu ou n'appartenant pas au demandeur → on repart proprement
    }
    if (!tid) {
      tid = await createThread(userId, userMessage);
      await appendExchange(userId, tid, userMessage, reply);
    }
    await maybeDistillMemory(userId);
    return tid;
  } catch (e) {
    console.error("[assistant] mémorisation impossible (non bloquant)", e);
    return threadId;
  }
}

/**
 * Tour de conversation : exécute la boucle agent côté serveur (clé jamais exposée).
 * Ne lève JAMAIS d'exception vers le client — toute erreur revient en résultat
 * structuré (fini le « Appel à l'assistant impossible »).
 */
export async function assistantChat(
  history: ChatTurn[],
  attachments?: AssistantAttachment[],
  threadId?: string | null,
): Promise<AssistantResult> {
  try {
    const user = await requireUser();
    // Tout employé a accès à l'assistant (espace de travail universel).
    if (!userCan(user, "WORKSPACE", "VIEW")) {
      return { configured: true, ok: false, reply: "", trace: [], error: "Non autorisé." };
    }
    // CLOISONNEMENT : en « Vue exacte » (un admin regarde l'app comme quelqu'un d'autre),
    // l'assistant est DÉSACTIVÉ. Sa mémoire est strictement personnelle : on n'ouvre jamais
    // celle d'un tiers, même à un administrateur.
    if (user.impersonatedBy) {
      return {
        configured: true, ok: false, reply: "", trace: [],
        error: "L'assistant est désactivé en « Vue exacte » : sa mémoire est strictement personnelle.",
      };
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
    // Mémoire personnelle (derrière le drapeau de version) : identité, rattachement,
    // hiérarchie et ce que l'assistant a retenu de CETTE personne.
    const memoryOn = await featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id);
    const personal = memoryOn ? await personalContext(user.id).catch(() => null) : null;

    const t0 = Date.now();
    const res = await runAssistant(user, turns, { personalContext: personal });
    await logAiUsage({
      feature: "assistant", userId: user.id, model: aiModel(),
      ok: res.ok, latencyMs: Date.now() - t0, errorCode: res.ok ? null : res.error ?? "error",
    });
    // Persistance du fil — uniquement pour SON propriétaire (helpers scopés par userId).
    if (memoryOn && res.ok && res.reply) {
      try {
        const lastUser = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
        res.threadId = await rememberExchange(user.id, threadId ?? null, lastUser, res.reply);
      } catch (e) {
        console.error("[assistant] mémorisation impossible (non bloquant)", e);
      }
    }
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
    const res = await runAssistant(user, [{ role: "user", content: prompt }], { model: aiModelCheap(), origin: "nudge" });
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

export async function executeAssistantAction(payload: AssistantActionPayload, intentId?: string): Promise<ExecuteResult> {
  try {
    const user = await requireUser();

    // CHEMIN CANONIQUE : l'action vit sous son INTENT (machine d'état serveur). Réclamation
    // atomique — un retry / double-clic / reconnexion ne relance JAMAIS l'exécution : une
    // action déjà EXÉCUTÉE renvoie son reçu d'origine. Le payload exécuté est celui STOCKÉ à
    // la proposition (le serveur est l'autorité, pas le client).
    if (intentId) {
      const guarded = await executeIntentGuarded(user, intentId, async (stored) => {
        const r = await performAction(user, stored as AssistantActionPayload);
        if (r.ok && r.revalidate) for (const path of r.revalidate) revalidatePath(path);
        return r;
      });
      if (guarded) return { ok: guarded.ok, message: guarded.message, link: guarded.link, error: guarded.error };
      // Intent introuvable (ou pas à ce compte) → chemin historique ci-dessous, sans reçu.
    }

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

/** Annule une action PROPOSÉE (état canonique → CANCELLED) — « jamais exécutée » restera vrai. */
export async function cancelAssistantAction(intentId: string): Promise<boolean> {
  try {
    const user = await requireUser();
    return await cancelActionIntent(user.id, intentId);
  } catch (err) {
    console.error("[assistant] cancelAssistantAction failed", err);
    return false;
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


// ─────────────────────── Mémoire personnelle (fils de conversation) ───────────────────────

/** Mes conversations passées. Personne d'autre ne peut les lister. */
export async function myAssistantThreads(): Promise<ThreadSummary[]> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return [];
    if (!(await featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id))) return [];
    return await listThreads(user.id);
  } catch {
    return [];
  }
}

/** Les messages d'UNE de mes conversations (null si ce n'est pas la mienne). */
export async function myAssistantThread(threadId: string): Promise<StoredMessage[] | null> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return null;
    return await getThreadMessages(user.id, threadId);
  } catch {
    return null;
  }
}

/** Supprime UNE de mes conversations. */
export async function deleteMyAssistantThread(threadId: string): Promise<ExecuteResult> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return { ok: false, error: "Indisponible en « Vue exacte »." };
    const ok = await deleteThreadScoped(user.id, threadId);
    return ok ? { ok: true, message: "Conversation supprimée." } : { ok: false, error: "Conversation introuvable." };
  } catch {
    return { ok: false, error: "Suppression impossible." };
  }
}

/**
 * Régénère MON point du matin (bouton « Actualiser »). Le brief est écrit à partir de mes
 * seules données ; personne d'autre ne peut le demander ni le lire.
 */
export async function refreshMyBrief(): Promise<{ text: string | null }> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return { text: null };
    if (!(await featureEnabled(FEATURES.ASSISTANT_PROACTIVE.key, user.id))) return { text: null };
    if (!(await aiFeatureEnabled("assistant"))) return { text: null };
    const res = await getDailyBrief(user, true);
    return { text: res.text };
  } catch (err) {
    console.error("[assistant] refreshMyBrief failed", err);
    return { text: null };
  }
}

/** Droit à l'oubli : efface TOUTE ma mémoire d'assistant (conversations + mémoire retenue). */
export async function forgetMyAssistantMemory(): Promise<ExecuteResult> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return { ok: false, error: "Indisponible en « Vue exacte »." };
    await forgetEverything(user.id);
    return { ok: true, message: "Mémoire effacée." };
  } catch {
    return { ok: false, error: "Effacement impossible." };
  }
}
