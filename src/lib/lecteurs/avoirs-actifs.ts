/**
 * ═════════════════════════════════════════════════════════════════
 * LES AVOIRS ACTIFS D'UNE FACTURE, lus en base (§118.195) — ce que la facture ne doit plus.
 *
 * Au SOCLE, à côté de la règle pure (`./avoir`) : le règlement (Finances) encaisse le NET, la fabrique plafonne,
 * la liste Legal compte « à régler », la règle qualité compare l'écriture au net. Une seule définition d'un avoir
 * « actif » (nature CREDIT_NOTE, rattaché par `chainFromId`, non annulé) : deux copies finiraient par compter un
 * avoir annulé d'un côté et pas de l'autre (§118.5).
 * ═════════════════════════════════════════════════════════════════
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * LES MONTANTS DES AVOIRS ACTIFS D'UNE FACTURE (§118.195) — une seule lecture pour la fabrique (qui plafonne un avoir,
 * dans la transaction qui verrouille la facture), pour le règlement (qui encaisse le net) et pour la fiche : trois
 * filtres écrits à la main finiraient par compter différemment un avoir annulé.
 */
export async function montantsDesAvoirsActifs(
  factureId: string, db: Pick<Prisma.TransactionClient, "legalDocument"> = prisma,
): Promise<number[]> {
  const rows = await db.legalDocument.findMany({
    where: { chainFromId: factureId, kind: "CREDIT_NOTE", status: { not: "CANCELLED" } }, select: { amount: true },
  });
  return rows.map((r) => (r.amount == null ? 0 : Number(r.amount)));
}

/**
 * Le total des avoirs ACTIFS de chaque facture, en UNE requête — pour une liste qui en montre cent, pas cent
 * requêtes (§118.102b). Une facture sans avoir n'a pas d'entrée : son total vaut zéro.
 */
export async function totauxAvoirsActifs(
  factureIds: readonly string[], db: Pick<Prisma.TransactionClient, "legalDocument"> = prisma,
): Promise<Map<string, number>> {
  if (factureIds.length === 0) return new Map();
  const lignes = await db.legalDocument.groupBy({
    by: ["chainFromId"],
    where: { kind: "CREDIT_NOTE", status: { not: "CANCELLED" }, chainFromId: { in: [...factureIds] } },
    _sum: { amount: true },
  });
  return new Map(lignes.filter((l) => l.chainFromId).map((l) => [l.chainFromId as string, Number(l._sum.amount ?? 0)]));
}
