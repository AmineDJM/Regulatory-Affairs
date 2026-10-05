import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { getBlob, cleObjetDirect } from "@/lib/drive-storage";
import { getObjectRange } from "@/lib/storage/object-storage";
import { listerZip, lireEntreeZip, sourceTampon, ErreurZip, type SourceZip } from "@/lib/storage/zip-lecteur";
import { mimeFromName } from "@/lib/regulatory-drive-mirror";
import { contentDisposition } from "@/lib/http/content-disposition";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Parcourir un ZIP DÉPOSÉ COMME DOCUMENT, sans le télécharger :
 *  - sans `?path=` → la liste des entrées (JSON) ;
 *  - avec `?path=` → UNE entrée (aperçu en ligne, ou `?dl=1` pour l'enregistrer).
 *
 * Les droits sont ceux du téléchargement du document (la même porte). L'archive n'est JAMAIS lue en
 * entier quand elle est dans le bucket : on lit son répertoire, puis l'entrée demandée, par plages —
 * une archive CTD de plusieurs Go s'ouvre en une seconde sur une instance à 512 Mo.
 */

/** Une archive stockée en base est lue en mémoire : on la borne (au-delà, elle est dans le bucket). */
const MAX_ARCHIVE_EN_MEMOIRE = 400 * 1024 * 1024;

/** Ces types s'exécuteraient dans notre origine s'ils étaient servis tels quels : on les montre en texte. */
const TYPES_ACTIFS = /\.(html?|xhtml|svg|xml|xsl|xslt)$/i;

async function sourceDuDocument(fileKey: string): Promise<SourceZip | { erreur: string; status: number }> {
  const stocke = await prisma.storedFile.findUnique({ where: { key: fileKey }, select: { blobId: true, size: true } });
  if (!stocke) return { erreur: "Contenu indisponible.", status: 404 };
  const cle = await cleObjetDirect(stocke.blobId);
  if (cle) return { taille: stocke.size, lire: (debut, longueur) => getObjectRange(cle, debut, longueur) };
  if (stocke.size > MAX_ARCHIVE_EN_MEMOIRE) {
    return { erreur: `Archive trop volumineuse pour l'aperçu (${Math.round(stocke.size / 1024 / 1024)} Mo). Téléchargez-la pour l'ouvrir.`, status: 413 };
  }
  const octets = await getBlob(stocke.blobId);
  if (!octets) return { erreur: "Contenu indisponible.", status: 404 };
  return sourceTampon(octets);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Non authentifié." }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { name: true, fileKey: true, entityType: true, entityId: true } });
  if (!doc) return NextResponse.json({ ok: false, error: "Introuvable." }, { status: 404 });
  if (!(await canAccessEntity(user, doc.entityType, doc.entityId, "VIEW"))) return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 403 });
  if (!doc.fileKey) return NextResponse.json({ ok: false, error: "Aucun fichier binaire associé." }, { status: 404 });
  if (!/\.zip$/i.test(doc.name)) return NextResponse.json({ ok: false, error: "Ce fichier n'est pas une archive ZIP." }, { status: 400 });

  try {
    const source = await sourceDuDocument(doc.fileKey);
    if ("erreur" in source) return NextResponse.json({ ok: false, error: source.erreur }, { status: source.status });
    const { entrees, tronque } = await listerZip(source);

    const chemin = req.nextUrl.searchParams.get("path");
    if (!chemin) {
      // Même forme que la liste du Drive : la visionneuse est UNE seule, pour les deux.
      const fichiers = entrees.filter((e) => !e.dossier);
      return NextResponse.json({
        ok: true, name: doc.name, count: fichiers.length, truncated: tronque,
        entries: fichiers.map((e) => ({ path: e.chemin, size: e.taille })),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const entree = entrees.find((e) => e.chemin === chemin && !e.dossier);
    if (!entree) return NextResponse.json({ ok: false, error: "Entrée introuvable dans l'archive." }, { status: 404 });
    const octets = await lireEntreeZip(source, entree);
    const nom = entree.chemin.split("/").pop() ?? entree.chemin;
    const dl = req.nextUrl.searchParams.get("dl") === "1";
    if (dl) {
      await recordAudit({
        actorId: user.id, action: "EXPORT", module: "Documents", entityType: doc.entityType, entityId: doc.entityId,
        summary: `Téléchargement de « ${entree.chemin} » dans « ${doc.name} »`,
      }).catch(() => undefined);
    }
    const type = TYPES_ACTIFS.test(nom) ? "text/plain; charset=utf-8" : mimeFromName(nom);
    return new NextResponse(new Uint8Array(octets), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": contentDisposition(nom, dl ? "attachment" : "inline"),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErreurZip) return NextResponse.json({ ok: false, error: e.message }, { status: 422 });
    console.error("[documents zip]", e);
    return NextResponse.json({ ok: false, error: "Lecture de l'archive impossible." }, { status: 500 });
  }
}
