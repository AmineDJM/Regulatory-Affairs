/**
 * QUI LIT ET QUI ÉMET LES DIRECTIVES — les accès du module, réglés par le Super Admin.
 *
 * Le module était distribué par la seule matrice de rôles : ouvrir les directives à quelqu'un
 * supposait de toucher son rôle, donc d'ouvrir aussi tout le reste de ce rôle. Ici, deux leviers
 * s'ajoutent PAR-DESSUS la matrice, réglables depuis l'Administration, et ils ne se confondent
 * pas :
 *
 *   • **LIRE** — recevoir et consulter les notes de service qui vous concernent. C'est le cas
 *     ordinaire : la quasi-totalité des salariés doit lire les notes de la direction ;
 *   • **ÉMETTRE** — rédiger une note et la SOUMETTRE. Ce n'est pas la publier : la signature
 *     reste au directeur général (voir `audience.ts`). Émettre sans pouvoir publier est
 *     exactement ce qu'on veut d'un chef de service qui prépare une consigne.
 *
 * Le Super Admin et le Directeur Général détiennent TOUJOURS les deux : ce sont eux qui
 * distribuent ces accès et qui publient — se les retirer rendrait la console inutilisable.
 * Émettre implique de lire : on ne rédige pas une note dans un module qu'on ne voit pas.
 *
 * Module PUR — testé, sans base de données, importable côté serveur comme côté client.
 */

import { canPublishDirectives, type DirectivePerson } from "./audience";

export interface DirectiveAccessSettings {
  /** Rôles autorisés à lire les directives, en plus de la matrice. */
  directiveReaderRoles: string[];
  /** Personnes nommément autorisées à les lire. */
  directiveReaderUserIds: string[];
  /** Rôles autorisés à rédiger et soumettre une directive. */
  directiveIssuerRoles: string[];
  /** Personnes nommément autorisées à en rédiger. */
  directiveIssuerUserIds: string[];
}

export const EMPTY_DIRECTIVE_ACCESS: DirectiveAccessSettings = {
  directiveReaderRoles: [],
  directiveReaderUserIds: [],
  directiveIssuerRoles: [],
  directiveIssuerUserIds: [],
};

function holdsRole(user: DirectivePerson, roles: readonly string[]): boolean {
  return roles.some((r) => r === user.role || (user.secondaryRole ? r === user.secondaryRole : false));
}

/**
 * ÉMETTRE une directive — la rédiger et la soumettre à la direction générale.
 *
 * `fromMatrix` porte le droit `DIRECTIVES:CREATE` de la matrice de rôles : les réglages
 * s'AJOUTENT à ce qui existe, ils ne le remplacent pas. Un lot d'administration ne doit jamais
 * retirer en silence un droit que la matrice accordait déjà.
 */
export function canIssueDirective(
  user: DirectivePerson,
  settings: DirectiveAccessSettings,
  fromMatrix = false,
): boolean {
  if (canPublishDirectives(user)) return true;
  if (fromMatrix) return true;
  if (settings.directiveIssuerUserIds.includes(user.id)) return true;
  return holdsRole(user, settings.directiveIssuerRoles);
}

/**
 * LIRE les directives. Qui émet lit forcément — l'inverse serait un écran où l'on écrirait sans
 * jamais voir ce qui a été écrit. La réciproque est fausse : la plupart des gens lisent sans
 * jamais émettre.
 */
export function canReadDirectives(
  user: DirectivePerson,
  settings: DirectiveAccessSettings,
  fromMatrix: { read?: boolean; create?: boolean } = {},
): boolean {
  if (canIssueDirective(user, settings, fromMatrix.create)) return true;
  if (fromMatrix.read) return true;
  if (settings.directiveReaderUserIds.includes(user.id)) return true;
  return holdsRole(user, settings.directiveReaderRoles);
}

/**
 * Ce que l'écran d'administration rappelle AVANT d'enregistrer : combien de personnes vont
 * désormais pouvoir écrire au nom de la direction. Un décompte est plus honnête qu'une phrase
 * rassurante — « 3 rôles » se relit, « quelques responsables » ne se relit pas.
 */
export function describeDirectiveAccess(settings: DirectiveAccessSettings): string {
  const readers = settings.directiveReaderRoles.length + settings.directiveReaderUserIds.length;
  const issuers = settings.directiveIssuerRoles.length + settings.directiveIssuerUserIds.length;
  if (readers === 0 && issuers === 0) {
    return "Aucun accès ajouté : seuls les droits du rôle s'appliquent. La direction générale et le Super Admin publient.";
  }
  const parts: string[] = [];
  if (readers > 0) parts.push(`${readers} accès en lecture`);
  if (issuers > 0) parts.push(`${issuers} accès en rédaction`);
  return `${parts.join(" · ")} — en plus des droits du rôle. La publication reste à la direction générale.`;
}
