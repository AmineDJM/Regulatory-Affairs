import { canOpenModule } from "@/lib/modules-visibility";
import { MODULE_LABELS } from "@/lib/labels";
import { userCan, type Module, type SessionUser } from "@/lib/rbac";

/**
 * ═════════════════════════════════════════════════════════════════
 * UN LIEN N'EXISTE QUE SI L'ÉCRAN S'OUVRIRA (§118.196, lot E3 — audit 360°, M10/M12). Fonctions PURES :
 * aucune lecture — elles rejouent les portes sur ce que la session et les réglages disent déjà.
 *
 * `requireModule` garde chaque écran de deux portes : le droit de LECTURE du module, PUIS le
 * module en service (ni masqué, ni retiré — `canOpenModule`). Un lien posé sans les rejouer
 * mène, selon le cas, à une redirection `?denied=` ou `?masque=` : un geste offert puis refusé
 * n'est pas un geste (§118.83). On les rejoue donc ICI, une fois, pour tous les liens de
 * « Mon Équipe » — la file comme les chiffres.
 * ═════════════════════════════════════════════════════════════════
 */

/** Cette personne ARRIVERA-T-ELLE sur l'écran de ce module ? Les deux portes de `requireModule`. */
export function peutOuvrirModule(user: SessionUser, module: Module, hidden: readonly string[]): boolean {
  return userCan(user, module, "VIEW") && canOpenModule(module, hidden, { isSuperAdmin: user.role === "SUPER_ADMIN" });
}

export interface LienDeLigne {
  /** L'écran où l'on agit — présent seulement si ses deux portes laissent entrer. */
  href: string | null;
  /** Pourquoi il n'y a pas de lien, et qui peut le lever. */
  sansLien: string | null;
}

/**
 * Le lien d'une ligne qui ATTEND quelqu'un, et les trois issues qu'il peut avoir :
 *  · module hors service (masqué, retiré) → `null` : la ligne n'a pas lieu d'être, rien ne s'y
 *    tranche plus pour personne ;
 *  · module non ouvert à ce compte → la ligne reste, SANS lien, et dit qui peut l'ouvrir — une
 *    décision qui attend quelqu'un ne disparaît pas en silence (§118.30) ;
 *  · sinon → le lien.
 */
export function lienDeLigne(user: SessionUser, module: Module, href: string, hidden: readonly string[]): LienDeLigne | null {
  if (!canOpenModule(module, hidden, { isSuperAdmin: user.role === "SUPER_ADMIN" })) return null;
  if (userCan(user, module, "VIEW")) return { href, sansLien: null };
  return {
    href: null,
    sansLien: `Le module « ${MODULE_LABELS[module]} » n'est pas ouvert à votre compte — le Super Admin l'accorde dans Administration › Accès.`,
  };
}
