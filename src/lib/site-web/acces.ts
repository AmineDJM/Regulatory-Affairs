import { isTopManagement, userCan, type SessionUser } from "@/lib/rbac";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI PUBLIE QUOI SUR LE SITE PUBLIC (§118.158) — une règle, lue par les écrans ET les actions.
 *
 *   • Les OFFRES D'EMPLOI se publient par les RH (droit `RH` en écriture) et la direction
 *     (Super Admin, Direction, Directeur Général) : ce sont des RECRUTEMENTS, et c'est la même
 *     porte que celle qui instruit une demande de recrutement (`recruitment/access.ts`). Le module
 *     « Site web » ne les ouvre qu'en LECTURE à qui ne tient pas les RH.
 *   • Les ARTICLES DE BLOG se publient par le module « Site web » (écriture) — de la communication.
 *   • LA LIAISON AU SITE (§118.159, §118.160) — générer ou abandonner la clé, vérifier la
 *     connexion, rapprocher à la demande, lever le blocage, lire ce que le site dit de lui-même :
 *     le Super Admin SEUL, depuis la console d'administration (`ECRAN_LIAISON`). Une seule règle
 *     pour les cinq gestes : trois prédicats écrits pour la même chose (« rapprocher », « lever »,
 *     « gérer ») ont fini par dire trois choses, et « Rapprocher maintenant » s'ouvrait à quiconque
 *     publiait un article.
 *
 * Deux copies de « qui peut publier » finiraient par diverger, et le symptôme serait un bouton
 * visible qu'une action refuse (§118.5) : les écrans ne calculent rien eux-mêmes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export function peutPublierOffres(user: SessionUser): boolean {
  return userCan(user, "RH", "UPDATE") || isTopManagement(user);
}

export function peutVoirSiteWeb(user: SessionUser): boolean {
  return userCan(user, "SITE_WEB", "VIEW");
}

export function peutVoirOffres(user: SessionUser): boolean {
  return peutPublierOffres(user) || peutVoirSiteWeb(user);
}

export function peutEcrireArticles(user: SessionUser): boolean {
  return userCan(user, "SITE_WEB", "CREATE") || userCan(user, "SITE_WEB", "UPDATE");
}

export function peutSupprimerArticles(user: SessionUser): boolean {
  return userCan(user, "SITE_WEB", "DELETE");
}

/**
 * GÉRER LA LIAISON AU SITE (§118.159, §118.160) — la clé (la générer, l'abandonner, voir le bloc à
 * coller), la vérification, le rapprochement à la demande, le blocage : le Super Admin, le rôle
 * PRINCIPAL et lui seul. C'est l'identifiant qui donne le droit de publier sur le site public ; il
 * ne se prête pas avec une casquette secondaire. Le rapprochement QUOTIDIEN, lui, tourne seul : ce
 * prédicat ne garde que le geste « maintenant ».
 */
export function peutGererLaLiaison(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN";
}
