import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sessionEditeur, RAISON_EDITEUR } from "@/lib/onlyoffice-session";

export const dynamic = "force-dynamic";

/**
 * La configuration d'ouverture d'un fichier dans l'éditeur Office, pour le composant embarqué dans les fenêtres
 * d'aperçu (Drive, documents, pièces). Les DROITS sont jugés par `sessionEditeur` ; la réponse ne porte que ce que
 * l'éditeur doit savoir (jetons à durée limitée, comme la page d'édition). `Cache-Control: no-store` : un jeton ne se garde pas.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id");
  if ((type !== "drive" && type !== "document") || !id) {
    return NextResponse.json({ error: "Fichier non précisé." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const s = await sessionEditeur(user, { type, id });
  if (!s.ok) {
    const statut = s.reason === "denied" ? 403 : s.reason === "not-found" ? 404 : s.reason === "not-openable" ? 415 : 501;
    return NextResponse.json({ error: RAISON_EDITEUR[s.reason], reason: s.reason }, { status: statut, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ apiJs: s.apiJs, config: s.config, name: s.name, mode: s.mode }, { headers: { "Cache-Control": "no-store" } });
}
