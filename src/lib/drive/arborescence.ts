import { prisma } from "@/lib/prisma";

/**
 * RECRÉER UNE ARBORESCENCE DE DOSSIERS sous un parent — le geste de l'import de dossier du Drive.
 *
 * Chaque chemin relatif (« Contrats/2026 ») est descendu niveau par niveau ; un dossier du même nom
 * qui existe déjà au même endroit est RÉUTILISÉ (pas de « Contrats (1) »). Rend la carte
 * `chemin relatif → id du dossier`, où chaque fichier sera ensuite déposé.
 *
 * Sorti de `ensureDriveFolders` (Direction, 06/10) : la messagerie dépose désormais ses gros envois
 * par le MÊME chemin que le Drive, et deux copies de cette boucle auraient fini par diverger. La
 * GARDE (qui a le droit d'écrire sous `parentId`) reste à l'appelant.
 */
export async function creerArborescenceDrive(opts: {
  ownerId: string;
  parentId: string | null;
  /** Catégorie de tout l'arbre (null = Drive personnel). */
  spaceId: string | null;
  paths: readonly string[];
}): Promise<Record<string, string>> {
  const { ownerId, parentId, spaceId, paths } = opts;
  const map: Record<string, string> = {};
  for (const raw of paths) {
    const segments = raw.split("/").map((s) => s.trim()).filter(Boolean);
    let curParent = parentId;
    let acc = "";
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (map[acc]) { curParent = map[acc]; continue; }
      const existing = await prisma.driveNode.findFirst({
        where: { parentId: curParent, name: seg, type: "FOLDER", isTrashed: false, spaceId },
        select: { id: true },
      });
      const id = existing
        ? existing.id
        : (await prisma.driveNode.create({
            data: { name: seg.slice(0, 200), type: "FOLDER", parentId: curParent ?? null, spaceId, ownerId, createdById: ownerId },
            select: { id: true },
          })).id;
      map[acc] = id;
      curParent = id;
    }
  }
  return map;
}
