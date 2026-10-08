/**
 * LE TABLEAU DES PRATICIENS — tri, filtres et état d'URL (Direction, 08/10 : « colonnes filtrables, triables »).
 *
 * Module PUR, sans aucun import : il est lu par l'écran (client) ET par la page (serveur, état initial depuis l'URL),
 * et testé sans base. L'écran lui passe des lignes déjà mises à plat (`LigneTri`) ; il rend l'ordre et le sous-ensemble.
 */

export const COLONNES = ["secteur", "cdr", "specialite", "nom", "prenom", "grade", "statut", "q1", "q2", "pct", "potentiel"] as const;
export type Colonne = (typeof COLONNES)[number];

/** Les filtres à liste fermée (cases à cocher) — « io » (In / Out) se règle dans l'en-tête CDR. */
export const FILTRES_LISTE = ["secteur", "cdr", "io", "specialite", "grade", "statut", "potentiel"] as const;
export type FiltreListe = (typeof FILTRES_LISTE)[number];
export const FILTRES_TEXTE = ["nom", "prenom"] as const;
export type FiltreTexte = (typeof FILTRES_TEXTE)[number];
export const FILTRES_PLAGE = ["q1", "q2", "pct"] as const;
export type FiltrePlage = (typeof FILTRES_PLAGE)[number];

export type Sens = "asc" | "desc";
export interface Tri { col: Colonne; sens: Sens }
export interface Plage { min: number | null; max: number | null }

export interface EtatTableau {
  q: string;
  tri: Tri | null;
  listes: Partial<Record<FiltreListe, string[]>>;
  textes: Partial<Record<FiltreTexte, string>>;
  plages: Partial<Record<FiltrePlage, Plage>>;
}

export const ETAT_VIDE: EtatTableau = { q: "", tri: null, listes: {}, textes: {}, plages: {} };

/**
 * Une ligne telle que le tri et les filtres la lisent : une CLÉ par filtre à liste (identifiant, ou « t:texte » pour
 * une valeur sans lien, « » pour l'absence), un LIBELLÉ pour le tri alphabétique, des nombres pour les plages.
 */
export interface LigneTri {
  secteur: string; secteurLib: string;
  cdr: string; cdrLib: string;
  io: string;
  specialite: string; specialiteLib: string;
  nom: string; prenom: string;
  grade: string; gradeLib: string;
  statut: string;
  q1: number | null; q2: number | null;
  /** L'affinité en RATIO (0,16) — les bornes de filtre s'écrivent en pourcentage (16). */
  pct: number | null;
  potentiel: string;
}

/** L'ordre des lettres, du plus haut potentiel au non ciblé ; « » (pas de lettre) en dernier. */
export const ORDRE_LETTRES = ["H", "A", "B", "C", "D", "NA", "NC"] as const;
/** L'ordre des statuts, tel que la règle H les lit. */
export const ORDRE_STATUTS = ["DECIDEUR", "INFLUENCEUR", "REFERENT", "PRESCRIPTEUR"] as const;

const plie = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const COLLATOR = typeof Intl !== "undefined" ? new Intl.Collator("fr", { sensitivity: "base", numeric: true }) : null;
const compareTexte = (a: string, b: string) => (COLLATOR ? COLLATOR.compare(a, b) : a < b ? -1 : a > b ? 1 : 0);

function rang(ordre: readonly string[], v: string): number {
  const i = ordre.indexOf(v);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/** La valeur comparable d'une colonne : `null` = vide (toujours en dernier, quel que soit le sens). */
function cleDeTri(l: LigneTri, col: Colonne): string | number | null {
  switch (col) {
    case "secteur": return l.secteurLib || null;
    case "cdr": return l.cdrLib || null;
    case "specialite": return l.specialiteLib || null;
    case "nom": return l.nom || null;
    case "prenom": return l.prenom || null;
    case "grade": return l.gradeLib || null;
    case "statut": return l.statut ? rang(ORDRE_STATUTS, l.statut) : null;
    case "q1": return l.q1;
    case "q2": return l.q2;
    case "pct": return l.pct;
    case "potentiel": return l.potentiel ? rang(ORDRE_LETTRES, l.potentiel) : null;
  }
}

/** TRI STABLE : à égalité, l'ordre d'arrivée (celui du serveur) ; les cases vides restent en bas. */
export function trier<T>(lignes: readonly T[], tri: Tri | null, lire: (x: T) => LigneTri): T[] {
  if (!tri) return [...lignes];
  const s = tri.sens === "asc" ? 1 : -1;
  return lignes
    .map((x, i) => ({ x, i, k: cleDeTri(lire(x), tri.col) }))
    .sort((a, b) => {
      if (a.k === null || b.k === null) return a.k === b.k ? a.i - b.i : a.k === null ? 1 : -1;
      const c = typeof a.k === "number" && typeof b.k === "number" ? a.k - b.k : compareTexte(String(a.k), String(b.k));
      return c !== 0 ? c * s : a.i - b.i;
    })
    .map((e) => e.x);
}

/** Le prochain tri d'un clic sur l'en-tête : croissant → décroissant → aucun. */
export function triSuivant(actuel: Tri | null, col: Colonne): Tri | null {
  if (!actuel || actuel.col !== col) return { col, sens: "asc" };
  return actuel.sens === "asc" ? { col, sens: "desc" } : null;
}

function dansPlage(v: number | null, p: Plage | undefined, facteur = 1): boolean {
  if (!p || (p.min === null && p.max === null)) return true;
  if (v === null) return false;
  const x = v * facteur;
  // Une borne en pourcentage se compare à l'arrondi affiché (16 % s'écrit 16, pas 15,999…).
  const y = facteur === 1 ? x : Math.round(x * 10) / 10;
  return (p.min === null || y >= p.min) && (p.max === null || y <= p.max);
}

/** La ligne passe-t-elle la recherche globale et TOUS les filtres ? */
export function passe(l: LigneTri, e: EtatTableau): boolean {
  const q = plie(e.q);
  if (q && !plie(`${l.nom} ${l.prenom} ${l.cdrLib} ${l.specialiteLib} ${l.secteurLib}`).includes(q)) return false;
  for (const f of FILTRES_LISTE) {
    const choix = e.listes[f];
    if (choix && choix.length > 0 && !choix.includes(l[f])) return false;
  }
  for (const f of FILTRES_TEXTE) {
    const t = plie(e.textes[f] ?? "");
    if (t && !plie(l[f]).includes(t)) return false;
  }
  if (!dansPlage(l.q1, e.plages.q1)) return false;
  if (!dansPlage(l.q2, e.plages.q2)) return false;
  if (!dansPlage(l.pct, e.plages.pct, 100)) return false;
  return true;
}

/** Filtrer puis trier — ce que l'écran affiche. */
export function vueDuTableau<T>(lignes: readonly T[], e: EtatTableau, lire: (x: T) => LigneTri): T[] {
  return trier(lignes.filter((x) => passe(lire(x), e)), e.tri, lire);
}

/** Les valeurs d'un filtre à liste présentes dans les lignes, avec leur libellé et leur compte, triées par libellé. */
export function valeursDuFiltre(lignes: readonly LigneTri[], f: FiltreListe, libelle: (l: LigneTri) => string): { valeur: string; libelle: string; n: number }[] {
  const m = new Map<string, { valeur: string; libelle: string; n: number }>();
  for (const l of lignes) {
    const v = l[f];
    const x = m.get(v);
    if (x) x.n++;
    else m.set(v, { valeur: v, libelle: libelle(l), n: 1 });
  }
  const ordre = f === "potentiel" ? ORDRE_LETTRES : f === "statut" ? ORDRE_STATUTS : null;
  return [...m.values()].sort((a, b) => {
    if (!a.valeur || !b.valeur) return !a.valeur ? 1 : -1;
    return ordre ? rang(ordre, a.valeur) - rang(ordre, b.valeur) : compareTexte(a.libelle, b.libelle);
  });
}

// ─────────────────────────────── Filtres actifs ───────────────────────────────

export function nbFiltresActifs(e: EtatTableau): number {
  return FILTRES_LISTE.filter((f) => (e.listes[f]?.length ?? 0) > 0).length
    + FILTRES_TEXTE.filter((f) => (e.textes[f] ?? "").trim()).length
    + FILTRES_PLAGE.filter((f) => e.plages[f] && (e.plages[f]!.min !== null || e.plages[f]!.max !== null)).length;
}

export function basculerValeur(e: EtatTableau, f: FiltreListe, v: string): EtatTableau {
  const avant = e.listes[f] ?? [];
  const apres = avant.includes(v) ? avant.filter((x) => x !== v) : [...avant, v];
  return { ...e, listes: { ...e.listes, [f]: apres } };
}

export type CleFiltre = FiltreListe | FiltreTexte | FiltrePlage;

/** Retire un filtre (une seule valeur d'une liste quand `valeur` est donnée). */
export function retirerFiltre(e: EtatTableau, f: CleFiltre, valeur?: string): EtatTableau {
  if ((FILTRES_LISTE as readonly string[]).includes(f)) {
    const k = f as FiltreListe;
    const reste = valeur === undefined ? [] : (e.listes[k] ?? []).filter((x) => x !== valeur);
    return { ...e, listes: { ...e.listes, [k]: reste } };
  }
  if ((FILTRES_TEXTE as readonly string[]).includes(f)) return { ...e, textes: { ...e.textes, [f]: "" } };
  return { ...e, plages: { ...e.plages, [f]: { min: null, max: null } } };
}

export function effacerFiltres(e: EtatTableau): EtatTableau {
  return { ...e, listes: {}, textes: {}, plages: {} };
}

// ─────────────────────────────── L'état dans l'URL ───────────────────────────────

/** Les clés d'URL du tableau : `q`, `tri`, et `f_<filtre>` — les autres (s, vue, spe…) restent intactes. */
export const estCleDuTableau = (k: string) => k === "q" || k === "tri" || k.startsWith("f_");
const SEP = "|";

const nombre = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

type Params = URLSearchParams | Record<string, string | string[] | undefined>;
function lire(p: Params, k: string): string {
  if (p instanceof URLSearchParams) return p.get(k) ?? "";
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** L'état lu de l'URL — tout ce qui est illisible est ignoré, jamais deviné. */
export function lireEtat(p: Params | null | undefined): EtatTableau {
  if (!p) return { ...ETAT_VIDE };
  const e: EtatTableau = { q: lire(p, "q"), tri: null, listes: {}, textes: {}, plages: {} };
  const [col, sens] = lire(p, "tri").split(".");
  if ((COLONNES as readonly string[]).includes(col) && (sens === "asc" || sens === "desc")) e.tri = { col: col as Colonne, sens };
  for (const f of FILTRES_LISTE) {
    const brut = lire(p, `f_${f}`);
    if (brut) e.listes[f] = [...new Set(brut.split(SEP).map((x) => (x === "_" ? "" : x)))];
  }
  for (const f of FILTRES_TEXTE) { const t = lire(p, `f_${f}`).trim(); if (t) e.textes[f] = t; }
  for (const f of FILTRES_PLAGE) {
    const brut = lire(p, `f_${f}`);
    if (!brut.includes("..")) continue;
    const [a, b] = brut.split("..");
    const pl = { min: nombre(a), max: nombre(b) };
    if (pl.min !== null || pl.max !== null) e.plages[f] = pl;
  }
  return e;
}

/** L'état écrit en paires d'URL (vides omises) — l'inverse exact de `lireEtat`. */
export function paramsDeLEtat(e: EtatTableau): [string, string][] {
  const out: [string, string][] = [];
  if (e.q.trim()) out.push(["q", e.q.trim()]);
  if (e.tri) out.push(["tri", `${e.tri.col}.${e.tri.sens}`]);
  for (const f of FILTRES_LISTE) {
    const v = e.listes[f];
    // La valeur vide (« sans secteur », « aucun statut ») s'écrit « _ ».
    if (v && v.length) out.push([`f_${f}`, v.map((x) => (x === "" ? "_" : x)).join(SEP)]);
  }
  for (const f of FILTRES_TEXTE) { const t = (e.textes[f] ?? "").trim(); if (t) out.push([`f_${f}`, t]); }
  for (const f of FILTRES_PLAGE) {
    const pl = e.plages[f];
    if (pl && (pl.min !== null || pl.max !== null)) out.push([`f_${f}`, `${pl.min ?? ""}..${pl.max ?? ""}`]);
  }
  return out;
}

/** La chaîne de recherche de l'URL, l'état du tableau remplacé, le reste gardé (« ?s=…&vue=praticiens&tri=q1.desc »). */
export function urlAvecEtat(search: string, e: EtatTableau): string {
  const sp = new URLSearchParams(search);
  for (const k of [...sp.keys()]) if (estCleDuTableau(k)) sp.delete(k);
  for (const [k, v] of paramsDeLEtat(e)) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ─────────────────────────────── Saisie et libellés ───────────────────────────────

/** Une réponse saisie : vide = effacée (NA) ; Q2 est un entier de 0 à 10 ; Q1 un nombre positif. */
export function lireSaisieQ(brut: string, cle: "q1" | "q2"): { ok: true; valeur: number | null } | { ok: false; error: string } {
  const t = brut.trim().replace(",", ".");
  if (t === "") return { ok: true, valeur: null };
  const n = Number(t);
  if (cle === "q2") {
    return Number.isInteger(n) && n >= 0 && n <= 10 ? { ok: true, valeur: n } : { ok: false, error: "Q2 : un entier de 0 à 10." };
  }
  return Number.isFinite(n) && n >= 0 ? { ok: true, valeur: n } : { ok: false, error: "Q1 : un nombre positif." };
}

/** « INFECTIOLOGIE » → « Infectiologie » ; un texte déjà en casse mixte est gardé tel quel. */
export function casseNom(s: string | null | undefined): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t || t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  const bas = t.toLocaleLowerCase("fr");
  return bas.charAt(0).toLocaleUpperCase("fr") + bas.slice(1);
}

/** « RALTEGRAVIR 400 MG · comprimé pelliculé » → « Raltegravir 400 mg » : la tête du nom, sans la forme. */
export function nomCourtProduit(nom: string | null | undefined): string {
  const t = (nom ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const tete = t.split(/\s[·•|]\s|\s-\s|,\s*/)[0].trim();
  const uniforme = tete === tete.toUpperCase() || tete === tete.toLowerCase();
  const casse = uniforme ? tete.toLocaleLowerCase("fr").replace(/^./, (c) => c.toLocaleUpperCase("fr")) : tete;
  return casse.replace(/(\d)\s*(mg|ml|mcg|µg|g|ui)\b/gi, (_, d: string, u: string) => `${d} ${u.toLowerCase()}`);
}

/** Le grade tel que le fichier l'écrivait quand la liste ne le connaît pas (« Grade : KOL » dans les commentaires). */
export function gradeBrutDe(commentaires: string | null | undefined): string | null {
  const m = (commentaires ?? "").match(/Grade\s*:\s*([^\n;·]+)/i);
  return m ? m[1].trim() || null : null;
}
