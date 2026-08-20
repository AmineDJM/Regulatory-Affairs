/**
 * QUI ENTRE DANS LE PIPELINE — les dossiers verrouillés, et le cadenas qui les tient.
 *
 * Un dossier verrouillé est un produit qu'on ÉTUDIE : un portefeuille chargé dans l'outil avant
 * d'avoir décidé qu'on le déposerait. Jusqu'ici, une seule personne au monde le voyait — le Super
 * Admin — et c'était trop peu : le directeur du développement, le responsable réglementaire ou
 * l'analyste qui montent le dossier travaillent dessus AVANT l'ouverture du cadenas. Sans accès,
 * ils recevaient le portefeuille par courriel, hors de l'outil : exactement ce que le verrou
 * voulait éviter.
 *
 * Deux droits, et ils ne se confondent pas :
 *
 *   • **CONSULTER** — voir les dossiers verrouillés, dans le pipeline comme partout ailleurs
 *     (recherche, sélecteurs de produits, assistant). C'est une confidence, pas un pouvoir ;
 *   • **TENIR LE CADENAS** — ouvrir un dossier, donc le rendre visible de toute l'entreprise.
 *     C'est l'acte qui met un dossier au travail, et il ne se reprend pas : ce qui a été publié
 *     a été lu. Il se donne à moins de monde que la consultation.
 *
 * Le Super Admin détient TOUJOURS les deux — il est celui qui distribue ces accès, et se les
 * retirer à soi-même rendrait la console inutilisable. Tenir le cadenas implique de voir : on ne
 * peut pas ouvrir ce qu'on ne voit pas.
 *
 * Module PUR — testé, sans base de données, importable côté serveur comme côté client.
 */

export interface PipelineAccessSettings {
  /** Rôles autorisés à voir les dossiers verrouillés. */
  pipelineViewerRoles: string[];
  /** Personnes nommément autorisées à les voir. */
  pipelineViewerUserIds: string[];
  /** Rôles autorisés à ouvrir / fermer le cadenas. */
  pipelineManagerRoles: string[];
  /** Personnes nommément autorisées à ouvrir / fermer le cadenas. */
  pipelineManagerUserIds: string[];
}

export interface PipelinePerson {
  id: string;
  role: string;
  /** « Autre rôle » : une fonction cumulée compte autant que la principale. */
  secondaryRole?: string | null;
}

function hasRole(user: PipelinePerson, roles: readonly string[]): boolean {
  return roles.some((r) => r === user.role || (user.secondaryRole ? r === user.secondaryRole : false));
}

/**
 * TENIR LE CADENAS — ouvrir un dossier à toute l'entreprise (ou le refermer).
 */
export function canManagePipeline(user: PipelinePerson, settings: PipelineAccessSettings): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (settings.pipelineManagerUserIds.includes(user.id)) return true;
  return hasRole(user, settings.pipelineManagerRoles);
}

/**
 * CONSULTER les dossiers verrouillés.
 *
 * Qui tient le cadenas voit forcément : l'inverse produirait un écran où l'on ouvrirait des
 * dossiers à l'aveugle. La réciproque est fausse — on peut lire un portefeuille confidentiel
 * sans avoir le droit de le publier.
 */
export function canViewPipeline(user: PipelinePerson, settings: PipelineAccessSettings): boolean {
  if (canManagePipeline(user, settings)) return true;
  if (settings.pipelineViewerUserIds.includes(user.id)) return true;
  return hasRole(user, settings.pipelineViewerRoles);
}

/** Les deux droits d'un coup — ce que `getAccess` résout une fois par requête. */
export function pipelineAccessFor(
  user: PipelinePerson,
  settings: PipelineAccessSettings,
): { view: boolean; manage: boolean } {
  const manage = canManagePipeline(user, settings);
  return { manage, view: manage || canViewPipeline(user, settings) };
}

/**
 * Ce que l'écran d'administration doit rappeler à l'administrateur AVANT qu'il n'enregistre :
 * combien de personnes vont désormais voir un portefeuille confidentiel.
 *
 * Un décompte est plus honnête qu'une phrase rassurante : « 4 rôles » se relit, « quelques
 * personnes de confiance » ne se relit pas.
 */
export function describePipelineAudience(settings: PipelineAccessSettings): string {
  const viewers = settings.pipelineViewerRoles.length + settings.pipelineViewerUserIds.length;
  const managers = settings.pipelineManagerRoles.length + settings.pipelineManagerUserIds.length;
  if (viewers === 0 && managers === 0) {
    return "Personne d'autre que le Super Admin ne voit les dossiers verrouillés.";
  }
  const parts: string[] = [];
  if (viewers > 0) parts.push(`${viewers} accès en consultation`);
  if (managers > 0) parts.push(`${managers} accès au cadenas`);
  return `${parts.join(" · ")} — en plus du Super Admin, toujours inclus.`;
}
