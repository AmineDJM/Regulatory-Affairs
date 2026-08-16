/**
 * L'EMPREINTE D'UN FICHIER, CALCULÉE DANS LE NAVIGATEUR.
 *
 * Le stockage est adressé par le contenu : un fichier déjà présent n'a pas à être renvoyé. Encore
 * faut-il le savoir AVANT de l'envoyer — sinon on transfère 300 Mo pour découvrir qu'ils existaient.
 *
 * Module PUR côté navigateur (aucun accès réseau ni base) — la décision « faut-il calculer une
 * empreinte ? » est testée ; le calcul lui-même s'appuie sur `crypto.subtle`, natif partout.
 */

/**
 * Sous ce seuil, on n'essaie même pas : l'aller-retour de vérification coûterait autant que
 * l'envoi. Au-dessus, une lecture locale de quelques centaines de millisecondes peut économiser
 * plusieurs minutes de réseau — le pari est très favorable.
 */
export const FINGERPRINT_MIN_BYTES = 512 * 1024;

/**
 * Au-delà, on renonce : `crypto.subtle.digest` exige le fichier ENTIER en mémoire, et un onglet
 * qui s'effondre sur un fichier de 2 Go est un bien pire défaut qu'un envoi non optimisé.
 */
export const FINGERPRINT_MAX_BYTES = 512 * 1024 * 1024;

export function shouldFingerprint(size: number): boolean {
  return size >= FINGERPRINT_MIN_BYTES && size <= FINGERPRINT_MAX_BYTES;
}

/** Un condensé SHA-256 rendu en hexadécimal minuscule — la forme stockée en base. */
export function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Empreinte SHA-256 du fichier, ou `null` si le calcul n'a pas lieu d'être (trop petit, trop gros,
 * navigateur sans `crypto.subtle` — page servie en clair, par exemple). **Ne lève jamais** : une
 * empreinte est une OPTIMISATION, et rater une optimisation ne doit jamais faire rater un envoi.
 */
export async function fingerprintFile(file: Blob): Promise<string | null> {
  if (!shouldFingerprint(file.size)) return null;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    return toHex(await subtle.digest("SHA-256", await file.arrayBuffer()));
  } catch {
    return null;
  }
}
