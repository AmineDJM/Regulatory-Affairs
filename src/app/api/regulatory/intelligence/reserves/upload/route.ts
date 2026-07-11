import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { ingestReserveLetter } from "@/lib/regulatory/intelligence/reserves/ingest";

/**
 * Upload d'une LETTRE DE RÉSERVES ANPP (G9) — OCR réel + décomposition en points.
 * En flux (pas la limite 1 Mo des Server Actions) ; org-scopé + permission.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.reserve.manage")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return NextResponse.json({ error: "Module non activé." }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Requête illisible." }, { status: 400 }); }
  const dossierId = String(form.get("dossierId") ?? "");
  const file = form.get("file");
  if (!dossierId) return NextResponse.json({ error: "Dossier manquant." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
  if (file.size > 50 * 1048576) return NextResponse.json({ error: "Lettre trop volumineuse (max 50 Mo)." }, { status: 413 });

  const name = file.name || "reserves.pdf";
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  const r = await ingestReserveLetter({ companyId, dossierId, actorId: user.id, filename: name, ext, buffer });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json(r);
}
