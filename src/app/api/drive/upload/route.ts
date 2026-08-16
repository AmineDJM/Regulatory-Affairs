import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { validateDriveUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { resolveDriveAccess, effectiveSpaceId, canCreateInSpace } from "@/lib/drive";
import { quotaVerdict } from "@/lib/drive/quota";
import { userUsageBytes, physicalUsageBytes, addPhysicalUsage } from "@/lib/drive/usage";
import { recordAudit } from "@/lib/audit";

/** Upload a new file (under `parentId`) or a new version (of `nodeId`). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Mot de passe à changer." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  const parentId = (form.get("parentId") as string) || null;
  const nodeId = (form.get("nodeId") as string) || null;
  const spaceId = (form.get("spaceId") as string) || null;

  // Autorisation d'écriture. Un accès **ÉDITEUR** explicite (partage/catégorie) sur la cible
  // SUFFIT, même si le rôle de la personne n'a pas le droit module « Téléverser » :
  //  - nouvelle version d'un fichier → éditeur sur CE fichier ;
  //  - nouveau fichier dans un dossier → éditeur sur CE dossier ;
  //  - nouveau fichier à la racine d'une CATÉGORIE → gestionnaire de la catégorie ;
  //  - nouveau fichier à la racine (espace perso) → droit module « Téléverser ».
  if (nodeId) {
    if ((await resolveDriveAccess(user, nodeId)) !== "EDIT") return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  } else if (parentId) {
    if ((await resolveDriveAccess(user, parentId)) !== "EDIT") return NextResponse.json({ error: "Dossier non autorisé." }, { status: 403 });
  } else if (spaceId) {
    if (!(await canCreateInSpace(user, spaceId))) return NextResponse.json({ error: "Catégorie non autorisée." }, { status: 403 });
  } else if (!userCan(user, "DRIVE", "UPLOAD")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const settings = await getAppSettings();
  const err = validateDriveUpload(file.name, file.size, settings.maxDriveUploadMb);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  // Quotas (réglés dans Administration → Stockage Drive) : par utilisateur (somme de SES fichiers
  // actifs, relue à chaque fois — c'est elle qui refuse) et capacité globale (mesure partagée,
  // relue au plus toutes les 30 s : sans cela, chaque fichier d'un lot payait un parcours complet
  // de la table des blobs AVANT d'écrire le moindre octet).
  const [myUsage, physical] = await Promise.all([userUsageBytes(user.id), physicalUsageBytes()]);
  const verdict = quotaVerdict({
    userUsageBytes: myUsage, physicalUsageBytes: physical, fileSize: file.size,
    userQuotaGb: settings.driveUserQuotaGb, capacityGb: settings.driveCapacityGb,
  });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { blobId, size, deduplicated } = await putBlob(buf);
  // Un contenu dédupliqué n'occupe pas de place NEUVE : le compter gonflerait l'occupation jusqu'à
  // refuser des envois qui tiennent parfaitement.
  if (!deduplicated) addPhysicalUsage(size);
  const mimeType = file.type || "application/octet-stream";

  if (nodeId) {
    const last = await prisma.fileVersion.findFirst({ where: { nodeId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    await prisma.fileVersion.create({ data: { nodeId, blobId, version, size, mimeType, createdById: user.id } });
    await prisma.driveNode.update({ where: { id: nodeId }, data: { size, mimeType } });
    await recordAudit({ actorId: user.id, action: "UPLOAD", module: "Drive", entityType: "DRIVE_NODE", entityId: nodeId, summary: `Nouvelle version (v${version})` });
    return NextResponse.json({ id: nodeId, version });
  }

  // Classement + permissions choisis à l'import (qui voit / qui modifie).
  const category = ((form.get("category") as string) || "").trim() || null;
  const viewers = form.getAll("viewers").map(String).filter(Boolean);
  const editors = form.getAll("editors").map(String).filter(Boolean);

  const effSpaceId = await effectiveSpaceId(parentId, spaceId);
  const node = await prisma.driveNode.create({
    data: {
      name: file.name, type: "FILE", parentId, spaceId: effSpaceId, ownerId: user.id, mimeType, size, category, createdById: user.id,
      versions: { create: { blobId, version: 1, size, mimeType, createdById: user.id } },
    },
    select: { id: true },
  });

  // Crée les partages (EDIT prioritaire sur VIEW ; on ignore l'auteur et les IDs invalides).
  const editorIds = new Set(editors.filter((id) => id !== user.id));
  const viewerIds = new Set(viewers.filter((id) => id !== user.id && !editorIds.has(id)));
  const ids = [...editorIds, ...viewerIds];
  if (ids.length) {
    const valid = new Set(
      (await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } })).map((u) => u.id),
    );
    const shareData = [
      ...[...editorIds].filter((id) => valid.has(id)).map((userId) => ({ nodeId: node.id, userId, access: "EDIT" as const })),
      ...[...viewerIds].filter((id) => valid.has(id)).map((userId) => ({ nodeId: node.id, userId, access: "VIEW" as const })),
    ];
    if (shareData.length) await prisma.driveShare.createMany({ data: shareData, skipDuplicates: true });
  }

  await recordAudit({ actorId: user.id, action: "UPLOAD", module: "Drive", entityType: "DRIVE_NODE", entityId: node.id, summary: `Fichier « ${file.name} »${category ? ` · ${category}` : ""}${ids.length ? ` · partagé (${ids.length})` : ""}` });
  return NextResponse.json({ id: node.id });
}
