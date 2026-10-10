/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ VIT LE MODULE « BONS DE COMMANDE » — une adresse, écrite une fois (§118.176).
 *
 * Décision de la Direction (01/10/2026) : « Le module bon de commande doit être à part et le super
 * admin donne les accès à qui il veut. » Ce n'est donc plus un sous-module des Finances
 * (`/finances/bons-de-commande`, §118.149) : c'est un module à part, avec son entrée de menu et son
 * droit (`PURCHASE_ORDERS`), réglé personne par personne dans Administration › Accès.
 *
 * AU SOCLE, comme l'adresse du stock promotionnel (§118.173) : le MENU (`labels.ts`, au socle) la
 * lit, l'aiguillage des bons de commande et les actions qui le revalident aussi, et des fichiers
 * d'Adam la citent dans leurs chemins à rafraîchir — aucun n'a le droit d'importer l'autre.
 *
 * L'ANCIENNE adresse ne meurt pas : des notifications « Bon de commande à signer » déjà envoyées la
 * portent, en base, et une personne qui clique demain doit arriver au bon écran. Une page d'escale
 * la REDIRIGE (le patron de `/finances`, §118.169) ; un banc appelle cette page et compare sa
 * destination à cette constante, et un cliquet interdit qu'un fichier de `src/` réécrive l'ancienne
 * adresse.
 *
 * Module PUR — aucune importation. Le navigateur et le serveur le lisent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const CHEMIN_BONS_DE_COMMANDE = "/bons-de-commande";

/**
 * La file ouverte SUR UN BC (`?bc=<id de la pièce Legal>`) : la ligne « à signer » dont parle la
 * notification vient sous les yeux et s'entoure (`ancreBonDeCommande`). Un BC déjà signé ou renvoyé
 * garde son ancre dans les listes du dessous ; sans identifiant, la file s'ouvre en tête.
 */
export function ancreBonDeCommande(docId: string): string {
  return `bc-${docId}`;
}

export function lienBonDeCommande(docId?: string | null): string {
  return docId ? `${CHEMIN_BONS_DE_COMMANDE}?bc=${encodeURIComponent(docId)}` : CHEMIN_BONS_DE_COMMANDE;
}

/**
 * Le chemin du MENU, tel qu'une phrase le nomme (« … depuis Administration › Bons de commande »).
 * Une phrase qui nomme un chemin qui n'existe pas fait chercher (§118.128) : il vit ici, à côté de
 * l'adresse, pour changer avec elle.
 */
export const MENU_BONS_DE_COMMANDE = "Administration › Bons de commande";
