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
  const limit = Math.min(500, Number(req.nextUrl.searchParams.get("limit") || 50));
  const withFolders = req.nextUrl.searchParams.get("folders") === "1";
  const search = req.nextUrl.searchParams.get("search")?.trim() || undefined;
  try {
    // Une seule connexion IMAP (messages + dossiers) → moins de pression sur le fournisseur.
    // `stale` = servi depuis le cache (Infomaniak momentanément saturé) → la boîte reste consultable.
    const { messages, mailboxes, stale, syncedAt } = await loadInbox(account, mailbox, limit, withFolders, search);
    return NextResponse.json({ email: account.email, mailbox, messages, mailboxes, stale: stale ?? false, syncedAt });
  } catch (e) {
    console.error("[mail] list failed", e);
    return NextResponse.json({ error: friendlyMailError(e) }, { status: 502 });
  }
}
