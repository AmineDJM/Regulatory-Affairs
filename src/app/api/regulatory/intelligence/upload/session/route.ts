import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { startUploadSession, startDirectUploadSession, objectStorageConfigured, DEFAULT_PART_SIZE, SMALL_FILE_THRESHOLD, MAX_TOTAL_BYTES, UPLOAD_CONCURRENCY } from "@/lib/regulatory/intelligence/upload/session";

/**
 * Ouverture d'une SESSION d'upload résumable (G14) — pour les gros dossiers CTD.
 * Les petits fichiers (< seuil) restent servis par la route directe /upload.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Téléversement non autorisé." }, { status: 403 });
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return NextResponse.json({ error: "Module non activé pour cette entité." }, { status: 403 });

  let body: { dossierId?: string; filename?: string; totalBytes?: number; partSize?: number; sha256?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (!body.dossierId || !body.filename || !body.totalBytes) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });

  // CHANTIER 1 — si un stockage objet est configuré, on route vers l'envoi DIRECT (navigateur →
  // bucket, bypass serveur + Postgres). Sinon, envoi résumable en base (comportement historique).
  if (objectStorageConfigured()) {
    const d = await startDirectUploadSession({
      companyId, dossierId: body.dossierId, createdById: user.id, filename: body.filename,
      contentType: body.contentType ?? null, totalBytes: Number(body.totalBytes), expectedSha256: body.sha256 ?? null,
    });
    if (!d.ok) return NextResponse.json({ error: d.error }, { status: 422 });
    // MULTIPART : le navigateur reçoit une URL présignée PAR PARTIE et les envoie EN PARALLÈLE.
    // C'est ce qui fait la différence de débit sur un gros dossier — un flux unique n'utilise
    // qu'une fraction du lien disponible.
    if (d.partUrls?.length) {
      return NextResponse.json({
        ok: true, mode: "direct-multipart", sessionId: d.sessionId,
        partUrls: d.partUrls, partSize: d.partSize, concurrency: d.concurrency, maxTotalBytes: MAX_TOTAL_BYTES,
      });
    }
    return NextResponse.json({ ok: true, mode: "direct", sessionId: d.sessionId, uploadUrl: d.uploadUrl, maxTotalBytes: MAX_TOTAL_BYTES });
  }

  const r = await startUploadSession({
    companyId, dossierId: body.dossierId, createdById: user.id, filename: body.filename,
    contentType: body.contentType ?? null, totalBytes: Number(body.totalBytes), partSize: body.partSize, expectedSha256: body.sha256 ?? null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true, mode: "resumable", sessionId: r.sessionId, partSize: r.partSize, expectedParts: r.expectedParts, receivedIndices: r.receivedIndices ?? [], resumed: r.resumed ?? false, concurrency: UPLOAD_CONCURRENCY, smallFileThreshold: SMALL_FILE_THRESHOLD, defaultPartSize: DEFAULT_PART_SIZE, maxTotalBytes: MAX_TOTAL_BYTES });
}
