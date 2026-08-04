import JSZip from "jszip";
import { extractText } from "@/lib/regulatory/intelligence/extract/extract-text";

/**
 * Lecture de PIÈCES JOINTES pour l'assistant : extrait un TEXTE exploitable d'un fichier
 * (Excel complet, PowerPoint, Word, PDF, CSV, texte…) afin de l'injecter dans le contexte
 * de la conversation. Réutilise l'extracteur éprouvé du pipeline Regulatory (xlsx/docx/pdf/
 * texte) et ajoute le PPTX (texte des diapositives via JSZip). Ne lève jamais.
 */

/** Plafond de texte injecté PAR fichier (garde le prompt borné). */
const PER_FILE_CHARS = 30_000;

export interface AttachmentText {
  name: string;
  /** Texte extrait (vide si non extractible). */
  text: string;
  /** Raison si non lisible (scan sans OCR, format binaire hérité…), sinon null. */
  note: string | null;
  truncated: boolean;
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec((name || "").trim());
  return m ? m[1].toLowerCase() : "";
}

/** PPTX → texte des diapositives (balises `<a:t>` de chaque `ppt/slides/slideN.xml`). */
async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] ?? 0) - Number(b.match(/slide(\d+)/)?.[1] ?? 0));
  const parts: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.files[slides[i]].async("string");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
    if (texts.length) parts.push(`--- Diapositive ${i + 1} ---\n${texts.join(" ").replace(/\s+/g, " ").trim()}`);
  }
  return parts.join("\n\n");
}

function cap(name: string, text: string, emptyNote: string | null): AttachmentText {
  const clean = (text || "").trim();
  const truncated = clean.length > PER_FILE_CHARS;
  return { name, text: truncated ? clean.slice(0, PER_FILE_CHARS) : clean, note: clean ? null : emptyNote, truncated };
}

/** Extrait un texte exploitable d'une pièce jointe d'après son nom (extension) et son contenu. */
export async function extractAttachmentText(name: string, buffer: Buffer): Promise<AttachmentText> {
  const ext = extOf(name);
  try {
    if (ext === "pptx") {
      const t = await extractPptx(buffer);
      return cap(name, t, "Aucun texte détecté dans la présentation.");
    }
    const r = await extractText(ext, buffer);
    if (r.status === "TEXT_EXTRACTED" || r.status === "OCR_COMPLETED" || r.status === "LOW_CONFIDENCE") {
      return cap(name, r.text, "Contenu texte vide.");
    }
    if (r.status === "OCR_REQUIRED") return { name, text: "", note: "Document scanné / image — texte non lisible sans OCR.", truncated: false };
    if (r.status === "UNSUPPORTED") return { name, text: "", note: `Format « .${ext || "?"} » non pris en charge pour la lecture.`, truncated: false };
    return { name, text: "", note: "Fichier illisible.", truncated: false };
  } catch {
    return { name, text: "", note: "Lecture du fichier impossible.", truncated: false };
  }
}

/**
 * Assemble le bloc de contexte injecté dans le message de l'utilisateur à partir des textes
 * extraits (plafond GLOBAL pour ne pas gonfler le prompt). Renvoie null si rien d'exploitable.
 */
const TOTAL_CHARS = 90_000;

export function buildAttachmentContext(items: AttachmentText[]): string | null {
  if (items.length === 0) return null;
  const blocks: string[] = [];
  let used = 0;
  for (const it of items) {
    const header = `### Pièce jointe : ${it.name}`;
    if (it.text) {
      const remaining = TOTAL_CHARS - used;
      if (remaining <= 0) { blocks.push(`${header}\n(non inclus : limite de contexte atteinte)`); continue; }
      const body = it.text.length > remaining ? `${it.text.slice(0, remaining)}\n…(tronqué)` : it.text;
      used += body.length;
      blocks.push(`${header}${it.truncated ? " (aperçu tronqué)" : ""}\n${body}`);
    } else {
      blocks.push(`${header}\n(${it.note ?? "contenu non extractible"})`);
    }
  }
  return `Contenu des pièces jointes fournies par l'utilisateur (utilise-le pour répondre) :\n\n${blocks.join("\n\n")}`;
}
