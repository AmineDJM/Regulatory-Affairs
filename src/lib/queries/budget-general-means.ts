import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { imputationsOf } from "@/lib/budget/imputation";

/**
 * LES ACHATS DU QUOTIDIEN, VUS DEPUIS LE BUDGET.
 *
 * Les moyens généraux et le module Budget tenaient deux comptabilités qui ne se parlaient
 * pas : l'assistante enregistrait ses tickets d'un côté, la Direction lisait des enveloppes de
 * l'autre, et l'enveloppe « Moyens généraux » restait désespérément vide. Ce fichier est le
 * pont — et il ne recopie rien : il RELIT les dépenses réelles et applique la règle
 * d'imputation (`@/lib/budget/imputation`) pour savoir ce qui tombe dans quelle catégorie.
 *
 * Recopier les montants dans une seconde table aurait produit deux vérités qui divergent au
 * premier correctif de ticket. Ici, corriger une dépense corrige le budget, immédiatement.
 */

export interface GeneralMeansAttribution {
  /** Identifiant de la dépense source (pour la retrouver dans les moyens généraux). */
  expenseId: string;
  label: string;
  date: Date;
  /** Montant imputé À CETTE catégorie — pas forcément le total du ticket. */
  amount: number;
  categoryId: string;
  department: string;
  createdBy: string | null;
}

export interface GeneralMeansConsumption {
  /** Consommation par catégorie, prête à s'ajouter aux dépenses de trésorerie. */
  byCategory: Map<string, number>;
  /** Les lignes détaillées, pour la liste « dépenses imputées ». */
  rows: GeneralMeansAttribution[];
}

const EMPTY: GeneralMeansConsumption = { byCategory: new Map(), rows: [] };

/**
 * Ce que les moyens généraux consomment sur ces catégories, entre ces deux dates.
 *
 * On ramène une dépense dès qu'elle touche l'une des catégories — par le ticket OU par un seul
 * de ses articles — puis on ne retient que la part qui revient vraiment à ces catégories. Une
 * dépense partagée entre deux enveloppes ne compte donc que pour sa part dans chacune.
 */
export async function generalMeansConsumption(
  categoryIds: readonly string[],
  from: Date,
  to: Date,
): Promise<GeneralMeansConsumption> {
  if (categoryIds.length === 0) return EMPTY;
  const ids = [...categoryIds];

  const expenses = await prisma.departmentBudgetExpense.findMany({
    where: {
      date: { gte: from, lte: to },
      OR: [
        { budgetCategoryId: { in: ids } },
        { lines: { some: { budgetCategoryId: { in: ids } } } },
      ],
    },
    orderBy: { date: "desc" },
    select: {
      id: true, label: true, amount: true, date: true, budgetCategoryId: true,
      department: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: { select: { amount: true, budgetCategoryId: true } },
    },
  });

  const wanted = new Set(ids);
  const byCategory = new Map<string, number>();
  const rows: GeneralMeansAttribution[] = [];

  for (const e of expenses) {
    const imputations = imputationsOf({
      amount: toNumber(e.amount),
      budgetCategoryId: e.budgetCategoryId,
      lines: e.lines.map((l) => ({ amount: toNumber(l.amount), budgetCategoryId: l.budgetCategoryId })),
    });
    for (const imp of imputations) {
      if (!imp.categoryId || !wanted.has(imp.categoryId)) continue;
      byCategory.set(imp.categoryId, (byCategory.get(imp.categoryId) ?? 0) + imp.amount);
      rows.push({
        expenseId: e.id,
        label: e.label,
        date: e.date,
        amount: imp.amount,
        categoryId: imp.categoryId,
        department: e.department?.name ?? "",
        createdBy: e.createdBy?.name ?? null,
      });
    }
  }
  return { byCategory, rows };
}
