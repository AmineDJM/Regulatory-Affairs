import { createHash, createHmac } from "crypto";
import { resolveS3Config, type S3Config } from "@/lib/storage/s3-config";

/**
 * STOCKAGE OBJET S3-COMPATIBLE — Supabase Storage, Cloudflare R2, AWS S3, MinIO, Backblaze…
 *
 * SANS dépendance SDK : les signatures **AWS SigV4** sont faites à la main avec le crypto natif.
 * C'est ce qui rend la couche réellement générique — il n'y a pas de client propriétaire à
 * remplacer pour changer de fournisseur, seulement des variables d'environnement.
 *
 * Deux usages, et ils comptent tous les deux :
 *   • le navigateur téléverse un dossier CTD DIRECTEMENT vers le bucket via une URL présignée —
 *     ni le serveur ni Postgres ne voient passer les octets, ce qui autorise des archives de
 *     plusieurs centaines de méga-octets ;
 *   • le serveur lit et écrit des objets (blobs chiffrés, inspection d'archive).
 *
 * Non configuré → l'application retombe sur le stockage en base, sans régression.
 *
 * Configuration : voir `@/lib/storage/s3-config` (variables `S3_*`, anciennes `REG_S3_*` en
 * repli). Les secrets restent strictement côté serveur : aucun nom en `NEXT_PUBLIC_`.
 */

function config(): S3Config | null {
  return resolveS3Config(process.env as Record<string, string | undefined>);
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

// Extrait le code d'erreur S3/R2 (`<Code>…</Code>`) du corps XML pour un diagnostic précis.
function s3ErrorCode(body: string): string {
  const m = /<Code>([^<]+)<\/Code>/.exec(body);
  return m ? m[1] : "";
}

/**
 * Requête signée AVEC query string — nécessaire au téléversement en plusieurs parties, dont
 * chaque opération se distingue par un paramètre (`?uploads`, `?partNumber=…&uploadId=…`).
 * Le chemin PUT/GET/DELETE simple garde sa propre fonction, éprouvée : on n'y touche pas.
 */
async function signedRequestQ(
  method: "GET" | "PUT" | "POST" | "DELETE",
  key: string,
  query: Record<string, string>,
  body?: Buffer,
  contentType?: string,
): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error("Stockage objet non configuré.");
  const { protocol, host, resourcePath } = hostAndPath(cfg, key);
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");
  const payloadHash = body ? sha256hex(body) : EMPTY_SHA256;
  const headers = signAuthHeaders(cfg, method, host, resourcePath, canonicalQuery, payloadHash);
  if (contentType) headers["content-type"] = contentType;
  const url = `${protocol}//${host}${resourcePath}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
  return fetch(url, { method, headers, body });
}

const tagOf = (xml: string, tag: string): string => {
  const m = new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(xml);
  return m ? m[1] : "";
};

/**
 * TÉLÉVERSEMENT EN PLUSIEURS PARTIES — c'est ce qui permet d'écrire une archive d'un gigaoctet
 * sans jamais la tenir en mémoire.
 *
 * L'alternative (un PUT unique) oblige à charger tout le contenu dans un Buffer : sur un
 * hébergeur à mémoire bornée, un dossier CTD volumineux fait tomber le processus — et ce n'est
 * pas une panne qu'on diagnostique facilement, puisqu'elle dépend de la taille du fichier envoyé.
 *
 * Le protocole S3 impose au moins 5 Mio par partie (sauf la dernière) ; on en prend 16 pour rester
 * loin de la borne et limiter le nombre d'allers-retours.
 */
export const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

/** Seuil au-delà duquel on passe en plusieurs parties. En deçà, un PUT simple est plus rapide. */
export const MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024;

async function createMultipartUpload(key: string, contentType: string): Promise<string> {
  const res = await signedRequestQ("POST", key, { uploads: "" }, undefined, contentType);
  const xml = await res.text();
  if (!res.ok) throw new Error(`Ouverture du téléversement échouée (${res.status}${s3ErrorCode(xml) ? ` ${s3ErrorCode(xml)}` : ""}).`);
  const uploadId = tagOf(xml, "UploadId");
  if (!uploadId) throw new Error("Le stockage n'a pas renvoyé d'identifiant de téléversement.");
  return uploadId;
}

async function uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string> {
  const res = await signedRequestQ("PUT", key, { partNumber: String(partNumber), uploadId }, body);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Envoi de la partie ${partNumber} échoué (${res.status}${s3ErrorCode(detail) ? ` ${s3ErrorCode(detail)}` : ""}).`);
  }
  // L'ETag est indispensable à la finalisation : sans lui, S3 refuse de recoller les parties.
  const etag = res.headers.get("etag") ?? res.headers.get("ETag") ?? "";
  if (!etag) throw new Error(`Le stockage n'a pas renvoyé d'ETag pour la partie ${partNumber}.`);
  return etag;
}

async function completeMultipartUpload(key: string, uploadId: string, etags: string[]): Promise<void> {
  const body = Buffer.from(
    `<CompleteMultipartUpload>${etags
      .map((etag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${etag}</ETag></Part>`)
      .join("")}</CompleteMultipartUpload>`,
    "utf8",
  );
  const res = await signedRequestQ("POST", key, { uploadId }, body, "application/xml");
  const xml = await res.text();
  // Piège S3 : la finalisation peut répondre 200 AVEC une erreur dans le corps. Ne pas la lire,
  // c'est croire un téléversement réussi alors que l'objet n'existe pas.
  if (!res.ok || /<Error>/.test(xml)) {
    throw new Error(`Finalisation du téléversement échouée (${res.status}${s3ErrorCode(xml) ? ` ${s3ErrorCode(xml)}` : ""}).`);
  }
}

/** Abandonne un téléversement entamé — libère les parties déjà envoyées. Ne lève jamais. */
async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  try {
    await signedRequestQ("DELETE", key, { uploadId });
  } catch (err) {
    console.error("[object-storage] abandon du téléversement", key, err instanceof Error ? err.message : err);
  }
}

/**
 * Écrit un objet depuis un FLUX, sans jamais le tenir entier en mémoire.
 *
 * Le pic mémoire vaut une partie (16 Mio), quelle que soit la taille du contenu. En cas d'échec
 * à mi-parcours, le téléversement est abandonné proprement : on ne laisse pas des parties
 * orphelines facturées dans le bucket, et surtout on ne laisse pas croire à un succès.
 */
export async function putObjectStream(
  key: string,
  source: AsyncIterable<Buffer>,
  contentType = "application/octet-stream",
): Promise<void> {
  const uploadId = await createMultipartUpload(key, contentType);
  const etags: string[] = [];
  try {
    for await (const part of intoParts(source, MULTIPART_PART_BYTES)) {
      etags.push(await uploadPart(key, uploadId, etags.length + 1, part));
    }
    await completeMultipartUpload(key, uploadId, etags);
  } catch (err) {
    await abortMultipartUpload(key, uploadId);
    throw err;
  }
}

/**
 * Regroupe un flux de morceaux quelconques en PARTIES de taille fixe — sauf la dernière.
 *
 * C'est la règle du protocole, et elle n'est pas cosmétique : S3 refuse toute partie non finale
 * inférieure à 5 Mio. Un chiffrement en flux rend des morceaux de tailles arbitraires ; les
 * renvoyer tels quels ferait échouer le téléversement au deuxième morceau, sur une erreur
 * (`EntityTooSmall`) qui ne dit pas d'où elle vient.
 *
 * Un flux vide rend UNE partie vide : le protocole exige au moins une partie pour finaliser.
 *
 * Générateur PUR — testé.
 */
export async function* intoParts(source: AsyncIterable<Buffer>, partSize: number): AsyncGenerator<Buffer> {
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  let emitted = 0;

  for await (const chunk of source) {
    if (chunk.length === 0) continue;
    pending.push(chunk);
    pendingBytes += chunk.length;
    while (pendingBytes >= partSize) {
      const whole = Buffer.concat(pending, pendingBytes);
      yield whole.subarray(0, partSize);
      emitted += 1;
      const tail = whole.subarray(partSize);
      pending = tail.length > 0 ? [tail] : [];
      pendingBytes = tail.length;
    }
  }
  if (pendingBytes > 0) {
    yield Buffer.concat(pending, pendingBytes);
  } else if (emitted === 0) {
    yield Buffer.alloc(0);
  }
}

/** Écrit un objet (le serveur pousse les octets vers le bucket — ex. blobs chiffrés). */
export async function putObject(key: string, body: Buffer, contentType = "application/octet-stream"): Promise<void> {
  const res = await signedRequest("PUT", key, body, contentType);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const code = s3ErrorCode(detail);
    throw new Error(`Écriture de l'objet échouée (${res.status}${code ? ` ${code}` : ""}).`);
  }
}

/** Lit un objet en mémoire (inspection d'archive après PUT direct, ou lecture d'un blob). */
export async function getObject(key: string): Promise<Buffer> {
  const res = await signedRequest("GET", key);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const code = s3ErrorCode(detail);
    throw new Error(`Lecture de l'objet échouée (${res.status}${code ? ` ${code}` : ""}).`);
  }
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

/** Extrait les noms de bucket (`<Name>…</Name>`) d'une réponse S3 ListBuckets. Exporté pour test.
 *  `<DisplayName>` du propriétaire n'est PAS capturé (le tag n'est pas `<Name>`). */
export function parseBucketNames(xml: string): string[] {
  const names: string[] = [];
  const re = /<Name>([^<]+)<\/Name>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) names.push(m[1]);
  return names;
}

/** Hôte de l'endpoint configuré (ex. `abcd.storage.supabase.co`) — pour diagnostic (non sensible). */
export function configuredEndpointHost(): string {
  const cfg = config();
  if (!cfg) return "";
  try { return new URL(cfg.endpoint).host; } catch { return ""; }
}

/** Calcule les en-têtes signés SigV4 (date/content-sha256/authorization) pour une requête à un
 *  hôte + chemin + querystring canonique donnés. Réservé aux sondes de diagnostic (host variable).
 *  N'altère pas le chemin PUT/GET éprouvé (`signedRequest`), pour ne pas risquer l'upload. */
function signAuthHeaders(cfg: S3Config, method: string, host: string, resourcePath: string, canonicalQuery: string, payloadHash: string): Record<string, string> {
  const { amz, date } = amzDate(new Date());
  const scope = `${date}/${cfg.region}/${SERVICE}/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const canonicalRequest = [method, resourcePath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = [ALGO, amz, scope, sha256hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(cfg, date)).update(stringToSign).digest("hex");
  const authorization = `${ALGO} Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { "x-amz-content-sha256": payloadHash, "x-amz-date": amz, authorization };
}

/** Variante `.eu.` d'un hôte R2 standard (juridiction Union Européenne), ou null si non applicable
 *  (déjà `.eu.`, ou hôte non-R2 : Supabase, MinIO, domaine custom). Diagnostic SPÉCIFIQUE R2 —
 *  chez les autres fournisseurs, il rend simplement `null` et la sonde ne propose rien. */
export function euJurisdictionHost(host: string): string | null {
  if (host.includes(".eu.")) return null;
  const eu = host.replace(/\.r2\.cloudflarestorage\.com$/, ".eu.r2.cloudflarestorage.com");
  return eu === host ? null : eu;
}

/**
 * Liste les buckets visibles pour ces identifiants À CET endpoint (S3 ListBuckets, GET `/`).
 * NB : un token R2 *scopé* à un bucket renvoie 403 AccessDenied ici (normal) — la sonde décisive
 * est `probeJurisdiction()`. Lève une erreur explicite si l'appel échoue.
 */
export async function listBuckets(): Promise<string[]> {
  const cfg = config();
  if (!cfg) throw new Error("Stockage objet non configuré.");
  const base = new URL(cfg.endpoint);
  const host = base.host;
  const headers = signAuthHeaders(cfg, "GET", host, "/", "", EMPTY_SHA256);
  const res = await fetch(`${base.protocol}//${host}/`, { method: "GET", headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const code = s3ErrorCode(detail);
    throw new Error(`Liste des buckets échouée (${res.status}${code ? ` ${code}` : ""}).`);
  }
  return parseBucketNames(await res.text());
}

/** Résultat de la sonde de juridiction : où le bucket cible existe-t-il ? */
export interface JurisdictionProbe {
  bucket: string;
  configuredHost: string;
  configuredStatus: number | null; // code HTTP à l'endpoint configuré (200/403 = présent, 404 = absent)
  euHost: string | null;           // variante `.eu.` testée (null si non applicable)
  euStatus: number | null;         // code HTTP à l'endpoint `.eu.`
}

// Sonde l'EXISTENCE du bucket à un hôte donné via ListObjectsV2 (max-keys=0) — l'opération
// la moins gourmande qu'un token « Object Read & Write » peut faire. 200/403 = présent (auth
// atteint le bucket) ; 404 NoSuchBucket = absent à cette juridiction/endpoint.
async function probeBucketExists(cfg: S3Config, host: string): Promise<number> {
  const resourcePath = `/${cfg.bucket}`;
  const canonicalQuery = "list-type=2&max-keys=0"; // déjà trié (l<m) et sans caractère à encoder
  const headers = signAuthHeaders(cfg, "GET", host, resourcePath, canonicalQuery, EMPTY_SHA256);
  const res = await fetch(`https://${host}${resourcePath}?${canonicalQuery}`, { method: "GET", headers });
  return res.status;
}

/**
 * Détecte OÙ vit réellement le bucket cible : sonde l'endpoint configuré ET sa variante `.eu.`.
 * Diagnostic décisif d'un « 404 NoSuchBucket » quand le nom est avéré correct :
 *  - présent à l'endpoint configuré (200/403) → ce n'est PAS la juridiction ;
 *  - absent (404) au configuré mais présent (200/403) en `.eu.` → bucket en juridiction UE :
 *    corriger REG_S3_ENDPOINT en l'hôte `.eu.` ;
 *  - absent aux deux → nom/compte réellement faux.
 */
export async function probeJurisdiction(): Promise<JurisdictionProbe | null> {
  const cfg = config();
  if (!cfg) return null;
  const configuredHost = new URL(cfg.endpoint).host;
  const euHost = euJurisdictionHost(configuredHost);
  const [configuredStatus, euStatus] = await Promise.all([
    probeBucketExists(cfg, configuredHost).catch(() => null),
    euHost ? probeBucketExists(cfg, euHost).catch(() => null) : Promise.resolve(null),
  ]);
  return { bucket: cfg.bucket, configuredHost, configuredStatus, euHost, euStatus };
}
