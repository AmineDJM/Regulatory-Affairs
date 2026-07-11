/**
 * Détection MIME par **octets magiques** (déterministe, sans dépendance). Sert à renseigner
 * `detectedMimeType` et à repérer une extension usurpée (ex. « .pdf » qui est en réalité un
 * exécutable ou une archive). Pure et testable.
 */

export interface MimeGuess {
  mime: string;
  family: "pdf" | "zip-office" | "image" | "ole-legacy" | "text" | "executable" | "unknown";
  /** L'extension déclarée est-elle cohérente avec les octets ? (heuristique) */
  matchesExt: boolean;
}

const startsWith = (buf: Buffer, sig: number[], offset = 0) =>
  buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

function sniffFamily(buf: Buffer): { mime: string; family: MimeGuess["family"] } {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return { mime: "application/pdf", family: "pdf" }; // %PDF
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]))
    return { mime: "application/zip", family: "zip-office" }; // PK.. (docx/xlsx/pptx/zip)
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return { mime: "image/png", family: "image" };
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", family: "image" };
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", family: "image" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: "image/webp", family: "image" };
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0])) return { mime: "application/x-ole-storage", family: "ole-legacy" }; // doc/xls/ppt hérités
  if (startsWith(buf, [0x4d, 0x5a])) return { mime: "application/x-dosexec", family: "executable" }; // MZ
  if (startsWith(buf, [0x7f, 0x45, 0x4c, 0x46])) return { mime: "application/x-elf", family: "executable" }; // ELF
  if (startsWith(buf, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return { mime: "application/rtf", family: "text" }; // {\rtf
  return { mime: "application/octet-stream", family: "unknown" };
}

const FAMILY_EXTS: Record<MimeGuess["family"], Set<string>> = {
  pdf: new Set(["pdf"]),
  "zip-office": new Set(["zip", "docx", "xlsx", "pptx", "xlsm", "docm", "pptm", "odt", "ods", "odp", "epub"]),
  image: new Set(["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp"]),
  "ole-legacy": new Set(["doc", "xls", "ppt", "msg"]),
  text: new Set(["rtf", "txt", "csv", "xml", "json", "md"]),
  executable: new Set([]),
  unknown: new Set([]),
};

export function detectMime(buffer: Buffer, ext: string): MimeGuess {
  const { mime, family } = sniffFamily(buffer);
  const e = (ext || "").toLowerCase();
  // Cohérence : famille connue → l'extension doit appartenir à la famille ; inconnue → on n'accuse pas.
  const matchesExt = family === "unknown" ? true : FAMILY_EXTS[family].has(e);
  return { mime, family, matchesExt };
}
