import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserPourEcrire } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { presignPutUrl, deleteObject, objectStorageConfigured } from "@/lib/storage/object-storage";

export const dynamic = "force-dynamic";

/**
 * TEST DE L'ENVOI DIRECT DEPUIS LE NAVIGATEUR — la seule moitié que le test serveur ne voit pas.
 *
 * Le test de connexion prouve que le SERVEUR parle au bucket. Les gros fichiers, eux, partent du
 * NAVIGATEUR : il faut une règle CORS qui autorise le `PUT` depuis l'adresse de l'application et
 * qui EXPOSE l'en-tête `ETag`. Sans elle, tout semble configuré et chaque gros envoi échoue. Cette
 * route signe une adresse pour un petit objet de test (préfixe `_selftest/`) ; c'est le navigateur
 * qui envoie, puis demande sa suppression. Super Admin seulement ; aucune clé ne sort.
 */
export async function POST() {
  const user = await getCurrentUserPourEcrire();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "ADMIN", "UPDATE")) return NextResponse.json({ error: "Réservé au Super Admin." }, { status: 403 });
  if (!objectStorageConfigured()) return NextResponse.json({ error: "Stockage objet non configuré." }, { status: 400 });
  const key = `_selftest/cors-${randomUUID()}.txt`;
  const url = presignPutUrl(key, 300);
  if (!url) return NextResponse.json({ error: "Signature impossible." }, { status: 500 });
  return NextResponse.json({ url, key }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserPourEcrire();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "ADMIN", "UPDATE")) return NextResponse.json({ error: "Réservé au Super Admin." }, { status: 403 });
  const key = req.nextUrl.searchParams.get("key") ?? "";
  // Seul un objet de test se supprime par ici — jamais une clé quelconque.
  if (!/^_selftest\/cors-[0-9a-f-]{36}\.txt$/.test(key)) return NextResponse.json({ error: "Clé refusée." }, { status: 400 });
  await deleteObject(key);
  return NextResponse.json({ ok: true });
}
