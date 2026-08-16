/**
 * MICROSOFT LIMITE LE DÉBIT, ET C'EST NORMAL.
 *
 * Graph répond `429` avec un en-tête `Retry-After` quand on demande trop vite. Deux fautes
 * possibles, symétriques :
 *   • **ignorer** la limite et réessayer aussitôt — on prolonge le blocage et on aggrave le cas ;
 *   • **abandonner** au premier 429 — l'écran affiche une erreur pour une situation parfaitement
 *     normale, qui se serait résolue en deux secondes.
 *
 * On respecte donc `Retry-After` **à la lettre** quand il est là, et on retombe sur une attente
 * qui double à chaque essai quand il ne l'est pas. Un `5xx` se traite pareil : c'est passager.
 * Un `401`/`403`/`404`, en revanche, ne s'améliorera jamais tout seul — on rend la main aussitôt.
 *
 * Module PUR — testé (l'attente est injectée).
 */

/** Ces codes valent la peine d'être réessayés ; les autres, non. */
export function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

/**
 * Combien de temps attendre avant le prochain essai, en millisecondes.
 *
 * `Retry-After` est prioritaire — c'est Microsoft qui sait. Sa valeur peut être un nombre de
 * secondes ou une date HTTP ; les deux formes existent réellement dans les réponses de Graph.
 */
export function retryDelayMs(attempt: number, retryAfter: string | null, now = Date.now()): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_DELAY_MS);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(Math.max(0, at - now), MAX_DELAY_MS);
  }
  // Repli : 1 s, 2 s, 4 s… avec un peu d'aléa pour ne pas que dix requêtes repartent ensemble.
  const base = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt), MAX_DELAY_MS);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
export const MAX_ATTEMPTS = 4;

export interface AttemptResult { status: number; retryAfter: string | null }

/**
 * Rejoue `run` tant que le résultat est réessayable, dans la limite de `maxAttempts`.
 *
 * `sleep` est injecté : la stratégie se vérifie en millisecondes de test, pas en minutes d'attente.
 * Rend le dernier résultat — c'est à l'appelant de décider quoi en faire, y compris quand il
 * échoue encore.
 */
export async function withRetry<T extends AttemptResult>(
  run: (attempt: number) => Promise<T>,
  opts: { maxAttempts?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());

  let last!: T;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await run(attempt);
    if (!isRetryable(last.status)) return last;
    if (attempt === maxAttempts - 1) return last;
    await sleep(retryDelayMs(attempt, last.retryAfter, now()));
  }
  return last;
}
