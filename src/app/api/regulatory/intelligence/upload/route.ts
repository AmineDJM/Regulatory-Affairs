import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { ingestDossierZip } from "@/lib/regulatory/intelligence/ingest/ingest-dossier";
import { DEFAULT_ZIP_LIMITS } from "@/lib/regulatory/intelligence/ingest/zip-inspector";

/**
 * Téléversement d'un dossier CTD (**ZIP**) — Regulatory Intelligence OS.
 * Route en **flux** (pas la limite 1 Mo des Server Actions) → gros dossiers acceptés.
 * Robustesse : garde MÉMOIRE (rejet AVANT lecture des octets si l'archive dépasse la
 * limite), vérification du type ZIP, isolation multi-locataire (le dossier doit appartenir
 * à l'organisation activée), puis ingestion sécurisée (voir ingest-dossier).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) {
    return NextResponse.json({ error: "Téléversement non autorisé." }, { status: 403 });
  }

  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) {
    return NextResponse.json({ error: "Module non activé pour cette entité — sélectionnez l'entité concernée." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête illisible (archive trop volumineuse ou corrompue ?)." }, { status: 400 });
  }

  const dossierId = String(form.get("dossierId") ?? "");
  const label = form.get("label") ? String(form.get("label")).slice(0, 200) : null;
  const file = form.get("file");

  if (!dossierId) return NextResponse.json({ error: "Dossier manquant." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucune archive fournie." }, { status: 400 });
  }

  // Isolation : le dossier doit appartenir à l'organisation cible.
  const dossier = await prisma.regulatoryDossier.findFirst({ where: { id: dossierId, companyId }, select: { id: true } });
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });

  // Garde MÉMOIRE : rejette d'après la taille déclarée, AVANT de charger les octets en RAM.
  const maxMb = Math.round(DEFAULT_ZIP_LIMITS.maxArchiveBytes / (1024 * 1024));
  if (file.size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) {
    return NextResponse.json({ error: `Archive trop volumineuse (${Math.round(file.size / 1048576)} Mo > ${maxMb} Mo).` }, { status: 413 });
  }

  const name = file.name || "dossier.zip";
  const looksZip = /\.zip$/i.test(name) || ["application/zip", "application/x-zip-compressed", "application/octet-stream"].includes(file.type);
  if (!looksZip) {
    return NextResponse.json({ error: "Le dossier CTD doit être fourni au format ZIP (.zip)." }, { status: 415 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Lecture de l'archive impossible." }, { status: 400 });
  }

  const result = await ingestDossierZip({ companyId, dossierId, actorId: user.id, filename: name, buffer, label });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, rejectionCode: result.rejectionCode }, { status: 422 });
  }
  return NextResponse.json({ ok: true, versionId: result.versionId, versionNo: result.versionNo, summary: result.summary });
}
