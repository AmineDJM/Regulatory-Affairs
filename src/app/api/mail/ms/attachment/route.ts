import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { mailAccess } from "@/lib/mail/access";
import { getActiveConnection } from "@/lib/mail/connection";
import { MicrosoftGraphMailProvider } from "@/lib/mail/graph/provider";

export const dynamic = "force-dynamic";

/**
 * UNE PIÈCE JOINTE, SERVIE PAR L'APPLICATION — jamais par Microsoft directement.
 *
 * Deux règles tenues ici :
 *   • **rien ne s'exécute** : le type est neutralisé et la réponse porte un
 *     `Content-Disposition: attachment`. Un `.html` ou un `.svg` reçu par mail ne doit pas
 *     pouvoir s'exécuter dans le domaine de l'ERP — il y lirait la session ;
 *   • **la visionneuse interne d'abord** : le parcours mis en avant reste « ouvrir dans
 *     AMD Internal OS » et « enregistrer dans le Drive ». Cette route sert les deux.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const access = mailAccess(user as never, process.env as Record<string, string | undefined>);
  if (!access.allowed) return new NextResponse(null, { status: 403 });

  const messageId = req.nextUrl.searchParams.get("message");
  const attachmentId = req.nextUrl.searchParams.get("attachment");
  if (!messageId || !attachmentId) return new NextResponse(null, { status: 400 });

  try {
    const conn = await getActiveConnection(user.id);
    if (!conn) return new NextResponse(null, { status: 409 });
    const p = new MicrosoftGraphMailProvider(conn.accessToken, conn.address);
    const att = await p.getAttachment(messageId, attachmentId);

    // Seuls les types que la visionneuse sait afficher SANS exécuter sont rendus tels quels.
    const inlineOk = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)$/i.test(att.contentType);
    return new NextResponse(new Uint8Array(att.content), {
      headers: {
        "Content-Type": inlineOk ? att.contentType : "application/octet-stream",
        "Content-Disposition": `${inlineOk ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(att.name)}`,
        "Content-Length": String(att.content.length),
        "Cache-Control": "private, no-store",
        // Ceinture et bretelles : même si le type passait, le navigateur ne doit pas deviner.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
