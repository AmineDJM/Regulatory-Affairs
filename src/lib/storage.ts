import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "./prisma";
import { putBlob, getBlob, releaseBlob } from "./drive-storage";

/**
 * Stockage des fichiers de **documents** (modèle Document, hors Drive).
 *
 * Le contenu est conservé **en base** (table `FileBlob` : chiffré AES-256-GCM,
 * dédupliqué), via une table de correspondance `StoredFile` (clé opaque → blob).
 * C'est **durable** : contrairement au disque local (éphémère sur Render, perdu à
 * chaque redéploiement → « erreur de téléchargement »), les fichiers survivent.
 *
 * Compatibilité : `readFileByKey` retombe sur l'ancien dossier `./uploads` si une
 * clé n'a pas (encore) d'entrée en base — pour ne pas casser les fichiers locaux.
 */

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export function isRemoteStorage() {
  // Le stockage est désormais la base (durable) ; plus de dépendance disque/S3.
  return true;
}

/** Écrit (ou remplace) le contenu d'une clé — durable, chiffré, en base. */
export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  const { blobId, size } = await putBlob(buffer);
  const previous = await prisma.storedFile.findUnique({ where: { key }, select: { blobId: true } });
  await prisma.storedFile.upsert({
    where: { key },
    create: { key, blobId, size },
    update: { blobId, size },
  });
  // Si la clé pointait sur un autre blob, on libère l'ancien (ref-count).
  if (previous && previous.blobId !== blobId) await releaseBlob(previous.blobId);
}

export async function readFileByKey(key: string): Promise<Buffer> {
  const stored = await prisma.storedFile.findUnique({ where: { key }, select: { blobId: true } });
  if (stored) {
    const bytes = await getBlob(stored.blobId);
    if (bytes) return bytes;
  }
  // Repli : ancien fichier écrit sur le disque local (dev / avant migration).
  return readFile(path.join(UPLOAD_DIR, key));
}

export async function deleteFileByKey(key: string): Promise<void> {
  const stored = await prisma.storedFile.findUnique({ where: { key }, select: { blobId: true } });
  if (stored) {
    await releaseBlob(stored.blobId);
    await prisma.storedFile.delete({ where: { key } }).catch(() => undefined);
  }
}

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx",
  "png", "jpg", "jpeg", "gif", "webp", "zip", "txt",
];

export function validateUpload(filename: string, sizeBytes: number): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Type de fichier non autorisé (.${ext}).`;
  }
  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? "25");
  if (sizeBytes > maxMb * 1024 * 1024) {
    return `Fichier trop volumineux (max ${maxMb} Mo).`;
  }
  return null;
}

// Le **Drive** est un stockage général : on accepte la quasi-totalité des fichiers
// (documents, médias, archives…) et on bloque seulement les **exécutables/scripts**.
const BLOCKED_DRIVE_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "jar", "js", "mjs", "cjs",
  "vbs", "vbe", "ws", "wsf", "wsh", "ps1", "psm1", "sh", "bash", "app", "dmg",
  "deb", "rpm", "apk", "dll", "sys", "scf", "lnk", "reg", "hta", "jse", "msc", "gadget",
]);

/** Validation des imports **Drive** : refuse seulement les exécutables, et applique
 *  une limite de taille plus large (configurable). */
export function validateDriveUpload(filename: string, sizeBytes: number): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_DRIVE_EXTENSIONS.has(ext)) {
    return `Pour des raisons de sécurité, les fichiers exécutables (.${ext}) ne sont pas autorisés.`;
  }
  if (sizeBytes <= 0) return "Fichier vide.";
  const maxMb = Number(process.env.MAX_DRIVE_UPLOAD_MB ?? process.env.MAX_UPLOAD_MB ?? "100");
  if (sizeBytes > maxMb * 1024 * 1024) {
    return `Fichier trop volumineux (max ${maxMb} Mo).`;
  }
  return null;
}
