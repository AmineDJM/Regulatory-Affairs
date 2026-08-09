import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractText } from "../extract/extract-text";
import { canOcr, ocrDocument } from "../ocr/ocr-engine";
import { inspectZip } from "../ingest/zip-inspector";
import { classifyDocument } from "../ctd/classify";
import { detectContainedSections } from "../ctd/detect-sections";
import { extOf, CORPUS_IMPORT_EXTS, type FileIngestResult } from "../corpus/import-formats";

/**
 * INGESTION D'UN DOCUMENT D'ÉTUDE DE CAS — la matière première de l'entraînement.
 *
 * Une étude de cas est un produit PASSÉ : son dossier tel qu'il a été déposé, et l'issue réelle
 * (accepté, accepté avec réserves, rejeté). Le texte de ses pièces devient des PRÉCÉDENTS que
 * l'analyse injecte section par section — « voilà ce que l'agence a réellement dit sur NOS
 * produits » — sans jamais devenir une règle opposable.
 *
 * Mêmes principes que le corpus, pour les mêmes raisons :
 *   • un fichier à la fois (mémoire bornée, verdict par fichier) ;
 *   • l'empreinte décide (réimporter un document connu de la MÊME étude ne crée rien) ;
 *   • un scan illisible est refusé en le disant — pas de précédent creux.
 */

const MAX_MB = Number(process.env.REG_CASE_MAX_MB ?? 120);
/** Texte conservé par pièce — assez pour des précédents riches, borné pour la base. */
const MAX_TEXT = 400_000;

export async function ingestCaseFile(input: {
  caseId: string;
  filename: string;
  buffer: Buffer;
}): Promise<FileIngestResult> {
  const filename = input.filename.trim();
  const ext = extOf(filename);

  if (!(CORPUS_IMPORT_EXTS as readonly string[]).includes(ext)) {
    return { filename, status: "FAILED", error: `Format « ${ext || "inconnu"} » non pris en charge (PDF, DOCX, TXT, MD, HTML, XLSX).` };
  }
  if (input.buffer.length > MAX_MB * 1024 * 1024) {
    return { filename, status: "FAILED", error: `${Math.round(input.buffer.length / 1048576)} Mo — au-delà de la limite de ${MAX_MB} Mo.` };
  }

  const extracted = await extractText(ext, input.buffer);
  let text = (extracted.text ?? "").trim();
  // Un COURRIER ANPP est presque toujours un scan : le refuser reviendrait à exclure la pièce la
  // plus précieuse de l'entraînement. Même OCR réel que les lettres de réserves — et si l'OCR ne
  // rend rien d'exploitable, on refuse en le disant : un précédent illisible n'apprend rien.
  if ((extracted.status === "OCR_REQUIRED" || text.length < 300) && canOcr(ext)) {
    try {
      const ocr = await ocrDocument({ ext, buffer: input.buffer });
      if (ocr.text.trim().length > text.length) text = ocr.text.trim();
    } catch {
      /* OCR indisponible → le verdict « texte trop court » ci-dessous dira quoi corriger */
    }
  }
  if (text.length < 300) {
    return { filename, status: "FAILED", error: `Texte illisible ou trop court (${text.length} caractères), même après OCR.` };
  }

  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  const dup = await prisma.regulatoryCaseDoc.findFirst({
    where: { caseId: input.caseId, sha256 },
    select: { id: true },
  });
  if (dup) return { filename, status: "UNCHANGED", chars: text.length };

  // Repérage CTD déterministe : nom de fichier + début du texte (aucun appel IA — l'entraînement
  // ne coûte rien à ingérer).
  const cls = classifyDocument({ path: filename, filename, ext, textSample: text.slice(0, 8000) });
  const sections = detectContainedSections(text).map((s) => s.code).slice(0, 40);

  const doc = await prisma.regulatoryCaseDoc.create({
    data: {
      caseId: input.caseId,
      filename,
      ctdSection: cls.section,
      sections,
      text: text.slice(0, MAX_TEXT),
      sha256,
    },
    select: { id: true },
  });

  return { filename, status: "INGESTED", sourceVersionId: doc.id, sections: sections.length, chars: text.length };
}

/**
 * INGESTION D'UNE ARCHIVE ZIP d'étude de cas — « je dépose le dossier du produit passé tel quel ».
 *
 * Le ZIP est ouvert par l'INSPECTEUR SÉCURISÉ du module (anti-bombe, anti-traversal, exécutables
 * bloqués, une entrée décompressée à la fois → mémoire bornée), puis chaque pièce passe par la
 * même ingestion qu'un dépôt individuel : mêmes formats, même OCR de repli, même déduplication
 * par empreinte. Le verdict est rendu PIÈCE PAR PIÈCE — un fichier illisible n'invalide pas les
 * autres, et redéposer le même ZIP ne crée rien (tout ressort « déjà connue »).
 */
export async function ingestCaseArchive(input: {
  caseId: string;
  filename: string;
  buffer: Buffer;
}): Promise<FileIngestResult[]> {
  const results: FileIngestResult[] = [];

  const inspection = await inspectZip(input.buffer, {
    onStorableEntry: async (entry, data) => {
      const ext = extOf(entry.filename);
      if (!(CORPUS_IMPORT_EXTS as readonly string[]).includes(ext)) {
        results.push({ filename: entry.path, status: "FAILED", error: `Format « ${ext || "inconnu"} » ignoré (PDF, DOCX, TXT, MD, HTML, CSV, XLSX).` });
        return;
      }
      results.push(await ingestCaseFile({ caseId: input.caseId, filename: entry.filename, buffer: data }));
    },
  });

  if (!inspection.ok) {
    return [{ filename: input.filename, status: "FAILED", error: inspection.rejection?.message ?? "Archive refusée." }];
  }
  // Les entrées BLOQUÉES par l'inspecteur (exécutables…) sont dites, pas passées sous silence.
  for (const e of inspection.entries) {
    if (e.securityStatus.startsWith("BLOCKED") || e.securityStatus === "CORRUPTED") {
      results.push({ filename: e.path, status: "FAILED", error: "Entrée bloquée par l'inspection de sécurité." });
    }
  }
  if (results.length === 0) return [{ filename: input.filename, status: "FAILED", error: "Archive vide ou sans pièce exploitable." }];
  return results;
}
