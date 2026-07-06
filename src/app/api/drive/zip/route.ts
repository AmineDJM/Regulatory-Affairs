import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { buildDriveZip } from "@/lib/drive-zip";
import { recordAudit } from "@/lib/audit";

/**
 * Télécharge **plusieurs éléments** du Drive (fichiers et/ou dossiers) en une seule
 * archive ZIP : `GET /api/drive/zip?ids=a,b,c`. L'accès est vérifié sur chaque élément
 * de tête ; les éléments non autorisés ou en corbeille sont ignorés.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ error: "Aucun élément sélectionné." }, { status: 400 });

  const nodes: { id: string; name: string; type: string }[] = [];
  for (const id of ids) {
    if (!canViewDrive(await resolveDriveAccess(user, id))) continue;
    const n = await prisma.driveNode.findUnique({ where: { id }, select: { id: true, name: true, type: true, isTrashed: true } });
    if (n && !n.isTrashed) nodes.push({ id: n.id, name: n.name, type: n.type });
  }
  if (nodes.length === 0) return NextResponse.json({ error: "Aucun élément accessible dans la sélection." }, { status: 403 });

  const res = await buildDriveZip(nodes);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  await recordAudit({
    actorId: user.id, action: "EXPORT", module: "Drive",
    summary: `Téléchargement ZIP — ${res.count} fichier·s (${nodes.length} élément·s sélectionné·s)`,
  });
  return new NextResponse(new Uint8Array(res.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(res.filename)}`,
      "Content-Length": String(res.buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
