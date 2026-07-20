/**
 * Moteur de property-based testing (§27) — générateurs déterministes (RNG semé), propriétés, et
 * **réduction automatique** du contre-exemple (§34, shrinking intégré). Reproductible : chaque
 * échec renvoie la graine + le contre-exemple minimal. Aucune dépendance externe.
 */

/** RNG déterministe (mulberry32) — même graine ⇒ même suite. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Arbitrary<T> {
  generate: (rng: () => number) => T;
  shrink: (value: T) => T[];
}

function int(min: number, max: number): Arbitrary<number> {
  return {
    generate: (rng) => min + Math.floor(rng() * (max - min + 1)),
    shrink: (v) => {
      const out: number[] = [];
      if (v > min) {
        const mid = min + Math.floor((v - min) / 2);
        if (mid < v) out.push(mid);
        out.push(v - 1);
      }
      return [...new Set(out)].filter((x) => x >= min && x < v);
    },
  };
}

const bool: Arbitrary<boolean> = { generate: (rng) => rng() < 0.5, shrink: (v) => (v ? [false] : []) };

function constantFrom<T>(values: readonly T[]): Arbitrary<T> {
  return {
    generate: (rng) => values[Math.floor(rng() * values.length)],
    shrink: (v) => {
      const i = values.indexOf(v);
      return i > 0 ? [values[0]] : []; // réduire vers le premier
    },
  };
}

function stringOf(alphabet: string, maxLen: number): Arbitrary<string> {
  return {
    generate: (rng) => {
      const len = Math.floor(rng() * (maxLen + 1));
      let s = "";
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
      return s;
    },
    shrink: (v) => {
      const out: string[] = [];
      if (v.length > 0) { out.push(v.slice(0, Math.floor(v.length / 2))); out.push(v.slice(0, v.length - 1)); }
      return [...new Set(out)];
    },
  };
}

function array<T>(elem: Arbitrary<T>, maxLen: number): Arbitrary<T[]> {
  return {
    generate: (rng) => {
      const len = Math.floor(rng() * (maxLen + 1));
      return Array.from({ length: len }, () => elem.generate(rng));
    },
    shrink: (v) => {
      if (v.length === 0) return [];
      const out: T[][] = [[], v.slice(0, Math.floor(v.length / 2)), v.slice(1), v.slice(0, v.length - 1)];
      return out.filter((a) => a.length < v.length);
    },
  };
}

function record<T extends Record<string, unknown>>(shape: { [K in keyof T]: Arbitrary<T[K]> }): Arbitrary<T> {
  const keys = Object.keys(shape) as (keyof T)[];
  return {
    generate: (rng) => {
      const o = {} as T;
      for (const k of keys) o[k] = shape[k].generate(rng);
      return o;
    },
    shrink: (v) => {
      const out: T[] = [];
      for (const k of keys) for (const sv of shape[k].shrink(v[k])) out.push({ ...v, [k]: sv });
      return out;
    },
  };
}

export const gen = { int, nat: (max: number) => int(0, max), bool, constantFrom, stringOf, array, record };

export interface PropertyResult<T> {
  ok: boolean;
  runs: number;
  seed: number;
  counterexample?: T;
  shrunk?: T;
  shrinkSteps?: number;
}

/**
 * Vérifie une propriété sur `runs` valeurs générées. À l'échec : réduit le contre-exemple au plus
 * petit qui échoue encore (§34) et renvoie la graine pour reproduction exacte.
 */
export function checkProperty<T>(arb: Arbitrary<T>, prop: (v: T) => boolean, opts: { runs?: number; seed?: number } = {}): PropertyResult<T> {
  const runs = opts.runs ?? 100;
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = makeRng(seed);
  const fails = (v: T) => { try { return prop(v) === false; } catch { return true; } };

  for (let i = 0; i < runs; i++) {
    const v = arb.generate(rng);
    if (fails(v)) {
      let cur = v, steps = 0;
      for (let guard = 0; guard < 2000; guard++) {
        const smaller = arb.shrink(cur).find((c) => fails(c));
        if (smaller === undefined) break;
        cur = smaller; steps++;
      }
      return { ok: false, runs: i + 1, seed, counterexample: v, shrunk: cur, shrinkSteps: steps };
    }
  }
  return { ok: true, runs, seed };
}
