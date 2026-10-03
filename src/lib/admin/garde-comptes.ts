/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SEUL UN SUPER ADMIN FAIT — OU TOUCHE — UN SUPER ADMIN (§118.184, audit 360° S9).
 *
 * L'Administration se DÉLÈGUE : un compte qui reçoit le module (modifier les comptes) gère les accès
 * des autres. Mesuré par l'audit : rien ne l'empêchait de nommer n'importe qui Super Admin — lui
 * compris —, ni de réinitialiser le mot de passe d'un Super Admin pour se connecter à sa place, ni de
 * s'accorder à lui-même les modules qu'on ne lui avait pas donnés. Une délégation qui permet de
 * dépasser ce qu'on a délégué n'est pas une délégation : c'est la clé de la maison.
 *
 * Trois refus, et aucun ne vise le Super Admin lui-même :
 *   1. NOMMER un Super Admin (rôle principal) est un geste de Super Admin ;
 *   2. TOUCHER au compte d'un Super Admin (rôle, droits, mot de passe, sessions, activation) aussi ;
 *   3. MODIFIER SES PROPRES droits ou son propre rôle passe par quelqu'un d'autre.
 * Les gestes ordinaires (corriger un nom, réinitialiser le mot de passe d'un collègue, révoquer une
 * session perdue) restent à l'administrateur délégué : c'est l'objet de la délégation.
 *
 * Module PUR : chaque action d'administration le lit, avec le rôle relu en base de la cible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La nature d'un geste d'administration : son rôle, ses droits (modules, lignes), ou le compte lui-même. */
export type GesteAdministration = "ROLE" | "DROITS" | "COMPTE";

export function refusAdministration(
  acteur: { id: string; role: string },
  cible: { id: string; role: string } | null,
  geste: GesteAdministration,
  nouveauRole?: string | null,
): string | null {
  if (acteur.role === "SUPER_ADMIN") return null;
  if (nouveauRole === "SUPER_ADMIN") return "Seul un Super Admin peut nommer un Super Admin.";
  if (cible?.role === "SUPER_ADMIN") return "Seul un Super Admin peut modifier le compte d'un Super Admin.";
  if (cible && cible.id === acteur.id && (geste === "ROLE" || geste === "DROITS")) {
    return "On ne modifie pas ses propres droits ni son propre rôle : demandez-le à un autre administrateur ou au Super Admin.";
  }
  return null;
}
