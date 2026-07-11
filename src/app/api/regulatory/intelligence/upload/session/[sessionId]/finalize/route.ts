import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { finalizeUploadSession } from "@/lib/regulatory/intelligence/upload/session";

/**
 * Finalisation d'une session d'upload (G14) : vérifie taille + SHA-256, assemble les parties,
 * PUIS lance l'ingestion sécurisée (inspection seulement après finalisation).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return NextResponse.json({ error: "Module non activé." }, { status: 403 });

  const r = await finalizeUploadSession(params.sessionId, companyId, user.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true, versionId: r.ingest?.versionId, versionNo: r.ingest?.versionNo, summary: r.ingest?.summary });
}
