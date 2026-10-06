import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { makeEditToken, appBaseUrl, fileExt } from "@/lib/onlyoffice";
import { apercuParServeur } from "@/lib/formats/apercu";
import { pdfDApercu, reponseApercu } from "@/lib/apercu-pdf";

export const dynamic = "force-dynamic";

/**
 * APERÇU PDF d'un fichier du Drive dont le format n'est pas lisible dans le navigateur (.doc, .rtf, .odt,
 * .ppt…). MÊMES DROITS que la lecture du fichier (`/api/drive/[id]/raw`) : la copie convertie n'ouvre rien de plus.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canViewDrive(await resolveDriveAccess(user, params.id))) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const node = await prisma.driveNode.findUnique({ where: { id: params.id }, select: { name: true, mimeType: true, type: true } });
  if (!node || node.type !== "FILE") return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!apercuParServeur(node.name, node.mimeType)) {
    return NextResponse.json({ error: "Ce format n'a pas d'aperçu préparé par le serveur." }, { status: 400 });
  }
  const version = await prisma.fileVersion.findFirst({ where: { nodeId: params.id }, orderBy: { version: "desc" }, select: { version: true } });
  if (!version) return NextResponse.json({ error: "Aucun contenu." }, { status: 404 });

  try {
    const token = makeEditToken(params.id, user.id, 300);
    const pdf = await pdfDApercu({
      srcUrl: `${appBaseUrl()}/api/onlyoffice/file?token=${token}`,
      ext: fileExt(node.name),
      cle: `drive_${params.id}_${version.version}`,
    });
    return reponseApercu(pdf, node.name);
  } catch (e) {
    console.error("[apercu] conversion échouée", e);
    return NextResponse.json({ error: "La conversion de l'aperçu a échoué. Téléchargez le fichier pour l'ouvrir." }, { status: 502 });
  }
}
