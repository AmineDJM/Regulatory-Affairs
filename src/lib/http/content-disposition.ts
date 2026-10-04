/**
 * L'EN-TÊTE QUI DONNE SON NOM AU FICHIER TÉLÉCHARGÉ — accents compris, sur tous les navigateurs.
 *
 * `filename="Évaluation.pdf"` est un en-tête HTTP en Latin-1 : Firefox et Safari enregistraient
 * « Ã‰valuation.pdf », et `filename="${encodeURIComponent(nom)}"` donnait « %C3%89valuation.pdf »
 * (audit du 04/10, constat 12). La forme juste est celle de la RFC 6266 / 5987 : un `filename=`
 * de repli en ASCII pour les très vieux clients, PUIS `filename*=UTF-8''…` qui l'emporte partout
 * ailleurs. Les guillemets, barres obliques inverses et retours à la ligne sont retirés du repli :
 * ce sont eux qui permettent d'injecter un second en-tête.
 *
 * Module PUR — testé.
 */
export function contentDisposition(nom: string, mode: "attachment" | "inline" = "attachment"): string {
  const propre = (nom || "fichier").replace(/[\r\n"\\]/g, "").trim() || "fichier";
  // Repli ASCII : accents retirés (« é » → « e »), le reste remplacé par « _ ».
  const ascii = propre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_");
  // RFC 5987 : `encodeURIComponent` laisse passer ' ( ) * — interdits dans un attr-char.
  const encode = encodeURIComponent(propre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encode}`;
}
