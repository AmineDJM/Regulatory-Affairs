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
