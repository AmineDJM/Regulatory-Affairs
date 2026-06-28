import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMailAccount, loadInbox, friendlyMailError } from "@/lib/mail";

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
    // Une seule connexion IMAP (messages + dossiers) → moins de pression sur le fournisseur.
    const { messages, mailboxes } = await loadInbox(account, mailbox, limit, withFolders);
    return NextResponse.json({ email: account.email, mailbox, messages, mailboxes });
  } catch (e) {
    console.error("[mail] list failed", e);
    return NextResponse.json({ error: friendlyMailError(e) }, { status: 502 });
  }
}
