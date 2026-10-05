import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserPourEcrire } from "@/lib/session";
import { replanifierDepotDirectDocument, finaliserDepotDirectDocument, abandonnerDepotDirectDocument } from "@/lib/documents-depot-direct";

export const dynamic = "force-dynamic";

/** Adresses fraîches pour les parties manquantes (expiration, reprise). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserPourEcrire();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const r = await replanifierDepotDirectDocument(user, params.id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, plan: r.plan }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: `Le stockage ne répond pas (${e instanceof Error ? e.message : "erreur"}).` }, { status: 503 });
  }
}

/** Finalise : le document est inscrit si le bucket l'a reçu en entier, à la bonne taille. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserPourEcrire();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const r = await finaliserDepotDirectDocument(user, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error, reprendre: r.reprendre ?? false, manquantes: r.manquantes ?? [] }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.id, ids: [r.id] });
}

/** Abandon : les parties déjà envoyées sont libérées dans le bucket. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserPourEcrire();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json(await abandonnerDepotDirectDocument(user, params.id));
}
