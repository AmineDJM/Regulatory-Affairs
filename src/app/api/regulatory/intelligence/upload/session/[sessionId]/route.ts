import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { uploadSessionStatus, abortUploadSession } from "@/lib/regulatory/intelligence/upload/session";

/** État d'une session (reprise) + abandon. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function scope(req: NextRequest): Promise<{ companyId: string } | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Non authentifié.", status: 401 };
  if (!regCan(user, "regulatory.dossier.upload")) return { error: "Non autorisé.", status: 403 };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { error: "Module non activé.", status: 403 };
  return { companyId };
}

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const s = await scope(req);
  if ("error" in s) return NextResponse.json({ error: s.error }, { status: s.status });
  const r = await uploadSessionStatus(params.sessionId, s.companyId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 404 });
  return NextResponse.json(r);
}

export async function DELETE(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const s = await scope(req);
  if ("error" in s) return NextResponse.json({ error: s.error }, { status: s.status });
  await abortUploadSession(params.sessionId, s.companyId);
  return NextResponse.json({ ok: true });
}
