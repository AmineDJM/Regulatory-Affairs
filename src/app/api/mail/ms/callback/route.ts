import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { resolveMicrosoftConfig, GRAPH_BASE } from "@/lib/mail/config";
import { exchangeCode, verifyState } from "@/lib/mail/oauth";
import { saveConnection } from "@/lib/mail/connection";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PKCE_COOKIE = "amd_ms_pkce";

/**
 * RETOUR DE MICROSOFT.
 *
 * Trois vérifications avant d'enregistrer quoi que ce soit, et aucune n'est décorative :
 *   1. le `state` est **signé** et récent — sinon un lien de retour forgé permettrait de brancher
 *      la boîte d'un attaquant sur le compte d'un collègue, qui enverrait alors des mails en son
 *      nom sans jamais s'en apercevoir ;
 *   2. le `state` désigne **la personne connectée** — un `state` valide volé à quelqu'un d'autre
 *      ne sert à rien ;
 *   3. le vérificateur PKCE vient du cookie de CE navigateur — un code intercepté est inutilisable
 *      ailleurs.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  const env = process.env as Record<string, string | undefined>;
  const base = env.APP_URL || req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(new URL(`/messagerie?${q}`, base));

  const error = req.nextUrl.searchParams.get("error");
  if (error) return back(`erreur=refus`); // l'utilisateur a refusé, ou Microsoft a refusé : même écran

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateUser = verifyState(state);
  if (!code || !stateUser || stateUser !== user.id) return back("erreur=state");

  const verifier = cookies().get(PKCE_COOKIE)?.value;
  if (!verifier) return back("erreur=state");
  cookies().delete(PKCE_COOKIE);

  const cfg = resolveMicrosoftConfig(env);
  if (!cfg) return back("erreur=not-configured");

  try {
    const tokens = await exchangeCode(cfg, code, verifier);

    // Qui vient d'être connecté ? On le demande à Microsoft plutôt que de le déduire : c'est la
    // seule source fiable, et l'adresse affichée doit être celle de la boîte réellement servie.
    const meRes = await fetch(`${GRAPH_BASE}/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
    const me = (await meRes.json().catch(() => ({}))) as Record<string, unknown>;
    const address = String(me.mail ?? me.userPrincipalName ?? "").trim();
    if (!address) return back("erreur=profil");

    await saveConnection({
      userId: user.id,
      address,
      displayName: me.displayName ? String(me.displayName) : null,
      homeAccountId: me.id ? String(me.id) : null,
      tokens,
    });
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Messagerie",
      summary: `Boîte Microsoft connectée (${address})`,
    });
    return back("connecte=1");
  } catch {
    // Aucun détail dans l'URL : un message d'erreur de Microsoft peut contenir des éléments
    // de la requête, et une URL se partage par copier-coller.
    return back("erreur=echec");
  }
}
