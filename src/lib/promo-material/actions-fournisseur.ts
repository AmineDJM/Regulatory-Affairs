/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ON ATTEND DU FOURNISSEUR — le vocabulaire des actions d'un achat promotionnel (§118.165).
 *
 * « Pour le devis ainsi que pour le BC du matériel promotionnel, on peut avoir plusieurs actions,
 * en l'occurrence conception, impression, etc. » Une fiche posologique se CONÇOIT chez une agence
 * puis s'IMPRIME chez un imprimeur : deux lignes, deux fournisseurs, deux bons de commande — et une
 * seule des deux produit des feuilles à compter.
 *
 * ── LE VOCABULAIRE EST FERMÉ, ET C'EST LUI QUI DÉCIDE DU STOCK ─────────────────────────────
 *
 * Une impression, une fabrication ou un achat produisent des UNITÉS : reçues, elles entrent au
 * magasin central. Une conception, une livraison, une installation, une location n'en produisent
 * pas : reçues, elles sont simplement « faites ». Un vocabulaire ouvert ferait entrer au stock des
 * prestations qui ne se comptent pas — « 1 maquette » au magasin, distribuable à un médecin.
 *
 * La liste vit ICI, zéro import : le schéma (enum `PromoAction`), le serveur et l'écran la lisent,
 * et un test exige que les deux listes soient la même (deux vocabulaires finissent par diverger).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type PromoAction =
  | "CONCEPTION"
  | "IMPRESSION"
  | "FABRICATION"
  | "ACHAT"
  | "LOCATION"
  | "LIVRAISON"
  | "INSTALLATION"
  | "AUTRE";

export const ACTIONS: readonly PromoAction[] = [
  "CONCEPTION", "IMPRESSION", "FABRICATION", "ACHAT", "LOCATION", "LIVRAISON", "INSTALLATION", "AUTRE",
];

export const ACTION_LABEL: Record<PromoAction, string> = {
  CONCEPTION: "Conception",
  IMPRESSION: "Impression",
  FABRICATION: "Fabrication",
  ACHAT: "Achat",
  LOCATION: "Location",
  LIVRAISON: "Livraison",
  INSTALLATION: "Installation",
  AUTRE: "Autre prestation",
};

/** Ce que l'action CHANGE — dit sous le choix, pour que le choix soit éclairé. */
export const ACTION_AIDE: Record<PromoAction, string> = {
  CONCEPTION: "Maquette, création graphique, BAT — rien à compter.",
  IMPRESSION: "Tirage d'un support : les unités reçues entrent au magasin.",
  FABRICATION: "Présentoir, stand, objet fabriqué : les unités reçues entrent au magasin.",
  ACHAT: "Objet fini (stylos, goodies) : les unités reçues entrent au magasin.",
  LOCATION: "L'objet repart chez le fournisseur : rien n'entre au magasin.",
  LIVRAISON: "Transport, livraison — rien à compter.",
  INSTALLATION: "Montage, installation — rien à compter.",
  AUTRE: "Toute autre prestation — rien à compter.",
};

const PRODUISENT = new Set<PromoAction>(["IMPRESSION", "FABRICATION", "ACHAT"]);

export function estAction(x: unknown): x is PromoAction {
  return typeof x === "string" && (ACTIONS as readonly string[]).includes(x);
}

/**
 * L'ACTION PRODUIT-ELLE DES UNITÉS À COMPTER ? `null` (une ligne d'avant ce vocabulaire) n'est ni
 * oui ni non : c'est la réception qui le dira, en choisissant ou non un article du catalogue.
 */
export function actionProduit(a: PromoAction | null | undefined): boolean | null {
  if (a == null) return null;
  return PRODUISENT.has(a);
}

/**
 * LA DÉSIGNATION D'UNE LIGNE DE BON DE COMMANDE : l'action devant la désignation du devis —
 * « Impression — Fiche posologique Nivolex ». Le BC est la pièce que le fournisseur lit : y
 * nommer l'action dit ce qu'on lui commande, et deux lignes du même article (conception, puis
 * impression) ne s'y confondent plus. Rien n'est répété si la désignation commence déjà par l'action.
 */
export function designationAvecAction(designation: string, action: PromoAction | null | undefined): string {
  const d = designation.trim();
  if (!action) return d;
  const libelle = ACTION_LABEL[action];
  const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return sansAccent(d).startsWith(sansAccent(libelle)) ? d : `${libelle} — ${d}`;
}
