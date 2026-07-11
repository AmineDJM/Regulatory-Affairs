import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { putUploadPart } from "@/lib/regulatory/intelligence/upload/session";

/**
 * Envoi d'UNE partie d'une session d'upload (G14). Corps = octets bruts de la partie ;
 * `?index=N` = numéro de partie. Idempotent → reprise/retente possible. Le chemin d'upload
 * ne charge qu'UNE partie en mémoire (jamais l'archive complète).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function PUT(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return NextResponse.json({ error: "Module non activé." }, { status: 403 });

  const index = Number(req.nextUrl.searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Index de partie invalide." }, { status: 400 });

  let data: Buffer;
  try {
    data = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Lecture de la partie impossible." }, { status: 400 });
  }
  if (data.length === 0) return NextResponse.json({ error: "Partie vide." }, { status: 400 });

  const r = await putUploadPart({ sessionId: params.sessionId, companyId, index, data });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true, receivedBytes: r.receivedBytes, storedParts: r.storedParts });
}
