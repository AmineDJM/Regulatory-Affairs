import { prisma } from "@/lib/prisma";
import { resolveProductId } from "@/lib/products/resolve";

/**
 * LE PRODUIT D'UN DOSSIER — déduit de sa source, rien de nouveau à saisir.
 *
 * Un sponsoring, un congrès, un événement nomment leurs produits en texte libre ; un dossier de
 * matériel promotionnel les rattache au catalogue. On rend le PREMIER produit nommé (plus le
 * nombre d'autres), et son identifiant quand il se résout avec certitude — la liste renvoie alors
 * à la fiche Produits 360. Un dossier ouvert par le pharmacien n'a pas de source : pas de produit.
 */
export interface ProduitDossier {
  nom: string;
  /** L'identifiant du produit canonique, quand la mention se résout sans ambiguïté. */
  id: string | null;
  /** Combien d'autres produits la source nomme. */
  autres: number;
}

/** « Raltégravir, Darunavir / Dolutégravir » → trois mentions. Le « + » reste : il lie une association. */
export function mentionsProduits(texte: string | null | undefined): string[] {
  return (texte ?? "")
    .split(/[,;\n/]|\s+et\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export async function produitsDesDossiers(
  decls: readonly { id: string; sourceType: string; sourceId: string }[],
): Promise<Map<string, ProduitDossier>> {
  const ids = (t: string) => decls.filter((d) => d.sourceType === t).map((d) => d.sourceId);
  const legalIds = ids("LEGAL_DOCUMENT");

  const [sponsorings, intls, nationaux, events, pieces] = await Promise.all([
    ids("SPONSORING").length
      ? prisma.sponsoringRequest.findMany({ where: { id: { in: ids("SPONSORING") } }, select: { id: true, product: true } })
      : Promise.resolve([]),
    ids("CONGRESS_INTERNATIONAL").length
      ? prisma.congressInternational.findMany({ where: { id: { in: ids("CONGRESS_INTERNATIONAL") } }, select: { id: true, products: true } })
      : Promise.resolve([]),
    ids("CONGRESS_NATIONAL").length
      ? prisma.congressNational.findMany({ where: { id: { in: ids("CONGRESS_NATIONAL") } }, select: { id: true, promotedProducts: true } })
      : Promise.resolve([]),
    ids("EVENT").length
      ? prisma.event.findMany({ where: { id: { in: ids("EVENT") } }, select: { id: true, products: true } })
      : Promise.resolve([]),
    // UN PAIEMENT DE MATÉRIEL PROMOTIONNEL déclare la FACTURE : on remonte au dossier dont elle découle.
    legalIds.length
      ? prisma.legalDocument.findMany({ where: { id: { in: legalIds } }, select: { id: true, sourceType: true, sourceId: true } })
      : Promise.resolve([]),
  ]);

  const texteParSource = new Map<string, string | null>();
  for (const s of sponsorings) texteParSource.set(s.id, s.product);
  for (const c of intls) texteParSource.set(c.id, c.products);
  for (const c of nationaux) texteParSource.set(c.id, c.promotedProducts);
  for (const e of events) texteParSource.set(e.id, e.products);

  // Matériel promotionnel : le dossier, directement ou par sa facture.
  const promoParSource = new Map<string, string>();
  for (const id of ids("PROMO_MATERIAL")) promoParSource.set(id, id);
  for (const p of pieces) if (p.sourceType === "PROMO_MATERIAL" && p.sourceId) promoParSource.set(p.id, p.sourceId);
  const promoIds = [...new Set(promoParSource.values())];
  const articles = promoIds.length
    ? await prisma.promoRequestItem.findMany({
        where: { promoMaterialId: { in: promoIds } },
        select: { promoMaterialId: true, produits: { select: { product: { select: { id: true, canonicalName: true } } } } },
        orderBy: { position: "asc" },
      })
    : [];
  const produitsParPromo = new Map<string, { id: string; nom: string }[]>();
  for (const a of articles) {
    const liste = produitsParPromo.get(a.promoMaterialId) ?? [];
    for (const p of a.produits) if (!liste.some((x) => x.id === p.product.id)) liste.push({ id: p.product.id, nom: p.product.canonicalName });
    produitsParPromo.set(a.promoMaterialId, liste);
  }

  // Une mention se résout UNE fois, quel que soit le nombre de dossiers qui la portent.
  const cache = new Map<string, Promise<string | null>>();
  const resoudre = (m: string) => {
    const cle = m.toLowerCase();
    if (!cache.has(cle)) cache.set(cle, resolveProductId(m).catch(() => null));
    return cache.get(cle)!;
  };

  const out = new Map<string, ProduitDossier>();
  await Promise.all(decls.map(async (d) => {
    const promo = promoParSource.get(d.sourceId);
    if (promo) {
      const liste = produitsParPromo.get(promo) ?? [];
      if (liste.length) out.set(d.id, { nom: liste[0].nom, id: liste[0].id, autres: liste.length - 1 });
      return;
    }
    const mentions = mentionsProduits(texteParSource.get(d.sourceId));
    if (mentions.length === 0) return;
    out.set(d.id, { nom: mentions[0], id: await resoudre(mentions[0]), autres: mentions.length - 1 });
  }));
  return out;
}
