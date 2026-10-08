/**
 * LES ÉCRANS DU MODULE STOCKS — leurs adresses, et la barre d'onglets qui les relie. Module PUR (aucun import) : la
 * barre se rend sur chaque page, et `voitLaChaine` est décidé par le serveur (`queries/stock-pch.ts`).
 */
export const CHEMIN_STOCKS = "/stocks";
export const CHEMIN_STOCKS_CHAINE = "/stocks/chaine";
export const CHEMIN_STOCK_PCH = "/stocks/pch-central";
export const CHEMIN_DEMANDES_STOCKS = "/stocks/demandes";

/** Les onglets du module : les relevés pour tous, la chaîne et le stock PCH pour la chaîne d'approvisionnement. */
export function ongletsStocks(voitLaChaine: boolean): { label: string; href: string; show: boolean }[] {
  return [
    { label: "Relevés", href: CHEMIN_STOCKS, show: true },
    { label: "Stocks de la chaîne", href: CHEMIN_STOCKS_CHAINE, show: voitLaChaine },
    { label: "Stock PCH central", href: CHEMIN_STOCK_PCH, show: voitLaChaine },
  ];
}
