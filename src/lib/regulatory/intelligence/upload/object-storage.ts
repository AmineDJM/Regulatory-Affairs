import { createHash, createHmac } from "crypto";

/**
 * STOCKAGE OBJET S3-compatible (AWS S3 / Cloudflare R2 / Backblaze B2 / MinIO…) — SANS dépendance
 * SDK : signatures **AWS SigV4** faites main (crypto natif). Sert le « chantier 1 » : le navigateur
 * téléverse le dossier CTD DIRECTEMENT vers le bucket via une URL présignée (bypass serveur + Postgres),
 * puis le serveur lit l'objet pour l'inspecter. Entièrement piloté par variables d'environnement :
 * absent → non configuré → l'app retombe sur l'upload résumable en base (aucune régression).
 *
 * Env : REG_S3_ENDPOINT (ex. https://<acct>.r2.cloudflarestorage.com), REG_S3_BUCKET,
 * REG_S3_ACCESS_KEY_ID, REG_S3_SECRET_ACCESS_KEY, REG_S3_REGION (défaut « auto » pour R2),
 * REG_S3_FORCE_PATH_STYLE (défaut 1 → chemin ; 0 → virtual-hosted).
 */

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle: boolean;
}

function config(): S3Config | null {
  const endpoint = process.env.REG_S3_ENDPOINT;
  const bucket = process.env.REG_S3_BUCKET;
  const accessKeyId = process.env.REG_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.REG_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    region: process.env.REG_S3_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    pathStyle: (process.env.REG_S3_FORCE_PATH_STYLE ?? "1") !== "0",
  };
}

/** Le stockage objet direct est-il configuré (bucket + clés présents) ? */
export function objectStorageConfigured(): boolean {
  return config() !== null;
}

const ALGO = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
const EMPTY_SHA256 = createHash("sha256").update("").digest("hex");

// Encodage RFC 3986 (SigV4) : espace → %20, encode aussi ! * ' ( ) que `encodeURIComponent` laisse.
function uriEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
// Chemin de ressource : chaque segment encodé, les « / » conservés.
function encodePath(key: string): string {
  return key.split("/").map(uriEncode).join("/");
}
function sha256hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
function amzDate(d: Date): { amz: string; date: string } {
  const amz = d.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  return { amz, date: amz.slice(0, 8) };
}
function signingKeyBuf(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = createHmac("sha256", `AWS4${secret}`).update(date).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}
function signingKey(cfg: S3Config, date: string): Buffer {
  return signingKeyBuf(cfg.secretAccessKey, date, cfg.region, SERVICE);
}
/** Dérivation de clé de signature SigV4 en hex — exposée pour test (vecteur AWS connu). */
export function _deriveSigningKeyHex(secret: string, date: string, region: string, service: string): string {
  return signingKeyBuf(secret, date, region, service).toString("hex");
}
function hostAndPath(cfg: S3Config, key: string): { protocol: string; host: string; resourcePath: string } {
  const base = new URL(cfg.endpoint);
  const host = cfg.pathStyle ? base.host : `${cfg.bucket}.${base.host}`;
  const resourcePath = cfg.pathStyle ? `/${cfg.bucket}/${encodePath(key)}` : `/${encodePath(key)}`;
  return { protocol: base.protocol, host, resourcePath };
}

/**
 * URL PRÉSIGNÉE pour un PUT (téléversement direct navigateur → bucket). Signature par query string,
 * `UNSIGNED-PAYLOAD`, seul l'en-tête `host` signé → le navigateur envoie juste le corps. Null si non configuré.
 */
export function presignPutUrl(key: string, expiresSec = 3600): string | null {
  const cfg = config();
  if (!cfg) return null;
  const { protocol, host, resourcePath } = hostAndPath(cfg, key);
  const { amz, date } = amzDate(new Date());
  const scope = `${date}/${cfg.region}/${SERVICE}/aws4_request`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": ALGO,
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expiresSec),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join("&");
  const canonicalRequest = ["PUT", resourcePath, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [ALGO, amz, scope, sha256hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(cfg, date)).update(stringToSign).digest("hex");
  return `${protocol}//${host}${resourcePath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Requête S3 signée (en-tête Authorization SigV4) — GET/PUT/DELETE côté serveur. */
async function signedRequest(method: "GET" | "PUT" | "DELETE", key: string, body?: Buffer, contentType?: string): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error("Stockage objet non configuré.");
  const { protocol, host, resourcePath } = hostAndPath(cfg, key);
  const { amz, date } = amzDate(new Date());
  const scope = `${date}/${cfg.region}/${SERVICE}/aws4_request`;
  const payloadHash = body ? sha256hex(body) : EMPTY_SHA256;
  // On ne signe QUE host + content-sha256 + date : le content-type éventuel reste non signé
  // (accepté tel quel par S3/R2) → moins de surface d'erreur de signature.
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const canonicalRequest = [method, resourcePath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = [ALGO, amz, scope, sha256hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(cfg, date)).update(stringToSign).digest("hex");
  const authorization = `${ALGO} Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: Record<string, string> = { "x-amz-content-sha256": payloadHash, "x-amz-date": amz, authorization };
  if (contentType) headers["content-type"] = contentType;
  // `host` est ajouté automatiquement par le client HTTP (et signé ci-dessus).
  return fetch(`${protocol}//${host}${resourcePath}`, { method, headers, body });
}

/** Écrit un objet (le serveur pousse les octets vers le bucket — ex. blobs chiffrés). */
export async function putObject(key: string, body: Buffer, contentType = "application/octet-stream"): Promise<void> {
  const res = await signedRequest("PUT", key, body, contentType);
  if (!res.ok) throw new Error(`Écriture de l'objet échouée (${res.status}).`);
}

/** Lit un objet en mémoire (inspection d'archive après PUT direct, ou lecture d'un blob). */
export async function getObject(key: string): Promise<Buffer> {
  const res = await signedRequest("GET", key);
  if (!res.ok) throw new Error(`Lecture de l'objet échouée (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/** Supprime un objet (nettoyage archive temporaire ou blob déréférencé). Ne lève jamais. */
export async function deleteObject(key: string): Promise<void> {
  try {
    const res = await signedRequest("DELETE", key);
    if (!res.ok && res.status !== 404) console.error("[reg-object-storage] delete", key, res.status);
  } catch (err) {
    console.error("[reg-object-storage] delete", key, err instanceof Error ? err.message : err);
  }
}
