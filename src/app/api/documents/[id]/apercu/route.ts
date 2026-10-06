import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { peutLirePasseportDuSujet } from "@/lib/ad-pro/passeport-acces";
import { prisma } from "@/lib/prisma";
import { makeDocEditToken, appBaseUrl, fileExt } from "@/lib/onlyoffice";
import { apercuParServeur } from "@/lib/formats/apercu";
import { pdfDApercu, reponseApercu } from "@/lib/apercu-pdf";

export const dynamic = "force-dynamic";

/**
 * APERÇU PDF d'un document dont le format n'est pas lisible dans le navigateur (.doc, .rtf, .odt, .ppt…).
 * MÊMES DROITS que le téléchargement (`/api/documents/[id]`) : la copie convertie n'ouvre rien de plus.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const allowed = (await canAccessEntity(user, doc.entityType, doc.entityId, "VIEW"))
    || (await peutLirePasseportDuSujet(user.id, doc));
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  if (!doc.fileKey) return NextResponse.json({ error: "Aucun fichier binaire associé (métadonnées uniquement)." }, { status: 404 });
  if (!apercuParServeur(doc.name, doc.mimeType)) {
    return NextResponse.json({ error: "Ce format n'a pas d'aperçu préparé par le serveur." }, { status: 400 });
  }

  try {
    const token = makeDocEditToken(doc.id, user.id, 300);
    const pdf = await pdfDApercu({
      srcUrl: `${appBaseUrl()}/api/onlyoffice/file?token=${token}`,
      ext: fileExt(doc.name),
      cle: `doc_${doc.id}_${doc.updatedAt.getTime()}`,
    });
    return reponseApercu(pdf, doc.name);
  } catch (e) {
    console.error("[apercu] conversion échouée", e);
    return NextResponse.json({ error: "La conversion de l'aperçu a échoué. Téléchargez le fichier pour l'ouvrir." }, { status: 502 });
  }
}
