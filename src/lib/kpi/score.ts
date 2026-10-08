import type { FrequenceRevue, NatureKpi, PeriodeRef, SensKpi, UniteKpi } from "./briques";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA NOTE D'UN KPI ET LE SCORE GLOBAL — module PUR (aucun import de valeur), testé sans base.
 *
 * ── LA NORMALISATION (Direction, 08/10 : « on affiche un score global pondéré ») ────────────
 *
 * Chaque KPI est ramené à une note sur 100, PLAFONNÉE À 120, avant d'être pondéré :
 *   · « plus haut = mieux » : note = 100 × valeur ÷ cible (au-delà de 120 % de la cible, plus rien ne compte —
 *     un KPI surperformé ne doit pas masquer un trou ailleurs) ;
 *   · « plus bas = mieux » (un délai) : note = 100 × cible ÷ valeur (valeur nulle → 120) ;
 *   · ÉVALUÉ : note = 100 × niveau ÷ niveau maximal de la grille (3 sur 4 → 75).
 * Sans cible, un KPI chiffré n'a pas de note (null) : il s'affiche, il ne compte pas.
 *
 * ── LE SCORE GLOBAL ───────────────────────────────────────────────────────────────────────
 *
 * Moyenne des notes pondérée par les poids. Un KPI SANS DONNÉE n'est jamais un zéro : il sort du calcul et son
 * poids se répartit sur les autres (renormalisation) ; l'écran le dit (« n KPI sans donnée »).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const PLAFOND_NOTE = 120;

export function normaliser(k: {
  valeur: number | null;
  cible: number | null;
  sens: SensKpi;
  nature: NatureKpi;
  /** Le nombre de niveaux de la grille d'un KPI évalué. */
  niveauMax?: number | null;
}): number | null {
  if (k.valeur === null || !Number.isFinite(k.valeur)) return null;
  if (k.nature === "EVALUE") {
    if (!k.niveauMax || k.niveauMax <= 0) return null;
    return arrondi1(Math.min(100, (100 * k.valeur) / k.niveauMax));
  }
  if (k.cible === null || !Number.isFinite(k.cible)) return null;
  if (k.sens === "PLUS_HAUT") {
    if (k.cible <= 0) return k.valeur > 0 ? PLAFOND_NOTE : 100;
    return arrondi1(Math.min(PLAFOND_NOTE, Math.max(0, (100 * k.valeur) / k.cible)));
  }
  if (k.valeur <= 0) return PLAFOND_NOTE;
  return arrondi1(Math.min(PLAFOND_NOTE, Math.max(0, (100 * k.cible) / k.valeur)));
}

const arrondi1 = (n: number) => Math.round(n * 10) / 10;

export interface ElementDeScore {
  note: number | null;
  poids: number;
}

/** LE SCORE PONDÉRÉ — les KPI sans donnée sortent du calcul, leurs poids se répartissent sur les autres. */
export function scoreGlobal(items: readonly ElementDeScore[]): { score: number | null; sansDonnee: number; poidsRetenu: number; poidsTotal: number } {
  let somme = 0, poidsRetenu = 0, poidsTotal = 0, sansDonnee = 0;
  for (const i of items) {
    const p = Number.isFinite(i.poids) && i.poids > 0 ? i.poids : 0;
    poidsTotal += p;
    if (i.note === null || !Number.isFinite(i.note)) { sansDonnee++; continue; }
    if (p === 0) continue;
    somme += i.note * p;
    poidsRetenu += p;
  }
  return { score: poidsRetenu > 0 ? Math.round(somme / poidsRetenu) : null, sansDonnee, poidsRetenu, poidsTotal };
}

// ── Les seuils et la couleur d'une cellule ────────────────────────────────────────────────

export type Couleur = "ok" | "w" | "ko" | "m";

/**
 * LES SEUILS EFFECTIFS — ceux de la définition, sinon déduits de la cible : vert à la cible, orange à 80 % de la cible
 * (« plus haut = mieux ») ou à 125 % (« plus bas = mieux »). Évalué : vert à la cible (le niveau visé), orange un
 * niveau en dessous.
 */
export function seuilsEffectifs(k: { cible: number | null; seuilVert: number | null; seuilOrange: number | null; sens: SensKpi; nature: NatureKpi }): { vert: number; orange: number } | null {
  if (k.seuilVert !== null && k.seuilOrange !== null) return { vert: k.seuilVert, orange: k.seuilOrange };
  if (k.cible === null) return null;
  const vert = k.seuilVert ?? k.cible;
  if (k.nature === "EVALUE") return { vert, orange: k.seuilOrange ?? Math.max(0, vert - 1) };
  return { vert, orange: k.seuilOrange ?? (k.sens === "PLUS_HAUT" ? vert * 0.8 : vert * 1.25) };
}

export function couleur(valeur: number | null, seuils: { vert: number; orange: number } | null, sens: SensKpi): Couleur {
  if (valeur === null || !seuils) return "m";
  if (sens === "PLUS_HAUT") return valeur >= seuils.vert ? "ok" : valeur >= seuils.orange ? "w" : "ko";
  return valeur <= seuils.vert ? "ok" : valeur <= seuils.orange ? "w" : "ko";
}

// ── Les périodes ───────────────────────────────────────────────────────────────────────────

/**
 * LES CLÉS DE PÉRIODE — « 2026-10 » (mois), « 2026-T4 » (trimestre), « 2026-S2 » (semestre). La fenêtre d'une revue
 * suit la fréquence choisie par le manager ; chaque KPI se calcule sur cette fenêtre.
 */
export function clePeriode(frequence: FrequenceRevue, annee: number, mois: number): string {
  if (frequence === "TRIMESTRIELLE") return `${annee}-T${Math.floor((mois - 1) / 3) + 1}`;
  if (frequence === "SEMESTRIELLE") return `${annee}-S${mois <= 6 ? 1 : 2}`;
  return `${annee}-${String(mois).padStart(2, "0")}`;
}

export interface Fenetre {
  cle: string;
  frequence: FrequenceRevue;
  /** Premier jour inclus, à minuit (heure du serveur — la convention du pilotage de la force de vente). */
  debut: Date;
  /** Lendemain du dernier jour, à minuit (borne exclue). */
  fin: Date;
  mois: number;
  libelle: string;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Relit une clé ; `null` si elle ne se lit pas. */
export function fenetre(cle: string): Fenetre | null {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (m) {
    const a = Number(m[1]), mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    return { cle, frequence: "MENSUELLE", debut: new Date(a, mo - 1, 1), fin: new Date(a, mo, 1), mois: 1, libelle: `${MOIS[mo - 1]} ${a}` };
  }
  const t = /^(\d{4})-T([1-4])$/.exec(cle);
  if (t) {
    const a = Number(t[1]), q = Number(t[2]);
    return { cle, frequence: "TRIMESTRIELLE", debut: new Date(a, (q - 1) * 3, 1), fin: new Date(a, q * 3, 1), mois: 3, libelle: `${q}${q === 1 ? "er" : "e"} trimestre ${a}` };
  }
  const s = /^(\d{4})-S([12])$/.exec(cle);
  if (s) {
    const a = Number(s[1]), n = Number(s[2]);
    return { cle, frequence: "SEMESTRIELLE", debut: new Date(a, (n - 1) * 6, 1), fin: new Date(a, n * 6, 1), mois: 6, libelle: `${n}${n === 1 ? "er" : "e"} semestre ${a}` };
  }
  return null;
}

export function fenetreCourante(frequence: FrequenceRevue, maintenant: Date): Fenetre {
  return fenetre(clePeriode(frequence, maintenant.getFullYear(), maintenant.getMonth() + 1))!;
}

/** Les `n` fenêtres qui finissent par `cle` (la plus ancienne d'abord). */
export function fenetresPrecedentes(cle: string, n: number): Fenetre[] {
  const f = fenetre(cle);
  if (!f) return [];
  const out: Fenetre[] = [];
  let d = f.debut;
  for (let i = 0; i < n; i++) {
    const x = fenetre(clePeriode(f.frequence, d.getFullYear(), d.getMonth() + 1))!;
    out.unshift(x);
    d = new Date(x.debut.getFullYear(), x.debut.getMonth() - 1, 1);
  }
  return out;
}

/**
 * LA CIBLE SUR LA FENÊTRE — une cible additive (« 20 visites par mois », « 1 formation par trimestre ») se rapporte à
 * sa période de référence : sur une revue trimestrielle, 20 par mois deviennent 60. Un taux, un délai ou un niveau ne
 * s'additionnent pas : leur cible ne bouge pas.
 */
export function cibleSurFenetre(cible: number | null, k: { unite: UniteKpi; additive: boolean; periode: PeriodeRef }, moisFenetre: number): number | null {
  if (cible === null) return null;
  if (!k.additive || k.unite !== "NOMBRE") return cible;
  const moisRef = k.periode === "TRIMESTRE" ? 3 : 1;
  return Math.round(((cible * moisFenetre) / moisRef) * 100) / 100;
}

// ── L'affichage ────────────────────────────────────────────────────────────────────────────

const fr1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function afficherValeur(valeur: number | null, unite: UniteKpi, niveauMax?: number | null): string {
  if (valeur === null || !Number.isFinite(valeur)) return "—";
  if (unite === "POURCENT") return `${Math.round(valeur)} %`;
  if (unite === "HEURES") return `${fr1(valeur)} h`;
  if (unite === "NIVEAU") return niveauMax ? `${valeur}/${niveauMax}` : String(valeur);
  return fr1(valeur);
}

// ── Luna propose une cible (b) : la règle, écrite ici et testée ───────────────────────────

/**
 * PROPOSER UNE CIBLE à partir des valeurs réelles de l'équipe sur les derniers mois : à mi-chemin entre la moyenne et
 * le meilleur (« plus haut = mieux »), ou entre la moyenne et le plus bas (« plus bas = mieux ») — atteignable, mais
 * au-dessus de l'habitude. Arrondie à 5 points pour un pourcentage, à l'unité sinon. Sans historique : pas de cible.
 */
export function proposerCible(historique: readonly (number | null)[], sens: SensKpi, unite: UniteKpi): { cible: number; moyenne: number; meilleur: number } | null {
  const vals = historique.filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length === 0) return null;
  const moyenne = vals.reduce((s, v) => s + v, 0) / vals.length;
  const meilleur = sens === "PLUS_HAUT" ? Math.max(...vals) : Math.min(...vals);
  let cible = (moyenne + meilleur) / 2;
  if (unite === "POURCENT") cible = Math.min(100, Math.round(cible / 5) * 5);
  else cible = Math.max(0, Math.round(cible));
  return { cible, moyenne: Math.round(moyenne * 10) / 10, meilleur: Math.round(meilleur * 10) / 10 };
}
