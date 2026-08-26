/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUOTA VOCAL ATTEINT — ce qu'on en déduit, et ce qu'on en dit.
 *
 * ── L'INCIDENT QUI A PRODUIT CE FICHIER (26 août, production) ────────────────────────────
 *
 * Les journaux, dans l'ordre :
 *
 *   voice_session_created   latencyMs 469   ← le secret éphémère est bien forgé
 *   voice_session_error     SDP_429         ← l'échange WebRTC est REFUSÉ : quota atteint
 *   voice_session_closed    sessionMs 8242
 *   voice_session_created   latencyMs 429   ← on repart…
 *   voice_session_created   latencyMs 449   ← …et encore, coup sur coup
 *   voice_session_error     SDP_429
 *
 * Deux choses s'y lisent. D'abord, **le mint n'était pas en cause** : le secret se créait à
 * chaque fois, en 430–470 ms. Le refus venait de l'étape suivante, l'échange SDP.
 *
 * Ensuite, et c'est le vrai défaut : **on répondait à « ralentis » en accélérant**. La
 * reconnexion automatique repartait sans aucune attente, jusqu'à trois tentatives en quelques
 * secondes, et chacune reforgeait une session — donc consommait précisément la ressource dont
 * on attendait qu'elle se libère. Un incident passager devenait un incident entretenu.
 *
 * ── CE QUE FAIT CE MODULE ────────────────────────────────────────────────────────────────
 *
 * Il est PUR : pas de React, pas de réseau, pas d'horloge cachée. Il traduit un refus HTTP en
 * une décision — combien de temps se taire — et en une phrase que le PDG peut utiliser.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** À défaut d'un `Retry-After`, une attente franche : assez longue pour que le compteur bouge. */
export const DEFAULT_VOICE_COOLDOWN_MS = 30_000;
/** Borne haute : un `Retry-After` d'une heure ne doit pas condamner la voix pour la journée. */
export const MAX_VOICE_COOLDOWN_MS = 5 * 60_000;
/** Borne basse : en dessous, on relancerait pratiquement tout de suite — sans effet. */
export const MIN_VOICE_COOLDOWN_MS = 5_000;

/**
 * 429 : quota atteint. 503 : capacité momentanément absente. Même conduite à tenir — attendre.
 *
 * Les autres codes ne sont PAS des limites : un 401 se corrige (jeton), un 400 est un défaut de
 * notre requête. Les mettre en refroidissement masquerait un vrai bogue derrière une attente.
 */
export const isRateLimitStatus = (status: number): boolean => status === 429 || status === 503;

/**
 * `Retry-After` s'exprime en SECONDES ou en date HTTP — les deux formes existent, et les serveurs
 * choisissent. Rendre `null` quand on ne sait pas lire est préférable à supposer zéro, qui
 * relancerait immédiatement : exactement le comportement qu'on corrige.
 */
export function parseRetryAfter(raw: string | null | undefined, now = Date.now()): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Forme « secondes ». `Number("")` vaut 0, d'où le garde ci-dessus.
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const when = Date.parse(trimmed);
  if (!Number.isNaN(when)) return Math.max(0, when - now);
  return null;
}

/** Le délai effectivement appliqué : la consigne du serveur, bornée des deux côtés. */
export function cooldownFor(retryAfterMs: number | null): number {
  if (retryAfterMs === null || !Number.isFinite(retryAfterMs)) return DEFAULT_VOICE_COOLDOWN_MS;
  return Math.min(Math.max(retryAfterMs, MIN_VOICE_COOLDOWN_MS), MAX_VOICE_COOLDOWN_MS);
}

/**
 * CE QUE LE PDG LIT. « Momentanément indisponible (connexion refusée) » — l'ancien message —
 * n'aide personne à décider : faut-il réessayer, appeler quelqu'un, renoncer ? Une DURÉE
 * répond à la question, et le repli disponible évite de laisser la personne bloquée.
 */
export function cooldownMessage(remainingMs: number): string {
  const s = Math.max(1, Math.ceil(remainingMs / 1000));
  const quand = s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
  return `Le service vocal a atteint sa limite de connexions. Nouvel essai possible dans ${quand} — la conversation écrite reste disponible.`;
}

/** Ce qu'on retient d'un refus, une fois débarrassé du transport. */
export interface RateLimitInfo {
  status: number;
  retryAfterMs: number | null;
  detail: string;
}

/**
 * Reconnaît un refus limitant SANS `instanceof`.
 *
 * Le `instanceof` échoue dès qu'un module est chargé deux fois — ce qui arrive en découpage de
 * paquets côté navigateur. Un test structurel ne connaît pas ce piège, et le prix est nul.
 */
export function rateLimitFrom(err: unknown): RateLimitInfo | null {
  const e = err as { status?: unknown; retryAfterMs?: unknown; detail?: unknown; message?: unknown } | null;
  if (!e || typeof e !== "object") return null;

  const status = typeof e.status === "number"
    ? e.status
    // Repli : les anciens jets ne portaient qu'un message « SDP_429 ».
    : typeof e.message === "string" && /^SDP_(\d{3})$/.test(e.message)
      ? Number(/^SDP_(\d{3})$/.exec(e.message)?.[1])
      : NaN;

  if (!Number.isFinite(status) || !isRateLimitStatus(status)) return null;
  return {
    status,
    retryAfterMs: typeof e.retryAfterMs === "number" ? e.retryAfterMs : null,
    detail: typeof e.detail === "string" ? e.detail : "",
  };
}
