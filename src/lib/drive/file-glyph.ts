/**
 * RECONNAÎTRE UN FICHIER SANS LIRE SON NOM.
 *
 * Dans une liste de quarante lignes, on ne lit pas les noms : on balaye les icônes. Encore
 * faut-il qu'elles se distinguent. Word, PDF, texte et Markdown partageaient la même feuille
 * grise — quatre types, une seule image, donc aucune information. Un tableur et une présentation
 * se ressemblaient tout autant.
 *
 * Ce module ne fait qu'une chose : dire à quelle FAMILLE appartient un fichier. La forme et la
 * couleur qui vont avec sont décidées à l'affichage (`FileGlyph`, côté composants) — c'est là que
 * vivent les classes de style, et c'est le seul endroit que l'outil de style inspecte.
 *
 * L'étiquette d'extension (« DOCX », « RAR ») accompagne l'icône pour les cas voisins : un `.rar`
 * et un `.zip` sont deux archives, mais on ne les ouvre pas avec le même outil.
 *
 * Module PUR — testé.
 */

import { extensionOf } from "./explorer";

export type FileFamily =
  | "folder" | "word" | "excel" | "slides" | "pdf" | "archive"
  | "image" | "video" | "audio" | "text" | "code" | "mail" | "cad" | "unknown";

export interface FileGlyphSpec {
  family: FileFamily;
  /** Étiquette courte affichée près de l'icône — l'extension, ou rien. */
  badge: string;
}

/**
 * Les familles, dans l'ordre où on les teste. La première qui reconnaît l'extension gagne, donc
 * l'ordre compte : `csv` doit rester un tableur, pas un fichier texte.
 */
const FAMILIES: { family: FileFamily; ext: string[] }[] = [
  { family: "word", ext: ["doc", "docx", "odt", "rtf", "dot", "dotx"] },
  { family: "excel", ext: ["xls", "xlsx", "xlsm", "ods", "csv", "tsv"] },
  { family: "slides", ext: ["ppt", "pptx", "pptm", "odp"] },
  { family: "pdf", ext: ["pdf"] },
  { family: "archive", ext: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"] },
  { family: "image", ext: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff", "ico"] },
  { family: "video", ext: ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv"] },
  { family: "audio", ext: ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma"] },
  { family: "text", ext: ["txt", "md", "log", "rst"] },
  { family: "code", ext: ["json", "xml", "yml", "yaml", "html", "css", "js", "ts", "sql"] },
  { family: "mail", ext: ["eml", "msg"] },
  { family: "cad", ext: ["dwg", "dxf"] },
];

/**
 * La famille d'une entrée de la liste, et son étiquette.
 *
 * Un `.rar` et un `.zip` sont tous deux des archives : l'icône dira vrai en les rapprochant.
 * C'est l'étiquette qui les sépare — et elle est nécessaire.
 */
export function fileGlyph(name: string, isFile: boolean): FileGlyphSpec {
  if (!isFile) return { family: "folder", badge: "" };
  const ext = extensionOf(name);
  const found = FAMILIES.find((f) => f.ext.includes(ext));
  // Une extension à rallonge tiendrait mal sur une pastille — au-delà de 4 signes, on n'affiche
  // rien plutôt qu'un mot tronqué qui n'apprendrait rien.
  return { family: found?.family ?? "unknown", badge: ext && ext.length <= 4 ? ext.toUpperCase() : "" };
}
