/**
 * RÉÉCRIRE LES ANCIENS LIENS DE NOTIFICATIONS — les notifications créées avant aujourd'hui
 * qui pointent vers des modules renommés ou des routes changées doivent être réorientées vers
 * leurs équivalents actuels.
 *
 * Les notifications CRÉES aujourd'hui et plus tard doivent pointer directement vers les bonnes
 * routes (fixé à la source dans les actions qui les créent). Ce fichier ne traite que le cas
 * des vieilles notifications DÉJÀ EN BASE qui porteraient des liens obsolètes.
 */

/**
 * Réécrit un lien de notification vers sa destination actuelle, ou le rend tel quel si c'est
 * déjà un lien valide.
 *
 * Exemples de réécritures :
 * - `/missions` → `/centre-de-missions`
 * - `/field-reports` → `/field-reports` (inchangé, route existe)
 * - `/planning/business-units` → `/business-units`
 * - `/regulatory/catalogue` → `/produits`
 * - `/sales/historique` → `/sales/historique` (peut ne pas exister, laisser au client)
 * - `/rh/demandes?id=123` → `/rh/demandes?demande=123` (param old name)
 */
export function reécriteLienNotification(lien: string | null | undefined): string | null {
  if (!lien) return null;

  // Extraire la base du chemin et les query params / hash
  const url = new URL(lien, "http://localhost");
  const chemin = url.pathname;
  const params = new URLSearchParams(url.search);
  const hash = url.hash;

  let cheminActuel = chemin;

  // Mappings des anciens chemins vers les nouveaux
  const VIEUX_CHEMINS: Record<string, string> = {
    "/missions": "/centre-de-missions",
    "/planning/business-units": "/business-units",
    "/regulatory/catalogue": "/produits",
  };

  // Appliquer le mapping s'il existe
  if (cheminActuel in VIEUX_CHEMINS) {
    cheminActuel = VIEUX_CHEMINS[cheminActuel];
  }

  // Rénommer les anciens paramètres de query
  if (params.has("id") && cheminActuel === "/rh/demandes") {
    const valeur = params.get("id");
    params.delete("id");
    if (valeur) params.set("demande", valeur);
  }

  // Reconstruire l'URL
  const paramsStr = params.toString();
  return cheminActuel + (paramsStr ? `?${paramsStr}` : "") + hash;
}
