import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";

/**
 * MIROIR DRIVE d'un document RH (contrat, avenant…) déposé par les RH : le réplique dans le
 * Drive sous « RH — Contrats / <employé> ». Le dossier appartient à la personne qui dépose (RH).
 * **Best-effort** : ne doit JAMAIS faire échouer le dépôt RH (toute erreur est journalisée et
 * avalée). Dédup : même nom dans le même dossier → nouvelle VERSION (pas de doublon).
 */

const HR_CONTRACT_ROOT = "RH — Contrats";

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

export async function mirrorEmployeeContractToDrive(opts: {
  ownerId: string;
  employeeName: string;
  filename: string;
  data: Buffer;
  mime?: string;
}): Promise<void> {
  try {
    const rootId = await ensureFolder(HR_CONTRACT_ROOT, null, opts.ownerId);
    const folderId = await ensureFolder(opts.employeeName.trim() || "Employé", rootId, opts.ownerId);
    const { blobId, size } = await putBlob(opts.data);
    const mimeType = opts.mime || "application/octet-stream";

    const existing = await prisma.driveNode.findFirst({
      where: { type: "FILE", name: opts.filename, parentId: folderId, isTrashed: false },
      select: { id: true },
    });
    if (existing) {
      const last = await prisma.fileVersion.findFirst({ where: { nodeId: existing.id }, orderBy: { version: "desc" }, select: { version: true } });
      await prisma.fileVersion.create({ data: { nodeId: existing.id, blobId, version: (last?.version ?? 0) + 1, size, mimeType, createdById: opts.ownerId } });
      await prisma.driveNode.update({ where: { id: existing.id }, data: { size, mimeType } });
    } else {
      await prisma.driveNode.create({
        data: {
          name: opts.filename, type: "FILE", parentId: folderId, ownerId: opts.ownerId, mimeType, size, createdById: opts.ownerId,
          versions: { create: { blobId, version: 1, size, mimeType, createdById: opts.ownerId } },
        },
      });
    }
  } catch (e) {
    console.error("[hr-drive-mirror] miroir contrat → Drive échoué (non-bloquant)", e);
  }
}
