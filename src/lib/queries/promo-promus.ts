import { prisma } from "@/lib/prisma";
import {
  CODE_SOCIETE, LIBELLE_SOCIETE, codeGamme, codeProduitBu, lireCode, type PromusChoisis,
} from "@/lib/promo-material/promus";

/**
 * LES « PRODUITS PROMUS » D'UNE LIGNE DE MATÉRIEL — la liste proposée, et la lecture d'un choix (§118.204).
 *
 * POURQUOI LA LISTE ÉTAIT VIDE : elle lisait `Product` (le produit CANONIQUE, `isActive`), une table que
 * rien ne remplit encore en production — le rattachement du catalogue reste un geste du Super Admin
 * (§118.178). Les produits que la force de vente promeut vivent dans les Business Units (`PromoProduct`,
 * « Force de vente › Business Units ») : c'est eux qu'on propose, SANS nommer la BU (un produit porté par
 * deux BU n'apparaît qu'une fois), avec « Société en général » et chaque gamme.
 *
 * Aucune garde de module : la liste ne révèle que des noms de produits COMMERCIALISÉS et de gammes — la
 * même ouverture que l'ancienne liste de produits actifs. Une BU archivée ne propose rien.
 */

export interface OptionPromu { id: string; nom: string }

const cle = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export async function optionsPromus(): Promise<OptionPromu[]> {
  const [gammes, produits] = await Promise.all([
    prisma.businessUnit.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.promoProduct.findMany({
      where: { isActive: true, businessUnit: { isActive: true } },
      select: { id: true, name: true, productId: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  // UN PRODUIT, UNE ENTRÉE : deux BU qui portent le même produit (même canonique, ou même nom) ne le
  // proposent pas deux fois — sans la BU, deux lignes « Nivolex » ne se départageraient pas.
  const vus = new Set<string>();
  const uniques = produits.filter((p) => {
    const k = p.productId ? `c:${p.productId}` : `n:${cle(p.name)}`;
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
  return [
    { id: CODE_SOCIETE, nom: LIBELLE_SOCIETE },
    ...gammes.map((g) => ({ id: codeGamme(g.id), nom: `Gamme — ${g.name}` })),
    ...uniques.map((p) => ({ id: codeProduitBu(p.id), nom: p.name })),
  ];
}

/**
 * LIRE UN CHOIX — les codes du sélecteur et la saisie « Autre ». Un code venu d'un champ ne se croit pas
 * sur parole : une gamme ou un produit inconnu (ou archivé) est REFUSÉ en le disant, jamais ignoré —
 * une ligne qui perd un produit en silence serait chiffrée pour autre chose (§118.16). Rend aussi les
 * produits CANONIQUES que ce choix désigne (le lien d'un produit de BU, ou une ligne d'avant) : c'est eux
 * que le stock lit à la réception.
 */
export async function resoudrePromus(
  codes: readonly string[], autreSaisi: string | null | undefined,
): Promise<{ ok: true; promus: PromusChoisis; canoniques: string[] } | { ok: false; error: string }> {
  const lus = [...new Set(codes.map((c) => c.trim()).filter(Boolean))].map((c) => ({ brut: c, lu: lireCode(c) }));
  const illisibles = lus.filter((x) => !x.lu).map((x) => x.brut);
  if (illisibles.length) return { ok: false, error: `Produit promu illisible (${illisibles.join(", ")}) : rechargez le formulaire.` };
  const idsGammes = lus.flatMap((x) => (x.lu?.type === "GAMME" ? [x.lu.id] : []));
  const idsBu = lus.flatMap((x) => (x.lu?.type === "PRODUIT_BU" ? [x.lu.id] : []));
  const idsCanon = lus.flatMap((x) => (x.lu?.type === "CANONIQUE" ? [x.lu.id] : []));
  const [gammes, produitsBu, canons] = await Promise.all([
    idsGammes.length ? prisma.businessUnit.findMany({ where: { id: { in: idsGammes }, isActive: true }, select: { id: true, name: true } }) : [],
    idsBu.length ? prisma.promoProduct.findMany({ where: { id: { in: idsBu }, isActive: true }, select: { id: true, name: true, productId: true } }) : [],
    idsCanon.length ? prisma.product.findMany({ where: { id: { in: idsCanon } }, select: { id: true, canonicalName: true } }) : [],
  ]);
  if (gammes.length !== idsGammes.length || produitsBu.length !== idsBu.length || canons.length !== idsCanon.length) {
    return { ok: false, error: "Un des produits promus choisis n'existe plus (ou a été archivé dans sa Business Unit) : rechargez le formulaire." };
  }
  const autre = (autreSaisi ?? "").trim().slice(0, 200) || null;
  const parIdGamme = new Map(gammes.map((g) => [g.id, g.name]));
  const parIdBu = new Map(produitsBu.map((p) => [p.id, p]));
  const parIdCanon = new Map(canons.map((p) => [p.id, p.canonicalName]));
  const promus: PromusChoisis = {
    societe: lus.some((x) => x.lu?.type === "SOCIETE"),
    gammes: idsGammes.map((id) => ({ id, nom: parIdGamme.get(id)! })),
    produits: [
      ...idsBu.map((id) => ({ id: codeProduitBu(id), nom: parIdBu.get(id)!.name })),
      ...idsCanon.map((id) => ({ id, nom: parIdCanon.get(id)! })),
    ],
    autre,
  };
  const canoniques = [...new Set([
    ...produitsBu.map((p) => p.productId).filter((x): x is string => Boolean(x)),
    ...idsCanon,
  ])];
  return { ok: true, promus, canoniques };
}
