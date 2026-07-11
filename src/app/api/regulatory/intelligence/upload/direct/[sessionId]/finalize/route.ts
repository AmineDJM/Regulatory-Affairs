import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { finalizeDirectUploadSession } from "@/lib/regulatory/intelligence/upload/session";

/**
 * Finalisation d'un ENVOI DIRECT (chantier 1) : le fichier est déjà dans le bucket (PUT présigné
 * navigateur → S3/R2). Le serveur le LIT, l'inspecte et l'ingère, puis supprime l'archive temporaire.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    const companyId = await resolveRegCompanyId(getCompanyScope());
    if (!companyId) return NextResponse.json({ error: "Module non activé." }, { status: 403 });

    const r = await finalizeDirectUploadSession(params.sessionId, companyId, user.id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ ok: true, summary: r.ingest?.summary ?? null });
  } catch (err) {
    console.error("[reg-upload/direct/finalize] erreur non gérée", err);
    return NextResponse.json({ error: "Erreur serveur à la finalisation de l'envoi direct." }, { status: 500 });
  }
}
