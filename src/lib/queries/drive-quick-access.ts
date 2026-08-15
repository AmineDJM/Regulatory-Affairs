import { prisma } from "@/lib/prisma";
import { driveVisibilityWhere } from "@/lib/queries/drive";
import type { SessionUser } from "@/lib/rbac";

/**
 * L'ACCÈS RAPIDE — « Récents » et « Téléchargements ».
 *
 * Neuf fois sur dix, le fichier qu'on cherche n'est pas rangé quelque part : c'est celui qu'on
 * vient de toucher. Un explorateur met donc ces deux listes AVANT l'arborescence, et c'est la
 * seule raison pour laquelle on retrouve un document sans se souvenir de son dossier.
 *
 * Les deux listes passent par le MÊME filtre de visibilité que la navigation normale
 * (`driveVisibilityWhere`) : un raccourci qui montrerait un fichier qu'on n'a pas le droit
 * d'ouvrir serait une fuite, pas un confort.
 */

export interface QuickAccessRow {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  updatedAt: string;
  /** Où il est rangé — c'est justement ce qu'on a oublié. */
  folderName: string | null;
  /** Quand je l'ai téléchargé (vue Téléchargements). */
  atLabel?: string;
}

const LIMIT = 100;

/** Les fichiers récemment modifiés, parmi ceux que je peux voir. */
export async function getRecentFiles(user: SessionUser): Promise<QuickAccessRow[]> {
  const nodes = await prisma.driveNode.findMany({
    where: { type: "FILE", isTrashed: false, ...(await driveVisibilityWhere(user)) },
    orderBy: { updatedAt: "desc" },
    take: LIMIT,
    select: {
      id: true, name: true, size: true, mimeType: true, updatedAt: true,
      parent: { select: { name: true } },
    },
  });
  return nodes.map((n) => ({
    id: n.id, name: n.name, size: n.size, mimeType: n.mimeType,
    updatedAt: n.updatedAt.toISOString(),
    folderName: n.parent?.name ?? null,
  }));
}

/**
 * CE QUE J'AI TÉLÉCHARGÉ — reconstitué depuis le journal d'audit, qui trace déjà chaque
 * téléchargement du Drive. On ne tient donc pas une seconde liste qui divergerait de la première :
 * la trace d'audit EST la source.
 *
 * Un fichier supprimé depuis n'apparaît plus : la liste dit ce qui est encore accessible, pas ce
 * qui a existé. L'historique complet, lui, reste dans le journal.
 */
export async function getDownloadedFiles(user: SessionUser): Promise<QuickAccessRow[]> {
  const events = await prisma.auditLog.findMany({
    where: { actorId: user.id, module: "Drive", action: "EXPORT", entityType: "DRIVE_NODE" },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { entityId: true, createdAt: true },
  });
  // Un même fichier téléchargé trois fois n'apparaît qu'une : c'est une liste de fichiers, pas
  // un journal — et le journal existe déjà, ailleurs.
  const seen = new Map<string, Date>();
  for (const e of events) {
    if (e.entityId && !seen.has(e.entityId)) seen.set(e.entityId, e.createdAt);
  }
  const ids = [...seen.keys()].slice(0, LIMIT);
  if (ids.length === 0) return [];

  const nodes = await prisma.driveNode.findMany({
    where: { id: { in: ids }, isTrashed: false, ...(await driveVisibilityWhere(user)) },
    select: {
      id: true, name: true, size: true, mimeType: true, type: true,
      parent: { select: { name: true } },
    },
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return ids
    .map((id) => {
      const n = byId.get(id);
      if (!n) return null;
      const at = seen.get(id)!;
      return {
        id: n.id, name: n.name, size: n.size, mimeType: n.mimeType,
        updatedAt: at.toISOString(),
        folderName: n.parent?.name ?? null,
      } satisfies QuickAccessRow;
    })
    .filter((r): r is QuickAccessRow => r !== null);
}
