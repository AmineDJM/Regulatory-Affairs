/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE HASARD REPRODUCTIBLE (mandat 5 §39) — pur.
 *
 * Un générateur à graine (xoshiro128**), la loi normale par Box-Muller, les lois d'un modèle de
 * risque (normale, log-normale, uniforme, triangulaire, PERT, discrète, Bernoulli, Poisson), leurs
 * QUANTILES (pour la copule gaussienne : des entrées corrélées sans supposer qu'elles sont
 * normales) et la décomposition de Cholesky. Deux simulations avec la même graine rendent les
 * mêmes tirages : un chiffre de risque qui change à chaque lecture n'est pas un chiffre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Loi =
  | { loi: "normale"; moyenne: number; ecartType: number }
  | { loi: "lognormale"; moyenne: number; ecartType: number }
  | { loi: "uniforme"; min: number; max: number }
  | { loi: "triangulaire"; min: number; mode: number; max: number }
  | { loi: "pert"; min: number; mode: number; max: number; lambda?: number }
  | { loi: "discrete"; valeurs: { valeur: number; p: number }[] }
  | { loi: "bernoulli"; p: number; siVrai?: number; siFaux?: number }
  | { loi: "poisson"; lambda: number }
  | { loi: "constante"; valeur: number };

export const LOIS = ["normale", "lognormale", "uniforme", "triangulaire", "pert", "discrete", "bernoulli", "poisson", "constante"] as const;

/** xoshiro128** — rapide, période 2^128-1, et la MÊME suite pour la même graine. */
export function generateur(graine: number | string = 42): () => number {
  let h = 1779033703 ^ (typeof graine === "string" ? graine.length : 0);
  const texte = String(graine);
  for (let i = 0; i < texte.length; i += 1) { h = Math.imul(h ^ texte.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  const seed = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  let a = seed() || 1, b = seed() || 2, c = seed() || 3, d = seed() || 4;
  return () => {
    const t = b << 9;
    let r = Math.imul(a * 5, 1) | 0; r = Math.imul(((r << 7) | (r >>> 25)) >>> 0, 9) >>> 0;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

/** Une normale centrée réduite (Box-Muller, les deux valeurs servent). */
export function normaleStandard(u: () => number): () => number {
  let reserve: number | null = null;
  return () => {
    if (reserve !== null) { const r = reserve; reserve = null; return r; }
    let x = 0, y = 0, s = 0;
    do { x = u() * 2 - 1; y = u() * 2 - 1; s = x * x + y * y; } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    reserve = y * m;
    return x * m;
  };
}

/** La fonction de répartition de la normale centrée réduite (erf par Abramowitz-Stegun 7.1.26, erreur < 1,5e-7). */
export function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Le quantile de la normale centrée réduite (Acklam, erreur relative < 1,2e-9). */
export function phiInverse(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425, ph = 1 - pl;
  let q: number, r: number;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** Ce qui est faux dans une loi — dit avant de tirer quoi que ce soit. */
export function validerLoi(l: Loi): string | null {
  const fini = (...xs: number[]) => xs.every((x) => Number.isFinite(x));
  switch (l.loi) {
    case "normale": case "lognormale": return !fini(l.moyenne, l.ecartType) ? "moyenne et écart-type doivent être des nombres" : l.ecartType < 0 ? "l'écart-type ne peut pas être négatif" : l.loi === "lognormale" && l.moyenne <= 0 ? "une log-normale a une moyenne strictement positive" : null;
    case "uniforme": return !fini(l.min, l.max) ? "min et max doivent être des nombres" : l.max < l.min ? "max < min" : null;
    case "triangulaire": case "pert": return !fini(l.min, l.mode, l.max) ? "min, mode et max doivent être des nombres" : !(l.min <= l.mode && l.mode <= l.max) ? "il faut min ≤ mode ≤ max" : l.max === l.min ? "min = max : c'est une constante" : null;
    case "discrete": {
      if (!Array.isArray(l.valeurs) || l.valeurs.length === 0) return "une loi discrète a au moins une valeur";
      if (l.valeurs.some((v) => !fini(v.valeur, v.p) || v.p < 0)) return "chaque valeur porte une probabilité ≥ 0";
      const s = l.valeurs.reduce((a, v) => a + v.p, 0);
      return Math.abs(s - 1) > 0.02 ? `les probabilités somment à ${s.toFixed(3)}, pas à 1` : null;
    }
    case "bernoulli": return !fini(l.p) || l.p < 0 || l.p > 1 ? "p entre 0 et 1" : null;
    case "poisson": return !fini(l.lambda) || l.lambda < 0 ? "lambda ≥ 0" : null;
    case "constante": return !fini(l.valeur) ? "valeur numérique attendue" : null;
  }
}

/** L'espérance analytique, quand elle existe en forme close — pour dire l'écart entre la simulation et la théorie. */
export function esperance(l: Loi): number | null {
  switch (l.loi) {
    case "normale": return l.moyenne;
    case "lognormale": return l.moyenne;
    case "uniforme": return (l.min + l.max) / 2;
    case "triangulaire": return (l.min + l.mode + l.max) / 3;
    case "pert": { const lam = l.lambda ?? 4; return (l.min + lam * l.mode + l.max) / (lam + 2); }
    case "discrete": return l.valeurs.reduce((a, v) => a + v.valeur * v.p, 0);
    case "bernoulli": return l.p * (l.siVrai ?? 1) + (1 - l.p) * (l.siFaux ?? 0);
    case "poisson": return l.lambda;
    case "constante": return l.valeur;
  }
}

/**
 * LE QUANTILE d'une loi pour u ∈ (0,1) — c'est par lui qu'une corrélation gaussienne s'applique à
 * n'importe quelle marginale (copule). La log-normale est paramétrée par la MOYENNE et l'écart-type
 * de la variable elle-même (ce que la personne connaît), pas par ceux du logarithme.
 */
export function quantile(l: Loi, u: number): number {
  const v = Math.min(1 - 1e-12, Math.max(1e-12, u));
  switch (l.loi) {
    case "constante": return l.valeur;
    case "normale": return l.moyenne + l.ecartType * phiInverse(v);
    case "lognormale": {
      if (l.ecartType === 0) return l.moyenne;
      const s2 = Math.log(1 + (l.ecartType * l.ecartType) / (l.moyenne * l.moyenne));
      const mu = Math.log(l.moyenne) - s2 / 2;
      return Math.exp(mu + Math.sqrt(s2) * phiInverse(v));
    }
    case "uniforme": return l.min + (l.max - l.min) * v;
    case "triangulaire": {
      const fc = (l.mode - l.min) / (l.max - l.min);
      return v < fc ? l.min + Math.sqrt(v * (l.max - l.min) * (l.mode - l.min)) : l.max - Math.sqrt((1 - v) * (l.max - l.min) * (l.max - l.mode));
    }
    case "pert": {
      // Bêta(α, β) sur [min, max] : le quantile est l'INVERSE de la bêta incomplète.
      const lam = l.lambda ?? 4;
      const alpha = 1 + lam * (l.mode - l.min) / (l.max - l.min);
      const beta = 1 + lam * (l.max - l.mode) / (l.max - l.min);
      return l.min + (l.max - l.min) * betaInverse(v, alpha, beta);
    }
    case "discrete": {
      let cumul = 0;
      for (const x of l.valeurs) { cumul += x.p; if (v <= cumul) return x.valeur; }
      return l.valeurs[l.valeurs.length - 1]!.valeur;
    }
    case "bernoulli": return v < 1 - l.p ? (l.siFaux ?? 0) : (l.siVrai ?? 1);
    case "poisson": {
      let k = 0, p = Math.exp(-l.lambda), cumul = p;
      while (v > cumul && k < 10_000) { k += 1; p *= l.lambda / k; cumul += p; }
      return k;
    }
  }
}

/** log Γ (Lanczos) — pour les lois bêta et de Student. */
export function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const xx = x - 1;
  let a = c[0]!;
  const t = xx + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i]! / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

/** La fonction bêta incomplète régularisée I_x(a, b) (fraction continue de Lentz). */
export function betaIncompleteReguliere(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta);
  const cf = (xx: number, aa: number, bb: number): number => {
    const tiny = 1e-30;
    let c = 1, d = 1 - (aa + bb) * xx / (aa + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m += 1) {
      const m2 = 2 * m;
      let num = m * (bb - m) * xx / ((aa + m2 - 1) * (aa + m2));
      d = 1 + num * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + num / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; h *= d * c;
      num = -(aa + m) * (aa + bb + m) * xx / ((aa + m2) * (aa + m2 + 1));
      d = 1 + num * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + num / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? front * cf(x, a, b) / a : 1 - front * cf(1 - x, b, a) / b;
}

/**
 * L'INVERSE DE LA BÊTA INCOMPLÈTE — Newton ENCADRÉ par une bissection (« rtsafe »).
 *
 * ── LA MESURE QUI A PRODUIT CETTE FONCTION ──────────────────────────────────────────────
 *
 * Le tirage PERT coûtait à lui seul 7 100 ms sur 200 000 tirages, là où toutes les autres lois
 * tenaient entre 150 et 335 ms. Cause : SOIXANTE bissections par tirage, chacune appelant la
 * bêta incomplète (une fraction continue, elle-même itérative) — soit des milliers d'opérations
 * pour un seul nombre. C'est ce qui faisait déborder le budget mural de la simulation.
 *
 * ── POURQUOI SOIXANTE ITÉRATIONS N'ÉTAIENT PAS DE LA RIGUEUR ────────────────────────────
 *
 * Soixante bissections visent une précision de 2⁻⁶⁰, sous le pas du double (2⁻⁵³) : les vingt
 * dernières ne changeaient plus un bit. Et surtout, la grandeur qu'on estime est un percentile
 * tiré au sort : à 200 000 tirages son erreur d'échantillonnage vaut ~0,2 %. Une inversion à
 * 1e-12 est déjà un milliard de fois plus fine que le bruit qui l'entoure. Payer 2⁻⁶⁰ n'achetait
 * donc AUCUNE justesse — c'était du temps, pas de la précision.
 *
 * ── CE QUI REMPLACE, ET POURQUOI C'EST AUSSI SÛR ────────────────────────────────────────
 *
 * Newton converge quadratiquement sur cette fonction (sa dérivée est la densité, connue en
 * forme close) : quatre à six itérations au lieu de soixante. Newton seul serait FRAGILE — il
 * peut sortir de (0,1) sur les queues. On garde donc en permanence un CROCHET [lo, hi] qui
 * encadre la solution, et tout pas de Newton qui en sort est remplacé par une bissection. La
 * convergence est donc garantie AU PIRE au rythme de la bissection, jamais moins bonne
 * qu'avant, et le résultat reste borné par la même tolérance.
 */
export function betaInverse(u: number, a: number, b: number): number {
  if (!(u > 0)) return 0;
  if (!(u < 1)) return 1;
  let lo = 0;
  let hi = 1;
  let x = departBeta(u, a, b);
  const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
  /**
   * LA TOLÉRANCE EST RELATIVE, et c'est le point le plus important de cette fonction.
   *
   * Une première version s'arrêtait sur |I(x) - u| < 1e-12. Pour u = 1e-12 — la queue d'un
   * risque, c'est-à-dire exactement ce qu'on simule — ce test est vrai DÈS LE DÉPART : la
   * fonction rendait donc son point de départ. Mesuré : 89 % d'erreur relative là où les
   * soixante bissections en faisaient 1e-6. Plus rapide et FAUX est un mauvais échange.
   */
  const tol = 1e-13 * Math.min(u, 1 - u);
  for (let i = 0; i < 60; i += 1) {
    const f = betaIncompleteReguliere(x, a, b) - u;
    if (f < 0) lo = x; else hi = x;
    if (Math.abs(f) <= tol) return x;
    // La dérivée de I_x(a,b) EST la densité bêta : x^(a-1) (1-x)^(b-1) / B(a,b).
    const d = Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - logB);
    // Un pas non fini, nul, ou qui sort du crochet : on retombe sur la bissection. C'est cette
    // ligne qui rend l'ensemble SÛR — sans elle, une queue lointaine ferait diverger Newton.
    const xn = Number.isFinite(d) && d > 0 ? x - f / d : NaN;
    const suivant = xn > lo && xn < hi ? xn : (lo + hi) / 2;
    // L'arrêt sur le pas est lui aussi RELATIF : sous le pas du double autour de x, itérer
    // encore ne déplace plus rien — mais « autour de x » ne veut pas dire la même chose à
    // x = 0,5 et à x = 1e-9.
    if (Math.abs(suivant - x) <= 1e-15 * x) return suivant;
    x = suivant;
  }
  return x;
}

/**
 * LE POINT DE DÉPART DE NEWTON — l'approximation normale d'Abramowitz & Stegun 26.5.22.
 *
 * Partir de la moyenne suffirait à converger (le crochet garantit tout), mais coûterait une
 * dizaine de bissections avant que Newton ne prenne le relais dans les queues. Cette
 * approximation place le départ à quelques pour cent de la solution même pour u = 1e-12 :
 * c'est là que se trouve la vitesse, pas dans un critère d'arrêt relâché.
 *
 * Le second cas (α ou β < 1) est le développement en série près de 0 et de 1 ; PERT ne
 * l'atteint jamais — α = 1 + λ(mode−min)/(max−min) ≥ 1 — mais `betaInverse` est exportée, et
 * une fonction exportée qui ne serait juste que pour son appelant du jour est un piège.
 */
function departBeta(u: number, a: number, b: number): number {
  let x: number;
  if (a >= 1 && b >= 1) {
    const y = phiInverse(u);
    const al = (y * y - 3) / 6;
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1));
    const w = (y * Math.sqrt(al + h)) / h - (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h));
    x = a / (a + b * Math.exp(2 * w));
  } else {
    const t = Math.exp(a * Math.log(a / (a + b))) / a;
    const v = Math.exp(b * Math.log(b / (a + b))) / b;
    const w = t + v;
    x = u < t / w ? (a * w * u) ** (1 / a) : 1 - (b * w * (1 - u)) ** (1 / b);
  }
  // Un départ hors de (0,1) — arithmétique dégénérée — retombe sur la moyenne, toujours valide.
  return x > 0 && x < 1 ? x : a / (a + b);
}

/** Cholesky d'une matrice symétrique définie positive ; `null` si elle ne l'est pas (corrélations incohérentes). */
export function cholesky(m: readonly (readonly number[])[]): number[][] | null {
  const n = m.length;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = m[i]![j]!;
      for (let k = 0; k < j; k += 1) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) { if (s <= 1e-12) return null; L[i]![j] = Math.sqrt(s); }
      else L[i]![j] = s / L[j]![j]!;
    }
  }
  return L;
}
