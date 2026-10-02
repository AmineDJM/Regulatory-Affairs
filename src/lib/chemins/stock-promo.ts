/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ VIVENT LE STOCK ET LE CATALOGUE PROMOTIONNELS — une adresse, écrite une fois (§118.173).
 *
 * Décision de la Direction (01/10) : le stock et le catalogue du matériel promotionnel forment un
 * sous-module À PART du pôle Sales & Marketing — ce ne sont plus des onglets d'Ad & Pro. Leur
 * adresse changeait donc, et elle était écrite en toutes lettres à vingt-cinq endroits : actions,
 * notifications, rappels, corbeille, écrans, bancs. Vingt-cinq copies d'une adresse, c'est la
 * garantie qu'un lien finira par mener à l'ancien écran (§118.5) ; elles lisent toutes ce module.
 *
 * AU SOCLE, et pas sous `promo/` : le MENU (`labels.ts`, au socle) la lit, et le socle ne lit que
 * le socle. Les écrivains du stock (domaine `adpro`), les actions, les chargeurs et les écrans la
 * lisent aussi — aucun n'a le droit d'importer l'autre.
 *
 * Les ANCIENNES adresses (`/promo-material/stock`, `/promo-material/catalogue`) ne meurent pas :
 * des notifications déjà envoyées les portent, en base, et une personne qui clique demain sur
 * « Comptage demandé » doit arriver au bon écran. Une page d'escale à chacune les REDIRIGE, la vue
 * demandée (`?vue=…`) comprise — le patron de `/finances` (§118.169) ; un banc appelle ces pages
 * et compare leur destination à ces constantes, et un cliquet interdit qu'un fichier de `src/`
 * réécrive l'ancienne adresse.
 *
 * Module PUR — aucune importation. Le navigateur et le serveur le lisent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const CHEMIN_STOCK_PROMO = "/stock-promotionnel";
export const CHEMIN_CATALOGUE_PROMO = "/stock-promotionnel/catalogue";

/** Les vues de l'écran du stock que les notifications et les liens désignent. */
export type VueStockPromo = "moi" | "equipe" | "magasin" | "general" | "comptages" | "tableau" | "medecins";

export const VUES_STOCK_PROMO: readonly VueStockPromo[] = ["moi", "equipe", "magasin", "general", "comptages", "tableau", "medecins"];

/**
 * La vue lue dans une adresse — `undefined` sur tout ce qui n'en est pas une. Une redirection ne
 * recopie pas une valeur qu'elle ne reconnaît pas : elle mène à l'écran tel qu'il s'ouvre.
 */
export function vueStockPromo(v: unknown): VueStockPromo | undefined {
  return typeof v === "string" && (VUES_STOCK_PROMO as readonly string[]).includes(v) ? (v as VueStockPromo) : undefined;
}

/** Le lien vers une vue du stock (`?vue=…`), ou vers l'écran tel qu'il s'ouvre. */
export function lienStockPromo(vue?: VueStockPromo): string {
  return vue ? `${CHEMIN_STOCK_PROMO}?vue=${vue}` : CHEMIN_STOCK_PROMO;
}

/**
 * Le chemin du MENU, tel qu'une phrase le nomme (« … depuis Sales & Marketing › Stock
 * promotionnel »). Une phrase qui nomme un chemin qui n'existe pas fait chercher (§118.128) : il
 * vit ici, à côté de l'adresse, pour changer avec elle.
 */
export const MENU_STOCK_PROMO = "Sales & Marketing › Stock promotionnel";
export const MENU_CATALOGUE_PROMO = "Sales & Marketing › Stock promotionnel › Catalogue";

