import { GRAPH_BASE } from "../config";
import { MailError, type MailErrorKind } from "../provider";
import { withRetry } from "./throttle";

/**
 * L'APPEL À GRAPH — un seul endroit qui parle réseau.
 *
 * Trois responsabilités, et elles doivent être ici plutôt que dispersées :
 *   • poser le jeton (jamais journalisé) ;
 *   • **respecter la limitation de débit** — Graph répond 429 quand on va trop vite, et insister
 *     aggrave le blocage ;
 *   • **traduire les erreurs** dans un vocabulaire que l'écran sait utiliser. Sans cette
 *     traduction, l'interface affiche le même message pour « reconnectez-vous » et pour
 *     « réessayez dans deux secondes » — donc le mauvais une fois sur deux.
 */

/** Le code d'erreur Graph qui signale un jeton de delta périmé — il faut resynchroniser. */
const DELTA_EXPIRED = new Set(["syncStateNotFound", "resyncRequired"]);

function kindOf(status: number, code: string): MailErrorKind {
  if (DELTA_EXPIRED.has(code)) return "delta-expired";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "throttled";
  if (status >= 500) return "network";
  return "unknown";
}

const HUMAN: Record<MailErrorKind, string> = {
  unauthorized: "Votre boîte Microsoft doit être reconnectée.",
  forbidden: "Microsoft refuse cette action : une autorisation manque sur votre compte.",
  "not-found": "Cet élément n'existe plus dans votre boîte.",
  throttled: "Microsoft limite temporairement les requêtes. Réessayez dans un instant.",
  "delta-expired": "La synchronisation doit repartir de zéro.",
  network: "Microsoft est momentanément injoignable.",
  unknown: "La messagerie n'a pas pu répondre.",
};

export interface GraphRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Chemin relatif à `/v1.0`, ex. `/me/mailFolders`. Une URL absolue n'est jamais acceptée. */
  path: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  accessToken: string;
}

function buildUrl(path: string, query?: GraphRequest["query"]): string {
  // On refuse une URL absolue : accepter `https://…` transformerait cette fonction en relais
  // ouvert, capable d'appeler n'importe quel service avec le jeton de la personne.
  if (/^https?:/i.test(path)) throw new MailError("unknown", "Chemin Graph invalide.");
  const url = new URL(GRAPH_BASE + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Appelle Graph et rend le JSON. Lève une `MailError` parlante en cas d'échec. */
export async function graphJson<T = Record<string, unknown>>(req: GraphRequest): Promise<T> {
  const { res, text } = await graphRaw(req);
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch {
    throw new MailError("unknown", `Réponse illisible de Microsoft (${res.status}).`);
  }
}

/** Appelle Graph et rend les octets — pièces jointes. */
export async function graphBinary(req: GraphRequest): Promise<{ buffer: Buffer; contentType: string }> {
  const url = buildUrl(req.path, req.query);
  const out = await withRetry(async () => {
    const res = await fetch(url, { headers: { authorization: `Bearer ${req.accessToken}` } });
    return { status: res.status, retryAfter: res.headers.get("retry-after"), res };
  });
  if (!out.res.ok) throw await toError(out.res);
  return {
    buffer: Buffer.from(await out.res.arrayBuffer()),
    contentType: out.res.headers.get("content-type") ?? "application/octet-stream",
  };
}

async function graphRaw(req: GraphRequest): Promise<{ res: Response; text: string }> {
  const url = buildUrl(req.path, req.query);
  const init: RequestInit = {
    method: req.method ?? "GET",
    headers: {
      authorization: `Bearer ${req.accessToken}`,
      ...(req.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
  };

  const out = await withRetry(async () => {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch {
      // Panne réseau : on la présente comme un 503, donc réessayable, plutôt que de faire
      // remonter une exception brute jusqu'à l'écran.
      return { status: 503, retryAfter: null, res: null as Response | null, text: "" };
    }
    const text = await res.text().catch(() => "");
    return { status: res.status, retryAfter: res.headers.get("retry-after"), res, text };
  });

  if (!out.res) throw new MailError("network", HUMAN.network);
  if (!out.res.ok) throw await toError(out.res, out.text);
  return { res: out.res, text: out.text };
}

async function toError(res: Response, bodyText?: string): Promise<MailError> {
  const text = bodyText ?? (await res.text().catch(() => ""));
  let code = "";
  try {
    const j = JSON.parse(text) as { error?: { code?: string } };
    code = j.error?.code ?? "";
  } catch { /* corps non-JSON : on se contente du statut */ }
  const kind = kindOf(res.status, code);
  const retryAfter = Number(res.headers.get("retry-after"));
  // Le message est CELUI QU'ON MONTRE : jamais le corps brut de Graph, qui peut contenir l'objet
  // ou l'adresse d'un message.
  return new MailError(kind, HUMAN[kind], Number.isFinite(retryAfter) ? retryAfter : undefined);
}
