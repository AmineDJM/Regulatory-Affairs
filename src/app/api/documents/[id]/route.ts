import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { readFileByKey } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Secure document download: authenticates, enforces row-level access, streams. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const allowed = await canAccessEntity(user, doc.entityType, doc.entityId, "VIEW");
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  if (!doc.fileKey) {
    return NextResponse.json(
      { error: "Aucun fichier binaire associé (métadonnées uniquement)." },
      { status: 404 },
    );
  }

  try {
    const buffer = await readFileByKey(doc.fileKey);
    await recordAudit({
      actorId: user.id,
      action: "EXPORT",
      module: "Documents",
      entityType: doc.entityType,
      entityId: doc.entityId,
      summary: `Téléchargement de « ${doc.name} »`,
    });
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": doc.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
  }
}
