import { DRIVE_BASE, DRIVE_UPLOAD_BASE } from "../config";
import { googleJson, googleBinary } from "../client";

/**
 * LE DRIVE GOOGLE — chercher, lire, déposer, ranger, partager.
 *
 * Ce module ne REMPLACE pas le Drive interne de l'ERP (chiffré, cloisonné par les droits AMD) :
 * il ajoute un second espace, celui d'Adam. Les deux se rejoignent au niveau du Chief, qui sait
 * prendre un fichier ici et le poser là — c'est ce qui évite au PDG de télécharger puis
 * re-téléverser.
 *
 * Les fichiers Google natifs (Docs, Sheets, Slides) n'ont pas de contenu binaire : on les
 * EXPORTE. Demander leur téléchargement direct rend une erreur incompréhensible ; le module
 * choisit donc le bon chemin selon le type.
 */

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
  webViewLink: string | null;
  parents: string[];
  owners: string[];
  trashed: boolean;
  isFolder: boolean;
  isGoogleDoc: boolean;
}

const FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,parents,owners(emailAddress),trashed";
const FOLDER_MIME = "application/vnd.google-apps.folder";

interface RawFile {
  id?: string; name?: string; mimeType?: string; size?: string; modifiedTime?: string;
  webViewLink?: string; parents?: string[]; owners?: { emailAddress?: string }[]; trashed?: boolean;
}

function normalize(raw: RawFile): GDriveFile {
  const mime = raw.mimeType ?? "";
  return {
    id: String(raw.id ?? ""),
    name: raw.name ?? "(sans nom)",
    mimeType: mime,
    sizeBytes: raw.size ? Number(raw.size) : null,
    modifiedAt: raw.modifiedTime ?? null,
    webViewLink: raw.webViewLink ?? null,
    parents: raw.parents ?? [],
    owners: (raw.owners ?? []).map((o) => (o.emailAddress ?? "").toLowerCase()).filter(Boolean),
    trashed: Boolean(raw.trashed),
    isFolder: mime === FOLDER_MIME,
    isGoogleDoc: mime.startsWith("application/vnd.google-apps.") && mime !== FOLDER_MIME,
  };
}

/** Échappe une valeur pour la syntaxe de requête Drive (les apostrophes y sont des délimiteurs). */
export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function searchFiles(accessToken: string, opts: {
  q?: string; nameContains?: string; parentId?: string; mimeType?: string;
  includeTrashed?: boolean; maxResults?: number;
} = {}): Promise<GDriveFile[]> {
  const clauses: string[] = [];
  if (opts.nameContains) clauses.push(`name contains '${escapeDriveQuery(opts.nameContains)}'`);
  if (opts.parentId) clauses.push(`'${escapeDriveQuery(opts.parentId)}' in parents`);
  if (opts.mimeType) clauses.push(`mimeType = '${escapeDriveQuery(opts.mimeType)}'`);
  if (!opts.includeTrashed) clauses.push("trashed = false");
  if (opts.q) clauses.push(`(fullText contains '${escapeDriveQuery(opts.q)}' or name contains '${escapeDriveQuery(opts.q)}')`);

  const res = await googleJson<{ files?: RawFile[] }>({
    url: `${DRIVE_BASE}/files`,
    accessToken,
    query: {
      q: clauses.join(" and ") || undefined,
      fields: `files(${FIELDS})`,
      pageSize: opts.maxResults ?? 25,
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    },
  });
  return (res.files ?? []).map(normalize);
}

export async function getFile(accessToken: string, fileId: string): Promise<GDriveFile> {
  const raw = await googleJson<RawFile>({
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { fields: FIELDS, supportsAllDrives: "true" },
  });
  return normalize(raw);
}

/** Le format d'export d'un fichier Google natif — sinon on ne peut pas le lire hors de Google. */
const EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.google-apps.drawing": "application/pdf",
};

/** Télécharge un fichier — export automatique pour les documents Google natifs. */
export async function downloadFile(accessToken: string, fileId: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const meta = await getFile(accessToken, fileId);
  if (meta.isGoogleDoc) {
    const target = EXPORT_MIME[meta.mimeType] ?? "application/pdf";
    const res = await googleBinary({
      url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/export`,
      accessToken,
      query: { mimeType: target },
    });
    const ext = target.includes("wordprocessing") ? "docx" : target.includes("spreadsheet") ? "xlsx" : target.includes("presentation") ? "pptx" : "pdf";
    return { buffer: res.buffer, contentType: target, filename: `${meta.name}.${ext}` };
  }
  const res = await googleBinary({
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { alt: "media", supportsAllDrives: "true" },
  });
  return { buffer: res.buffer, contentType: res.contentType, filename: meta.name };
}

/** Dépose un fichier (téléversement multipart : métadonnées + contenu en une requête). */
export async function uploadFile(accessToken: string, input: {
  name: string; content: Buffer; mimeType?: string; parentId?: string;
}): Promise<GDriveFile> {
  const boundary = `amd_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({
    name: input.name,
    ...(input.parentId ? { parents: [input.parentId] } : {}),
  });
  const mime = input.mimeType || "application/octet-stream";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    input.content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const raw = await googleJson<RawFile>({
    method: "POST",
    url: `${DRIVE_UPLOAD_BASE}/files`,
    accessToken,
    query: { uploadType: "multipart", fields: FIELDS, supportsAllDrives: "true" },
    rawBody: { contentType: `multipart/related; boundary=${boundary}`, data: body },
  });
  return normalize(raw);
}

export async function createFolder(accessToken: string, name: string, parentId?: string): Promise<GDriveFile> {
  const raw = await googleJson<RawFile>({
    method: "POST",
    url: `${DRIVE_BASE}/files`,
    accessToken,
    query: { fields: FIELDS, supportsAllDrives: "true" },
    body: { name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) },
  });
  return normalize(raw);
}

export async function renameFile(accessToken: string, fileId: string, name: string): Promise<GDriveFile> {
  const raw = await googleJson<RawFile>({
    method: "PATCH",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { fields: FIELDS, supportsAllDrives: "true" },
    body: { name },
  });
  return normalize(raw);
}

/** Déplace un fichier : Drive raisonne en parents ajoutés/retirés, pas en « chemin ». */
export async function moveFile(accessToken: string, fileId: string, newParentId: string): Promise<GDriveFile> {
  const cur = await getFile(accessToken, fileId);
  const raw = await googleJson<RawFile>({
    method: "PATCH",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: {
      addParents: newParentId,
      removeParents: cur.parents.join(",") || undefined,
      fields: FIELDS,
      supportsAllDrives: "true",
    },
    body: {},
  });
  return normalize(raw);
}

export async function copyFile(accessToken: string, fileId: string, name?: string, parentId?: string): Promise<GDriveFile> {
  const raw = await googleJson<RawFile>({
    method: "POST",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/copy`,
    accessToken,
    query: { fields: FIELDS, supportsAllDrives: "true" },
    body: { ...(name ? { name } : {}), ...(parentId ? { parents: [parentId] } : {}) },
  });
  return normalize(raw);
}

/** Corbeille — RÉVERSIBLE. La suppression définitive existe (`deleteFile`) mais ne s'utilise pas seule. */
export async function trashFile(accessToken: string, fileId: string): Promise<void> {
  await googleJson({
    method: "PATCH",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { supportsAllDrives: "true" },
    body: { trashed: true },
  });
}

export async function restoreFile(accessToken: string, fileId: string): Promise<void> {
  await googleJson({
    method: "PATCH",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { supportsAllDrives: "true" },
    body: { trashed: false },
  });
}

/** Suppression DÉFINITIVE — sans corbeille, sans retour. Réservée à un geste explicite du PDG. */
export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  await googleJson({
    method: "DELETE",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { supportsAllDrives: "true" },
  });
}

export interface GDrivePermission {
  id: string;
  type: string;
  role: string;
  emailAddress: string | null;
}

export async function listPermissions(accessToken: string, fileId: string): Promise<GDrivePermission[]> {
  const res = await googleJson<{ permissions?: { id?: string; type?: string; role?: string; emailAddress?: string }[] }>({
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/permissions`,
    accessToken,
    query: { fields: "permissions(id,type,role,emailAddress)", supportsAllDrives: "true" },
  });
  return (res.permissions ?? []).map((p) => ({
    id: String(p.id ?? ""),
    type: p.type ?? "user",
    role: p.role ?? "reader",
    emailAddress: p.emailAddress?.toLowerCase() ?? null,
  }));
}

/**
 * Partage un fichier avec une PERSONNE nommée.
 *
 * Volontairement limité aux partages nominatifs : `type: "anyone"` produit un lien public que
 * n'importe qui peut faire suivre, et ce n'est jamais ce qu'on veut par défaut pour un document
 * d'entreprise. Un lien public reste possible depuis Google, en connaissance de cause.
 */
export async function shareFile(accessToken: string, fileId: string, email: string, role: "reader" | "commenter" | "writer" = "reader"): Promise<void> {
  await googleJson({
    method: "POST",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/permissions`,
    accessToken,
    query: { sendNotificationEmail: "false", supportsAllDrives: "true" },
    body: { type: "user", role, emailAddress: email },
  });
}

export async function unshareFile(accessToken: string, fileId: string, permissionId: string): Promise<void> {
  await googleJson({
    method: "DELETE",
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`,
    accessToken,
    query: { supportsAllDrives: "true" },
  });
}
