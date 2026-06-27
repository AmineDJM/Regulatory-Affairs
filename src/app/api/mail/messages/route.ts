import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMailAccount, listMessages, listMailboxes } from "@/lib/mail";

export const dynamic = "force-dynamic";

/** Liste des messages d'une boîte + dossiers. Serveur uniquement (IMAP). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const account = await getMailAccount(user.id);
  if (!account) return NextResponse.json({ error: "Aucune boîte connectée", noAccount: true }, { status: 404 });

  const mailbox = req.nextUrl.searchParams.get("mailbox") || "INBOX";
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") || 30));
  const withFolders = req.nextUrl.searchParams.get("folders") === "1";
  try {
    const [messages, mailboxes] = await Promise.all([
      listMessages(account, mailbox, limit),
      withFolders ? listMailboxes(account) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ email: account.email, mailbox, messages, mailboxes });
  } catch (e) {
    console.error("[mail] list failed", e);
    return NextResponse.json({ error: (e as Error)?.message ?? "Connexion à la boîte impossible." }, { status: 502 });
  }
}
