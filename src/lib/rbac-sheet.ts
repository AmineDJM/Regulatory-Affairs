/**
 * LA FEUILLE D'ACCÈS SE DÉDUIT DES DROITS RÉELS — elle ne les recopie pas.
 *
 * L'écran « Accès par module » affichait des colonnes fixes : Créer, Modifier, Supprimer,
 * Valider, Exporter, Upload, pour tous les modules, et une liste de modules « à lignes » écrite
 * à la main. Deux ennuis, tous les deux silencieux :
 *
 *   • on cochait « Valider » sur un module où PLUS AUCUN rôle ne valide — la case s'enregistrait
 *     et n'ouvrait rien. L'administrateur croyait avoir donné un droit ;
 *   • on ajoutait un module dont la portée se restreint aux lignes assignées sans penser à
 *     l'écrire dans la liste — le sélecteur de portée n'apparaissait pas, et l'accès restait
 *     bloqué sans qu'on comprenne pourquoi.
 *
 * Ici, tout se DÉDUIT de la matrice `PERMISSIONS` et de `defaultScope`, c'est-à-dire des règles
 * qui gouvernent réellement l'application. Ajouter un module ou une capacité met la feuille à
 * jour toute seule ; en retirer une fait disparaître la case. C'est la définition de « pas codé
 * en dur ».
 *
 * Module PUR — testé. Les données (matrice, rôles) arrivent en argument : le composant qui
 * affiche la feuille tourne dans le navigateur et ne doit rien importer de lourd.
 */

/** Une matrice de droits, vue d'ici : rôle → module → actions. */
export type PermissionMatrix = Record<string, Partial<Record<string, readonly string[]>>>;

/**
 * Les actions RÉELLEMENT attribuables sur ce module — celles qu'au moins un rôle possède.
 *
 * « Voir » est exclu : il est implicite dès que le module n'est pas bloqué, et en faire une case
 * laisserait croire qu'on peut donner « Modifier » sans « Voir ».
 *
 * L'ordre est celui d'`ACTIONS`, pas celui de la découverte : des colonnes qui changent de place
 * d'un module à l'autre rendent la feuille illisible.
 */
export function actionsOfModule(
  module: string,
  permissions: PermissionMatrix,
  order: readonly string[],
): string[] {
  const found = new Set<string>();
  for (const role of Object.keys(permissions)) {
    for (const action of permissions[role]?.[module] ?? []) found.add(action);
  }
  return order.filter((a) => a !== "VIEW" && found.has(a));
}

/**
 * Ce module se restreint-il aux LIGNES assignées pour quelqu'un ?
 *
 * La question ne se pose que si la réponse varie : un module que tout le monde voit en entier
 * n'a pas de portée à régler, et proposer le choix laisserait croire à un cloisonnement qui
 * n'existe pas.
 */
export function isRowScoped(
  module: string,
  roles: readonly string[],
  scopeOf: (role: string, module: string) => string,
): boolean {
  return roles.some((r) => scopeOf(r, module) === "ASSIGNED");
}

/**
 * Combien de rôles atteignent ce module par défaut. Un module à ZÉRO rôle est une porte que
 * personne ne peut ouvrir sans autorisation nominative : le dire évite de chercher pourquoi
 * « personne n'y a accès » alors que c'est le comportement voulu.
 */
export function rolesReaching(module: string, permissions: PermissionMatrix): number {
  return Object.keys(permissions).filter((r) => (permissions[r]?.[module] ?? []).length > 0).length;
}

export interface ModuleSheetSpec {
  value: string;
  label: string;
  /** Colonnes d'actions à afficher pour ce module — déduites, jamais listées à la main. */
  actions: string[];
  /** Faut-il proposer le choix « toutes les lignes / lignes assignées » ? */
  rowScoped: boolean;
  /** Nombre de rôles qui atteignent le module sans autorisation nominative. */
  roleCount: number;
  /**
   * Module retiré du service (« Modules en service »). Ce n'est PAS un droit — c'est un état
   * de plateforme qui prime sur tous les droits : masqué, le module se referme pour tout le
   * monde sauf le Super Admin. L'écran des accès doit le DIRE, sinon on règle des permissions
   * qui n'ouvrent rien et l'on croit la matrice cassée.
   */
  hidden: boolean;
}

/** La feuille entière, module par module — l'unique source de ce que l'écran affiche. */
export function buildAccessSheet(
  modules: readonly string[],
  labels: Record<string, string>,
  permissions: PermissionMatrix,
  actionOrder: readonly string[],
  roles: readonly string[],
  scopeOf: (role: string, module: string) => string,
  /** Modules hors service. Absent = aucun (la feuille reste utilisable sans les réglages). */
  hidden: readonly string[] = [],
): ModuleSheetSpec[] {
  const off = new Set(hidden);
  return modules.map((m) => ({
    value: m,
    label: labels[m] ?? m,
    actions: actionsOfModule(m, permissions, actionOrder),
    rowScoped: isRowScoped(m, roles, scopeOf),
    roleCount: rolesReaching(m, permissions),
    hidden: off.has(m),
  }));
}
