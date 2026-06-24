import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";

/**
 * Storage adapter. In production, point STORAGE_* env vars at an S3-compatible
 * bucket (Supabase Storage / Cloudflare R2 / AWS S3) and implement the SDK
 * calls below. For local/MVP usage, files are written under ./uploads.
 */

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const s3Configured = Boolean(
  process.env.STORAGE_ENDPOINT && process.env.STORAGE_ACCESS_KEY_ID,
);

export function isRemoteStorage() {
  return s3Configured;
}

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  if (s3Configured) {
    // Extension point: upload to S3-compatible storage here.
    throw new Error("Remote storage adapter not configured in this build.");
  }
  const full = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
}

export async function readFileByKey(key: string): Promise<Buffer> {
  return readFile(path.join(UPLOAD_DIR, key));
}

export async function deleteFileByKey(key: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_DIR, key));
  } catch {
    // ignore missing files
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
