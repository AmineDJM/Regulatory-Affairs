import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { corrigerAuCompte, soldeDe, sousVerrous } from "@/lib/promo/stock-ecriture";
import { partitionComptage, type ArticleAComptabiliser, type LigneSaisie } from "@/lib/promo/comptages";
import { libelleArticleStock } from "@/lib/promo/stock";
import type { PromoFamille } from "@/lib/promo/catalogue";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ENREGISTRER UN COMPTAGE — sous le verrou de chaque article compté (§118.168).
 *
 * Trois propriétés, et chacune a son cas dans le banc :
 *
 *   • L'ÉCART SE LIT SOUS LE VERROU, au moment de la saisie : une visite faite entre la demande et
 *     la saisie a déjà retiré ses fiches ; la compter comme un manquant les retirerait deux fois.
 *   • TOUT OU RIEN : la ligne d'un article dont la correction échoue annule la saisie entière. Un
 *     comptage à moitié appliqué dirait « compté » sur un registre resté à moitié faux.
 *   • UNE SEULE FOIS : le comptage passe SAISI par une écriture conditionnelle prise AVANT toute
 *     correction, dans la même transaction. Deux envois simultanés de la même saisie (double clic,
 *     deux onglets) verrouillent les mêmes articles dans le même ordre : le second attend, puis
 *     trouve le comptage déjà saisi, et n'écrit rien.
 *
 * Les mouvements passent par l'écrivain unique (`corrigerAuCompte`) : ce module n'en crée aucun.
 * Serveur seulement.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

class RefusComptage extends Error {}

export interface LigneEnregistree {
  itemId: string;
  libelle: string;
  attendu: number;
  compte: number;
  ecart: number;
}

/**
 * LES ARTICLES QUE CE DÉTENTEUR DOIT COMPTER, et ceux qu'il peut ajouter — dans le périmètre
 * d'entité de celui qui SAISIT (le même que son écran), avec les soldes EN BASE. L'appelant les
 * passe à `lireSaisieComptage` ; la règle de partition est la même que celle du formulaire.
 */
export async function articlesDuComptage(saisieParId: string, holderId: string | null, famille: PromoFamille | null) {
  const items = await prisma.promoStockItem.findMany({
    where: await companyScopedWhere(saisieParId, {}),
    select: {
      id: true, isActive: true,
      catalogue: { select: { nom: true, famille: true } },
      produits: { select: { product: { select: { canonicalName: true } } } },
    },
  });
  const ids = items.map((i) => i.id);
  const sommes = ids.length
    ? await prisma.promoStockMovement.groupBy({ by: ["itemId"], where: { itemId: { in: ids }, holderId }, _sum: { delta: true } })
    : [];
  const solde = new Map(sommes.map((s) => [s.itemId, r3(Number(s._sum.delta ?? 0))]));
  const articles: ArticleAComptabiliser[] = items.map((i) => ({
    itemId: i.id, famille: i.catalogue.famille, actif: i.isActive, solde: solde.get(i.id) ?? 0,
  }));
  const libelles = new Map(items.map((i) => [i.id, libelleArticleStock(i.catalogue.nom, i.produits.map((p) => p.product.canonicalName))]));
  return { ...partitionComptage(articles, famille), libelles };
}

export async function enregistrerSaisieComptage(c: {
  comptageId: string;
  holderId: string | null;
  lignes: readonly LigneSaisie[];
  libelles: ReadonlyMap<string, string>;
  auteurId: string;
  motif: string;
  maintenant: Date;
}): Promise<{ ok: true; lignes: LigneEnregistree[] } | { ok: false; refus: string }> {
  try {
    const lignes = await sousVerrous(c.lignes.map((l) => l.itemId), async (tx, verrouilles) => {
      for (const l of c.lignes) {
        if (!verrouilles.has(l.itemId)) throw new RefusComptage("Un des articles comptés vient d'être supprimé : rechargez la page avant de saisir.");
      }
      // LA PRISE, AVANT TOUTE CORRECTION : c'est elle qui rend la saisie unique.
      const pris = await tx.promoStockComptage.updateMany({
        where: { id: c.comptageId, statut: "DEMANDE" },
        data: { statut: "SAISI", saisiLe: c.maintenant, saisiParId: c.auteurId },
      });
      if (pris.count === 0) throw new RefusComptage("Ce comptage n'est plus à faire : il vient d'être saisi ou annulé.");
      const resultat: LigneEnregistree[] = [];
      for (const l of c.lignes) {
        const attendu = await soldeDe(tx, l.itemId, c.holderId);
        const ecart = r3(l.compte - attendu);
        if (ecart !== 0) {
          const r = await corrigerAuCompte(tx, l.itemId, {
            holderId: c.holderId, compte: l.compte, motif: c.motif, auteurId: c.auteurId, maintenant: c.maintenant,
            comptageId: c.comptageId,
          });
          if (!r.ok) throw new RefusComptage(`« ${c.libelles.get(l.itemId) ?? "Article"} » : ${r.refus}`);
        }
        await tx.promoStockComptageLigne.create({
          data: { comptageId: c.comptageId, itemId: l.itemId, attendu, compte: l.compte, ecart },
        });
        resultat.push({ itemId: l.itemId, libelle: c.libelles.get(l.itemId) ?? "Article", attendu, compte: l.compte, ecart });
      }
      return resultat;
    });
    return { ok: true, lignes };
  } catch (e) {
    if (e instanceof RefusComptage) return { ok: false, refus: e.message };
    throw e;
  }
}
