"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import {
  runAssistant, performAction,
  type AssistantActionPayload, type AssistantResult, type ChatTurn, type ExecuteResult,
} from "@/lib/assistant";

/** Tour de conversation : exécute la boucle agent côté serveur (clé jamais exposée). */
export async function assistantChat(history: ChatTurn[]): Promise<AssistantResult> {
  const user = await requireUser();
  // Tout employé a accès à l'assistant (espace de travail universel).
  if (!userCan(user, "WORKSPACE", "VIEW")) {
    return { configured: true, ok: false, reply: "", trace: [], error: "Non autorisé." };
  }
  return runAssistant(user, Array.isArray(history) ? history : []);
}

/**
 * Exécute une action **après confirmation explicite** de l'utilisateur. L'identité
 * provient de la session (jamais du client) ; `performAction` ré-autorise et
 * journalise. On applique ensuite la revalidation des pages concernées.
 */
export async function executeAssistantAction(payload: AssistantActionPayload): Promise<ExecuteResult> {
  const user = await requireUser();
  const result = await performAction(user, payload);
  if (result.ok && result.revalidate) {
    for (const path of result.revalidate) revalidatePath(path);
  }
  return { ok: result.ok, message: result.message, link: result.link, error: result.error };
}
