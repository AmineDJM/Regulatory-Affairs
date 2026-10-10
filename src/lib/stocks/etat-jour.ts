import { prisma } from "@/lib/prisma";

/**
 * ÉCRIRE UN ÉTAT DE STOCK DATÉ — un seul état par (produit, lieu, jour) : ressaisir le même jour
 * CORRIGE la valeur (§ Stocks, « états datés »).
 *
 * Sorti de `recordStockSnapshot` pour que l'envoi d'une demande de stocks (DO → KAM) écrive
 * EXACTEMENT le même état que le formulaire du module : deux écrivains auraient tôt ou tard deux
 * règles du jour. Aucune permission ici — les appelants gardent la portée (§118.134).
 */
export interface EtatDuJour {
  scope: "PCH" | "HOSPITAL" | "ANNEX";
  /** Le lieu (hôpital ou annexe) — nul pour la PCH. */
  annexId: string | null;
  /** La direction régionale de la PCH (« DRA »…) : scope ANNEX, `annexId` nul. Nul partout ailleurs. */
  drCode?: string | null;
  productId: string;
  date: Date;
  quantity: number;
  companyId: string | null;
  createdById: string;
}

export async function ecrireEtatDuJour(e: EtatDuJour): Promise<{ id: string; cree: boolean }> {
  const dayStart = new Date(e.date); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const quantity = Math.round(e.quantity);
  const drCode = e.drCode ?? null;
  const existing = await prisma.stockSnapshot.findFirst({
    where: { scope: e.scope, annexId: e.annexId, drCode, productId: e.productId, date: { gte: dayStart, lt: dayEnd } },
    select: { id: true },
  });
  if (existing) {
    await prisma.stockSnapshot.update({ where: { id: existing.id }, data: { quantity, date: e.date, companyId: e.companyId } });
    return { id: existing.id, cree: false };
  }
  const cree = await prisma.stockSnapshot.create({
    data: { scope: e.scope, annexId: e.annexId, drCode, productId: e.productId, date: e.date, quantity, companyId: e.companyId, createdById: e.createdById },
    select: { id: true },
  });
  return { id: cree.id, cree: true };
}
