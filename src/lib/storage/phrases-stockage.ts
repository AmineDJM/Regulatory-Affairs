/**
 * Les phrases du stockage objet — module PUR, lu par le serveur ET par le navigateur (un refus
 * dit avant l'envoi doit être mot pour mot celui que le serveur aurait rendu).
 */

/** Variables à poser pour activer le stockage objet — un refus doit les NOMMER. */
export const VARIABLES_STOCKAGE = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_REGION"] as const;

/**
 * Le refus d'un TRÈS gros fichier quand aucun stockage objet n'est configuré. Jamais d'écriture
 * en base d'un fichier de cette taille : elle remplirait Postgres (≈ 1 Go sur l'offre gratuite)
 * et ferait tomber l'application entière.
 */
export function refusSansStockageObjet(taille: number, maxSansObjetMo: number): string {
  return `Ce fichier (${Math.round(taille / (1024 * 1024))} Mo) dépasse ${maxSansObjetMo} Mo : il doit aller dans un stockage objet, `
    + `qui n'est pas configuré. Dans Render → votre service → Environment, ajoutez ${VARIABLES_STOCKAGE.slice(0, 4).join(", ")} `
    + `(et S3_REGION, « auto » pour Cloudflare R2), puis redéployez — voir docs/stockage-gros-fichiers.md. `
    + `Administration → Stockage → « Tester la connexion » confirme le réglage.`;
}
