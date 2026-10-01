import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { gestionnairesDuMagasin } from "@/lib/queries/promo-stock";
import { libelleArticleStock } from "@/lib/promo/stock";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RAPPEL « CONFIRMEZ LA RÉCEPTION » (§118.164) — une fois, au troisième jour.
 *
 * Une dotation n'entre dans le stock d'un délégué qu'à SA confirmation (décision de la Direction,
 * 01/10). Sans relance, un transfert oublié reste « en route » indéfiniment : le magasin croit
 * avoir doté, le délégué croit n'avoir rien reçu, et le parc total compte des unités que personne
 * n'a en main. Le battement relance donc celui qui doit confirmer — le destinataire, ou la
 * gestionnaire du magasin pour un retour.
 *
 * UNE SEULE FOIS : `rappelEnvoyeLe` se pose AVANT la notification, par une écriture conditionnelle
 * (le même verrou que les récurrences de stock et les missions) — deux battements concurrents ne
 * relancent pas deux fois, et un rappel répété chaque jour deviendrait du bruit qu'on cesse de lire
 * (§118.32). Borné par passage : le suivant reprend ce qui reste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const JOURS_AVANT_RAPPEL = 3;
const PAR_PASSAGE = 100;

export async function relancerReceptionsStock(maintenant = new Date()): Promise<{ relances: number }> {
  const limite = new Date(maintenant.getTime() - JOURS_AVANT_RAPPEL * 86_400_000);
  const dus = await prisma.promoStockTransfer.findMany({
    where: { statut: "EN_ROUTE", rappelEnvoyeLe: null, createdAt: { lte: limite } },
    select: {
      id: true, versId: true, quantite: true, createdAt: true,
      item: { select: { catalogue: { select: { nom: true } }, produits: { select: { product: { select: { canonicalName: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
    take: PAR_PASSAGE,
  });
  let magasin: string[] | null = null;
  let relances = 0;
  for (const t of dus) {
    const pris = await prisma.promoStockTransfer.updateMany({
      where: { id: t.id, statut: "EN_ROUTE", rappelEnvoyeLe: null },
      data: { rappelEnvoyeLe: maintenant },
    });
    if (pris.count === 0) continue;
    const libelle = libelleArticleStock(t.item.catalogue.nom, t.item.produits.map((p) => p.product.canonicalName));
    const quantite = Number(t.quantite).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
    const destinataires = t.versId ? [t.versId] : (magasin ??= await gestionnairesDuMagasin());
    for (const userId of destinataires) {
      await notifyUser({
        userId,
        type: "GENERIC",
        title: t.versId ? "Réception de matériel à confirmer" : "Retour au magasin à confirmer",
        body: `${quantite} × ${libelle}, envoyé(s) il y a plus de ${JOURS_AVANT_RAPPEL} jours, ne sont toujours pas confirmé(s). Confirmez ce que vous avez reçu — ou refusez-le : tant que rien n'est confirmé, ce matériel n'est dans le stock de personne.`,
        link: t.versId ? "/promo-material/stock?vue=moi" : "/promo-material/stock?vue=magasin",
      });
    }
    relances++;
  }
  return { relances };
}
