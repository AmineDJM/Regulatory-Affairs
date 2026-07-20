import { gen, checkProperty } from "./property";

/**
 * Réduction automatique des scénarios en échec (§34). Quand une propriété échoue, on conserve la
 * graine, on reproduit, et on réduit l'entrée au **plus petit contre-exemple** encore fautif, avec
 * une commande de relance. Ce module DÉMONTRE la capacité sur une propriété volontairement fausse
 * (`n < seuil`) : le minimiseur doit converger exactement vers la borne.
 */

export interface MinimalScenario {
  property: string;
  seed: number;
  found: boolean;
  original: unknown;
  minimal: unknown;
  steps: number;
  reproduction: string;
}

/** Démontre le minimiseur : `n < threshold` sur [0, 100000] converge vers `threshold`. */
export function demonstrateMinimization(seed = 7, threshold = 1000): MinimalScenario {
  const arb = gen.int(0, 100000);
  const res = checkProperty(arb, (n) => n < threshold, { runs: 300, seed });
  return {
    property: `n < ${threshold}`,
    seed: res.seed,
    found: !res.ok,
    original: res.counterexample ?? null,
    minimal: res.shrunk ?? null,
    steps: res.shrinkSteps ?? 0,
    reproduction: `checkProperty(gen.int(0,100000), n => n < ${threshold}, { seed: ${res.seed} })`,
  };
}
