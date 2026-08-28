/**
 * LA RASTÉRISATION D'UNE PAGE DE PDF — une seule page, à la demande (§71).
 *
 * ── POURQUOI PAS `storage/raster.ts`, QUI EXISTE DÉJÀ ───────────────────────────────────
 *
 * `rasterizePdfStream` parcourt TOUTES les pages en flux : c'est ce qu'il faut pour l'ingestion
 * de connaissance, qui lit un document entier une fois. Ici, on affiche la page 7 d'un dossier
 * de mille pages : en rendre neuf cent quatre-vingt-dix-neuf pour en montrer une serait absurde,
 * et sur un gros dossier cela dépasserait le délai de la requête.
 *
 * Cette fonction charge donc la page demandée et elle seule. Sur un PDF de 1 000 pages, le coût
 * est celui d'UNE page — c'est ce qui rend le workspace utilisable sur les dossiers ANPP.
 */

import { chargerMupdf } from "@/lib/artifact/adapters/pdf/adapter";

/** 2× donne un rendu net sur les écrans à haute densité sans quadrupler le poids de l'image. */
export const ECHELLE_DEFAUT = 2;

export interface PageRendue {
  png: Buffer;
  largeur: number;
  hauteur: number;
}

/**
 * REND une page (1-indexée, §17) d'un PDF en PNG.
 *
 * Rend `null` si la page n'existe pas — le cas normal juste après une suppression, quand un
 * navigateur redemande une page qui vient de disparaître. Ce n'est pas une erreur à journaliser.
 */
export async function rendrePagePdf(
  octets: Buffer, page: number, opts: { echelle?: number } = {},
): Promise<PageRendue | null> {
  const mupdf = await chargerMupdf();
  const doc = mupdf.Document.openDocument(new Uint8Array(octets), "application/pdf");
  if (page < 1 || page > doc.countPages()) return null;
  const echelle = opts.echelle ?? ECHELLE_DEFAUT;
  const pix = doc.loadPage(page - 1).toPixmap(
    mupdf.Matrix.scale(echelle, echelle),
    mupdf.ColorSpace.DeviceRGB,
    // Pas de canal alpha : un PNG opaque sur fond blanc pèse moins et s'affiche comme du papier.
    false,
    true,
  );
  return { png: Buffer.from(pix.asPNG()), largeur: pix.getWidth(), hauteur: pix.getHeight() };
}
