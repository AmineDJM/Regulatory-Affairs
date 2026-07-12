import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { regCan } from "@/lib/regulatory/intelligence/access";
import {
  objectStorageConfigured,
  putObject,
  getObject,
  deleteObject,
  listBuckets,
  configuredEndpointHost,
} from "@/lib/regulatory/intelligence/upload/object-storage";

/**
 * DIAGNOSTIC du stockage objet (R2/S3) — teste la liaison SERVEUR → bucket (liste des buckets,
 * puis écriture/lecture/suppression d'un petit objet). Permet d'isoler la cause d'un échec :
 *  - `403 SignatureDoesNotMatch` → clés (Secret) fausses ou espace parasite ;
 *  - `403 AccessDenied`          → token en lecture seule / mauvais scope ;
 *  - `404 NoSuchBucket`          → nom de bucket faux OU endpoint/JURIDICTION incorrects.
 * Pour ce dernier, on liste les buckets visibles : si le bucket cible n'y est pas alors que
 * l'auth passe, c'est l'endpoint/juridiction (bucket UE → endpoint `.eu.`). CORS n'intervient
 * PAS ici (test serveur) ; si CE test est vert mais l'upload navigateur échoue → règle CORS.
 * Visiter `/api/regulatory/intelligence/upload/diagnose` (connecté, droit d'upload).
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

  const bucket = (process.env.REG_S3_BUCKET ?? "").trim();
  const endpointHost = configuredEndpointHost();
  const steps: Record<string, string> = {};

  // Étape 0 — ListBuckets : que voient réellement ces clés à cet endpoint ?
  let visibleBuckets: string[] | undefined;
  let bucketVisible: boolean | undefined;
  try {
    visibleBuckets = await listBuckets();
    bucketVisible = visibleBuckets.includes(bucket);
    steps.list = "ok";
  } catch (err) {
    steps.list = err instanceof Error ? err.message : String(err);
  }

  // Si l'auth passe (liste OK) mais que le bucket ciblé n'est pas visible → endpoint/juridiction.
  if (visibleBuckets && !bucketVisible) {
    return NextResponse.json({
      ok: false, configured: true, steps,
      endpointHost, targetBucket: bucket, visibleBuckets, bucketVisible,
      message:
        `Les clés sont valides (auth OK) mais le bucket « ${bucket} » n'est PAS visible à l'endpoint ${endpointHost}. ` +
        (visibleBuckets.length
          ? `Buckets vus : ${visibleBuckets.join(", ")}. Utilisez exactement l'un d'eux, OU corrigez REG_S3_ENDPOINT (juridiction UE → hôte en « .eu. »).`
          : `Aucun bucket visible ici → l'endpoint pointe la mauvaise juridiction/compte : corrigez REG_S3_ENDPOINT (bucket UE → hôte en « .eu. »).`),
    });
  }

  const key = `diagnostics/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const payload = Buffer.from(`diag ${new Date().toISOString()}`);
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
      endpointHost, targetBucket: bucket, visibleBuckets, bucketVisible,
      message: ok
        ? "Liaison SERVEUR → bucket OK (écriture/lecture/suppression). Si l'upload NAVIGATEUR échoue quand même, c'est la règle CORS du bucket."
        : "Écriture OK mais relecture incohérente — vérifiez le bucket.",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, configured: true, steps,
      endpointHost, targetBucket: bucket, visibleBuckets, bucketVisible,
      error: err instanceof Error ? err.message : String(err),
      message: "Le SERVEUR n'a pas pu joindre le bucket. Vérifiez REG_S3_ENDPOINT (host exact), REG_S3_BUCKET, les clés (Access Key/Secret) et REG_S3_REGION.",
    });
  }
}
