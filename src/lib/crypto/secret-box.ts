import crypto from "crypto";

/**
 * LE COFFRE À SECRETS — AES-256-GCM, pour ce qui doit dormir chiffré en base.
 *
 * Extrait de la couche IMAP historique, où il rendait déjà service : un jeton OAuth Microsoft n'a
 * pas moins de valeur qu'un mot de passe, et le laisser en clair dans une colonne reviendrait à
 * offrir la boîte mail de quelqu'un à quiconque lit une sauvegarde.
 *
 * GCM plutôt que CBC : il **authentifie**. Un octet modifié fait échouer le déchiffrement au lieu
 * de rendre des données silencieusement fausses.
 */

function masterKey(): Buffer {
  const s = process.env.MAIL_ENCRYPTION_KEY
    || process.env.DRIVE_ENCRYPTION_KEY
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || "dev-secret-box-change-me";
  return crypto.createHash("sha256").update(s).digest(); // 32 octets
}

/** Chiffre une valeur. Format : `iv:tag:chiffré`, en base64 — lisible, comparable, migrable. */
export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

/**
 * Déchiffre. Rend `null` plutôt que de lever quand la valeur est illisible (clé changée, colonne
 * abîmée) : un jeton indéchiffrable doit conduire à **redemander une connexion**, pas à faire
 * tomber l'écran de messagerie de tout le monde.
 */
export function openSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    const parts = blob.split(":");
    if (parts.length !== 3) return null;
    const [iv, tag, enc] = parts.map((s) => Buffer.from(s, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
