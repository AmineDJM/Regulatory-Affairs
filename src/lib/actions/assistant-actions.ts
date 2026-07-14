"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { aiConfigured, aiModel, aiModelCheap } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import { getUnreadDigest } from "@/lib/assistant-nudge";
import {
  runAssistant, performAction,
  type AssistantActionPayload, type AssistantResult, type ChatTurn, type ExecuteResult, type ProposedAction,
} from "@/lib/assistant";

export interface NudgeResult {
  signature: string;
  suggestion: { summary: string; proposal?: ProposedAction } | null;
}

/**
 * Tour de conversation : exécute la boucle agent côté serveur (clé jamais exposée).
 * Ne lève JAMAIS d'exception vers le client — toute erreur revient en résultat
 * structuré (fini le « Appel à l'assistant impossible »).
 */
export async function assistantChat(history: ChatTurn[]): Promise<AssistantResult> {
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
    const t0 = Date.now();
    const res = await runAssistant(user, Array.isArray(history) ? history : []);
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
