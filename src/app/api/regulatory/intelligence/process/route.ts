import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { runDueRegulatoryJobs } from "@/lib/regulatory/intelligence/jobs/runner";

/**
 * Déclenche un passage du runner de jobs (extraction, etc.) à la demande — pour ne pas
 * attendre le planificateur (≤ 1 min). Borné par le runner. Le planificateur reste le
 * filet de sécurité (reprise, lots suivants).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.analyse")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return NextResponse.json({ error: "Module non activé." }, { status: 403 });

  await runDueRegulatoryJobs();
  return NextResponse.json({ ok: true });
}
