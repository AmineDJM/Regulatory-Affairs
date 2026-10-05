/**
 * Deux limites qui ne se confondent pas. Module PUR, sans import.
 *
 * - BLOB_MAX_BYTES : ce que le COFFRE CHIFFRÉ applicatif (`putBlob`) sait tenir — un fichier y
 *   passe en mémoire et sa taille est un entier 32 bits signé (2 Go − 1).
 * - LIMITE_FICHIER_BYTES : ce qu'une PERSONNE peut déposer (Drive, archive CTD, zip…). Au-delà de
 *   BLOB_MAX_BYTES le fichier ne passe jamais par le coffre : il part DIRECTEMENT du navigateur au
 *   bucket (envoi en parties), sans chiffrement applicatif ni déduplication. 10 Go = 320 parties de
 *   32 Mo, loin des 10 000 parties qu'un envoi en parties accepte.
 */
export const BLOB_MAX_BYTES = 2_147_483_647;
export const LIMITE_FICHIER_MO = 10 * 1024;
export const LIMITE_FICHIER_BYTES = LIMITE_FICHIER_MO * 1024 * 1024;
export const LIMITE_FICHIER_LIBELLE = "10 Go";
