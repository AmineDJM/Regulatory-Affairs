import { prisma } from "@/lib/prisma";
import { ENTITIES } from "@/lib/api/registry/entities";
import { ensureDrivePath, putDriveFile } from "./mirror";
import { shouldMirrorToDrive, importFolderPath } from "./mirror-path";

/**
 * TOUT CE QUI ENTRE DANS L'ERP ENTRE AUSSI DANS LE DRIVE.
 *
 * Une pièce importée depuis un sponsoring, un appel d'offres, une demande RH restait accrochée à
 * son objet métier. Six semaines plus tard on la cherche « dans le Drive » — parce que c'est là
 * qu'on cherche les fichiers — et elle n'y est pas. Chaque téléversement dépose donc désormais une
 * copie dans le Drive de celui qui importe, rangée par module puis par objet.
 *
 * **Dans SON drive, à lui.** Le nœud appartient à l'importateur : la visibilité du Drive ne
 * s'ouvre qu'au propriétaire, aux partages explicites et au super-admin. Une pièce confidentielle
 * copiée ici reste donc aussi confidentielle qu'à l'origine — le miroir ne crée aucun accès
 * nouveau, et c'est la condition pour qu'il puisse être automatique.
 *
 * **Best-effort, toujours** : le document est déjà enregistré côté métier quand on arrive ici. Une
 * erreur de miroir est journalisée et avalée — jamais un téléversement perdu pour une copie ratée.
 */

/** Le champ « référence » de cet objet, d'après le registre : « SPO-2026-014 », « AO-12 »… */
function referenceFieldFor(entityType: string): { model: string; field: string } | null {
  const def = ENTITIES.find((e) => e.entityType === entityType && e.referenceField);
  if (!def) return null;
  return { model: def.model.charAt(0).toLowerCase() + def.model.slice(1), field: def.referenceField! };
}

/** La référence lisible de l'objet, quand l'ERP en connaît une. Silencieux en cas d'échec. */
async function resolveReference(entityType: string, entityId: string): Promise<string | null> {
  const target = referenceFieldFor(entityType);
  if (!target) return null;
  try {
    const delegate = (prisma as any)[target.model];
    if (!delegate?.findUnique) return null;
    const row = await delegate.findUnique({ where: { id: entityId }, select: { [target.field]: true } });
    const value = row?.[target.field];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export interface MirrorFile {
  name: string;
  data: Buffer;
  mime?: string | null;
}

/**
 * Réplique dans le Drive les fichiers qui viennent d'être téléversés sur un objet métier.
 * À appeler SANS `await` bloquant depuis une route : la copie se termine côté serveur pendant que
 * l'utilisateur enchaîne (`void mirrorDocumentsToDrive(...).catch(...)`).
 */
export async function mirrorDocumentsToDrive(opts: {
  ownerId: string;
  entityType: string;
  entityId: string;
  files: readonly MirrorFile[];
}): Promise<void> {
  if (opts.files.length === 0 || !shouldMirrorToDrive(opts.entityType)) return;
  try {
    const reference = await resolveReference(opts.entityType, opts.entityId);
    const folderId = await ensureDrivePath(importFolderPath(opts.entityType, reference, opts.entityId), opts.ownerId);
    if (!folderId) return;
    for (const f of opts.files) {
      try {
        await putDriveFile({ parentId: folderId, name: f.name, data: f.data, mimeType: f.mime, ownerId: opts.ownerId });
      } catch (err) {
        console.error("[drive mirror] fichier ignoré", f.name, err);
      }
    }
  } catch (err) {
    console.error("[drive mirror] miroir Drive échoué (non bloquant)", err);
  }
}
