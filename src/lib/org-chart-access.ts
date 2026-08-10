/**
 * QUI PEUT CONSULTER L'ORGANIGRAMME — pur, sans dépendance (importable serveur et client).
 *
 * L'organigramme était enfermé dans la console d'administration : les RH, qui le tiennent à jour
 * au quotidien, devaient passer par le Super Admin pour le regarder. On sépare donc deux droits :
 *  • CONSULTER — le Super Admin ouvre l'accès à des rôles (ex. RH) et/ou à des personnes nommées ;
 *  • MODIFIER (rattachements, positions sur la carte) — réservé au Super Admin, inchangé.
 */

export interface OrgChartAccessSettings {
  orgChartViewerRoles: string[];
  orgChartViewerUserIds: string[];
}

export function canViewOrgChart(
  user: { id: string; role: string; secondaryRole?: string | null },
  settings: OrgChartAccessSettings,
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (settings.orgChartViewerUserIds.includes(user.id)) return true;
  // Le « autre rôle » compte aussi : une personne cumulant une fonction RH doit voir ce que
  // son rôle secondaire lui ouvre, sinon le cumul de fonctions n'aurait aucun effet réel.
  return settings.orgChartViewerRoles.some((r) => r === user.role || (user.secondaryRole ? r === user.secondaryRole : false));
}

/** Seul le Super Admin RÉORGANISE (rattachements, postes, positions de la carte). */
export function canEditOrgChart(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN";
}
