import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { extractText } from "@/lib/regulatory/intelligence/extract/extract-text";
import { ocrDocument, canOcr, rasterizePdf } from "@/lib/regulatory/intelligence/ocr/ocr-engine";
import { trackedLuna } from "@/lib/regulatory/intelligence/cost/ledger";
import {
  buildTextExtraction, buildVisionExtraction, parseExtraction, normalizeModule,
  type ExtractedLetter,
} from "./library-extract";

/**
 * INGESTION D'UNE LETTRE DE RÉSERVES ANPP, quel qu'en soit le format.
 *
 * Une lettre arrive comme elle peut : PDF numérique, scan de mauvaise qualité, Word, tableau
 * Excel, ou simple texte collé depuis un courriel. Le chemin choisi dépend de ce qu'on a
 * réellement sous la main, dans cet ordre :
 *
 *   1. **Texte exploitable** (PDF numérique, DOCX, XLSX, TXT) → extraction directe, coût minimal.
 *   2. **Scan / PDF sans texte** → OCR *puis* **lecture des pages en IMAGE** par le modèle
 *      multimodal. C'est le point important : sur un scan, l'OCR rend un verbatim approximatif,
 *      et un verbatim approximatif ne vaut rien comme preuve. Le modèle qui REGARDE la page lit
 *      les tampons, les tableaux et la numérotation que l'OCR perd. L'OCR n'est plus qu'une aide.
 *
 * **Dédoublonnage** : l'empreinte SHA-256 du fichier est unique en base. Réimporter deux fois la
 * même lettre ne crée pas deux lots et ne coûte pas deux fois.
 *
 * Ne lève jamais : tout échec revient en résultat structuré.
 */

export interface IngestResult {
  ok: boolean;
  batchId?: string;
  /** Vrai si la lettre avait déjà été importée (rien n'a été recalculé ni refacturé). */
  duplicate?: boolean;
  reserveCount?: number;
  costUsd?: number;
  /** Chemin réellement emprunté — utile pour comprendre un résultat décevant. */
  method?: "text" | "vision" | "ocr-text";
  error?: string;
}

/** Nombre de pages envoyées en image au modèle (au-delà, le coût grimpe sans gain). */
const MAX_VISION_PAGES = 24;

export interface IngestInput {
  filename: string;
  buffer: Buffer;
  createdById: string;
  companyId?: string | null;
  dossierId?: string | null;
  /** Cycle de réserves d'origine, quand l'import vient du traitement d'une lettre. */
  sourceCycleId?: string | null;
}

/** Nature du fichier, telle qu'on la conserve pour la traçabilité. */
function sourceKindOf(ext: string, viaVision: boolean): string {
  if (viaVision) return "SCAN";
  if (ext === "pdf") return "PDF";
  if (ext === "docx" || ext === "doc") return "DOCX";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "XLSX";
  if (ext === "eml" || ext === "msg") return "EMAIL";
  return "TEXT";
}

/** Un texte est-il assez riche pour se passer de la lecture en image ? */
export function textIsUsable(text: string, pageCount: number): boolean {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length < 200) return false;
  // Un scan mal océrisé produit peu de caractères par page et beaucoup de bruit.
  const perPage = pageCount > 0 ? clean.length / pageCount : clean.length;
  if (perPage < 250) return false;
  const letters = (clean.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  return letters / clean.length > 0.55;
}

export async function ingestReserveDocument(input: IngestInput): Promise<IngestResult> {
  const ext = (input.filename.split(".").pop() ?? "").toLowerCase();
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  // ── Déjà importée ? On ne refait rien et on ne repaie rien.
  try {
    const existing = await prisma.anppReserveBatch.findUnique({
      where: { sha256 },
      select: { id: true, extractedCount: true },
    });
    if (existing) return { ok: true, batchId: existing.id, duplicate: true, reserveCount: existing.extractedCount, costUsd: 0 };
  } catch (e) {
    console.error("[reserves] recherche de doublon impossible", e);
  }

  // ── 1) Obtenir du texte, par le chemin le moins coûteux qui marche.
  let rawText = "";
  let pageCount = 0;
  let ocrConfidence: number | null = null;
  let method: IngestResult["method"] = "text";

  try {
    const extracted = await extractText(ext, input.buffer);
    rawText = extracted.text ?? "";
  } catch (e) {
    console.error("[reserves] extraction de texte impossible", e);
  }

  let images: { buffer: Buffer; mime: string }[] = [];
  const needsEyes = !textIsUsable(rawText, pageCount) && canOcr(ext);

  if (needsEyes) {
    // OCR d'abord — il sert d'aide au modèle, et de repli si la vision échoue.
    try {
      const ocr = await ocrDocument({ ext, buffer: input.buffer, langs: ["fra", "ara", "eng"], maxPages: MAX_VISION_PAGES });
      const ocrText = ocr.pages.map((p) => p.text).join("\n").trim();
      pageCount = ocr.pages.length;
      ocrConfidence = ocr.pages.length > 0
        ? ocr.pages.reduce((s, p) => s + (p.confidence ?? 0), 0) / ocr.pages.length
        : null;
      if (ocrText.length > rawText.length) { rawText = ocrText; method = "ocr-text"; }
    } catch (e) {
      console.error("[reserves] OCR impossible", e);
    }

    // Puis les pages EN IMAGE : c'est ce qui donne un verbatim fidèle sur un scan.
    if (ext === "pdf") {
      try {
        const raster = await rasterizePdf(input.buffer, MAX_VISION_PAGES);
        images = raster.pages.map((page) => ({ buffer: page, mime: "image/png" }));
      } catch (e) {
        console.error("[reserves] rastérisation impossible", e);
      }
    } else {
      images = [{ buffer: input.buffer, mime: `image/${ext === "jpg" ? "jpeg" : ext}` }];
    }
    if (images.length > 0) method = "vision";
  }

  if (rawText.trim().length < 40 && images.length === 0) {
    return { ok: false, error: "Ce document ne contient aucun texte exploitable, et ses pages n'ont pas pu être lues." };
  }

  // ── 2) Extraction structurée (schéma JSON strict, coût tracé).
  const call = images.length > 0
    ? buildVisionExtraction(images, input.filename, rawText)
    : buildTextExtraction(rawText, input.filename);

  const res = await trackedLuna<unknown>(
    { dossierId: input.dossierId ?? null, step: "reserve-extract" },
    call,
  );
  if (!res.ok) {
    return { ok: false, error: res.budgetExceeded ? res.error : (res.error ?? "Extraction impossible."), costUsd: res.usage.costUsd };
  }

  let letter: ExtractedLetter;
  try {
    letter = parseExtraction(res.data ?? JSON.parse(res.text));
  } catch {
    return { ok: false, error: "La réponse de l'IA n'a pas pu être lue.", costUsd: res.usage.costUsd };
  }
  if (letter.reserves.length === 0) {
    return { ok: false, error: "Aucune réserve n'a été identifiée dans ce document.", costUsd: res.usage.costUsd };
  }

  // ── 3) Écriture : le lot, puis ses réserves. Le fichier d'origine est conservé chiffré —
  //       la preuve doit rester vérifiable des années plus tard.
  try {
    let blobId: string | null = null;
    try { blobId = (await putBlob(input.buffer)).blobId; } catch (e) { console.error("[reserves] archivage du fichier impossible", e); }

    const batch = await prisma.anppReserveBatch.create({
      data: {
        companyId: input.companyId ?? null,
        dossierId: input.dossierId ?? null,
        sourceCycleId: input.sourceCycleId ?? null,
        sourceFilename: input.filename,
        sourceKind: sourceKindOf(ext, images.length > 0),
        blobId,
        sha256,
        rawText: rawText.slice(0, 2_000_000),
        ocrConfidence,
        pageCount,
        extractedCount: letter.reserves.length,
        createdById: input.createdById,
      },
      select: { id: true },
    });

    await prisma.anppReserve.createMany({
      data: letter.reserves.map((r) => ({
        batchId: batch.id,
        ordinal: r.ordinal,
        productName: letter.productName,
        dci: letter.dci,
        pharmaForm: letter.pharmaForm,
        dosage: letter.dosage,
        procedureType: letter.procedureType,
        supplier: letter.supplier,
        ctdModule: normalizeModule(r.ctdModule),
        ctdSection: r.ctdSection,
        verbatim: r.verbatim,
        category: r.category,
        severity: r.severity,
        targetDocument: r.targetDocument,
        legalBasis: r.legalBasis,
        requestedAction: r.requestedAction,
        evidenceFile: input.filename,
        evidencePage: r.evidencePage,
        evidenceExcerpt: r.evidenceExcerpt,
        extractionConfidence: r.confidence,
      })),
    });

    return {
      ok: true, batchId: batch.id, reserveCount: letter.reserves.length,
      costUsd: res.usage.costUsd, method,
    };
  } catch (e) {
    console.error("[reserves] enregistrement impossible", e);
    return { ok: false, error: "Enregistrement des réserves impossible.", costUsd: res.usage.costUsd };
  }
}
