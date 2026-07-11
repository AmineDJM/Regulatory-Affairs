import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { regAudit } from "../audit";
import { extractText } from "../extract/extract-text";
import { ocrDocument, canOcr } from "../ocr/ocr-engine";
import { decomposeReserveText } from "./decompose";

/**
 * INGESTION D'UNE LETTRE DE RÉSERVES ANPP (G9) — stocke la lettre chiffrée, en extrait le
 * texte (couche texte native si présente, sinon OCR RÉEL), le décompose en POINTS catégorisés
 * (extraits VERBATIM), et ouvre un nouveau CYCLE de réserves. Traçable.
 */

export interface ReserveIngestResult {
  ok: boolean;
  error?: string;
  cycleId?: string;
  cycle?: number;
  points?: number;
  ocrConfidence?: number;
  needsReview?: boolean;
}

export async function ingestReserveLetter(opts: {
  companyId: string; dossierId: string; actorId: string; filename: string; ext: string; buffer: Buffer;
}): Promise<ReserveIngestResult> {
  const dossier = await prisma.regulatoryDossier.findFirst({ where: { id: opts.dossierId, companyId: opts.companyId }, select: { id: true } });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  // 1) Extraction : couche texte native (PDF/DOCX) sinon OCR réel (scan/image).
  let text = "";
  let ocrConfidence: number | null = null;
  let needsReview = false;
  try {
    const native = await extractText(opts.ext, opts.buffer);
    if (native.status === "TEXT_EXTRACTED" && native.text.trim().length > 40) {
      text = native.text;
    } else if (canOcr(opts.ext)) {
      const ocr = await ocrDocument({ ext: opts.ext, buffer: opts.buffer });
      text = ocr.text;
      ocrConfidence = ocr.meanConfidence;
      needsReview = ocr.needsReview;
    }
  } catch {
    needsReview = true;
  }

  const stored = await putBlob(opts.buffer);
  const cycleNo = (await prisma.regulatoryReserveCycle.count({ where: { dossierId: opts.dossierId } })) + 1;
  const points = decomposeReserveText(text);

  const cycle = await prisma.regulatoryReserveCycle.create({
    data: {
      dossierId: opts.dossierId, cycle: cycleNo, letterFilename: opts.filename.slice(0, 255), letterBlobId: stored.blobId,
      ocrText: text.slice(0, 500_000) || null, ocrConfidence, ocrNeedsReview: needsReview,
      createdById: opts.actorId,
      points: { createMany: { data: points.map((p) => ({ ordinal: p.ordinal, category: p.category, verbatim: p.verbatim })) } },
    },
    select: { id: true },
  });

  await regAudit({
    companyId: opts.companyId, actorId: opts.actorId, dossierId: opts.dossierId,
    action: "RESERVE_LETTER_INGESTED",
    detail: `Lettre de réserves (cycle ${cycleNo}) « ${opts.filename} » : ${points.length} point(s) décomposé(s)${ocrConfidence != null ? ` — OCR confiance ${ocrConfidence}%` : ""}${needsReview ? " (revue humaine requise)" : ""}.`,
  });

  return { ok: true, cycleId: cycle.id, cycle: cycleNo, points: points.length, ocrConfidence: ocrConfidence ?? undefined, needsReview };
}
