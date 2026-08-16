import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { mailAccess } from "@/lib/mail/access";
import { getActiveConnection, writeFolderState } from "@/lib/mail/connection";
import { MicrosoftGraphMailProvider } from "@/lib/mail/graph/provider";
import { MailError } from "@/lib/mail/provider";
import { sortFolders } from "@/lib/mail/folders";

export const dynamic = "force-dynamic";

/**
 * LES DONNÉES DE L'ÉCRAN — dossiers, liste, message, conversation.
 *
 * Une seule route, quatre vues, parce que toutes partagent exactement les mêmes trois contrôles :
 * session → droit d'accès → connexion **de cette personne**. Multiplier les routes multiplierait
 * les endroits où l'un des trois peut manquer.
 *
 * Aucun paramètre ne désigne une boîte : elle vient du jeton de la session. Changer un identifiant
 * dans l'URL ne donne accès à rien d'autre que ses propres messages.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const access = mailAccess(user as never, process.env as Record<string, string | undefined>);
  if (!access.allowed) return NextResponse.json({ error: "Non autorisé.", reason: access.reason }, { status: 403 });

  try {
    const conn = await getActiveConnection(user.id);
    if (!conn) return NextResponse.json({ error: "Aucune boîte connectée.", needsConnect: true }, { status: 409 });

    const p = new MicrosoftGraphMailProvider(conn.accessToken, conn.address);
    const view = req.nextUrl.searchParams.get("view") ?? "folders";

    if (view === "folders") {
      const folders = sortFolders(await p.listFolders());
      // Les compteurs servent aussi hors ligne (badge du menu) : on les garde, sans les messages.
      for (const f of folders) {
        await writeFolderState({
          connectionId: conn.id, folderId: f.id, displayName: f.name,
          wellKnown: f.wellKnown, unread: f.unread, total: f.total,
        });
      }
      return NextResponse.json({ address: conn.address, folders });
    }

    if (view === "messages") {
      const folderId = req.nextUrl.searchParams.get("folder") ?? "inbox";
      const cursor = req.nextUrl.searchParams.get("cursor");
      const search = req.nextUrl.searchParams.get("q");
      const page = await p.listMessages({ folderId, cursor, search, limit: 40 });
      return NextResponse.json(page);
    }

    if (view === "message") {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Message manquant." }, { status: 400 });
      return NextResponse.json({ message: await p.getMessage(id) });
    }

    if (view === "conversation") {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Conversation manquante." }, { status: 400 });
      return NextResponse.json({ items: await p.getConversation(id) });
    }

    return NextResponse.json({ error: "Vue inconnue." }, { status: 400 });
  } catch (e) {
    if (e instanceof MailError) {
      const status = e.kind === "unauthorized" ? 401 : e.kind === "throttled" ? 429 : e.kind === "forbidden" ? 403 : 502;
      return NextResponse.json({ error: e.message, kind: e.kind, needsReconnect: e.kind === "unauthorized" }, { status });
    }
    console.error("[mail] lecture en échec", e instanceof Error ? e.name : typeof e);
    return NextResponse.json({ error: "La messagerie n'a pas pu répondre." }, { status: 502 });
  }
}
