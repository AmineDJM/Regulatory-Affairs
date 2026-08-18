/**
 * ACCÈS AUX ENTITÉS — qui a le droit de voir et de modifier quelle société du groupe.
 *
 * Le sélecteur d'entité de la barre supérieure n'était qu'une **préférence d'affichage** : il
 * proposait toutes les entités à tout le monde, et rien n'empêchait quelqu'un d'Adventum de
 * basculer sur Pharmagène et d'y lire les dossiers réglementaires. Pour un groupe multi-entités,
 * ce n'est pas un confort d'affichage, c'est une question d'étanchéité.
 *
 * Deux notions à ne pas confondre :
 *   • **l'appartenance** — de quelle société on est salarié (`Employee.companyId`) ;
 *   • **le droit d'accès** — sur quelles sociétés on travaille (`UserCompanyAccess`).
 * Quelqu'un peut être salarié d'Adventum et travailler pour trois entités.
 *
 * Ce fichier ne contient que des fonctions PURES : la décision d'accès doit être testable sans
 * base de données, et lisible sans dérouler une requête.
 */

/**
 * LE SEUL RÔLE QUI VOIT TOUT LE GROUPE — le Super Admin, et lui seul.
 *
 * Chacun ne voit que SON entité : quelqu'un d'Adventum voit Adventum, et rien d'autre, à moins
 * qu'on ne lui ait explicitement accordé une autre société (`UserCompanyAccess`). La Direction
 * était ici et voyait donc tout le groupe sans autorisation à saisir — ce n'est plus le cas :
 * elle relève de la règle commune, et ses accès inter-entités se donnent, comme pour les autres.
 *
 * C'est une règle de CLOISONNEMENT : l'élargir se fait par une autorisation nominative, jamais
 * par un rôle qui traverse tout en silence.
 */
const GROUP_WIDE_ROLES = ["SUPER_ADMIN"] as const;

export interface AccessGrant {
  companyId: string;
  canEdit: boolean;
}

export interface AccessBearer {
  role: string;
  secondaryRole?: string | null;
  /** Entité d'appartenance (fiche salarié), si elle est connue. */
  homeCompanyId?: string | null;
  grants: AccessGrant[];
  /**
   * Gammes rattachées nominativement (`UserProductRange`). Une gamme OUVRE son entité en
   * lecture : rattacher quelqu'un à « Cardiologie » de Pharmagène sans lui donner Pharmagène
   * ne lui ouvrirait rien, et un droit qui n'ouvre rien se paie en heures de recherche.
   * Ce qu'il voit DEDANS est ensuite restreint aux produits de ses gammes — voir
   * `src/lib/org/product-ranges.ts`, qui porte cette règle-là.
   */
  rangeGrants?: { rangeId: string; companyId: string }[];
}

/** Vue groupe : accès à toutes les entités, sans autorisation à saisir. */
export function seesWholeGroup(user: { role: string; secondaryRole?: string | null }): boolean {
  const roles = [user.role, user.secondaryRole].filter(Boolean) as string[];
  return roles.some((r) => (GROUP_WIDE_ROLES as readonly string[]).includes(r));
}

/**
 * Les entités auxquelles la personne a accès, parmi celles qui existent.
 *
 * **L'entité d'appartenance est toujours accessible en lecture.** Sans cette règle, oublier
 * d'accorder une autorisation enfermerait quelqu'un hors de sa propre société — un salarié
 * d'Adventum qui ne voit plus Adventum. On n'enferme personne par omission.
 *
 * Fonction PURE — testée.
 */
export function allowedCompanyIds(user: AccessBearer, allCompanyIds: string[]): string[] {
  if (seesWholeGroup(user)) return [...allCompanyIds];

  const ids = new Set<string>();
  for (const g of user.grants) {
    if (allCompanyIds.includes(g.companyId)) ids.add(g.companyId);
  }
  // Une GAMME rattachée ouvre l'entité qui la porte — en lecture seulement, et le contenu
  // visible y sera limité à cette gamme (`productRangeWhere`).
  for (const g of user.rangeGrants ?? []) {
    if (allCompanyIds.includes(g.companyId)) ids.add(g.companyId);
  }
  if (user.homeCompanyId && allCompanyIds.includes(user.homeCompanyId)) ids.add(user.homeCompanyId);
  // Ordre stable : celui des entités telles qu'elles sont classées à l'écran.
  return allCompanyIds.filter((id) => ids.has(id));
}

/** A-t-on le droit de LIRE cette entité ? */
export function canViewCompany(user: AccessBearer, companyId: string, allCompanyIds: string[]): boolean {
  return allowedCompanyIds(user, allCompanyIds).includes(companyId);
}

/**
 * A-t-on le droit d'ÉCRIRE sur cette entité ?
 *
 * L'appartenance donne la lecture, pas l'écriture : travailler dans une société ne suffit pas à
 * y modifier des dossiers réglementaires. L'écriture se donne explicitement — sauf pour la vue
 * groupe, qui arbitre partout.
 *
 * Fonction PURE — testée.
 */
export function canEditCompany(user: AccessBearer, companyId: string): boolean {
  if (seesWholeGroup(user)) return true;
  return user.grants.some((g) => g.companyId === companyId && g.canEdit);
}

/**
 * Valide la portée demandée (cookie du sélecteur) contre les droits réels.
 *
 * Le cookie est une donnée du navigateur : il se modifie à la main. On ne lui fait donc pas
 * confiance — on le **valide**, et une portée interdite retombe silencieusement sur un défaut
 * légitime plutôt que d'ouvrir un accès.
 *
 * `null` en retour signifie « toutes les entités autorisées », ce qui n'est proposé que si la
 * personne en a réellement plusieurs.
 *
 * Fonction PURE — testée.
 */
export function resolveScope(user: AccessBearer, requested: string | null, allCompanyIds: string[]): string | null {
  const allowed = allowedCompanyIds(user, allCompanyIds);
  if (allowed.length === 0) return null;

  if (requested) return allowed.includes(requested) ? requested : allowed[0];

  // Sans portée demandée : une seule entité autorisée ⇒ on s'y borne d'office. C'est le cas du
  // salarié mono-entité, qui ne doit jamais voir les données d'une autre société par défaut.
  return allowed.length === 1 ? allowed[0] : null;
}

/**
 * Le filtre Prisma correspondant aux droits, quelle que soit la portée choisie.
 *
 * ⚠️ C'est LA fonction qui rend l'étanchéité réelle : même « toutes les entités » ne veut pas
 * dire « toutes celles qui existent », mais « toutes celles auxquelles j'ai droit ».
 *
 * Fonction PURE — testée.
 */
export function companyAccessWhere(
  user: AccessBearer,
  scope: string | null,
  allCompanyIds: string[],
): { companyId?: string | { in: string[] } } {
  if (seesWholeGroup(user)) return scope ? { companyId: scope } : {};

  const allowed = allowedCompanyIds(user, allCompanyIds);
  if (scope && allowed.includes(scope)) return { companyId: scope };
  return { companyId: { in: allowed } };
}

/** Filtre Prisma acceptant aussi les enregistrements NON rattachés. */
export type ScopeWhere = { companyId?: string | { in: string[] } } | { OR: { companyId: string | { in: string[] } | null }[] } | Record<string, never>;

/**
 * LE FILTRE TRANSVERSE — celui qu'appliquent le budget, l'Ad & Pro, les finances et les
 * demandes, c'est-à-dire tous les modules rattachés à une entité.
 *
 * LA RÈGLE, SANS EXCEPTION : ce que quelqu'un crée appartient à SON entité, et choisir une
 * entité ne montre QUE celle-là. Une demande d'Adventum ne se lit pas depuis la vue Pharmagène,
 * un document non plus, un événement non plus.
 *
 * Une exception a longtemps existé : les enregistrements NON RATTACHÉS (`companyId = null`)
 * restaient visibles dans toutes les vues, parce que ces tables avaient vécu sans entité et
 * qu'un rattachement rétroactif ne devine pas. Elle est levée — l'exception faisait exactement
 * ce qu'on voulait empêcher : dans la vue Pharmagène, on lisait le travail d'Adventum, sans
 * qu'aucun écran ne le signale.
 *
 * Deux conditions rendaient cette levée honnête, et elles sont remplies :
 *   • les créations portent leur entité (celle du créateur) ;
 *   • l'historique a été rattaché depuis l'entité de son créateur, et ce qui reste sans entité
 *     est listé en Console d'Administration — visible et réparable, plutôt que perdu.
 *
 * Le non-rattaché reste lisible depuis la vue « toutes les entités », qui n'applique aucun
 * filtre : rien ne disparaît de la plateforme, seulement des vues cloisonnées.
 *
 * Garde-fou conservé : **s'il n'existe pas au moins deux entités, aucun filtre n'est appliqué.**
 * Cloisonner un groupe mono-société ne protège rien et ne peut que masquer des données.
 *
 * Fonction PURE — testée.
 */
export function platformScopeWhere(
  user: AccessBearer,
  scope: string | null,
  allCompanyIds: string[],
): ScopeWhere {
  if (allCompanyIds.length < 2) return {};

  // ON N'ENFERME PERSONNE PAR OMISSION. Quelqu'un qui n'appartient à aucune entité et n'a reçu
  // aucune autorisation n'est cloisonné par rien : le filtrer à zéro ne protège aucune société,
  // cela lui vide simplement tous les écrans — un compte sans fiche salarié ne doit pas devenir
  // un compte aveugle. Le cloisonnement vise ceux qui RELÈVENT d'une entité.
  if (allowedCompanyIds(user, allCompanyIds).length === 0) return {};

  const base = companyAccessWhere(user, scope, allCompanyIds);
  if (base.companyId === undefined) return {}; // vue groupe sans portée : rien à restreindre
  return { companyId: base.companyId };
}
