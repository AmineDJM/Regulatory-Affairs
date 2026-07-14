import { askClaudeCheap, aiConfigured } from "@/lib/ai";

/**
 * BROUILLON D'E-MAIL FOURNISSEUR (G8) — l'IA ne crée qu'un BROUILLON ; l'envoi reste une action
 * HUMAINE. Deux niveaux : modèle déterministe (toujours disponible) et, si l'IA est configurée,
 * une reformulation professionnelle (toujours un brouillon relu par un humain avant envoi).
 */

export interface DraftInput {
  productName?: string | null;
  dossierRef: string;
  supplierName?: string | null;
  questions: string[];
  deadline?: Date | null;
}

export type AiFn = (prompt: string, opts: { system?: string; maxTokens?: number; temperature?: number }) => Promise<{ ok: boolean; configured: boolean; text?: string; error?: string }>;

const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/** Modèle déterministe (sans IA) — toujours un BROUILLON, jamais envoyé automatiquement. */
export function buildSupplierEmailDraft(input: DraftInput): string {
  const greeting = input.supplierName ? `Cher ${input.supplierName},` : "Madame, Monsieur,";
  const prod = input.productName ? ` relatif au produit ${input.productName}` : "";
  const qs = input.questions.filter((q) => q.trim()).map((q, i) => `${i + 1}. ${q.trim()}`).join("\n");
  const deadline = input.deadline ? `\n\nNous vous saurions gré de nous transmettre ces éléments avant le ${fmtDate(input.deadline)}.` : "";
  return [
    `Objet : Demande de compléments — dossier ${input.dossierRef}${prod ? ` (${input.productName})` : ""}`,
    "",
    greeting,
    "",
    `Dans le cadre de l'instruction du dossier réglementaire ${input.dossierRef}${prod}, nous vous prions de bien vouloir nous fournir les compléments suivants :`,
    "",
    qs || "(à préciser)",
    `${deadline}`,
    "",
    "Restant à votre disposition pour tout échange, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
    "",
    "Adventum Pharma — Affaires réglementaires",
  ].join("\n");
}

const SYSTEM = "Tu rédiges un BROUILLON d'e-mail professionnel en français, destiné à un fournisseur pharmaceutique. Ce n'est qu'un brouillon : il sera relu, corrigé et envoyé par un humain. Reste factuel, courtois, précis. N'invente aucune information ; reprends fidèlement les questions fournies. Réponds uniquement par le texte de l'e-mail (objet + corps), sans commentaire.";

/**
 * Brouillon assisté par IA si configurée ; sinon repli sur le modèle déterministe. Dans tous
 * les cas, le résultat est un BROUILLON (jamais envoyé automatiquement).
 */
export async function draftSupplierEmail(input: DraftInput, aiFn: AiFn = askClaudeCheap): Promise<{ draft: string; aiUsed: boolean }> {
  const fallback = buildSupplierEmailDraft(input);
  if (!aiConfigured() && aiFn === askClaudeCheap) return { draft: fallback, aiUsed: false };

  const prompt = [
    `Dossier : ${input.dossierRef}${input.productName ? ` — produit ${input.productName}` : ""}.`,
    input.supplierName ? `Fournisseur : ${input.supplierName}.` : "",
    input.deadline ? `Échéance souhaitée : ${fmtDate(input.deadline)}.` : "",
    "Questions/compléments à demander :",
    ...input.questions.filter((q) => q.trim()).map((q, i) => `${i + 1}. ${q.trim()}`),
  ].filter(Boolean).join("\n");

  const res = await aiFn(prompt, { system: SYSTEM, maxTokens: 900, temperature: 0.3 });
  if (!res.ok || !res.text || res.text.trim().length < 20) return { draft: fallback, aiUsed: false };
  return { draft: res.text.trim(), aiUsed: true };
}
