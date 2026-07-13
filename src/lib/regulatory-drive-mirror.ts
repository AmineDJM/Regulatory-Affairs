import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";

/**
 * MIROIR DRIVE d'un dépôt Regulatory. Réplique dans le Drive — sous un dossier
 * automatiquement nommé D'APRÈS LE PRODUIT — les fichiers déposés (un/plusieurs fichiers,
 * un dossier, ou une archive ZIP décompressée), EN CONSERVANT L'ARBORESCENCE EXACTE
 * (sous-dossiers imbriqués → dossiers Drive imbriqués). Idempotent : re-déposer un même
 * chemin ajoute une NOUVELLE VERSION du fichier plutôt qu'un doublon.
 *
 * Le dossier racine « Regulatory — Dossiers produits » et le dossier produit sont propres
 * à l'utilisateur qui dépose (owner) ; le dossier produit est PARTAGÉ (lecture) avec les
 * parties prenantes du dossier — l'accès descend tout l'arbre (cf. resolveDriveAccess).
 */

export const REG_DRIVE_ROOT = "Regulatory — Dossiers produits";

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv", txt: "text/plain", md: "text/markdown", json: "application/json", xml: "application/xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
  zip: "application/zip",
};

export function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/** Segments d'un chemin, nettoyés (sépar. Windows, « . »/« .. »/vides retirés). */
export function cleanPathSegments(path: string): string[] {
  return path.replace(/\\/g, "/").split("/").map((s) => s.trim()).filter((s) => s && s !== "." && s !== "..");
}

/** Trouve/crée un dossier Drive (par nom, sous parent, pour cet owner) — idempotent. */
async function ensureFolder(name: string, parentId: string | null, ownerId: string): Promise<string> {
  const existing = await prisma.driveNode.findFirst({
    where: { type: "FOLDER", name, parentId, ownerId, isTrashed: false },
    select: { id: true },
  });
  if (existing) return existing.id;
  const node = await prisma.driveNode.create({
    data: { name, type: "FOLDER", parentId, ownerId, createdById: ownerId },
    select: { id: true },
  });
  return node.id;
}

export interface MirrorEntry { path: string; data: Buffer; mime?: string }
export interface MirrorResult { productFolderId: string; created: number; updated: number; skipped: number }

/**
 * Réplique `entries` (chemins relatifs + contenu) dans le Drive sous
 * `Regulatory — Dossiers produits / <produit> [/ <subfolder>]`, arborescence préservée.
 */
export async function mirrorToProductDrive(opts: {
  productName: string;
  ownerId: string;
  entries: MirrorEntry[];
  subfolder?: string; // ex. « Dépôt du 2026-07-13 » pour dater un lot
  shareUserIds?: string[]; // parties prenantes : lecture partagée sur le dossier produit
}): Promise<MirrorResult> {
  const rootId = await ensureFolder(REG_DRIVE_ROOT, null, opts.ownerId);
  const productFolderId = await ensureFolder(opts.productName.trim() || "Produit sans nom", rootId, opts.ownerId);
  const baseId = opts.subfolder ? await ensureFolder(opts.subfolder, productFolderId, opts.ownerId) : productFolderId;

  // Partage lecture du dossier produit avec les parties prenantes (accès hérité par tout l'arbre).
  const shareIds = [...new Set((opts.shareUserIds ?? []).filter((id) => id && id !== opts.ownerId))];
  if (shareIds.length) {
    const valid = await prisma.user.findMany({ where: { id: { in: shareIds }, isActive: true }, select: { id: true } });
    if (valid.length) {
      await prisma.driveShare.createMany({
        data: valid.map((u) => ({ nodeId: productFolderId, userId: u.id, access: "VIEW" as const })),
        skipDuplicates: true,
      });
    }
  }

  const folderCache = new Map<string, string>(); // clé « parentId/seg/seg » → id (évite de re-résoudre)
  let created = 0, updated = 0, skipped = 0;

  for (const e of opts.entries) {
    const parts = cleanPathSegments(e.path);
    if (parts.length === 0) { skipped++; continue; }
    const filename = parts.pop()!;

    // Reconstitue l'arborescence de dossiers.
    let parentId = baseId;
    let key = baseId;
    for (const seg of parts) {
      key += `/${seg}`;
      let id = folderCache.get(key);
      if (!id) { id = await ensureFolder(seg, parentId, opts.ownerId); folderCache.set(key, id); }
      parentId = id;
    }

    const { blobId, size } = await putBlob(e.data);
    const mimeType = e.mime || mimeFromName(filename);

    // Dédup : même nom dans le même dossier → nouvelle VERSION (pas de doublon).
    const existing = await prisma.driveNode.findFirst({
      where: { type: "FILE", name: filename, parentId, isTrashed: false },
      select: { id: true },
    });
    if (existing) {
      const last = await prisma.fileVersion.findFirst({ where: { nodeId: existing.id }, orderBy: { version: "desc" }, select: { version: true } });
      await prisma.fileVersion.create({ data: { nodeId: existing.id, blobId, version: (last?.version ?? 0) + 1, size, mimeType, createdById: opts.ownerId } });
      await prisma.driveNode.update({ where: { id: existing.id }, data: { size, mimeType } });
      updated++;
    } else {
      await prisma.driveNode.create({
        data: {
          name: filename, type: "FILE", parentId, ownerId: opts.ownerId, mimeType, size, createdById: opts.ownerId,
          versions: { create: { blobId, version: 1, size, mimeType, createdById: opts.ownerId } },
        },
      });
      created++;
    }
  }

  return { productFolderId, created, updated, skipped };
}

/**
 * MIROIR AUTOMATIQUE d'un (ou plusieurs) document(s) Regulatory officiellement téléversé(s) :
 * les réplique aussitôt dans le Drive, sous le dossier du produit, partagés en lecture avec les
 * parties prenantes du dossier. Appelé après l'enregistrement du document (upload officiel) — il
 * n'y a plus d'option manuelle. **Best-effort** : ne doit JAMAIS faire échouer le téléversement
 * (toute erreur est journalisée et avalée). Le stockage physique est dédupliqué (SHA-256), donc
 * le miroir n'ajoute pas de copie binaire si le contenu existe déjà.
 */
export async function mirrorRegulatoryUpload(opts: {
  productId: string;
  ownerId: string;
  files: { name: string; data: Buffer; mime?: string }[];
}): Promise<void> {
  if (opts.files.length === 0) return;
  try {
    const product = await prisma.regulatoryProduct.findUnique({
      where: { id: opts.productId },
      select: { reference: true, dci: true, responsibleId: true, assistantId: true, assignedUsers: { select: { id: true } } },
    });
    if (!product) return;
    const productName = `${product.reference} — ${product.dci}`.trim();
    const stakeholders = [product.responsibleId, product.assistantId, ...product.assignedUsers.map((u) => u.id)]
      .filter((v): v is string => Boolean(v));
    await mirrorToProductDrive({
      productName,
      ownerId: opts.ownerId,
      entries: opts.files.map((f) => ({ path: f.name, data: f.data, mime: f.mime || mimeFromName(f.name) })),
      shareUserIds: stakeholders,
    });
  } catch (err) {
    console.error("[reg auto-mirror] échec (non bloquant)", err);
  }
}
