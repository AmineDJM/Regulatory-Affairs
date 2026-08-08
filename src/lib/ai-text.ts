/**
 * ASSAINISSEMENT DU TEXTE ENVOYÉ AUX MODÈLES — indispensable sur du texte EXTRAIT.
 *
 * Le contenu vient de PDF et d'OCR, pas d'un clavier : il contient régulièrement des demi-paires
 * de substituts UTF-16 (un `\uD800` sans son complément), des octets nuls et des caractères de
 * contrôle. `JSON.stringify` les recopie tels quels, le corps de la requête n'est alors pas de
 * l'UTF-8 valide, et l'API répond **400** — pour tout le dossier, alors que le fautif est un
 * caractère invisible dans une seule pièce. On les retire : ils ne portent aucun sens à analyser.
 *
 * Module à part, SANS dépendance : les deux fournisseurs (Claude et Luna) l'utilisent, et aucun
 * des deux ne doit tirer l'autre dans son graphe d'imports pour trois expressions régulières.
 */
export function sanitizeForModel(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "") // substitut haut orphelin
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "") // substitut bas orphelin
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " "); // nuls et contrôles (on garde \t \n \r)
}
