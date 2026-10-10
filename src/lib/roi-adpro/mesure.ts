/**
 * LE ROI AD & PRO — la mesure, en module PUR (console d'administration, Super Admin seul).
 *
 * Méthode : AVANT / APRÈS l'action (fenêtre 3, 6 ou 12 mois), comparé à des médecins SEMBLABLES non touchés — même
 * spécialité, même zone, même lettre, même statut — : différence des différences. L'effet vient avec une fourchette
 * (bootstrap déterministe) et n'est jamais présenté comme certain. Sous le seuil (moins de 3 médecins touchés mesurables,
 * ou moins de 10 comparables), on dit « pas assez de données » — on ne calcule pas un chiffre qui ne veut rien dire.
 *
 * Zéro import : testé sans base.
 */

export const FENETRES_MOIS = [3, 6, 12] as const;
export type FenetreMois = (typeof FENETRES_MOIS)[number];
export const FENETRE_DEFAUT: FenetreMois = 6;
export const MIN_EXPOSES = 3;
export const MIN_COMPARABLES = 10;

export function lireFenetre(v: unknown): FenetreMois {
  const n = Number(v);
  return (FENETRES_MOIS as readonly number[]).includes(n) ? (n as FenetreMois) : FENETRE_DEFAUT;
}

/** Ajoute des mois calendaires (UTC), le jour borné à la fin du mois. */
export function ajouterMois(d: Date, mois: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + mois;
  const cible = new Date(Date.UTC(y, m, 1, d.getUTCHours(), d.getUTCMinutes()));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(d.getUTCDate(), dernier));
  return cible;
}

// ─────────────────────────── Appariement ───────────────────────────

export interface Profil {
  specialite: string | null;
  zone: string | null;
  lettre: string | null;
  statut: string | null;
}

export type NiveauAppariement = "STRICT" | "SPECIALITE_LETTRE" | "SPECIALITE" | "AUCUN";

const NIVEAUX: { niveau: Exclude<NiveauAppariement, "AUCUN">; cle: (p: Profil) => string | null }[] = [
  { niveau: "STRICT", cle: (p) => (p.specialite ? `${p.specialite}|${p.zone ?? "-"}|${p.lettre ?? "-"}|${p.statut ?? "-"}` : null) },
  { niveau: "SPECIALITE_LETTRE", cle: (p) => (p.specialite ? `${p.specialite}|${p.lettre ?? "-"}` : null) },
  { niveau: "SPECIALITE", cle: (p) => p.specialite },
];

export const LIBELLE_APPARIEMENT: Record<NiveauAppariement, string> = {
  STRICT: "même spécialité, zone, lettre et statut",
  SPECIALITE_LETTRE: "même spécialité et lettre",
  SPECIALITE: "même spécialité",
  AUCUN: "aucun comparable",
};

/**
 * LES COMPARABLES d'un groupe de médecins touchés : ceux dont le profil (au moment de l'action) est celui d'un touché,
 * non touchés eux-mêmes. On commence strict ; sous `min`, on desserre d'un cran (et l'écran dit lequel). Ordre stable.
 */
export function choisirComparables(
  exposes: readonly Profil[],
  candidats: readonly { id: string; profil: Profil }[],
  exclus: ReadonlySet<string>,
  min = MIN_COMPARABLES,
): { ids: string[]; niveau: NiveauAppariement } {
  let meilleur: { ids: string[]; niveau: NiveauAppariement } = { ids: [], niveau: "AUCUN" };
  for (const n of NIVEAUX) {
    const voulues = new Set(exposes.map(n.cle).filter((k): k is string => !!k));
    if (voulues.size === 0) continue;
    const ids = candidats.filter((c) => !exclus.has(c.id) && voulues.has(n.cle(c.profil) ?? "")).map((c) => c.id).sort();
    if (ids.length >= min) return { ids, niveau: n.niveau };
    if (ids.length > meilleur.ids.length) meilleur = { ids, niveau: n.niveau };
  }
  return meilleur;
}

// ─────────────────────────── Effet ───────────────────────────

export const moyenne = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Différence des différences : (moyenne des variations des touchés) − (moyenne des variations des comparables). */
export function differenceDesDifferences(exposes: readonly number[], comparables: readonly number[]): number | null {
  const a = moyenne(exposes);
  const b = moyenne(comparables);
  return a === null || b === null ? null : a - b;
}

/** Un générateur pseudo-aléatoire graine fixe (mulberry32) : la même page donne la même fourchette. */
export function generateur(graine: number): () => number {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function graineDe(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const quantile = (tri: readonly number[], q: number): number => {
  const pos = (tri.length - 1) * q;
  const b = Math.floor(pos);
  const r = pos - b;
  return tri[b + 1] !== undefined ? tri[b] + r * (tri[b + 1] - tri[b]) : tri[b];
};

/** Fourchette à 95 % par bootstrap (rééchantillonnage des deux groupes), déterministe par sa graine. */
export function intervalleBootstrap(
  exposes: readonly number[], comparables: readonly number[], opts: { iterations?: number; graine?: number } = {},
): { bas: number; haut: number } | null {
  if (exposes.length === 0 || comparables.length === 0) return null;
  const alea = generateur(opts.graine ?? 1);
  const it = opts.iterations ?? 400;
  const tirer = (xs: readonly number[]) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[Math.floor(alea() * xs.length)]; return s / xs.length; };
  const res: number[] = [];
  for (let i = 0; i < it; i++) res.push(tirer(exposes) - tirer(comparables));
  res.sort((a, b) => a - b);
  return { bas: quantile(res, 0.025), haut: quantile(res, 0.975) };
}

export type StatutMesure = "MESURE" | "PEU_DE_DONNEES" | "EN_ATTENTE";

export interface Effet {
  statut: StatutMesure;
  effet: number | null;
  bas: number | null;
  haut: number | null;
  nExposes: number;
  nComparables: number;
  moyenneExposes: number | null;
  moyenneComparables: number | null;
}

/** L'effet d'une action sur une mesure : sous les seuils, « pas assez de données » (et aucun chiffre d'effet). */
export function mesurerEffet(
  exposes: readonly number[], comparables: readonly number[], opts: { graine?: number; minExposes?: number; minComparables?: number } = {},
): Effet {
  const base = { nExposes: exposes.length, nComparables: comparables.length, moyenneExposes: moyenne(exposes), moyenneComparables: moyenne(comparables) };
  if (exposes.length < (opts.minExposes ?? MIN_EXPOSES) || comparables.length < (opts.minComparables ?? MIN_COMPARABLES)) {
    return { statut: "PEU_DE_DONNEES", effet: null, bas: null, haut: null, ...base };
  }
  const effet = differenceDesDifferences(exposes, comparables);
  const iv = intervalleBootstrap(exposes, comparables, { graine: opts.graine });
  return { statut: "MESURE", effet, bas: iv?.bas ?? null, haut: iv?.haut ?? null, ...base };
}

export const EFFET_EN_ATTENTE: Effet = { statut: "EN_ATTENTE", effet: null, bas: null, haut: null, nExposes: 0, nComparables: 0, moyenneExposes: null, moyenneComparables: null };

// ─────────────────────────── Séries ───────────────────────────

export interface Point { date: Date; valeur: number }

/**
 * La valeur AVANT (la plus récente au plus 12 mois avant l'action, action exclue) et APRÈS (la plus récente dans la fenêtre
 * qui suit l'action). Une valeur absente reste absente.
 */
export function avantApres(points: readonly Point[], date: Date, fenetre: number): { avant: number | null; apres: number | null } {
  const debutAvant = ajouterMois(date, -12).getTime();
  const fin = ajouterMois(date, fenetre).getTime();
  const t = date.getTime();
  let avant: Point | null = null;
  let apres: Point | null = null;
  for (const p of points) {
    const x = p.date.getTime();
    if (x >= debutAvant && x <= t && (!avant || x >= avant.date.getTime())) avant = p;
    if (x > t && x <= fin && (!apres || x >= apres.date.getTime())) apres = p;
  }
  return { avant: avant?.valeur ?? null, apres: apres?.valeur ?? null };
}

/** La somme sur [debut, fin[. */
export function sommeEntre(points: readonly Point[], debut: Date, fin: Date): number {
  const a = debut.getTime(), b = fin.getTime();
  let s = 0;
  for (const p of points) { const x = p.date.getTime(); if (x >= a && x < b) s += p.valeur; }
  return s;
}

/** Variation en % d'une somme avant → après ; null quand il n'y avait rien avant (une hausse depuis zéro n'a pas de %). */
export function variationPct(avant: number, apres: number): number | null {
  if (!(avant > 0)) return null;
  return ((apres - avant) / avant) * 100;
}

// ─────────────────────────── Lettres ───────────────────────────

const RANG: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, H: 5 };

/** Le sens d'un passage de lettre ; null si l'une des deux n'est pas une lettre de rang (NA, NC, absente). */
export function mouvementLettre(avant: string | null, apres: string | null): "HAUSSE" | "BAISSE" | "STABLE" | null {
  const a = avant ? RANG[avant] : undefined;
  const b = apres ? RANG[apres] : undefined;
  if (a === undefined || b === undefined) return null;
  return b > a ? "HAUSSE" : b < a ? "BAISSE" : "STABLE";
}

/** Passé en A (ou en H) depuis une lettre plus basse. */
export function passeEnA(avant: string | null, apres: string | null): boolean {
  return mouvementLettre(avant, apres) === "HAUSSE" && (apres === "A" || apres === "H");
}

/** La lettre à une date dans un historique d'instantanés de cycle (le plus récent ouvert au plus tard à cette date). */
export function lettreA(historique: readonly { debut: Date; lettre: string }[], date: Date, apresStrict?: Date): string | null {
  let best: { debut: Date; lettre: string } | null = null;
  for (const h of historique) {
    const x = h.debut.getTime();
    if (x > date.getTime()) continue;
    if (apresStrict && x <= apresStrict.getTime()) continue;
    if (!best || x >= best.debut.getTime()) best = h;
  }
  return best?.lettre ?? null;
}

/** La lettre lue dans un praticien figé d'un cycle : H, sinon la première lettre de l'affichage (« A / B »). */
export function lettreDeFige(f: { h?: unknown; affichage?: unknown }): string | null {
  if (f.h === true) return "H";
  if (typeof f.affichage !== "string") return null;
  const t = f.affichage.split("/")[0]?.trim() ?? "";
  if (t === "?") return "NA";
  return ["A", "B", "C", "D", "NC"].includes(t) ? t : null;
}

/** Coût par passage en A — null sans passage (on ne divise pas par zéro, on ne l'affiche pas). */
export function coutParPassage(cout: number | null, passages: number): number | null {
  if (cout === null || !(cout > 0) || passages <= 0) return null;
  return cout / passages;
}
