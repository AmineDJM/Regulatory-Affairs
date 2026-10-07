import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { effortVsSales, type EffortSalesRow } from "@/lib/sfe-performance";
import type { RepScope } from "@/lib/sfe";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EFFORT × VENTES — les visites par produit, en regard des ventes du même mois (le pilotage SFE).
 *
 * LE CHIFFRE D'AFFAIRES SE LIT À LA MAILLE D'UNE BU OU DE LA DIRECTION (§118.184 — audit 360°, S14).
 * Ce calcul vivait dans la page, et les ventes s'y lisaient SANS AUCUN FILTRE : un délégué (lecture du
 * module, portée « lui-même ») voyait le chiffre d'affaires de tous les produits de toutes les sociétés.
 *
 *   • Le KAM (`self`) : les ventes ne s'attribuent pas à un délégué — il n'a pas d'effet à mettre en
 *     regard de son effort. Le tableau ne s'affiche pas, plutôt que de déclarer « détaillé sans vente »
 *     chaque produit qu'il présente : un verdict FAUX serait pire qu'une absence.
 *   • Le superviseur (`team`) : les produits de SES gammes (le portefeuille des BU qu'il supervise).
 *   • La Direction / le configurateur (`all`) : tous les produits.
 *   • Chacun dans les sociétés qu'il voit (`companyScopedWhere`, le filtre de la liste des ventes).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function chargerEffortVentes(
  userId: string,
  scope: RepScope,
  repIds: readonly string[],
  debut: Date,
  fin: Date,
): Promise<{ lisible: boolean; lignes: EffortSalesRow[] }> {
  // Le LECTEUR de pilotage (portée `all` en lecture seule) ne gagne pas le chiffre d'affaires : il ne le lisait pas.
  if (scope.mode === "self" || scope.lectureSeule) return { lisible: false, lignes: [] };
  if (repIds.length === 0) return { lisible: true, lignes: [] };
  const produitsDeLaPortee = scope.mode === "team"
    ? (await prisma.promoProduct.findMany({ where: { businessUnitId: { in: scope.buIds }, productId: { not: null } }, select: { productId: true } }))
        .map((p) => p.productId as string)
    : null;
  const [visites, ventes] = await Promise.all([
    prisma.medicalVisitProduct.findMany({
      where: { visit: { delegateId: { in: [...repIds] }, status: "COMPLETED", date: { gte: debut, lt: fin } } },
      select: { productId: true, product: { select: { canonicalName: true } } },
    }),
    prisma.sale.findMany({
      where: await companyScopedWhere<Prisma.SaleWhereInput>(userId, {
        productId: produitsDeLaPortee ? { in: produitsDeLaPortee } : { not: null },
        date: { gte: debut, lt: fin },
      }),
      select: { productId: true, revenue: true, canonicalProduct: { select: { canonicalName: true } } },
    }),
  ]);
  const parProduit = new Map<string, { name: string; visits: number; revenue: number }>();
  for (const l of visites) {
    const cur = parProduit.get(l.productId) ?? { name: l.product.canonicalName, visits: 0, revenue: 0 };
    cur.visits += 1;
    parProduit.set(l.productId, cur);
  }
  for (const v of ventes) {
    if (!v.productId) continue;
    const cur = parProduit.get(v.productId) ?? { name: v.canonicalProduct?.canonicalName ?? "Produit", visits: 0, revenue: 0 };
    cur.revenue += toNumber(v.revenue);
    parProduit.set(v.productId, cur);
  }
  return { lisible: true, lignes: effortVsSales([...parProduit.entries()].map(([productId, v]) => ({ productId, ...v }))) };
}
