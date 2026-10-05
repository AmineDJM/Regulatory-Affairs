import { NextResponse } from "next/server";
import { convertDocument, convertConfigured } from "@/lib/office-convert";
import { contentDisposition } from "@/lib/http/content-disposition";

/**
 * L'APERÇU PAR CONVERSION — rendre en PDF, par l'éditeur Office, un fichier que le navigateur ne sait pas
 * lire (.doc, .rtf, .odt, .ppt, .xls, .ods, .pages, .epub…). Le fichier d'origine n'est JAMAIS modifié :
 * l'aperçu est une copie jetable, gardée quelques minutes en mémoire pour qu'un second affichage (ou un
 * défilement) ne relance pas la conversion.
 *
 * Serveur uniquement. Les DROITS sont vérifiés par la route appelante, avant tout : ce module ne décide rien.
 */

const MAX_OCTETS_EN_CACHE = 64 * 1024 * 1024;
const DUREE_DE_VIE_MS = 10 * 60_000;
const cache = new Map<string, { pdf: Buffer; at: number }>();
let octets = 0;

function purger(): void {
  const maintenant = Date.now();
  for (const [k, v] of cache) {
    if (maintenant - v.at > DUREE_DE_VIE_MS || octets > MAX_OCTETS_EN_CACHE) {
      cache.delete(k);
      octets -= v.pdf.length;
    }
  }
}

export const REFUS_SANS_EDITEUR =
  "L'aperçu de ce format passe par l'éditeur Office (OnlyOffice), qui n'est pas configuré sur ce serveur. "
  + "Téléchargez le fichier pour l'ouvrir — ou demandez à l'administrateur de renseigner les variables ONLYOFFICE_* et APP_URL.";

/** Le PDF de l'aperçu, ou `null` si l'éditeur n'est pas configuré. Lève si la conversion échoue. */
export async function pdfDApercu(i: { srcUrl: string; ext: string; cle: string }): Promise<Buffer | null> {
  if (!convertConfigured()) return null;
  purger();
  const garde = cache.get(i.cle);
  if (garde) return garde.pdf;
  const pdf = await convertDocument({ srcUrl: i.srcUrl, fromExt: i.ext, outputType: "pdf", key: `apercu_${i.cle}` });
  cache.set(i.cle, { pdf, at: Date.now() });
  octets += pdf.length;
  return pdf;
}

/** La réponse HTTP d'un aperçu : le PDF en ligne, ou une erreur NOMMÉE que la fenêtre affiche telle quelle. */
export function reponseApercu(pdf: Buffer | null, nom: string, erreur?: string): NextResponse {
  if (pdf === null) return NextResponse.json({ error: erreur ?? REFUS_SANS_EDITEUR }, { status: 501 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": contentDisposition(`${nom.replace(/\.[a-z0-9]+$/i, "")}.pdf`, "inline"),
      "Cache-Control": "private, no-store",
    },
  });
}
