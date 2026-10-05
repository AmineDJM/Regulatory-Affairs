import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { collecterPourZip, entreesDeDrive } from "@/lib/drive-zip";
import { qualiteDeLaRequete, repondreArchive, repondreEstimationArchive } from "@/lib/http/telechargement";
import { recordAudit } from "@/lib/audit";

/**
 * Télécharge **plusieurs éléments** du Drive (fichiers et/ou dossiers) en une seule
 * archive ZIP : `GET /api/drive/zip?ids=a,b,c`. L'accès est vérifié sur chaque élément
 * de tête ; les éléments non autorisés ou en corbeille sont ignorés.
 *
 * `&qualite=max` (défaut : aucun fichier recompressé, octet pour octet) | `reduite` (deflate 9) |
 * `estimer` (JSON des deux tailles) — voir `@/lib/http/telechargement`.
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

  const res = await collecterPourZip(nodes);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  const qualite = qualiteDeLaRequete(req);
  if (qualite === "estimer") {
    return repondreEstimationArchive({
      nomArchive: res.filename, noms: res.items.map((i) => i.chemin), octetsTotal: res.total,
      cle: `drive:${res.items.map((i) => i.blobId).join(",")}`, entrees: () => entreesDeDrive(res.items),
    });
  }
  return repondreArchive(res.filename, entreesDeDrive(res.items), qualite, {
    octetsTotal: res.total,
    journaliser: (q) => recordAudit({
      actorId: user.id, action: "EXPORT", module: "Drive",
      summary: `Téléchargement ZIP${q === "reduite" ? " compressé" : ""} — ${res.items.length} fichier·s (${nodes.length} élément·s sélectionné·s)`,
    }),
  });
}
