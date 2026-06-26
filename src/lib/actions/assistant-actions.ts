"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import {
  runAssistant, performAction,
  type AssistantActionPayload, type AssistantResult, type ChatTurn, type ExecuteResult,
} from "@/lib/assistant";

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
    return await runAssistant(user, Array.isArray(history) ? history : []);
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
