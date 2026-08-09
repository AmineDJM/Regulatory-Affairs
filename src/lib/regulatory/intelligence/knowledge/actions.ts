"use server";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { aiConfigured } from "@/lib/ai";
import { regCan, resolveRegCompanyId } from "../access";
import { askDossier, type ChatTurn, type DossierChatResult } from "./dossier-chat";
import { runDossierAgent, type AgentAttachment, type DossierAgentResult } from "./dossier-agent";
import { extractText } from "../extract/extract-text";
import { canOcr, ocrDocument } from "../ocr/ocr-engine";
import { askReserves } from "../reserves/chat";

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

/**
 * Action « DISCUTER AVEC LES RÉSERVES » — rédige/discute des réponses EXIGEANTES aux réserves ANPP
 * du dossier, sourcées et dans le périmètre technique (abstention prix/commercial ; renvoi
 * fournisseur si donnée absente). Mêmes gardes d'accès et d'isolation que le chatbot de dossier.
 */
/**
 * ACTION DE L'AGENT DE DOSSIER — la version OUTILLÉE de « Discuter avec ce dossier ».
 * Accepte des PIÈCES JOINTES (PDF, DOCX, images scannées, TXT…) : extraites ici (OCR réel au
 * besoin) puis remises à l'agent comme contenu de conversation. Mêmes gardes d'accès que le chat.
 */
export async function askDossierAgentAction(formData: FormData): Promise<DossierAgentResult> {
  const fail = (error: string): DossierAgentResult => ({ ok: false, configured: aiConfigured(), answer: "", citations: [], files: [], error });
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

  // PIÈCES JOINTES : 3 max, 20 Mo chacune — extraites tout de suite, OCR réel si scan.
  const attachments: AgentAttachment[] = [];
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) return fail(`« ${file.name} » dépasse 20 Mo.`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    let text = "";
    try {
      const extracted = await extractText(ext, buffer);
      text = (extracted.text ?? "").trim();
      if ((extracted.status === "OCR_REQUIRED" || text.length < 40) && canOcr(ext)) {
        const ocr = await ocrDocument({ ext, buffer });
        if (ocr.text.trim().length > text.length) text = ocr.text.trim();
      }
    } catch {
      /* verdict ci-dessous */
    }
    if (text.length < 40) return fail(`« ${file.name} » est illisible (même après OCR) — impossible d'en discuter.`);
    attachments.push({ filename: file.name, text });
  }

  const history = parseHistory(String(formData.get("history") ?? ""));
  return runDossierAgent({ dossierVersionId: version.id, userId: user.id, question, history, attachments });
}

export async function askReservesAction(formData: FormData): Promise<DossierChatResult> {
  const fail = (error: string): DossierChatResult => ({ ok: false, configured: aiConfigured(), answer: "", citations: [], error });
  const user = await requireUser();
  if (!regCan(user, "regulatory.document.view") && user.role !== "SUPER_ADMIN") return fail("Non autorisé.");

  const dossierId = String(formData.get("dossierId") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  if (!dossierId || !question) return fail("Paramètres manquants.");

  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return fail("Module non activé.");
  // Isolation : le dossier doit appartenir à l'organisation activée.
  const dossier = await prisma.regulatoryDossier.findFirst({ where: { id: dossierId, companyId }, select: { id: true } });
  if (!dossier) return fail("Dossier introuvable.");

  const history = parseHistory(String(formData.get("history") ?? ""));
  return askReserves(dossierId, question, undefined, history);
}
