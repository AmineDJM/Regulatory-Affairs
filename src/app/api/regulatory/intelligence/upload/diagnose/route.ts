import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { regCan } from "@/lib/regulatory/intelligence/access";
import {
  objectStorageConfigured,
  putObject,
  getObject,
  deleteObject,
  probeJurisdiction,
  configuredEndpointHost,
} from "@/lib/regulatory/intelligence/upload/object-storage";

/**
 * DIAGNOSTIC du stockage objet (R2/S3) — isole la cause d'un échec serveur → bucket :
 *  - `403 SignatureDoesNotMatch` → clés (Secret) fausses ou espace parasite ;
 *  - `403 AccessDenied` (écriture) → token en lecture seule / mauvais scope ;
 *  - `404 NoSuchBucket`          → nom de bucket faux OU endpoint/JURIDICTION incorrects.
 * On SONDE d'abord la juridiction : le bucket est-il présent à l'endpoint configuré, ou seulement
 * à sa variante `.eu.` (juridiction Union Européenne) ? Cela tranche définitivement un NoSuchBucket
 * même quand le nom est correct. CORS n'intervient PAS ici (test serveur) ; si CE test est vert
 * mais l'upload NAVIGATEUR échoue → règle CORS du bucket.
 * Visiter `/api/regulatory/intelligence/upload/diagnose` (connecté, droit d'upload).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!regCan(user, "regulatory.dossier.upload")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  if (!objectStorageConfigured()) {
    const disabled = (process.env.REG_S3_DISABLED ?? "").trim().toLowerCase();
    const isDisabled = disabled === "1" || disabled === "true";
    return NextResponse.json({
      configured: false,
      disabledByFlag: isDisabled,
      message: isDisabled
        ? "R2 est DÉSACTIVÉ par REG_S3_DISABLED → l'app stocke dans la base Postgres (Render). Retirez le flag pour réactiver R2."
        : "REG_S3_* non configuré côté serveur → l'app utilise le stockage en base (Postgres).",
    });
  }

  const bucket = (process.env.REG_S3_BUCKET ?? "").trim();
  const endpointHost = configuredEndpointHost();
  const steps: Record<string, string> = {};

  // Étape 0 — SONDE DE JURIDICTION : où le bucket existe-t-il réellement (endpoint configuré vs `.eu.`) ?
  const jur = await probeJurisdiction();
  const present = (s: number | null) => s === 200 || s === 403; // auth atteint le bucket = présent ici
  if (jur) {
    steps.jurisdiction = `configuré=${jur.configuredStatus ?? "?"}${jur.euHost ? ` / eu=${jur.euStatus ?? "?"}` : ""}`;

    // Bucket absent à l'endpoint configuré mais présent en `.eu.` → juridiction UE : fix décisif.
    if (!present(jur.configuredStatus) && jur.euHost && present(jur.euStatus)) {
      return NextResponse.json({
        ok: false, configured: true, steps, endpointHost, targetBucket: bucket, jurisdiction: jur,
        message:
          `Le bucket « ${bucket} » existe en juridiction UE mais PAS à l'endpoint configuré (${jur.configuredHost}). ` +
          `Corrigez REG_S3_ENDPOINT en : https://${jur.euHost}  (puis redéployez).`,
      });
    }
    // Absent partout (configuré ET éventuel `.eu.`) → nom/compte réellement faux.
    if (!present(jur.configuredStatus) && (!jur.euHost || !present(jur.euStatus))) {
      return NextResponse.json({
        ok: false, configured: true, steps, endpointHost, targetBucket: bucket, jurisdiction: jur,
        message:
          `Le bucket « ${bucket} » est introuvable à ${jur.configuredHost}` +
          (jur.euHost ? ` ni à ${jur.euHost}` : "") +
          `. Vérifiez le nom EXACT et le compte via R2 → bucket → Settings → « S3 API » (l'URL y donne l'endpoint et le nom réels).`,
      });
    }
    // present(configuredStatus) → le bucket est là : on continue avec le test d'écriture réel.
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
      ok, configured: true, steps, endpointHost, targetBucket: bucket, jurisdiction: jur,
      message: ok
        ? "Liaison SERVEUR → bucket OK (écriture/lecture/suppression). Si l'upload NAVIGATEUR échoue quand même, c'est la règle CORS du bucket."
        : "Écriture OK mais relecture incohérente — vérifiez le bucket.",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, configured: true, steps, endpointHost, targetBucket: bucket, jurisdiction: jur,
      error: err instanceof Error ? err.message : String(err),
      message: "Le SERVEUR n'a pas pu joindre le bucket. Vérifiez REG_S3_ENDPOINT (host exact), REG_S3_BUCKET, les clés (Access Key/Secret) et REG_S3_REGION.",
    });
  }
}
