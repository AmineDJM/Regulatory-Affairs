import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { recordAudit } from "@/lib/audit";
import { fichierEmisDeLaPiece } from "@/lib/queries/legal-fichier";

/**
 * LE FICHIER ÉMIS D'UNE PIÈCE LEGAL (Word ou PDF de la fabrique), sous la porte de la PIÈCE.
 *
 * `/api/drive/<nœud>/raw` répond selon le Drive — et le fichier d'un BC vit dans le Drive
 * personnel de celui qui l'a émis : les Finances qui le signent, le centre qui le valide, le
 * demandeur qui l'envoie à son fournisseur recevaient un 403. Ici, qui lit la pièce lit son
 * fichier (`fichierEmisDeLaPiece`), et rien de plus : un refus et une absence rendent 404.
 * `?format=pdf|docx` (PDF par défaut), `?dl=1` force le téléchargement — et le trace.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const format = req.nextUrl.searchParams.get("format") === "docx" ? "docx" : "pdf";
  const fichier = await fichierEmisDeLaPiece(user, params.id, format);
  if (!fichier) return new NextResponse(null, { status: 404 });

  const node = await prisma.driveNode.findUnique({
    where: { id: fichier.nodeId },
    select: { name: true, mimeType: true, type: true, isTrashed: true },
  });
  if (!node || node.type !== "FILE" || node.isTrashed) return new NextResponse(null, { status: 404 });
  const version = await prisma.fileVersion.findFirst({
    where: { nodeId: fichier.nodeId }, orderBy: { version: "desc" }, select: { blobId: true, mimeType: true },
  });
  if (!version) return new NextResponse(null, { status: 404 });
  const bytes = await getBlob(version.blobId);
  if (!bytes) return new NextResponse(null, { status: 404 });

  const dl = req.nextUrl.searchParams.get("dl") === "1";
  if (dl) {
    await recordAudit({
      actorId: user.id, action: "EXPORT", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: params.id,
      summary: `Téléchargement du fichier émis « ${node.name} »`,
    });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": node.mimeType ?? version.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(node.name)}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
