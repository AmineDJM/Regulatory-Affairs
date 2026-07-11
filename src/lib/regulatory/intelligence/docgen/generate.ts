import type { RegFactStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { regAudit } from "../audit";
import { PROCEDURE_TYPE_LABELS } from "../labels";
import { templateByCode } from "./templates";
import { renderTemplate } from "./build-docx";

/**
 * GÉNÉRATION DOCUMENTAIRE (G10) — produit un .docx à partir d'un template versionné et des
 * données du jumeau numérique **APPROUVÉ** UNIQUEMENT (faits CONFIRMED/CORRECTED, valeur
 * approuvée si présente). Aucune extraction libre : ce qui n'est pas approuvé n'est pas inséré
 * (marqueur « [À COMPLÉTER] »). Le document produit est stocké chiffré + tracé.
 */

const APPROVED: RegFactStatus[] = ["CONFIRMED", "CORRECTED"];

export interface GenerateResult {
  ok: boolean;
  error?: string;
  generatedDocId?: string;
  filename?: string;
  used?: number;
  missing?: number;
}

/** Dictionnaire des faits APPROUVÉS du jumeau numérique (clé → valeur approuvée). */
async function approvedFactMap(dossierVersionId: string): Promise<Record<string, string>> {
  const facts = await prisma.regulatoryFact.findMany({
    where: { dossierVersionId, status: { in: APPROVED } },
    select: { factKey: true, value: true, approvedValue: true },
  });
  const map: Record<string, string> = {};
  for (const f of facts) {
    const v = (f.approvedValue ?? f.value ?? "").trim();
    if (v) map[f.factKey] = v;
  }
  return map;
}

export async function generateDocument(opts: { dossierVersionId: string; templateCode: string; actorId: string }): Promise<GenerateResult> {
  const template = templateByCode(opts.templateCode);
  if (!template) return { ok: false, error: "Template inconnu." };

  const version = await prisma.regulatoryDossierVersion.findUnique({
    where: { id: opts.dossierVersionId },
    select: { id: true, dossier: { select: { id: true, companyId: true, reference: true, title: true, procedureType: true } } },
  });
  if (!version) return { ok: false, error: "Version introuvable." };

  const factMap = await approvedFactMap(opts.dossierVersionId);
  const now = new Date();
  const data: Record<string, string> = {
    ...factMap,
    DATE: now.toLocaleDateString("fr-FR"),
    DOSSIER_REF: version.dossier.reference,
    DOSSIER_TITLE: version.dossier.title,
    PROCEDURE: PROCEDURE_TYPE_LABELS[version.dossier.procedureType] ?? String(version.dossier.procedureType),
  };

  const { buffer, used, missing } = renderTemplate(template, data);
  const stored = await putBlob(buffer);
  const filename = `${template.code}_${version.dossier.reference}_${now.toISOString().slice(0, 10)}.docx`.replace(/[^\w.\-]+/g, "_");

  const doc = await prisma.regulatoryGeneratedDoc.create({
    data: {
      dossierVersionId: opts.dossierVersionId, templateCode: template.code, templateVersion: template.version,
      filename, blobId: stored.blobId, sizeBytes: stored.size, factsUsed: used.length, factsMissing: missing.length, generatedById: opts.actorId,
    },
    select: { id: true },
  });

  await regAudit({
    companyId: version.dossier.companyId, actorId: opts.actorId, dossierId: version.dossier.id, dossierVersionId: opts.dossierVersionId,
    action: "DOC_GENERATED",
    detail: `Document « ${template.name} » (v${template.version}) généré depuis le jumeau approuvé : ${used.length} donnée(s) utilisée(s), ${missing.length} à compléter.`,
    meta: { templateCode: template.code, used, missing },
  });

  return { ok: true, generatedDocId: doc.id, filename, used: used.length, missing: missing.length };
}
