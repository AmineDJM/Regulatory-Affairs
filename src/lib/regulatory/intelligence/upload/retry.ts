/**
 * POLITIQUE DE RETENTE partagée (client d'upload + tests) — logique PURE, sans DOM ni réseau, donc
 * unitairement testable. Un échec d'upload/finalisation est soit TRANSITOIRE (réseau coupé, instance
 * qui redémarre, 502/503/504 du proxy, réponse vide/tronquée) → à réessayer avec backoff ; soit
 * DÉFINITIF (erreur métier 4xx : quota, type de fichier, SHA) → à remonter tout de suite.
 */

/** Statuts HTTP considérés comme transitoires (à réessayer). 5xx = serveur/proxy momentané. */
export const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504, 507, 522, 524]);

/** Le statut HTTP justifie-t-il une nouvelle tentative ? (les 4xx métier ne le justifient pas). */
export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

/**
 * Délai de backoff exponentiel plafonné : 500 ms → 1 s → 2 s → 4 s → 8 s → 16 s (plafond).
 * Déterministe (testable) ; l'appelant peut ajouter du jitter s'il le souhaite.
 */
export function backoffMs(attempt: number, base = 500, cap = 16_000): number {
  if (attempt < 0) return base;
  return Math.min(base * 2 ** attempt, cap);
}
