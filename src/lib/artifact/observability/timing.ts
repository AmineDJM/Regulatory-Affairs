/**
 * LES CHRONOS DU LIVE OFFICE (§97) — mesurés, jamais estimés.
 *
 * §29 pose des cibles chiffrées : moins d'une à deux secondes pour une modification simple, une
 * suppression de page PDF quasi instantanée. Une cible sans mesure est un vœu ; ce module fait
 * en sorte que chaque appel rende ses temps, et que le banc (`scripts/bench/`) les agrège en
 * P50 / P95 sur des fichiers réels.
 *
 * Module PUR, sans dépendance : il traverse la frontière client / serveur avec la vue.
 */

export interface Chrono {
  /** `open`, `edit`, `save`, `annuler`… — ce qui a été mesuré. */
  quoi: string;
  /** Durée totale en millisecondes. */
  totalMs: number;
  /** Les étapes intermédiaires nommées : `commandParse`, `commandApply`, `serialize`… */
  etapes: Record<string, number>;
}

export interface Mesure {
  /** Marque une étape : le temps écoulé DEPUIS la marque précédente. */
  etape(nom: string): void;
  fin(quoi: string): Chrono;
}

const maintenant = (): number =>
  (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();

export function mesurer(): Mesure {
  const debut = maintenant();
  let precedent = debut;
  const etapes: Record<string, number> = {};
  return {
    etape(nom: string) {
      const t = maintenant();
      etapes[nom] = Math.round((t - precedent) * 10) / 10;
      precedent = t;
    },
    fin(quoi: string): Chrono {
      return { quoi, totalMs: Math.round((maintenant() - debut) * 10) / 10, etapes };
    },
  };
}

/** Les percentiles d'une série — la seule façon honnête de rapporter une latence. */
export function percentiles(valeurs: number[]): { p50: number; p95: number; max: number; n: number } {
  if (valeurs.length === 0) return { p50: 0, p95: 0, max: 0, n: 0 };
  const tri = [...valeurs].sort((a, b) => a - b);
  const au = (p: number) => tri[Math.min(tri.length - 1, Math.floor((p / 100) * tri.length))];
  return {
    p50: Math.round(au(50) * 10) / 10,
    p95: Math.round(au(95) * 10) / 10,
    max: Math.round(tri[tri.length - 1] * 10) / 10,
    n: tri.length,
  };
}
