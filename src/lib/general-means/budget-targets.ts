import { prisma } from "@/lib/prisma";
import type { BudgetTarget } from "@/lib/budget/target";

export type { BudgetTarget };

/**
 * LES CASES BUDGÉTAIRES OUVERTES À CELUI QUI ACHÈTE.
 *
 * L'assistante de direction classe ses dépenses dans le budget — sans avoir accès au module
 * Budget, qu'elle n'a pas à voir. C'est exactement la raison d'être de ce fichier : exposer une
 * liste RESTREINTE de destinations, et rien d'autre. Pas de montants, pas d'enveloppes, pas de
 * consommation : juste « dans quelle case va ce ticket ».
 *
 * La restriction est STRICTE et le repli est volontairement absent : seules les enveloppes
 * ACTIVES qui déclarent couvrir les moyens généraux apparaissent. Un repli « sinon, toutes les
 * enveloppes » lui ouvrirait les catégories d'Ad & Pro ou du Regulatory — et une dépense de
 * papeterie finirait un jour dans le budget des congrès.
 */

/** Le module qu'une enveloppe doit couvrir pour recevoir les achats des moyens généraux. */
export const GENERAL_MEANS_MODULE = "GENERAL_MEANS";

/**
 * Les destinations proposées, ordonnées comme elles se lisent : l'enveloppe, sa catégorie, puis
 * ses sous-catégories juste dessous.
 */
export async function generalMeansBudgetTargets(): Promise<BudgetTarget[]> {
  const envelopes = await prisma.budgetEnvelope.findMany({
    where: {
      isActive: true,
      OR: [{ modules: { has: GENERAL_MEANS_MODULE } }, { module: GENERAL_MEANS_MODULE }],
    },
    orderBy: [{ periodStart: "desc" }],
    include: { categories: { orderBy: { name: "asc" } } },
  });

  const out: BudgetTarget[] = [];
  for (const env of envelopes) {
    for (const top of env.categories.filter((c) => c.parentId === null)) {
      out.push({ id: top.id, label: `${env.name} › ${top.name}`, isSub: false });
      for (const sub of env.categories.filter((c) => c.parentId === top.id)) {
        out.push({ id: sub.id, label: `${env.name} › ${top.name} › ${sub.name}`, isSub: true });
      }
    }
  }
  return out;
}

/**
 * Les identifiants réellement autorisés — la même liste, vue du serveur.
 *
 * Un formulaire peut être forgé : ce n'est pas parce qu'une catégorie a été envoyée qu'elle est
 * légitime. On revalide donc à l'écriture, et une catégorie hors liste est simplement IGNORÉE
 * (la dépense reste « à classer ») plutôt que refusée : perdre le ticket et son justificatif
 * pour un identifiant périmé serait une punition disproportionnée.
 */
export async function allowedGeneralMeansCategoryIds(): Promise<Set<string>> {
  return new Set((await generalMeansBudgetTargets()).map((t) => t.id));
}

/** Filtre une valeur reçue du formulaire : autorisée → gardée, sinon `null`. */
export function keepAllowedCategory(raw: string | null | undefined, allowed: Set<string>): string | null {
  return raw && allowed.has(raw) ? raw : null;
}
