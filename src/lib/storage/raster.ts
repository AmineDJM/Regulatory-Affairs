/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RASTÉRISER UNE PAGE — transformer du PDF en image, et rien d'autre.
 *
 * ── POURQUOI CE MODULE EXISTE, ET POURQUOI ICI ───────────────────────────────────────────
 *
 * Cette fonction vivait dans le moteur OCR du Regulatory. Elle n'a pourtant AUCUNE règle
 * métier : elle ouvre un PDF, rend une page, produit un PNG. Deux chantiers en ont besoin —
 * l'analyse CTD et l'ingestion de connaissance — et le second ne peut pas aller la chercher
 * chez le premier sans que « Knowledge » se mette à dépendre de « Regulatory » pour lire une
 * image. Elle rejoint donc l'infrastructure de fichiers, à côté de la détection de type et du
 * stockage d'objets, qui sont exactement de la même nature.
 *
 * ── LA PROPRIÉTÉ QUI COMPTE : LA MÉMOIRE NE DÉPEND PAS DU NOMBRE DE PAGES ─────────────────
 *
 * La version qui accumulait `Buffer[]` gardait TOUTES les pages en mémoire : à ~1,5 Mo la page
 * rendue, un dossier de 15 000 pages demandait des dizaines de gigaoctets. C'est ce qui imposait
 * un plafond de 25 pages — un plafond qui faisait passer un dossier lu à 3 % pour un dossier lu.
 *
 * Ici chaque page est rendue, remise à l'appelant, puis relâchée. La mémoire ne dépend plus que
 * de la plus grande page, et le nombre de pages devient illimité. `onPage` est ATTENDU avant de
 * rendre la suivante : sans cela on fabriquerait les pages plus vite qu'on ne les consomme, et
 * la file d'attente reconstituerait exactement le tas qu'on vient de supprimer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** ~200 DPI : lisible par un modèle de vision sans faire exploser le poids de la page. */
export const DEFAULT_RASTER_SCALE = 2.0;

export interface RasterOptions {
  /** `0` ou moins ⇒ tout le document. */
  maxPages?: number;
  /** Facteur d'échelle. 2.0 ≈ 200 DPI. */
  scale?: number;
  /** Les pages voulues, en RANG 1-INDEXÉ. Absent ⇒ les `maxPages` premières. */
  pages?: number[];
}

export interface RasterOutcome {
  /** Le nombre TOTAL de pages du document — pas le nombre de pages rendues. */
  total: number;
  /** Les rangs (1-indexés) qu'on n'a pas su rendre. Une page cassée n'arrête pas le document. */
  failed: number[];
}

/**
 * RASTÉRISE EN FLUX. Rend le nombre total de pages du document et la liste de celles qui ont
 * échoué — jamais une exception pour une page abîmée : un document de 400 pages ne doit pas
 * être perdu parce que la page 137 est corrompue.
 *
 * `onPage` reçoit le rang **1-indexé**, comme le lisent les humains et comme le citent les
 * réponses d'Adam. Un décalage d'un rang ici ferait citer la mauvaise page comme preuve.
 */
export async function rasterizePdfStream(
  buffer: Buffer,
  onPage: (png: Buffer, page: number) => Promise<void>,
  opts: RasterOptions = {},
): Promise<RasterOutcome> {
  const scale = Number.isFinite(opts.scale) && (opts.scale as number) > 0
    ? (opts.scale as number)
    : DEFAULT_RASTER_SCALE;

  // L'import est DYNAMIQUE : `mupdf` est un module natif lourd, et la plupart des ingestions
  // (feuilles, DOCX, e-mails) n'en ont jamais besoin. Le charger au sommet le ferait entrer
  // dans tous les processus qui touchent au stockage.
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  const total = doc.countPages();
  const failed: number[] = [];

  // Quelles pages ? Une sélection explicite gagne ; sinon les N premières. Les rangs hors
  // document sont écartés silencieusement — demander la page 900 d'un document de 12 pages
  // est une erreur d'appelant, pas une raison de tout arrêter.
  const wanted = opts.pages?.length
    ? [...new Set(opts.pages)].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
    : Array.from(
      { length: (opts.maxPages ?? 0) > 0 ? Math.min(total, opts.maxPages as number) : total },
      (_, i) => i + 1,
    );

  try {
    for (const page of wanted) {
      let png: Buffer | null = null;
      try {
        const p = doc.loadPage(page - 1);
        const pix = p.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
        png = Buffer.from(pix.asPNG());
        pix.destroy?.();
        p.destroy?.();
      } catch (err) {
        failed.push(page);
        console.error("[raster] page non rendue", page, err instanceof Error ? err.message : err);
        continue;
      }
      await onPage(png, page);
      png = null; // relâche explicite : la page suivante ne cohabite pas avec celle-ci
    }
  } finally {
    doc.destroy?.();
  }
  return { total, failed };
}

/**
 * LA VARIANTE QUI ACCUMULE — pour les petites sélections SEULEMENT.
 *
 * Elle existe parce que « rends-moi les trois pages illisibles de ce courrier » est un cas
 * fréquent où le flux n'apporte rien. `cap` est un garde-fou volontairement bas : si un appelant
 * demande cinquante pages d'un coup, c'est le flux qu'il lui faut, pas cette fonction.
 */
export async function rasterizePages(
  buffer: Buffer,
  pages: number[],
  opts: { scale?: number; cap?: number } = {},
): Promise<{ page: number; png: Buffer }[]> {
  const cap = opts.cap ?? 8;
  const out: { page: number; png: Buffer }[] = [];
  await rasterizePdfStream(
    buffer,
    async (png, page) => { if (out.length < cap) out.push({ page, png }); },
    { pages: pages.slice(0, cap), scale: opts.scale },
  );
  return out;
}
