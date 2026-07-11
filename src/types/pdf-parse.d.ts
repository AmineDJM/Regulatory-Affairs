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
