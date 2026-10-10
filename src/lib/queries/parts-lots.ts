import { prisma } from "@/lib/prisma";
import { dateDuMois, decalerMois, moisDeDate } from "@/lib/ventes-pch/calculs";
import { lotsParProduit, partDeNosLots, type PartLotsProduit } from "@/lib/influence/parts-lots";

/**
 * LA PART DE NOS LOTS D'UN ÉTABLISSEMENT (Intelligence terrain, Super Admin seul) — la lecture. Règle et limites :
 * `influence/parts-lots.ts`. Nos lots = ceux des lignes de livraison (BL) de nos commandes PCH, par produit canonique ; les lots
 * livrés = ceux des ventes des DR à l'établissement (Ventes PCH), sur les 12 derniers mois reçus pour lui.
 *
 * Les fichiers de la PCH s'arrêtent à l'ÉTABLISSEMENT : il n'existe aucun volume par service, et aucun n'est inventé ici.
 */

export interface LigneLotsEtablissement extends PartLotsProduit { nom: string }

export interface VuePartsLots {
  etablissement: string;
  /** Les 12 mois lus (« 2025-06 » → « 2026-05 ») — nul si aucune vente PCH n'est rattachée à l'établissement. */
  periode: { debut: string; fin: string } | null;
  lignes: LigneLotsEtablissement[];
  /** Combien de lignes de livraison de nos commandes portent un numéro de lot (la base de « nos lots »). */
  lotsRenseignes: number;
}

export async function partsDeNosLotsEtablissement(institutionId: string, productId?: string | null): Promise<VuePartsLots> {
  const inst = await prisma.medicalInstitution.findUnique({ where: { id: institutionId }, select: { name: true } });
  const etablissement = inst?.name ?? "—";
  const derniere = await prisma.pchVenteLigne.findFirst({ where: { institutionId, productId: { not: null } }, orderBy: { mois: "desc" }, select: { mois: true } });
  if (!derniere) return { etablissement, periode: null, lignes: [], lotsRenseignes: 0 };
  const fin = moisDeDate(derniere.mois);
  const debut = decalerMois(fin, -11);

  const [groupes, livraisons] = await Promise.all([
    prisma.pchVenteLigne.groupBy({
      by: ["productId", "lot"],
      where: { institutionId, productId: productId ? productId : { not: null }, qteLivree: { gt: 0 }, mois: { gte: dateDuMois(debut), lte: dateDuMois(fin) } },
      _sum: { qteLivree: true },
    }),
    prisma.pchDeliveryLine.findMany({
      where: { batchNumber: { not: null } },
      select: {
        batchNumber: true,
        orderLine: { select: { contractLine: { select: { productId: true } }, tenderLine: { select: { productId: true } } } },
      },
      take: 20_000,
    }),
  ]);
  const nosLots = lotsParProduit(livraisons.map((l) => ({
    productId: l.orderLine?.contractLine?.productId ?? l.orderLine?.tenderLine?.productId ?? null,
    batchNumber: l.batchNumber,
  })));
  const parts = partDeNosLots(
    groupes.filter((g): g is typeof g & { productId: string } => !!g.productId).map((g) => ({ productId: g.productId, lot: g.lot, livre: g._sum.qteLivree ?? 0 })),
    nosLots,
  );
  const produits = parts.length ? await prisma.product.findMany({ where: { id: { in: parts.map((p) => p.productId) } }, select: { id: true, canonicalName: true } }) : [];
  const nom = new Map(produits.map((p) => [p.id, p.canonicalName]));
  return {
    etablissement, periode: { debut, fin },
    lignes: parts.map((p) => ({ ...p, nom: nom.get(p.productId) ?? "Produit" })),
    lotsRenseignes: livraisons.length,
  };
}
