/**
 * Écriture des lignes d'un ticket, côté serveur — le pont entre le module pur `receipt.ts` et
 * la base.
 *
 * Vit à part des deux actions qui l'appellent (caisse d'avance et dépense sur budget) parce que
 * la règle est la même des deux côtés : un ticket, ses articles, un total qui vient des lignes.
 * L'écrire deux fois, c'est se garantir deux comportements différents au premier correctif.
 */
import { prisma } from "@/lib/prisma";
import { parseLinesField, validateReceipt, receiptTotal, receiptLabel, type ReceiptLine } from "./receipt";

export interface ReceiptDraft {
  lines: ReceiptLine[];
  /** Total du ticket, calculé depuis les lignes — jamais saisi à côté. */
  total: number;
  label: string;
}

/**
 * Lit les lignes du formulaire et les complète depuis le CATALOGUE : une ligne peut n'envoyer
 * qu'un `articleId`, c'est alors le nom du catalogue qui fait foi — et il est recopié dans la
 * ligne, pour qu'un article renommé plus tard ne réécrive pas un ticket déjà classé.
 *
 * Un `articleId` inconnu (article supprimé entre l'ouverture du formulaire et l'envoi) n'est pas
 * une erreur : la ligne redevient un achat libre, à condition d'être nommée.
 */
export async function readReceipt(raw: unknown, givenLabel?: string | null): Promise<ReceiptDraft | { error: string }> {
  const lines = parseLinesField(raw);
  const ids = Array.from(new Set(lines.map((l) => l.articleId).filter((x): x is string => Boolean(x))));
  const names = new Map<string, string>();
  if (ids.length) {
    const articles = await prisma.officeSupplyArticle.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    for (const a of articles) names.set(a.id, a.name);
  }
  const resolved: ReceiptLine[] = lines.map((l) => ({
    ...l,
    articleId: l.articleId && names.has(l.articleId) ? l.articleId : null,
    label: l.label || (l.articleId ? names.get(l.articleId) ?? "" : ""),
  }));

  const check = validateReceipt(resolved);
  if (!check.ok) return { error: check.error ?? "Ticket incomplet." };
  return { lines: resolved, total: receiptTotal(resolved), label: receiptLabel(resolved, givenLabel) };
}

/** Enregistre les lignes d'un ticket sur une dépense déjà créée. */
export async function saveReceiptLines(expenseId: string, lines: ReceiptLine[]): Promise<void> {
  if (lines.length === 0) return;
  await prisma.departmentExpenseLine.createMany({
    data: lines.map((l) => ({
      expenseId,
      articleId: l.articleId,
      label: l.label,
      quantity: l.quantity,
      amount: l.amount,
    })),
  });
}
