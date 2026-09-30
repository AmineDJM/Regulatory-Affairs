import { NextResponse } from "next/server";
import { authentifierLeSite } from "@/lib/site-web/entrant";
import { reveillerFile } from "@/lib/site-web/file";
import { recevoirCandidature, REQUETE_TAILLE_MAX } from "@/lib/site-web/candidatures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * UNE CANDIDATURE DÉPOSÉE SUR LE SITE (§118.159) — le site l'envoie ici au moment où le candidat
 * clique « Envoyer », puis la réessaie jusqu'à ce que l'ERP l'ait.
 *
 *   201 reçue · 200 déjà reçue (même identifiant du site : rien n'est recréé) · 401 clé ou
 *   signature refusée · 413 trop lourde · 422 incomplète (la raison est dite, le site ne la
 *   réessaie pas telle quelle) · 503 l'ERP n'est pas relié.
 *
 * La taille est bornée AVANT de lire le corps quand le client l'annonce, et APRÈS sinon : un corps
 * de plusieurs centaines de mégaoctets ne doit pas être chargé pour être refusé.
 */
export async function POST(request: Request) {
  const annoncee = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(annoncee) && annoncee > REQUETE_TAILLE_MAX) {
    return NextResponse.json({ error: "Candidature trop lourde (CV limité à 5 Mo)." }, { status: 413 });
  }
  const corps = await request.text();
  if (corps.length > REQUETE_TAILLE_MAX) {
    return NextResponse.json({ error: "Candidature trop lourde (CV limité à 5 Mo)." }, { status: 413 });
  }
  const auth = await authentifierLeSite(request.headers, corps);
  if (!auth.ok) return NextResponse.json({ error: auth.erreur }, { status: auth.statut });
  // Le site vient d'employer la clé EN ATTENTE : il l'a donc, et elle est désormais active. Les
  // envois qui attendaient (ou que l'ancienne clé faisait refuser) repartent sans attendre.
  if (auth.source === "ATTENTE_PROMUE") reveillerFile(0);

  let j: unknown;
  try {
    j = JSON.parse(corps);
  } catch {
    return NextResponse.json({ error: "Le corps doit être du JSON valide." }, { status: 400 });
  }
  const r = await recevoirCandidature(j);
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: r.statut });
  return NextResponse.json({ received: true, id: r.id, duplicate: r.deja, state: r.etat }, { status: r.deja ? 200 : 201 });
}
