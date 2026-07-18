/**
 * Anti-rafale process-wide pour les écritures « présence / dernier vu » (`lastSeenAt`).
 *
 * Sans ce garde, `lastSeenAt` est réécrit **à chaque requête** (validation de session) et **à
 * chaque battement de polling** de la messagerie (toutes les ~6 s par onglet ouvert) : autant
 * d'UPDATE Postgres → un flux d'écritures WAL constant, visible en pics réguliers de « Disk
 * Operations » sur l'hébergeur, même quand personne ne fait rien.
 *
 * `shouldTouch(key, windowMs)` renvoie `true` (et mémorise l'instant) si `key` n'a pas été
 * touchée depuis `windowMs` — sinon `false`. On n'écrit donc `lastSeenAt` qu'au plus une fois
 * par fenêtre (≈ 1×/min), ce qui suffit largement pour la présence et le « dernier clic ».
 *
 * Portée : par **instance** de serveur (en mémoire). Avec plusieurs instances, chacune
 * throttle indépendamment — la réduction reste massive. La map est bornée (purge au-delà de
 * 5 000 clés) pour éviter toute fuite mémoire.
 */
const lastTouch = new Map<string, number>();

export function shouldTouch(key: string, windowMs: number): boolean {
  const now = Date.now();
  const prev = lastTouch.get(key);
  if (prev !== undefined && now - prev < windowMs) return false;
  lastTouch.set(key, now);
  if (lastTouch.size > 5000) {
    for (const [k, t] of lastTouch) if (now - t > windowMs * 4) lastTouch.delete(k);
  }
  return true;
}
