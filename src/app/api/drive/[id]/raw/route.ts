import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { buildDriveZip } from "@/lib/drive-zip";
import { recordAudit } from "@/lib/audit";

/** Stream a file's current version (decrypted). `?dl=1` forces download. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!canViewDrive(await resolveDriveAccess(user, params.id))) return new NextResponse(null, { status: 403 });

  const node = await prisma.driveNode.findUnique({
    where: { id: params.id },
    select: { name: true, mimeType: true, type: true, isTrashed: true },
  });
  if (!node) return new NextResponse(null, { status: 404 });

  // Dossier → téléchargement en archive ZIP (contenu récursif).
  if (node.type === "FOLDER") {
    const res = await buildDriveZip([{ id: params.id, name: node.name, type: "FOLDER" }]);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    await recordAudit({ actorId: user.id, action: "EXPORT", module: "Drive", entityType: "DRIVE_NODE", entityId: params.id, summary: `Téléchargement du dossier « ${node.name} » (ZIP, ${res.count} fichier·s)` });
    return new NextResponse(new Uint8Array(res.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(res.filename)}`,
        "Content-Length": String(res.buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  }

  const version = await prisma.fileVersion.findFirst({
    where: { nodeId: params.id },
    orderBy: { version: "desc" },
    select: { blobId: true, mimeType: true },
  });
  if (!version) return new NextResponse(null, { status: 404 });

  const bytes = await getBlob(version.blobId);
  if (!bytes) return new NextResponse(null, { status: 404 });

  const dl = req.nextUrl.searchParams.get("dl") === "1";
  if (dl) {
    await recordAudit({ actorId: user.id, action: "EXPORT", module: "Drive", entityType: "DRIVE_NODE", entityId: params.id, summary: `Téléchargement « ${node.name} »` });
  }
  const filename = encodeURIComponent(node.name);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": node.mimeType ?? version.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
