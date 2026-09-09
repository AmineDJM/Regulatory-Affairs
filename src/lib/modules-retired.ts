/**
 * LES MODULES RETIRÉS DU SERVICE — la liste, et pourquoi elle vit seule dans son fichier.
 *
 * ── CE QUE « RETIRÉ » VEUT DIRE ─────────────────────────────────────────────────────────────
 *
 * Ni menu, ni adresse, ni action serveur, ni outil d'assistant — pour TOUT LE MONDE, Super Admin
 * compris. Ce n'est pas un droit (« cette personne n'y a pas accès ») ni un masquage (« éteint le
 * temps d'une refonte, le Super Admin le voit encore ») : c'est une décision de produit. Ces
 * écrans ne servent à personne dans cette entreprise.
 *
 * ── POURQUOI LE CODE ET NON UN RÉGLAGE ──────────────────────────────────────────────────────
 *
 * Un réglage se rallume « pour voir », et l'on se retrouve avec trois modules à maintenir pour un
 * usage qui n'existe pas. Écrit ici, le retrait se relit, se discute, et se défait en supprimant
 * une ligne — sans qu'aucune donnée ne soit perdue.
 *
 * ── POURQUOI UN FICHIER À PART ──────────────────────────────────────────────────────────────
 *
 * Parce que le retrait doit être connu de `rbac.ts` (pour vider l'accès à la racine) ET de
 * `modules-visibility.ts` (qui, lui, importe `rbac.ts`). Une constante posée dans l'un des deux
 * créerait un cycle d'imports. Ce fichier n'importe RIEN : c'est ce qui le rend citable de
 * partout, y compris d'un composant client.
 *
 * ── OÙ LE RETRAIT PREND EFFET ───────────────────────────────────────────────────────────────
 *
 *   • `rbac.ts` (`getAccess`) — le module n'entre PAS dans l'accès effectif. `userCan` répond
 *     donc non partout : écrans, actions serveur, routes d'API et outils d'Adam d'un seul coup.
 *     C'est la garde qui compte : les autres ne font que rendre l'interface cohérente ;
 *   • `modules-visibility.ts` — hors du menu et injoignable par son adresse ;
 *   • `navigation.ts` — les alias de recherche partent avec les écrans.
 *
 * Les DONNÉES restent en base, intactes.
 */

/**
 * Retirés le 2026-09 sur décision métier :
 *   • `SALES` — « Ventes » : le suivi commercial se fait dans Force de vente (SFE) ;
 *   • `LOGISTICS` — « Commandes & logistique » : jamais entré dans les usages ;
 *   • `BUSINESS_DEVELOPMENT` — « Market Intelligence ».
 *
 * ⚠️ `PCH` (Marchés PCH) et `PRODUCT_EXPLORER` (Explorateur produits) RESTENT en service : ce
 * sont des modules voisins, séparés de Market Intelligence précisément pour survivre à ce genre
 * de décision. Ne pas les ajouter ici par association d'idées.
 */
export const RETIRED_MODULE_KEYS: readonly string[] = ["SALES", "LOGISTICS", "BUSINESS_DEVELOPMENT"];

/**
 * CE QUI SURVIT À UN RETRAIT — un sous-module nommé, et lui seul.
 *
 * Un retrait est une décision de produit, pas un réglage (voir plus haut). Mais une décision de
 * produit se REVISE PAR MORCEAUX : le dirigeant a redemandé « BD › Projets » — le registre des
 * projets par lesquels on classe les dossiers réglementaires — sans redemander Market
 * Intelligence. Rouvrir le module entier lui rendrait onze écrans qu'il a décidé d'éteindre ;
 * laisser Projets dans le retrait lui laisserait un écran INATTEIGNABLE, ce qui est pire que de
 * ne pas l'avoir écrit (§118.50 : une vue que rien n'affiche est du code mort).
 *
 * ── CE QUE CETTE LISTE NE FAIT PAS, ET C'EST L'ESSENTIEL ────────────────────────────────────
 *
 * Elle NE ROUVRE PAS le module dans `rbac.ts`. `userCan(user, "BUSINESS_DEVELOPMENT", …)` reste
 * FAUX pour tout le monde, Super Admin compris — donc les écrans de Market Intelligence, leurs
 * actions serveur et les outils d'Adam qui les visent restent fermés, exactement comme avant.
 * Le sous-module maintenu porte sa PROPRE porte (`canViewBdProjects` / `canManageBdProjects`),
 * qui ne passe pas par le module retiré. Rouvrir le module aurait été une ligne de moins et
 * aurait rendu, en prime, deux actions de Market Intelligence et l'accès générique d'Adam à
 * tout le module : l'empreinte réelle aurait dépassé l'empreinte demandée (§118.16).
 *
 * Ce qui reste vrai du retrait : l'adresse racine `/business-development` et les onze autres
 * écrans ne s'ouvrent pas, pour personne.
 */
export const SOUS_MODULES_MAINTENUS: Readonly<Record<string, readonly string[]>> = {
  BUSINESS_DEVELOPMENT: ["/business-development/projets"],
};

/** Ce chemin est-il un sous-module maintenu d'un module par ailleurs retiré ? */
export function estCheminMaintenu(href: string): boolean {
  return Object.values(SOUS_MODULES_MAINTENUS).some((chemins) => chemins.includes(href));
}

/** Ce module a-t-il été retiré du service ? */
export function isRetiredModule(module: string): boolean {
  return RETIRED_MODULE_KEYS.includes(module);
}
