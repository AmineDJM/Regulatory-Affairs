import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { regCan } from "@/lib/regulatory/intelligence/access";
import { objectStorageConfigured, putObject, getObject, deleteObject } from "@/lib/regulatory/intelligence/upload/object-storage";

/**
 * DIAGNOSTIC du stockage objet (R2/S3) — teste la liaison SERVEUR → bucket (écriture, lecture,
 * suppression d'un petit objet). Permet d'isoler la cause d'un « Envoi direct échoué (réseau) » :
 *  - ce test OK mais l'upload navigateur KO  → problème **CORS** du bucket (règle côté fournisseur) ;
 *  - ce test KO                              → **endpoint / clés / région** incorrects côté serveur.
 * Visiter `/api/regulatory/intelligence/upload/diagnose` (connecté, droit d'upload). Aucune donnée
 * sensible ; l'objet de test est supprimé aussitôt.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  if (!objectStorageConfigured()) {
    return NextResponse.json({ configured: false, message: "REG_S3_* non configuré côté serveur → l'app utilise le stockage en base." });
  }

  const key = `diagnostics/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const payload = Buffer.from(`diag ${new Date().toISOString()}`);
  const steps: Record<string, string> = {};
  try {
    await putObject(key, payload, "text/plain");
    steps.put = "ok";
    const got = await getObject(key);
    steps.get = got.equals(payload) ? "ok" : "mismatch";
    await deleteObject(key);
    steps.delete = "ok";
    const ok = steps.get === "ok";
    return NextResponse.json({
      ok, configured: true, steps,
      message: ok
        ? "Liaison SERVEUR → bucket OK (écriture/lecture/suppression). Si l'upload NAVIGATEUR échoue quand même, c'est la règle CORS du bucket."
        : "Écriture OK mais relecture incohérente — vérifiez le bucket.",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, configured: true, steps,
      error: err instanceof Error ? err.message : String(err),
      message: "Le SERVEUR n'a pas pu joindre le bucket. Vérifiez REG_S3_ENDPOINT (host exact), REG_S3_BUCKET, les clés (Access Key/Secret) et REG_S3_REGION.",
    });
  }
}
