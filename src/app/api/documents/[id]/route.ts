import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { peutLirePasseportDuSujet } from "@/lib/ad-pro/passeport-acces";
import { readFileByKey } from "@/lib/storage";
import { cleObjetDirect } from "@/lib/drive-storage";
import { presignGetUrl } from "@/lib/storage/object-storage";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { contentDisposition } from "@/lib/http/content-disposition";

/** Secure document download: authenticates, enforces row-level access, streams. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Le passeport d'un voyageur s'ouvre aussi à qui réserve son billet (audit 360°, I10) — une porte
  // ÉTROITE, à la pièce près : voir `peutLirePasseportDuSujet`.
  const allowed = (await canAccessEntity(user, doc.entityType, doc.entityId, "VIEW"))
    || (await peutLirePasseportDuSujet(user.id, doc));
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  if (!doc.fileKey) {
    return NextResponse.json(
      { error: "Aucun fichier binaire associé (métadonnées uniquement)." },
      { status: 404 },
    );
  }

  try {
    // Aperçu in-app : on sert le fichier « inline » par défaut (l'iframe/img peut
    // l'afficher) ; `?dl=1` force le téléchargement. On ne journalise que le téléchargement.
    const download = req.nextUrl.searchParams.get("dl") === "1";
    const journaliser = () => download
      ? recordAudit({
        actorId: user.id, action: "EXPORT", module: "Documents",
        entityType: doc.entityType, entityId: doc.entityId,
        summary: `Téléchargement de « ${doc.name} »`,
      })
      : Promise.resolve();

    // GROS FICHIER DÉPOSÉ EN DIRECT : le navigateur le lit dans le bucket, sur une adresse signée
    // pour quinze minutes — le servir d'ici le ferait passer ENTIER par la mémoire de l'instance
    // (plusieurs gigaoctets sur 512 Mo). Les droits viennent d'être vérifiés, ce sont eux qui signent.
    const stocke = await prisma.storedFile.findUnique({ where: { key: doc.fileKey }, select: { blobId: true } });
    const direct = stocke ? await cleObjetDirect(stocke.blobId) : null;
    if (direct) {
      const url = presignGetUrl(direct, 900, {
        "response-content-disposition": contentDisposition(doc.name, download ? "attachment" : "inline"),
        "response-content-type": doc.mimeType ?? "application/octet-stream",
      });
      if (url) {
        await journaliser();
        return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
      }
    }
    const buffer = await readFileByKey(doc.fileKey);
    await journaliser();
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": doc.mimeType ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(doc.name, download ? "attachment" : "inline"),
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
  }
}
