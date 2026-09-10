/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI EST UN KAM, QUI EST DIRECTION MARKETING — module PUR au socle, aucun import.
 *
 * ── POURQUOI CETTE LECTURE EST AU SOCLE ─────────────────────────────────────────────────
 *
 * Même critère que `designation.ts` et `joignabilite.ts`, à côté desquels il vit : une lecture
 * de ce qu'une personne EST, sans métier, sans base, et dont TROIS couches ont besoin sans avoir
 * le droit de s'importer les unes les autres :
 *
 *   • le CIRCUIT Ad & Pro (`workflow/`), pour savoir par où entre une demande et qui la tranche ;
 *   • la GAMME d'une demande (`ad-pro/`), pour déduire la Business Unit d'un KAM de sa fiche
 *     force de vente ;
 *   • les ÉCRANS, pour dire à qui un champ s'adresse.
 *
 * La première version mettait la constante dans `workflow/parcours.ts` — pur lui aussi, mais
 * DANS un domaine. `domains.test.ts` a compté 70 traversées inter-domaines pour un plafond de
 * 69 et refusé : la déduction de gamme traversait vers le circuit pour lire un nom de rôle. Le
 * plafond ne se lève pas ; on sort la partie partagée. C'est §118.72 et §118.97 pour la
 * troisième fois, et le remède est le même à chaque fois.
 *
 * ── ET LE DÉFAUT QU'ON ÉVITE ────────────────────────────────────────────────────────────
 *
 * Recopier `"MEDICAL_DELEGATE"` de chaque côté donnerait deux réponses à « est-ce un KAM ? ».
 * Le symptôme serait silencieux et coûteux : une demande routée comme celle d'un KAM (par le
 * circuit) dont la gamme ne se déduirait pas (par l'autre lecture), ou l'inverse — un KAM dont
 * la gamme est imposée mais dont la demande saute son superviseur national.
 *
 * L'OBLIGATION qui vient avec la place : `scanSocle()` échoue si ce fichier importe un domaine
 * ou une façade. Cette lecture restera pure, ou elle cassera le test.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE RÔLE QUI DÉSIGNE UN KAM, et lui seul.
 *
 * `MEDICAL_DELEGATE` est le délégué médical, c'est-à-dire le KAM (`rbac.ts` le dit en toutes
 * lettres là où il ouvre son tableau de bord : « KAM / délégué médical »). Le `NATIONAL_SALES`
 * porte « les capacités du délégué médical + l'approbation préliminaire » : il fait le même
 * métier, mais c'est LUI le superviseur national — sa demande n'a personne au-dessus d'elle dans
 * la force de vente, et la Direction l'a explicitement rangé dans l'autre parcours.
 */
export const ROLE_KAM = "MEDICAL_DELEGATE" as const;

/** Le rôle qui porte Direction Marketing — anciennement « Chef de produit ». */
export const ROLE_DIRECTION_MARKETING = "PRODUCT_MANAGER" as const;

/** Le superviseur national de la force de vente. */
export const ROLE_NATIONAL_SALES = "NATIONAL_SALES" as const;

/** Ce qu'il faut savoir d'une personne pour lire son métier. */
export interface RolesPersonne {
  role: string;
  secondaryRole?: string | null;
}

/**
 * Le RÔLE SECONDAIRE compte, partout.
 *
 * Quelqu'un qui exerce AUSSI comme délégué médical est un KAM pour le circuit ; l'ignorer
 * enverrait sa demande directement à Direction Marketing en sautant son superviseur national.
 * C'est la convention de tout le RBAC de ce produit (`hasRole`), et s'en écarter ici ferait une
 * exception que personne ne pourrait deviner.
 */
const porte = (p: RolesPersonne | null | undefined, role: string): boolean => {
  if (!p) return false;
  return p.role === role || (p.secondaryRole ?? null) === role;
};

export function estKam(p: RolesPersonne | null | undefined): boolean {
  return porte(p, ROLE_KAM);
}

export function estDirectionMarketing(p: RolesPersonne | null | undefined): boolean {
  return porte(p, ROLE_DIRECTION_MARKETING);
}

export function estNationalSales(p: RolesPersonne | null | undefined): boolean {
  return porte(p, ROLE_NATIONAL_SALES);
}
