import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMailAccount, getAttachment } from "@/lib/mail";

export const dynamic = "force-dynamic";

/** Télécharge une pièce jointe d'un e-mail. Serveur uniquement (IMAP). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const account = await getMailAccount(user.id);
  if (!account) return NextResponse.json({ error: "Aucune boîte connectée" }, { status: 404 });

  const mailbox = req.nextUrl.searchParams.get("mailbox") || "INBOX";
  const uid = Number(req.nextUrl.searchParams.get("uid"));
  const index = Number(req.nextUrl.searchParams.get("index") || 0);
  if (!uid) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  try {
    const att = await getAttachment(account, mailbox, uid, index);
    if (!att) return NextResponse.json({ error: "Pièce jointe introuvable" }, { status: 404 });
    return new NextResponse(att.content as unknown as BodyInit, {
      headers: {
        "Content-Type": att.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(att.filename)}"`,
      },
    });
  } catch (e) {
    console.error("[mail] attachment failed", e);
    return NextResponse.json({ error: "Téléchargement impossible." }, { status: 502 });
  }
}
