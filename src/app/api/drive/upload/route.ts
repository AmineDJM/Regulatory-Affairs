import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { validateUpload } from "@/lib/storage";
import { resolveDriveAccess } from "@/lib/drive";
import { recordAudit } from "@/lib/audit";

/** Upload a new file (under `parentId`) or a new version (of `nodeId`). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Mot de passe à changer." }, { status: 403 });
  if (!userCan(user, "DRIVE", "UPLOAD")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  const parentId = (form.get("parentId") as string) || null;
  const nodeId = (form.get("nodeId") as string) || null;

  const err = validateUpload(file.name, file.size);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  // Editability: a new version requires EDIT on the node; a new file requires EDIT on its parent.
  if (nodeId) {
    if ((await resolveDriveAccess(user, nodeId)) !== "EDIT") return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  } else if (parentId) {
    if ((await resolveDriveAccess(user, parentId)) !== "EDIT") return NextResponse.json({ error: "Dossier non autorisé." }, { status: 403 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { blobId, size } = await putBlob(buf);
  const mimeType = file.type || "application/octet-stream";

  if (nodeId) {
    const last = await prisma.fileVersion.findFirst({ where: { nodeId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    await prisma.fileVersion.create({ data: { nodeId, blobId, version, size, mimeType, createdById: user.id } });
    await prisma.driveNode.update({ where: { id: nodeId }, data: { size, mimeType } });
    await recordAudit({ actorId: user.id, action: "UPLOAD", module: "Drive", entityType: "DRIVE_NODE", entityId: nodeId, summary: `Nouvelle version (v${version})` });
    return NextResponse.json({ id: nodeId, version });
  }

  const node = await prisma.driveNode.create({
    data: {
      name: file.name, type: "FILE", parentId, ownerId: user.id, mimeType, size, createdById: user.id,
      versions: { create: { blobId, version: 1, size, mimeType, createdById: user.id } },
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "UPLOAD", module: "Drive", entityType: "DRIVE_NODE", entityId: node.id, summary: `Fichier « ${file.name} »` });
  return NextResponse.json({ id: node.id });
}
