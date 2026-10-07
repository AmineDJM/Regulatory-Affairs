import { NextResponse } from "next/server";
import { entetesCors, enregistrerAudience, porteAudience } from "@/lib/site-web/audience-collecte";
import { CORPS_MAX } from "@/lib/site-web/audience-calc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * L'AUDIENCE DU SITE PUBLIC (Direction, 07/10) — un LOT d'événements (≤ 50) envoyé par le
 * NAVIGATEUR des visiteurs d'adventumdz.com, par le script `audience.js`.
 *
 * Route PUBLIQUE par nature (aucun secret ne vit dans un navigateur) : sa porte est l'ORIGINE du
 * site (`porteAudience`), puis un débit borné par adresse et une validation stricte. Elle n'écrit
 * que dans `SiteAnalyticsEvent`, jamais l'IP ni l'agent utilisateur bruts (`audience-collecte.ts`).
 *
 *   204 reçu (ou ignoré : robot, « ne pas me suivre ») · 400 illisible · 403 origine refusée ·
 *   413 trop lourd · 429 débit dépassé.
 */
export async function OPTIONS(request: Request) {
  const porte = porteAudience(request.headers);
  if (!porte.ok) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: entetesCors(porte.origine) });
}

export async function POST(request: Request) {
  const porte = porteAudience(request.headers);
  if (!porte.ok) return NextResponse.json({ error: porte.erreur }, { status: porte.statut });
  const cors = entetesCors(porte.origine);

  const annoncee = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(annoncee) && annoncee > CORPS_MAX) {
    return NextResponse.json({ error: "Lot trop lourd." }, { status: 413, headers: cors });
  }
  const corps = await request.text();
  const r = await enregistrerAudience(corps, request.headers).catch((e) => {
    console.error("[audience] enregistrement échoué", e);
    return null;
  });
  if (r && !r.ok) return NextResponse.json({ error: r.erreur }, { status: r.statut, headers: cors });
  // Une base momentanément indisponible ne se dit pas au visiteur : il n'y peut rien.
  return new NextResponse(null, { status: 204, headers: cors });
}
