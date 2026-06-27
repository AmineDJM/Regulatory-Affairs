import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMailAccount, getMessage } from "@/lib/mail";

export const dynamic = "force-dynamic";

/** Détail d'un message (corps + pièces jointes). Serveur uniquement (IMAP). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const account = await getMailAccount(user.id);
  if (!account) return NextResponse.json({ error: "Aucune boîte connectée" }, { status: 404 });

  const mailbox = req.nextUrl.searchParams.get("mailbox") || "INBOX";
  const uid = Number(req.nextUrl.searchParams.get("uid"));
  if (!uid) return NextResponse.json({ error: "Message introuvable" }, { status: 400 });
  try {
    const message = await getMessage(account, mailbox, uid);
    if (!message) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    return NextResponse.json({ message });
  } catch (e) {
    console.error("[mail] read failed", e);
    return NextResponse.json({ error: (e as Error)?.message ?? "Lecture impossible." }, { status: 502 });
  }
}
