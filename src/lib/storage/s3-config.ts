/**
 * LA CONFIGURATION DU STOCKAGE OBJET — S3-compatible, quel que soit le fournisseur.
 *
 * La couche de stockage n'a jamais été spécifique à un hébergeur : elle parle **S3**, et
 * Cloudflare R2, Supabase Storage, MinIO, Backblaze ou AWS répondent tous à ce protocole. Seules
 * les variables d'environnement portaient encore le nom de l'ancien fournisseur.
 *
 * DEUX JEUX DE NOMS, UNE SEULE VÉRITÉ. Les variables canoniques sont désormais `S3_*`. Les
 * anciennes `REG_S3_*` restent acceptées **en repli** : une production qui tourne ne doit pas
 * s'arrêter parce qu'on a renommé une variable. Les nouvelles priment quand les deux existent —
 * sinon la migration ne finirait jamais.
 *
 * SÉCURITÉ. Ces valeurs ne sortent JAMAIS du serveur : aucun nom ne commence par `NEXT_PUBLIC_`,
 * et `describeConfig()` existe précisément pour pouvoir afficher un diagnostic sans montrer une
 * clé. Le navigateur ne reçoit que des URLs présignées à durée de vie courte, jamais les clés.
 *
 * Module PUR — testé. Il reçoit un environnement en argument : la résolution des variables se
 * vérifie sans dépendre de celui de la machine.
 */

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Chemin (`/bucket/clé`) plutôt que sous-domaine — exigé par Supabase et MinIO. */
  pathStyle: boolean;
}

/** D'où vient chaque valeur — sert au diagnostic pendant la transition de noms. */
export type ConfigSource = "S3" | "REG_S3" | "none";

export type Env = Record<string, string | undefined>;

/**
 * Lit une variable sous son nom canonique, puis sous l'ancien.
 *
 * `.trim()` défensif : un secret collé dans un panneau d'hébergeur avec un espace ou un
 * retour-ligne parasite corromprait silencieusement la clé HMAC — et l'erreur qui en résulte
 * (« SignatureDoesNotMatch ») n'oriente vers rien. Une clé S3 n'a jamais d'espace en bordure :
 * ce nettoyage est toujours sûr.
 */
export function readVar(env: Env, name: string): { value: string; source: ConfigSource } {
  const modern = env[`S3_${name}`]?.trim();
  if (modern) return { value: modern, source: "S3" };
  const legacy = env[`REG_S3_${name}`]?.trim();
  if (legacy) return { value: legacy, source: "REG_S3" };
  return { value: "", source: "none" };
}

/** Un drapeau écrit par un humain : « 1 », « true », « yes », « on » valent vrai. */
export function isTruthy(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * L'interrupteur d'arrêt : force le repli sur le stockage en base SANS effacer les variables.
 * Utile pour écarter le stockage objet le temps d'un incident, puis le réactiver d'un drapeau.
 */
export function storageDisabled(env: Env): boolean {
  const raw = env.S3_DISABLED ?? env.REG_S3_DISABLED;
  return isTruthy(raw, false);
}

/**
 * La configuration effective, ou `null` si le stockage objet n'est pas utilisable.
 *
 * `null` n'est pas une erreur : c'est le mode « tout en base », qui reste parfaitement
 * fonctionnel. Les quatre valeurs indispensables sont l'endpoint, le bucket et les deux clés —
 * la région et le style d'URL ont des défauts sensés.
 */
export function resolveS3Config(env: Env): S3Config | null {
  if (storageDisabled(env)) return null;

  const endpoint = readVar(env, "ENDPOINT").value;
  const bucket = readVar(env, "BUCKET").value;
  const accessKeyId = readVar(env, "ACCESS_KEY_ID").value;
  const secretAccessKey = readVar(env, "SECRET_ACCESS_KEY").value;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    // « auto » convient à R2 ; Supabase et AWS veulent une vraie région, qu'on lit telle quelle.
    region: readVar(env, "REGION").value || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    // Par défaut le style CHEMIN : c'est ce qu'exigent Supabase et MinIO, et R2 l'accepte aussi.
    pathStyle: isTruthy(readVar(env, "FORCE_PATH_STYLE").value || undefined, true),
  };
}

/** Diagnostic affichable — TOUT sauf les secrets. Aucune clé, jamais, même tronquée. */
export interface ConfigDescription {
  configured: boolean;
  disabled: boolean;
  /** Hôte seul, sans schéma ni chemin (ex. `abcd.storage.supabase.co`). */
  endpointHost: string;
  bucket: string;
  region: string;
  pathStyle: boolean;
  /** Le fournisseur reconnu depuis l'hôte — indicatif, jamais utilisé pour décider. */
  provider: string;
  /** Sous quels noms les variables ont été trouvées (aide à finir la transition). */
  variableSource: ConfigSource;
  /** Ce qui manque, nommé, quand la configuration est incomplète. */
  missing: string[];
}

const REQUIRED = ["ENDPOINT", "BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"];

/** Le fournisseur, deviné depuis l'hôte. Purement informatif : le code ne s'en sert jamais. */
export function providerOf(host: string): string {
  if (!host) return "—";
  if (host.includes("supabase")) return "Supabase Storage";
  if (host.includes("r2.cloudflarestorage.com")) return "Cloudflare R2";
  if (host.includes("amazonaws.com")) return "Amazon S3";
  if (host.includes("backblazeb2.com")) return "Backblaze B2";
  return "S3-compatible";
}

export function describeConfig(env: Env): ConfigDescription {
  const disabled = storageDisabled(env);
  const missing = REQUIRED.filter((n) => !readVar(env, n).value);
  const cfg = resolveS3Config(env);
  let endpointHost = "";
  if (cfg) {
    try { endpointHost = new URL(cfg.endpoint).host; } catch { endpointHost = ""; }
  }
  return {
    configured: cfg !== null,
    disabled,
    endpointHost,
    bucket: cfg?.bucket ?? readVar(env, "BUCKET").value,
    region: cfg?.region ?? readVar(env, "REGION").value,
    pathStyle: cfg?.pathStyle ?? true,
    provider: providerOf(endpointHost),
    variableSource: readVar(env, "ENDPOINT").source,
    missing: missing.map((n) => `S3_${n}`),
  };
}
