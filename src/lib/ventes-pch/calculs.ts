/**
 * VENTES PCH — LES CALCULS (module PUR, zéro import : lisible aussi par un composant client).
 *
 *   • périodes (mois, trimestre, année, 12 mois glissants) et la période précédente de même longueur ;
 *   • REMPLACEMENT d'un import : un fichier plus récent pour la même source (DR, ou réceptions) et le même mois
 *     REMPLACE ce mois ; un fichier annuel remplace ses douze mois ; le même fichier (empreinte) ne fait rien ;
 *   • part de marché, évolution, chaîne d'un contrat (attribué → BC → livré, dépassement = avenant) ;
 *   • fraîcheur : les mois manquants d'une source.
 */

// ─────────────────────────── Mois ───────────────────────────

/** « 2026-05 » → décalé de n mois. */
export function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Les mois de `debut` à `fin` inclus. */
export function moisEntre(debut: string, fin: string): string[] {
  const out: string[] = [];
  for (let m = debut; m <= fin && out.length < 600; m = decalerMois(m, 1)) out.push(m);
  return out;
}

/** « 2026-05 » → 1er mai 2026, minuit UTC (la valeur stockée dans `mois`). */
export const dateDuMois = (mois: string): Date => new Date(`${mois}-01T00:00:00Z`);
export const moisDeDate = (d: Date): string => d.toISOString().slice(0, 7);

// ─────────────────────────── Périodes ───────────────────────────

export type TypePeriode = "mois" | "trimestre" | "annee" | "12m";
export const TYPES_PERIODE: { value: TypePeriode; label: string }[] = [
  { value: "mois", label: "Mois" },
  { value: "trimestre", label: "Trimestre" },
  { value: "annee", label: "Année" },
  { value: "12m", label: "12 mois" },
];

export interface Periode { type: TypePeriode; debut: string; fin: string; libelle: string }

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function moisCourt(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return `${MOIS_COURTS[(m || 1) - 1]} ${a}`;
}

/**
 * LA PÉRIODE qui CONTIENT le mois de référence : son mois, son trimestre civil, son année civile, ou les 12 mois qui
 * finissent sur lui.
 */
export function periodeDe(type: TypePeriode, ref: string): Periode {
  const [a, m] = ref.split("-").map(Number);
  if (type === "mois") return { type, debut: ref, fin: ref, libelle: moisCourt(ref) };
  if (type === "trimestre") {
    const q = Math.floor((m - 1) / 3);
    const debut = `${a}-${String(q * 3 + 1).padStart(2, "0")}`;
    return { type, debut, fin: decalerMois(debut, 2), libelle: `T${q + 1} ${a}` };
  }
  if (type === "annee") return { type, debut: `${a}-01`, fin: `${a}-12`, libelle: String(a) };
  return { type, debut: decalerMois(ref, -11), fin: ref, libelle: `12 mois → ${moisCourt(ref)}` };
}

/** La période d'avant, de même longueur (mois d'avant, trimestre d'avant, année d'avant, 12 mois d'avant). */
export function periodePrecedente(p: Periode): Periode {
  const n = moisEntre(p.debut, p.fin).length;
  return periodeDe(p.type, decalerMois(p.type === "12m" ? p.fin : p.debut, -n));
}

export function typePeriode(v: string | null | undefined): TypePeriode {
  return v === "trimestre" || v === "annee" || v === "12m" ? v : "mois";
}

// ─────────────────────────── Remplacement ───────────────────────────

/** La source des réceptions de la PCH centrale (les ventes ont pour source leur code DR). */
export const SOURCE_RECEPTIONS = "RECEPTIONS";

/** Une tranche de données : une SOURCE (code DR, ou « RECEPTIONS ») × un mois. */
export interface Tranche { source: string; mois: string }
export const cleTranche = (t: Tranche) => `${t.source}|${t.mois}`;

export interface ImportExistant { id: string; empreinte: string; tranches: Tranche[] }

export type PlanRemplacement =
  | { deja: true; importId: string }
  | { deja: false; tranchesRemplacees: Tranche[]; importsRemplaces: string[]; importsEntames: string[] };

/**
 * QUE FAIT CE FICHIER AUX DONNÉES DÉJÀ LÀ ?
 *   • même empreinte qu'un import existant → rien (`deja`) ;
 *   • sinon chaque tranche (source × mois) qu'il porte REMPLACE la même tranche, quel que soit l'import qui la portait ;
 *     un import dont TOUTES les tranches sont remplacées est « remplacé » (gardé, il ne compte plus) ; un import dont
 *     une partie seulement l'est est « entamé » (un fichier annuel dont on reçoit ensuite un mois corrigé).
 */
export function planRemplacement(empreinte: string, tranches: readonly Tranche[], existants: readonly ImportExistant[]): PlanRemplacement {
  const meme = existants.find((e) => e.empreinte === empreinte);
  if (meme) return { deja: true, importId: meme.id };
  const nouvelles = new Set(tranches.map(cleTranche));
  const remplacees = new Map<string, Tranche>();
  const importsRemplaces: string[] = [], importsEntames: string[] = [];
  for (const e of existants) {
    const touchees = e.tranches.filter((t) => nouvelles.has(cleTranche(t)));
    if (!touchees.length) continue;
    for (const t of touchees) remplacees.set(cleTranche(t), t);
    (touchees.length === e.tranches.length ? importsRemplaces : importsEntames).push(e.id);
  }
  return { deja: false, tranchesRemplacees: [...remplacees.values()], importsRemplaces, importsEntames };
}

// ─────────────────────────── Indicateurs ───────────────────────────

/** Part de marché en % (une décimale) ; marché nul → null (rien à partager, pas « 0 % »). */
export function partDeMarche(notre: number, marche: number): number | null {
  if (!(marche > 0)) return null;
  return Math.round((Math.max(0, notre) / marche) * 1000) / 10;
}

/** Évolution en % par rapport à la période précédente ; précédent nul → null (pas de « +∞ % »). */
export function evolution(actuel: number, precedent: number): number | null {
  if (!(precedent > 0)) return null;
  return Math.round(((actuel - precedent) / precedent) * 1000) / 10;
}

export interface ChaineContrat {
  attribue: number;
  commande: number;
  livre: number;
  /** Ce qui reste à commander sur l'AO (jamais négatif). */
  reste: number;
  /** Ce qui a été commandé AU-DELÀ de l'attribué (0 sinon). */
  depassement: number;
  /** Dépassement ou BC marqué « avenant » : la suite passe par des avenants. */
  avenant: boolean;
  pctCommande: number | null;
  pctLivre: number | null;
}

/**
 * LA CHAÎNE D'UN CONTRAT — l'AO attribue un volume global (30 000 boîtes), la PCH le consomme par bons de commande
 * (8 000, 5 000, 10 000…) ; au-delà de l'attribué, les BC supplémentaires sont des AVENANTS.
 */
export function chaineContrat(attribue: number, commande: number, livre: number, bcAvenant = false): ChaineContrat {
  const a = Math.max(0, attribue), c = Math.max(0, commande), l = Math.max(0, livre);
  const depassement = Math.max(0, c - a);
  return {
    attribue: a, commande: c, livre: l,
    reste: Math.max(0, a - c),
    depassement,
    avenant: depassement > 0 || bcAvenant,
    pctCommande: a > 0 ? Math.round((c / a) * 1000) / 10 : null,
    pctLivre: a > 0 ? Math.round((l / a) * 1000) / 10 : null,
  };
}

// ─────────────────────────── Fraîcheur ───────────────────────────

/**
 * LES MOIS MANQUANTS d'une source entre `debut` et `fin` — un trou dans les fichiers reçus se voit, il ne se lit pas
 * comme une vente nulle.
 */
export function moisManquants(presents: Iterable<string>, debut: string, fin: string): string[] {
  const p = new Set(presents);
  return moisEntre(debut, fin).filter((m) => !p.has(m));
}
