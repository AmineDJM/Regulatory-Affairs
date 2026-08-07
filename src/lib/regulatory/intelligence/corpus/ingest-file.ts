import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractText } from "../extract/extract-text";
import { splitIntoSections } from "./import";
import {
  CORPUS_IMPORT_EXTS, extOf, titleFromFilename, codeFromTitle,
  type FileIngestResult,
} from "./import-formats";

// Réexport pour les appelants SERVEUR : la définition vit dans le module pur (voir
// `import-formats.ts`), pour qu'un composant client puisse la lire sans embarquer Prisma.
export { CORPUS_IMPORT_EXTS, extOf, titleFromFilename, codeFromTitle } from "./import-formats";
export type { FileIngestResult, FileIngestStatus } from "./import-formats";

/**
 * INGESTION D'UN TEXTE RÉGLEMENTAIRE DEPUIS UN FICHIER.
 *
 * Le corpus ne se remplissait que par TÉLÉCHARGEMENT depuis le catalogue. Or beaucoup de textes
 * ne sont pas en ligne : arrêtés remis en main propre, notes de l'agence, monographies achetées,
 * documents reçus par courrier. Ils n'avaient aucune porte d'entrée.
 *
 * Les deux principes de l'ingestion catalogue s'appliquent à l'identique — les changer ici aurait
 * créé deux corpus aux règles différentes :
 *
 *   1. **Rien ne s'active tout seul.** Une version importée arrive en `DRAFT`. Elle ne devient
 *      opposable qu'après activation humaine. Un texte qui fait foi ne s'auto-proclame pas.
 *   2. **L'empreinte décide.** Même contenu ⇒ rien n'est créé. Réimporter cinquante fichiers dont
 *      quarante sont déjà connus ne coûte rien et ne pollue pas le RAG.
 *
 * Un fichier à la fois, volontairement : c'est ce qui borne la mémoire (un seul document vit à
 * l'instant t) et ce qui permet de dire, pour CHACUN des cinquante fichiers, ce qui lui est
 * arrivé. Un import en masse qui rend « 47 réussis » sans dire lesquels ont échoué est
 * inexploitable — on ne sait pas quoi recommencer.
 */

/** Taille maximale d'un fichier importé (Mo) — un texte réglementaire reste raisonnable. */
const MAX_MB = Number(process.env.REG_CORPUS_MAX_MB ?? 120);

export interface ImportFileInput {
  filename: string;
  buffer: Buffer;
  /** Autorité émettrice (ANPP, ICH, EMA, EDQM…) — sert au filtrage du RAG. */
  authority?: string | null;
  jurisdiction?: string | null;
  /** Titre imposé ; à défaut, déduit du nom de fichier. */
  title?: string | null;
  userId?: string | null;
}

export async function ingestCorpusFile(input: ImportFileInput): Promise<FileIngestResult> {
  const filename = input.filename.trim();
  const ext = extOf(filename);

  if (!(CORPUS_IMPORT_EXTS as readonly string[]).includes(ext)) {
    return { filename, status: "FAILED", error: `Format « ${ext || "inconnu"} » non pris en charge (PDF, DOCX, TXT, MD, HTML, XLSX).` };
  }
  if (input.buffer.length > MAX_MB * 1024 * 1024) {
    return { filename, status: "FAILED", error: `${Math.round(input.buffer.length / 1048576)} Mo — au-delà de la limite de ${MAX_MB} Mo.` };
  }

  // 1) Texte. Un PDF scanné rend un texte vide : on le DIT plutôt que de créer une version creuse
  //    qui gonflerait le corpus sans jamais rien apporter à une recherche.
  const extracted = await extractText(ext, input.buffer);
  const text = (extracted.text ?? "").trim();
  if (extracted.status === "OCR_REQUIRED" || (text.length < 500 && extracted.status !== "TEXT_EXTRACTED")) {
    return {
      filename, status: "FAILED",
      error: extracted.status === "OCR_REQUIRED"
        ? "Document image (scanné) : le corpus attend un texte sélectionnable. Océrisez-le d'abord."
        : `Texte illisible ou trop court (${text.length} caractères).`,
    };
  }
  if (text.length < 500) {
    return { filename, status: "FAILED", error: `Texte trop court (${text.length} caractères) — un texte réglementaire en fait davantage.` };
  }

  const title = (input.title ?? "").trim() || titleFromFilename(filename);
  const code = codeFromTitle(title);
  // L'empreinte porte sur le TEXTE, pas sur le fichier : le même arrêté réenregistré en PDF a un
  // octet près différent mais dit exactement la même chose.
  const hash = createHash("sha256").update(text, "utf8").digest("hex");

  try {
    const existing = await prisma.regulatorySource.findFirst({ where: { code }, select: { id: true } });
    const source = existing
      ? await prisma.regulatorySource.update({
          where: { id: existing.id },
          data: { title, ...(input.authority ? { authority: input.authority } : {}), ...(input.jurisdiction ? { jurisdiction: input.jurisdiction } : {}) },
          select: { id: true },
        })
      : await prisma.regulatorySource.create({
          data: {
            authority: input.authority || "INTERNE",
            jurisdiction: input.jurisdiction || "DZ",
            code, title, language: "fr",
            sourceUrl: null, createdById: input.userId ?? null,
          },
          select: { id: true },
        });

    const latest = await prisma.regulatorySourceVersion.findFirst({
      where: { sourceId: source.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, hash: true },
    });
    if (latest?.hash === hash) {
      return { filename, status: "UNCHANGED", sourceVersionId: latest.id, chars: text.length };
    }

    const version = await prisma.regulatorySourceVersion.create({
      data: {
        sourceId: source.id,
        version: new Date().toISOString().slice(0, 10),
        status: "DRAFT", // jamais opposable sans activation humaine
        hash,
        originalText: text.slice(0, 5_000_000),
        supersedesId: latest?.id ?? null,
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    const sections = splitIntoSections(text);
    if (sections.length > 0) {
      await prisma.regulatorySourceSection.createMany({
        data: sections.map((s) => ({
          sourceVersionId: version.id, path: s.path, heading: s.heading, text: s.text, ordinal: s.ordinal,
        })),
      });
    }

    return { filename, status: "INGESTED", sourceVersionId: version.id, sections: sections.length, chars: text.length };
  } catch (e) {
    console.error("[corpus] import de fichier impossible", filename, e);
    return { filename, status: "FAILED", error: "Enregistrement en base impossible." };
  }
}
