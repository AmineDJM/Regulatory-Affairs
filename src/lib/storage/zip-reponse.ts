import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { getBlob, cleObjetDirect } from "@/lib/drive-storage";
import { getObjectRange } from "@/lib/storage/object-storage";
import { fluxEntreeZip, lireEntreeZip, sourceTampon, type EntreeZip, type SourceZip } from "@/lib/storage/zip-lecteur";
import { mimeFromName } from "@/lib/regulatory-drive-mirror";
import { contentDisposition } from "@/lib/http/content-disposition";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SERVIR UNE ENTRÉE D'ARCHIVE — la même réponse pour les documents (Regulatory…) et le Drive.
 *
 * « J'ai essayé d'ouvrir un fichier dans un dossier depuis Regulatory et aussi depuis le Drive, mais des fois ça
 * s'affiche comme ça : {"ok":false,"error":"Cette entrée est trop volumineuse…"} » (Direction, 06/10). Deux défauts :
 *   • une grosse entrée était REFUSÉE (au-delà de 200 Mo décompressés) : elle se sert maintenant EN FLUX, par plages,
 *     sans jamais tenir en mémoire (`fluxEntreeZip`) ;
 *   • un refus s'affichait en JSON brut dans l'aperçu : une demande d'ENTRÉE reçoit désormais une phrase lisible
 *     (`text/plain`), jamais du JSON.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Une archive stockée en base est lue en mémoire : on la borne (au-delà, elle est dans le bucket). */
export const MAX_ARCHIVE_EN_MEMOIRE = 400 * 1024 * 1024;
/** Au-delà, l'entrée se sert en flux plutôt que d'un bloc. */
const SEUIL_FLUX = 32 * 1024 * 1024;

/** Ces types s'exécuteraient dans notre origine s'ils étaient servis tels quels : on les montre en texte. */
const TYPES_ACTIFS = /\.(html?|xhtml|svg|xml|xsl|xslt)$/i;

/** La source d'une archive à partir de son blob : par plages dans le bucket, sinon en mémoire (bornée). */
export async function sourceDuBlob(blobId: string, taille: number): Promise<SourceZip | { erreur: string; status: number }> {
  const cle = await cleObjetDirect(blobId);
  if (cle) return { taille, lire: (debut, longueur) => getObjectRange(cle, debut, longueur) };
  if (taille > MAX_ARCHIVE_EN_MEMOIRE) {
    return { erreur: `Archive trop volumineuse pour l'aperçu (${Math.round(taille / 1024 / 1024)} Mo). Téléchargez-la pour l'ouvrir.`, status: 413 };
  }
  const octets = await getBlob(blobId);
  if (!octets) return { erreur: "Contenu indisponible.", status: 404 };
  return sourceTampon(octets);
}

/** La source d'une archive déposée comme `Document` (sa clé de stockage). */
export async function sourceDuFichierStocke(fileKey: string): Promise<SourceZip | { erreur: string; status: number }> {
  const stocke = await prisma.storedFile.findUnique({ where: { key: fileKey }, select: { blobId: true, size: true } });
  if (!stocke) return { erreur: "Contenu indisponible.", status: 404 };
  return sourceDuBlob(stocke.blobId, stocke.size);
}

/** Un refus lisible DANS l'aperçu (une iframe montre du texte, pas un objet JSON). */
export function refusLisible(message: string, status: number): Response {
  return new Response(`${message}\n`, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

/** UNE entrée : d'un bloc si elle est petite, en flux sinon — en ligne, ou en pièce jointe (`dl`). */
export async function reponseEntreeZip(source: SourceZip, entree: EntreeZip, dl: boolean): Promise<Response> {
  const nom = entree.chemin.split("/").pop() || "fichier";
  const headers: Record<string, string> = {
    "Content-Type": TYPES_ACTIFS.test(nom) ? "text/plain; charset=utf-8" : mimeFromName(nom),
    "Content-Disposition": contentDisposition(nom, dl ? "attachment" : "inline"),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  if (entree.taille <= SEUIL_FLUX) {
    const octets = await lireEntreeZip(source, entree);
    return new Response(new Uint8Array(octets), { headers: { ...headers, "Content-Length": String(octets.length) } });
  }
  const flux = await fluxEntreeZip(source, entree);
  return new Response(Readable.toWeb(flux) as unknown as ReadableStream<Uint8Array>, { headers: { ...headers, "Content-Length": String(entree.taille) } });
}
