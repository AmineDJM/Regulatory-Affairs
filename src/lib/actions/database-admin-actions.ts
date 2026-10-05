"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { purgeOrphanBlobs, releaseBlob } from "@/lib/drive-storage";
import { deleteFileByKey } from "@/lib/storage";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Onglet « Bases de données » (Super Admin) : suppression DÉFINITIVE de fichiers / documents /
 * dossiers pour libérer RÉELLEMENT le stockage de la BDD. Le contenu binaire étant dédupliqué
 * (FileBlob adressé par contenu, partagé), on supprime la référence PUIS on ramasse les blobs
 * devenus orphelins — c'est ce ramassage qui rend l'espace disque.
 */

const NOT_ALLOWED: ActionResult = { ok: false, error: "Réservé au Super Admin." };

/** Le nœud et tout son sous-arbre — pour rendre les références de ses versions avant la cascade. */
async function sousArbre(rootId: string): Promise<string[]> {
  const ids: string[] = [];
  const vus = new Set<string>();
  let front = [rootId];
  while (front.length) {
    const lot = front.filter((id) => !vus.has(id));
    if (lot.length === 0) break;
    lot.forEach((id) => vus.add(id));
    ids.push(...lot);
    front = (await prisma.driveNode.findMany({ where: { parentId: { in: lot } }, select: { id: true } })).map((c) => c.id);
  }
  return ids;
}

/** Ramasse-miettes : détruit les blobs physiques non référencés → libère l'espace disque. */
export async function purgeOrphanStorage(): Promise<ActionResult & { count?: number; bytes?: number }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return NOT_ALLOWED;
  const freed = await purgeOrphanBlobs();
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Administration", summary: `Purge stockage : ${freed.count} blob·s orphelins détruits (${freed.bytes} octets libérés)` });
  revalidatePath("/admin/bases");
  return { ok: true, count: freed.count, bytes: freed.bytes };
}

/**
 * Supprime DÉFINITIVEMENT un nœud Drive (fichier OU dossier). Un dossier emporte toute son
 * arborescence (cascade). Les blobs devenus orphelins sont ensuite ramassés pour libérer l'espace.
 */
export async function permanentlyDeleteDriveNode(formData: FormData): Promise<ActionResult & { count?: number; bytes?: number }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return NOT_ALLOWED;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const node = await prisma.driveNode.findUnique({ where: { id }, select: { name: true, type: true } });
  if (!node) return { ok: false, error: "Élément introuvable (déjà supprimé ?)." };
  // On rend les références de CE sous-arbre, et elles seules (audit du 04/10, constat 2). Lancer
  // ici la purge globale effaçait, à chaque suppression, tout blob qu'elle ne savait pas
  // rattacher — c'est-à-dire les pièces de onze autres tables. La purge reste un geste à part.
  const versions = await prisma.fileVersion.findMany({ where: { nodeId: { in: await sousArbre(id) } }, select: { blobId: true, size: true } });
  await prisma.driveNode.delete({ where: { id } }); // cascade : enfants + versions
  const avant = await prisma.fileBlob.count({ where: { id: { in: versions.map((v) => v.blobId) } } });
  for (const v of versions) await releaseBlob(v.blobId);
  const apres = await prisma.fileBlob.count({ where: { id: { in: versions.map((v) => v.blobId) } } });
  const freed = { count: avant - apres };
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Administration", summary: `Suppression définitive Drive (${node.type === "FOLDER" ? "dossier" : "fichier"}) « ${node.name} » — ${freed.count} blob·s libérés` });
  revalidatePath("/admin/bases");
  return { ok: true, count: freed.count };
}

/**
 * Supprime DÉFINITIVEMENT un Document (bibliothèque d'un objet métier). Libère la référence de
 * stockage (StoredFile) — le blob part si plus personne ne le référence.
 */
export async function permanentlyDeleteDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return NOT_ALLOWED;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const doc = await prisma.document.findUnique({ where: { id }, select: { name: true, fileKey: true } });
  if (!doc) return { ok: false, error: "Document introuvable (déjà supprimé ?)." };
  if (doc.fileKey) await deleteFileByKey(doc.fileKey); // relâche le blob (ramassé si plus référencé)
  await prisma.document.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Administration", summary: `Suppression définitive document « ${doc.name} »` });
  revalidatePath("/admin/bases");
  return { ok: true };
}
