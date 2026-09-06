/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC D'APPRENTISSAGE (mandat 5 §39) — pur.
 *
 * Segmentation (k-moyennes++ avec choix du k par la silhouette), réduction de dimension (ACP par
 * itération de puissance sur la matrice de corrélation), détection d'ANOMALIES par trois regards
 * qui ne voient pas les mêmes choses (écart robuste au z-score modifié, distance de Mahalanobis
 * multivariée, isolement par densité locale) et classification par k plus proches voisins.
 *
 * Les pièges nommés par le code, parce que personne ne les lit dans une note de bas de page :
 * une segmentation sans NORMALISATION regroupe sur l'unité de mesure (un montant en DZD écrase un
 * âge) ; k-moyennes trouve TOUJOURS k groupes, même dans du bruit ; une ACP sur des variables non
 * réduites décrit la variance de la plus grande échelle ; une anomalie statistique n'est pas une
 * erreur, c'est une observation à REGARDER.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { generateur } from "./alea";
import { type Rigueur, arrondi, ecartType, mediane, moyenne, percentile, rigueurVide } from "./rigueur";

export const POINTS_MAX = 100_000;
export const DIMENSIONS_MAX = 60;

const nombreDe = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") { const t = v.trim().replace(/\s/g, "").replace(",", "."); const n = t ? Number(t) : NaN; return Number.isFinite(n) ? n : null; }
  return null;
};

export interface Matrice {
  colonnes: string[];
  lignes: number[][];
  /** Index dans le tableau d'origine (les lignes incomplètes sont écartées). */
  index: number[];
  incompletes: number;
}

/** Extrait une matrice numérique ; une colonne non numérique n'est pas devinée, elle est ignorée et DITE. */
export function matriceDe(lignes: readonly Record<string, unknown>[], colonnes?: readonly string[]): { ok: true; m: Matrice; ignorees: string[] } | { ok: false; erreur: string } {
  if (!lignes.length) return { ok: false, erreur: "Aucune observation." };
  if (lignes.length > POINTS_MAX) return { ok: false, erreur: `${lignes.length} observations : ${POINTS_MAX} au plus (limite opérationnelle).` };
  const candidates = colonnes?.length ? [...colonnes] : [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  const retenues: string[] = [], ignorees: string[] = [];
  for (const c of candidates) {
    const n = lignes.filter((l) => nombreDe(l[c]) !== null).length;
    if (n >= lignes.length * 0.5) retenues.push(c); else ignorees.push(c);
  }
  if (!retenues.length) return { ok: false, erreur: `Aucune colonne numérique exploitable parmi ${candidates.slice(0, 8).join(", ")}.` };
  if (retenues.length > DIMENSIONS_MAX) return { ok: false, erreur: `${retenues.length} dimensions : ${DIMENSIONS_MAX} au plus.` };
  const out: number[][] = [], index: number[] = [];
  let incompletes = 0;
  for (const [i, l] of lignes.entries()) {
    const v = retenues.map((c) => nombreDe(l[c]));
    if (v.some((x) => x === null)) { incompletes += 1; continue; }
    out.push(v as number[]); index.push(i);
  }
  if (out.length < 2) return { ok: false, erreur: `${out.length} ligne(s) complète(s) : trop peu (${incompletes} écartée(s) faute de valeur).` };
  return { ok: true, m: { colonnes: retenues, lignes: out, index, incompletes }, ignorees };
}

/** Centre-réduit chaque colonne ; rend les moyennes et écarts pour revenir à l'échelle d'origine. */
export function normaliser(m: Matrice): { z: number[][]; moyennes: number[]; ecarts: number[]; constantes: string[] } {
  const p = m.colonnes.length;
  const moyennes: number[] = [], ecarts: number[] = [], constantes: string[] = [];
  for (let j = 0; j < p; j += 1) {
    const col = m.lignes.map((r) => r[j]!);
    const mu = moyenne(col), sd = ecartType(col);
    moyennes.push(mu);
    ecarts.push(sd > 1e-12 ? sd : 1);
    if (sd <= 1e-12) constantes.push(m.colonnes[j]!);
  }
  const z = m.lignes.map((r) => r.map((x, j) => (x - moyennes[j]!) / ecarts[j]!));
  return { z, moyennes, ecarts, constantes };
}

/* ─────────────────────────────── Segmentation ─────────────────────────────── */

export interface Groupe {
  numero: number;
  taille: number;
  /** Le centre, dans les unités D'ORIGINE (pas en écarts-types). */
  centre: Record<string, number>;
  /** L'écart du centre à la moyenne générale, en écarts-types : ce qui CARACTÉRISE le groupe. */
  signature: { colonne: string; ecartsTypes: number }[];
  /** Indices dans le tableau d'origine. */
  membres: number[];
  inertie: number;
}

export interface Segmentation {
  ok: true;
  k: number;
  kTeste: { k: number; silhouette: number; inertie: number }[];
  groupes: Groupe[];
  silhouette: number;
  colonnes: string[];
  normalise: boolean;
  affectations: { index: number; groupe: number; distanceAuCentre: number }[];
  rigueur: Rigueur;
  ms: number;
}
export type ResultatSegmentation = Segmentation | { ok: false; erreur: string };

const distance2 = (a: readonly number[], b: readonly number[]): number => { let s = 0; for (let i = 0; i < a.length; i += 1) s += (a[i]! - b[i]!) ** 2; return s; };

function kMoyennes(z: number[][], k: number, graine: number | string): { centres: number[][]; affect: number[]; inertie: number } {
  const u = generateur(graine);
  const n = z.length, p = z[0]!.length;
  // k-means++ : le premier centre au hasard, les suivants loin des précédents.
  const centres: number[][] = [[...z[Math.floor(u() * n)]!]];
  while (centres.length < k) {
    const d = z.map((x) => Math.min(...centres.map((c) => distance2(x, c))));
    const total = d.reduce((s, x) => s + x, 0);
    if (total <= 0) { centres.push([...z[Math.floor(u() * n)]!]); continue; }
    let cible = u() * total, idx = 0;
    for (let i = 0; i < n; i += 1) { cible -= d[i]!; if (cible <= 0) { idx = i; break; } }
    centres.push([...z[idx]!]);
  }
  const affect = new Array<number>(n).fill(0);
  for (let iter = 0; iter < 100; iter += 1) {
    let bouge = false;
    for (let i = 0; i < n; i += 1) {
      let meilleur = 0, best = Infinity;
      for (let c = 0; c < k; c += 1) { const d = distance2(z[i]!, centres[c]!); if (d < best) { best = d; meilleur = c; } }
      if (affect[i] !== meilleur) { affect[i] = meilleur; bouge = true; }
    }
    const sommes = Array.from({ length: k }, () => new Array<number>(p).fill(0));
    const comptes = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i += 1) { comptes[affect[i]!] += 1; const s = sommes[affect[i]!]!; for (let j = 0; j < p; j += 1) s[j] = s[j]! + z[i]![j]!; }
    for (let c = 0; c < k; c += 1) {
      if (!comptes[c]) { centres[c] = [...z[Math.floor(u() * n)]!]; bouge = true; continue; }
      for (let j = 0; j < p; j += 1) centres[c]![j] = sommes[c]![j]! / comptes[c]!;
    }
    if (!bouge && iter > 0) break;
  }
  let inertie = 0;
  for (let i = 0; i < n; i += 1) inertie += distance2(z[i]!, centres[affect[i]!]!);
  return { centres, affect, inertie };
}

/** La silhouette moyenne : proche de 1 = groupes nets, proche de 0 = découpage arbitraire. */
function silhouetteMoyenne(z: number[][], affect: number[], k: number, echantillonMax = 2_000): number {
  const n = z.length;
  const pas = Math.max(1, Math.floor(n / echantillonMax));
  let somme = 0, compte = 0;
  for (let i = 0; i < n; i += pas) {
    const distances = new Array<number>(k).fill(0);
    const comptes = new Array<number>(k).fill(0);
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      distances[affect[j]!] += Math.sqrt(distance2(z[i]!, z[j]!));
      comptes[affect[j]!] += 1;
    }
    const a = comptes[affect[i]!] ? distances[affect[i]!]! / comptes[affect[i]!]! : 0;
    let b = Infinity;
    for (let c = 0; c < k; c += 1) if (c !== affect[i]! && comptes[c]) b = Math.min(b, distances[c]! / comptes[c]!);
    if (!Number.isFinite(b)) continue;
    somme += (b - a) / Math.max(a, b);
    compte += 1;
  }
  return compte ? somme / compte : 0;
}

export function segmenter(
  lignes: readonly Record<string, unknown>[],
  options: { colonnes?: readonly string[]; k?: number; kMax?: number; normaliser?: boolean; graine?: number | string } = {},
): ResultatSegmentation {
  const t0 = Date.now();
  const extrait = matriceDe(lignes, options.colonnes);
  if (!extrait.ok) return extrait;
  const { m, ignorees } = extrait;
  const rigueur = rigueurVide();
  const n = m.lignes.length;
  const normalise = options.normaliser !== false;
  const norm = normaliser(m);
  const z = normalise ? norm.z : m.lignes;
  const graine = options.graine ?? 7;

  const kMax = Math.max(2, Math.min(options.kMax ?? 8, Math.floor(n / 2), 12));
  const kTeste: { k: number; silhouette: number; inertie: number }[] = [];
  let meilleur: { k: number; centres: number[][]; affect: number[]; inertie: number; sil: number } | null = null;
  const candidats = options.k ? [Math.max(1, Math.min(options.k, n))] : Array.from({ length: kMax - 1 }, (_, i) => i + 2);
  for (const k of candidats) {
    if (k >= n) continue;
    let best: { centres: number[][]; affect: number[]; inertie: number } | null = null;
    for (let essai = 0; essai < 5; essai += 1) {
      const r = kMoyennes(z, k, `${graine}:${k}:${essai}`);
      if (!best || r.inertie < best.inertie) best = r;
    }
    if (!best) continue;
    const sil = k > 1 ? silhouetteMoyenne(z, best.affect, k) : 0;
    kTeste.push({ k, silhouette: sil, inertie: best.inertie });
    if (!meilleur || sil > meilleur.sil) meilleur = { k, centres: best.centres, affect: best.affect, inertie: best.inertie, sil };
  }
  if (!meilleur) return { ok: false, erreur: "Segmentation impossible : trop peu d'observations distinctes." };

  const p = m.colonnes.length;
  const moyenneGenerale = norm.moyennes;
  const groupes: Groupe[] = [];
  for (let c = 0; c < meilleur.k; c += 1) {
    const membres = meilleur.affect.map((a, i) => (a === c ? m.index[i]! : -1)).filter((i) => i >= 0);
    const idx = meilleur.affect.map((a, i) => (a === c ? i : -1)).filter((i) => i >= 0);
    const centreOrigine: Record<string, number> = {};
    const signature: { colonne: string; ecartsTypes: number }[] = [];
    for (let j = 0; j < p; j += 1) {
      const brut = normalise ? meilleur.centres[c]![j]! * norm.ecarts[j]! + norm.moyennes[j]! : meilleur.centres[c]![j]!;
      centreOrigine[m.colonnes[j]!] = brut;
      signature.push({ colonne: m.colonnes[j]!, ecartsTypes: (brut - moyenneGenerale[j]!) / norm.ecarts[j]! });
    }
    signature.sort((a, b) => Math.abs(b.ecartsTypes) - Math.abs(a.ecartsTypes));
    let inertie = 0;
    for (const i of idx) inertie += distance2(z[i]!, meilleur.centres[c]!);
    groupes.push({ numero: c + 1, taille: membres.length, centre: centreOrigine, signature: signature.slice(0, 5), membres, inertie });
  }
  groupes.sort((a, b) => b.taille - a.taille);
  groupes.forEach((g, i) => { g.numero = i + 1; });
  const renumerotation = new Map<number, number>();
  // (les affectations suivent la renumérotation par taille)
  const parMembre = new Map<number, number>();
  for (const g of groupes) for (const mIdx of g.membres) parMembre.set(mIdx, g.numero);
  const affectations = m.index.map((origine, i) => ({
    index: origine,
    groupe: parMembre.get(origine) ?? 0,
    distanceAuCentre: Math.sqrt(distance2(z[i]!, meilleur!.centres[meilleur!.affect[i]!]!)),
  }));
  void renumerotation;

  rigueur.hypotheses.push(normalise
    ? "Variables centrées-réduites avant le calcul : chaque dimension pèse pareil, quelle que soit son unité."
    : "Variables NON normalisées (demandé) : la dimension de plus grande amplitude domine la distance — un montant en DZD écrase un âge.");
  rigueur.hypotheses.push(`Distance euclidienne sur ${m.colonnes.join(", ")}${ignorees.length ? ` ; colonnes non numériques ignorées : ${ignorees.slice(0, 6).join(", ")}` : ""}.`);
  rigueur.limites.push("Les k-moyennes trouvent TOUJOURS k groupes, même dans un nuage sans structure : la silhouette dit si le découpage tient.");
  rigueur.limites.push("Groupes sphériques et de taille comparable : une structure allongée ou imbriquée est mal rendue.");
  if (meilleur.sil < 0.25) rigueur.avertissements.push(`Silhouette ${arrondi(meilleur.sil, 3)} : les groupes se chevauchent largement, ce découpage est faible — les données n'ont peut-être pas de segments naturels.`);
  else if (meilleur.sil < 0.5) rigueur.avertissements.push(`Silhouette ${arrondi(meilleur.sil, 3)} : structure présente mais peu marquée.`);
  if (norm.constantes.length) rigueur.avertissements.push(`Colonne(s) constante(s) sans effet sur le découpage : ${norm.constantes.join(", ")}.`);
  if (m.incompletes) rigueur.avertissements.push(`${m.incompletes} ligne(s) écartée(s) faute de valeur.`);
  const petits = groupes.filter((g) => g.taille < Math.max(3, n * 0.02));
  if (petits.length) rigueur.avertissements.push(`Groupe(s) minuscule(s) : ${petits.map((g) => `n°${g.numero} (${g.taille})`).join(", ")} — souvent des valeurs extrêmes plutôt qu'un segment.`);

  return { ok: true, k: meilleur.k, kTeste, groupes, silhouette: meilleur.sil, colonnes: m.colonnes, normalise, affectations, rigueur, ms: Date.now() - t0 };
}

/* ─────────────────────────────── Analyse en composantes principales ─────────────────────────────── */

export interface Composante {
  numero: number;
  varianceExpliqueePourcent: number;
  cumulPourcent: number;
  /** Les poids de chaque variable dans la composante — ce qu'elle « veut dire ». */
  poids: { colonne: string; poids: number }[];
  valeurPropre: number;
}

export interface Acp {
  ok: true;
  colonnes: string[];
  n: number;
  composantes: Composante[];
  /** Le nombre de composantes qui portent 90 % de l'information. */
  composantesPour90: number;
  /** Les coordonnées des observations sur les deux premières composantes (pour une projection). */
  projection: { index: number; c1: number; c2: number }[];
  rigueur: Rigueur;
  ms: number;
}
export type ResultatAcp = Acp | { ok: false; erreur: string };

export function acp(lignes: readonly Record<string, unknown>[], colonnes?: readonly string[], maxComposantes = 5): ResultatAcp {
  const t0 = Date.now();
  const extrait = matriceDe(lignes, colonnes);
  if (!extrait.ok) return extrait;
  const { m } = extrait;
  if (m.colonnes.length < 2) return { ok: false, erreur: "Au moins deux variables numériques sont nécessaires pour une ACP." };
  const rigueur = rigueurVide();
  const { z, constantes } = normaliser(m);
  const p = m.colonnes.length, n = z.length;
  // Matrice de corrélation (les variables sont réduites, donc covariance = corrélation).
  const C: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (const r of z) for (let a = 0; a < p; a += 1) for (let b = a; b < p; b += 1) C[a]![b] = C[a]![b]! + (r[a]! * r[b]!) / (n - 1);
  for (let a = 0; a < p; a += 1) for (let b = 0; b < a; b += 1) C[a]![b] = C[b]![a]!;

  // Itération de puissance avec déflation.
  const composantes: Composante[] = [];
  const vecteurs: number[][] = [];
  const M = C.map((r) => [...r]);
  const total = p; // trace de la matrice de corrélation
  const u = generateur(5);
  const k = Math.min(maxComposantes, p);
  for (let c = 0; c < k; c += 1) {
    let v = Array.from({ length: p }, () => u() - 0.5);
    let lambda = 0;
    for (let iter = 0; iter < 500; iter += 1) {
      const w = new Array<number>(p).fill(0);
      for (let a = 0; a < p; a += 1) { let s = 0; for (let b = 0; b < p; b += 1) s += M[a]![b]! * v[b]!; w[a] = s; }
      const norme = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      if (norme < 1e-12) break;
      const nv = w.map((x) => x / norme);
      const diff = nv.reduce((s, x, i) => s + Math.abs(x - v[i]!), 0);
      v = nv; lambda = norme;
      if (diff < 1e-12) break;
    }
    if (lambda <= 1e-9) break;
    // Orienter : la plus grande charge en valeur absolue est positive (stabilité du signe).
    let maxIdx = 0;
    for (let a = 1; a < p; a += 1) if (Math.abs(v[a]!) > Math.abs(v[maxIdx]!)) maxIdx = a;
    if (v[maxIdx]! < 0) v = v.map((x) => -x);
    vecteurs.push(v);
    const poids = m.colonnes.map((nom, a) => ({ colonne: nom, poids: v[a]! })).sort((a, b) => Math.abs(b.poids) - Math.abs(a.poids));
    composantes.push({ numero: c + 1, valeurPropre: lambda, varianceExpliqueePourcent: (lambda / total) * 100, cumulPourcent: 0, poids });
    for (let a = 0; a < p; a += 1) for (let b = 0; b < p; b += 1) M[a]![b] = M[a]![b]! - lambda * v[a]! * v[b]!;
  }
  let cumul = 0;
  for (const c of composantes) { cumul += c.varianceExpliqueePourcent; c.cumulPourcent = cumul; }
  const composantesPour90 = composantes.findIndex((c) => c.cumulPourcent >= 90) + 1 || composantes.length;

  const projection = z.map((r, i) => ({
    index: m.index[i]!,
    c1: vecteurs[0] ? r.reduce((s, x, a) => s + x * vecteurs[0]![a]!, 0) : 0,
    c2: vecteurs[1] ? r.reduce((s, x, a) => s + x * vecteurs[1]![a]!, 0) : 0,
  }));

  rigueur.hypotheses.push("Variables centrées-réduites : l'ACP porte sur la matrice de CORRÉLATION, pas de covariance — une variable en millions ne domine pas une variable en unités.");
  rigueur.limites.push("Une composante est une combinaison linéaire : elle résume, elle n'explique pas. Son sens vient des poids, pas d'un nom.");
  rigueur.limites.push("Une structure non linéaire (courbe, groupes imbriqués) n'est pas capturée par une projection linéaire.");
  if (constantes.length) rigueur.avertissements.push(`Colonne(s) constante(s) ignorée(s) de fait : ${constantes.join(", ")}.`);
  if (composantes[0] && composantes[0].varianceExpliqueePourcent > 90) rigueur.avertissements.push("La première composante porte plus de 90 % : les variables mesurent probablement la même chose (redondance forte).");
  if (composantesPour90 >= p) rigueur.avertissements.push("Aucune réduction utile : il faut presque autant de composantes que de variables — les variables sont peu corrélées entre elles.");
  if (n < 5 * p) rigueur.avertissements.push(`${n} observations pour ${p} variables : une ACP demande au moins ${5 * p} observations pour être stable.`);

  return { ok: true, colonnes: m.colonnes, n, composantes, composantesPour90, projection, rigueur, ms: Date.now() - t0 };
}

/* ─────────────────────────────── Anomalies ─────────────────────────────── */

export interface Anomalie {
  index: number;
  score: number;
  methodes: string[];
  raisons: string[];
  valeurs: Record<string, number>;
}

export interface DetectionAnomalies {
  ok: true;
  n: number;
  colonnes: string[];
  anomalies: Anomalie[];
  seuils: { zModifie: number; mahalanobis: number; isolement: number };
  rigueur: Rigueur;
  ms: number;
}
export type ResultatAnomalies = DetectionAnomalies | { ok: false; erreur: string };

/** Trois regards : écart robuste par variable, distance de Mahalanobis, et densité locale. */
export function detecterAnomalies(
  lignes: readonly Record<string, unknown>[],
  options: { colonnes?: readonly string[]; sensibilite?: "prudente" | "normale" | "large" } = {},
): ResultatAnomalies {
  const t0 = Date.now();
  const extrait = matriceDe(lignes, options.colonnes);
  if (!extrait.ok) return extrait;
  const { m } = extrait;
  const rigueur = rigueurVide();
  const n = m.lignes.length, p = m.colonnes.length;
  if (n < 8) return { ok: false, erreur: `${n} observations : au moins 8 sont nécessaires pour distinguer une anomalie du bruit.` };
  const sens = options.sensibilite ?? "normale";
  const seuilZ = sens === "prudente" ? 5 : sens === "large" ? 3 : 3.5;
  const seuilMahalanobis = sens === "prudente" ? 0.999 : sens === "large" ? 0.99 : 0.995;
  // Facteur d'aberration locale : 1 = densité identique à celle du voisinage ; au-delà, le point est seul.
  const seuilIsolement = sens === "prudente" ? 3 : sens === "large" ? 1.6 : 2.2;

  const trouvees = new Map<number, Anomalie>();
  const ajouter = (i: number, methode: string, score: number, raison: string) => {
    const idx = m.index[i]!;
    const a = trouvees.get(idx) ?? { index: idx, score: 0, methodes: [], raisons: [], valeurs: Object.fromEntries(m.colonnes.map((c, j) => [c, m.lignes[i]![j]!])) };
    a.score = Math.max(a.score, score);
    if (!a.methodes.includes(methode)) a.methodes.push(methode);
    a.raisons.push(raison);
    trouvees.set(idx, a);
  };

  // 1) Z-score MODIFIÉ (médiane et écart absolu médian) : insensible aux extrêmes qu'il cherche.
  for (let j = 0; j < p; j += 1) {
    const col = m.lignes.map((r) => r[j]!);
    const med = mediane(col);
    const mad = mediane(col.map((x) => Math.abs(x - med)));
    if (mad < 1e-12) continue;
    for (let i = 0; i < n; i += 1) {
      const z = (0.6745 * (col[i]! - med)) / mad;
      if (Math.abs(z) > seuilZ) ajouter(i, "écart robuste", Math.abs(z) / seuilZ, `${m.colonnes[j]} = ${arrondi(col[i]!, 4)} à ${arrondi(Math.abs(z), 1)} écarts robustes de la médiane (${arrondi(med, 4)})`);
    }
  }

  // 2) Mahalanobis : une combinaison anormale de valeurs chacune normale.
  if (p >= 2 && n > p * 3) {
    const { z } = normaliser(m);
    const C: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (const r of z) for (let a = 0; a < p; a += 1) for (let b = 0; b < p; b += 1) C[a]![b] = C[a]![b]! + (r[a]! * r[b]!) / (n - 1);
    for (let a = 0; a < p; a += 1) C[a]![a] = C[a]![a]! + 1e-6;
    const M: number[][] = C.map((r, i) => [...r, ...Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))]);
    let inversible = true;
    for (let col = 0; col < p; col += 1) {
      let pivot = col;
      for (let r = col + 1; r < p; r += 1) if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
      if (Math.abs(M[pivot]![col]!) < 1e-12) { inversible = false; break; }
      [M[col], M[pivot]] = [M[pivot]!, M[col]!];
      const d = M[col]![col]!;
      for (let j2 = 0; j2 < 2 * p; j2 += 1) M[col]![j2] = M[col]![j2]! / d;
      for (let r = 0; r < p; r += 1) { if (r === col) continue; const f = M[r]![col]!; if (Math.abs(f) < 1e-15) continue; for (let j2 = 0; j2 < 2 * p; j2 += 1) M[r]![j2] = M[r]![j2]! - f * M[col]![j2]!; }
    }
    if (inversible) {
      const inv = M.map((r) => r.slice(p));
      const d2s = z.map((r) => { let s = 0; for (let a = 0; a < p; a += 1) for (let b = 0; b < p; b += 1) s += r[a]! * inv[a]![b]! * r[b]!; return s; });
      // Seuil empirique robuste : le quantile demandé de la distribution observée, au moins χ²(p).
      const seuil = Math.max(percentile(d2s, seuilMahalanobis * 100), p + 3 * Math.sqrt(2 * p));
      for (let i = 0; i < n; i += 1) if (d2s[i]! > seuil) {
        const contributions = m.colonnes.map((c, j) => ({ c, v: Math.abs(z[i]![j]!) })).sort((a, b) => b.v - a.v).slice(0, 2);
        ajouter(i, "profil multivarié", d2s[i]! / seuil, `combinaison inhabituelle (${contributions.map((x) => `${x.c} à ${arrondi(x.v, 1)} σ`).join(", ")})`);
      }
    } else rigueur.limites.push("Distance multivariée non calculable (variables linéairement dépendantes) : seuls les écarts variable par variable ont été examinés.");
  }

  // 3) Densité LOCALE : un point isolé par rapport à SES PROPRES voisins (facteur d'aberration local).
  //    Comparer au médian GLOBAL serait faux : la distribution des distances est asymétrique à droite,
  //    et toute sa queue serait signalée sur des données pourtant saines.
  if (n >= 20 && n <= 5_000) {
    const { z } = normaliser(m);
    const k = Math.max(3, Math.min(20, Math.floor(Math.sqrt(n))));
    const voisins: number[][] = [];
    const distancesK: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const paires = z.map((r, j) => ({ j, d: i === j ? Infinity : Math.sqrt(distance2(z[i]!, r)) })).sort((a, b) => a.d - b.d).slice(0, k);
      voisins.push(paires.map((x) => x.j));
      distancesK.push(moyenne(paires.map((x) => x.d)));
    }
    const plancher = Math.max(1e-9, percentile(distancesK, 10));
    for (let i = 0; i < n; i += 1) {
      const densiteVoisins = moyenne(voisins[i]!.map((j) => distancesK[j]!));
      const facteur = distancesK[i]! / Math.max(plancher, densiteVoisins);
      if (facteur > seuilIsolement) ajouter(i, "isolement", facteur / seuilIsolement, `isolé : ses ${k} plus proches voisins sont ${arrondi(facteur, 1)} fois plus loin de lui qu'ils ne le sont entre eux`);
    }
  }

  const anomalies = [...trouvees.values()].sort((a, b) => b.score - a.score).slice(0, 200);
  rigueur.hypotheses.push(`Trois regards indépendants : écart robuste par variable (z modifié > ${seuilZ}), profil multivarié (Mahalanobis), isolement par densité locale (facteur > ${seuilIsolement}). Une observation signalée par plusieurs mérite d'être regardée en premier.`);
  rigueur.limites.push("Une anomalie STATISTIQUE n'est pas une erreur : c'est une observation à regarder. La supprimer sans la comprendre supprime souvent l'information la plus intéressante.");
  rigueur.limites.push("Sur des données saines, un petit pourcentage de signalements est NORMAL — l'absence d'anomalie n'est pas une preuve de qualité.");
  if (m.incompletes) rigueur.avertissements.push(`${m.incompletes} ligne(s) écartée(s) faute de valeur : une valeur manquante peut elle-même être l'anomalie.`);
  if (anomalies.length > n * 0.1) rigueur.avertissements.push(`${anomalies.length} signalements sur ${n} observations (${arrondi((anomalies.length / n) * 100, 1)} %) : c'est beaucoup — soit la distribution est très étalée, soit le seuil est trop large.`);
  if (n < 30) rigueur.avertissements.push(`${n} observations : sur un petit échantillon, la notion de « normal » est mal estimée et les signalements sont fragiles.`);

  return { ok: true, n, colonnes: m.colonnes, anomalies, seuils: { zModifie: seuilZ, mahalanobis: seuilMahalanobis, isolement: seuilIsolement }, rigueur, ms: Date.now() - t0 };
}

/** Le texte court d'une segmentation. */
export function resumerSegmentation(s: Segmentation): string[] {
  const lignes = [`${s.k} groupes sur ${s.affectations.length} observations (silhouette ${arrondi(s.silhouette, 3)}${s.silhouette < 0.25 ? ", découpage faible" : ""}).`];
  for (const g of s.groupes) {
    const sig = g.signature.filter((x) => Math.abs(x.ecartsTypes) > 0.3).slice(0, 3);
    lignes.push(`Groupe ${g.numero} (${g.taille}) : ${sig.length ? sig.map((x) => `${x.colonne} ${x.ecartsTypes > 0 ? "+" : ""}${arrondi(x.ecartsTypes, 2)} σ`).join(", ") : "proche de la moyenne générale"}.`);
  }
  return lignes;
}
