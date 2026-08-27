// pdf-parse ne fournit pas de types. Déclaration minimale de l'API utilisée
// (extraction du texte d'un PDF côté serveur, dans le runner d'extraction).
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }
  function pdf(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdf;
}

/**
 * L'IMPLÉMENTATION, SANS LE HARNAIS DE DÉMONSTRATION.
 *
 * L'index de `pdf-parse` embarque un bloc de debug qui, lorsqu'il se croit lancé directement,
 * tente d'ouvrir `./test/data/05-versions-space.pdf` — absent de ce dépôt. Le worker
 * d'extraction importait déjà ce chemin profond pour l'éviter ; le chemin en ligne le fait
 * désormais aussi, d'où cette déclaration.
 *
 * `Uint8Array` est accepté en plus de `Buffer` : le pdf.js embarqué emprunte, face à un Buffer
 * Node, un chemin de récupération qui refuse des PDF pourtant valides.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }
  function pdf(dataBuffer: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdf;
}
