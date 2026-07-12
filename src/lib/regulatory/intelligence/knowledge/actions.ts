"use server";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { aiConfigured } from "@/lib/ai";
import { regCan, resolveRegCompanyId } from "../access";
import { askDossier, type ChatTurn, type DossierChatResult } from "./dossier-chat";

/** Historique conversationnel transmis par le client (borné, texte pur — jamais une consigne). */
function parseHistory(raw: string): ChatTurn[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t): t is { role: string; content: string } => t && typeof t.content === "string" && (t.role === "user" || t.role === "assistant"))
      .map((t) => ({ role: t.role as "user" | "assistant", content: String(t.content).slice(0, 800) }))
      .slice(-6);
  } catch {
    return [];
  }
}

/**
 * Action du CHATBOT DE DOSSIER — question/réponse ancrée dans le dossier réel, avec sources.
 * Vérifie le rôle (voir les documents) ET l'appartenance du dossier au périmètre de l'organisation,
 * puis interroge la dernière version. L'IA n'est appelée que si configurée (sinon sources seules).
 */
export async function askDossierAction(formData: FormData): Promise<DossierChatResult> {
  const fail = (error: string): DossierChatResult => ({ ok: false, configured: aiConfigured(), answer: "", citations: [], error });
  const user = await requireUser();
  if (!regCan(user, "regulatory.document.view") && user.role !== "SUPER_ADMIN") return fail("Non autorisé.");

  const dossierId = String(formData.get("dossierId") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  if (!dossierId || !question) return fail("Paramètres manquants.");

  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return fail("Module non activé.");

  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } },
    orderBy: { versionNo: "desc" },
    select: { id: true },
  });
  if (!version) return fail("Aucune version de dossier.");

  const history = parseHistory(String(formData.get("history") ?? ""));
  return askDossier(version.id, question, undefined, history);
}
