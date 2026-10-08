/**
 * VENTES PCH — LES CALCULS (module PUR, zéro import : lisible aussi par un composant client).
 *
 *   • périodes (mois, trimestre, année, 12 mois glissants) et la période précédente de même longueur ;
 *   • REMPLACEMENT d'un import : un fichier plus récent pour la même source (DR, ou réceptions) et le même mois
 *     REMPLACE ce mois ; un fichier annuel remplace ses douze mois ; le même fichier (empreinte) ne fait rien ;
 *   • part de marché, évolution, chaîne d'un contrat (attribué → BC → livré, dépassement = avenant) ;
 *   • Produits 360 : série mensuelle, valeur au coût PCH, parts des fournisseurs, demande non servie significative ;
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

/**
 * LA PÉRIODE CHOISIE PAR LA PERSONNE POUR UN FICHIER (Direction, 10/2026) : un mois précis de l'année donnée
 * (`mois` = 1..12), ou « annuel » (`mois` = null) — chaque ligne garde alors son mois, ramené à l'année choisie.
 * Sans choix, la période se lit sur les dates du fichier.
 */
export interface ChoixPeriode { annee: number; mois: number | null }

/** Le mois (« 2026-05 ») sous lequel une ligne détectée au mois `detecte` s'enregistre, selon le choix. */
export function moisSelonChoix(detecte: string, choix: ChoixPeriode | null | undefined): string {
  if (!choix) return detecte;
  const mm = choix.mois !== null ? String(choix.mois).padStart(2, "0") : detecte.slice(5, 7);
  return `${choix.annee}-${mm}`;
}

/** Un choix lu sur un champ de formulaire — rejeté s'il n'est pas un mois (1..12) / une année (2000..2100) lisibles. */
export function lireChoixPeriode(annee: unknown, mois: unknown): ChoixPeriode | null {
  const a = Number(annee);
  if (!Number.isInteger(a) || a < 2000 || a > 2100) return null;
  if (mois === null || mois === undefined || mois === "" || mois === "annuel") return { annee: a, mois: null };
  const m = Number(mois);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? { annee: a, mois: m } : null;
}

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

// ─────────────────────────── Produits 360 ───────────────────────────

/** Les quantités ramenées aux mois demandés, dans leur ordre (un mois sans ligne vaut 0). */
export function serieSurMois(mois: readonly string[], lignes: readonly { mois: string; qte: number }[]): number[] {
  const par = new Map<string, number>();
  for (const l of lignes) par.set(l.mois, (par.get(l.mois) ?? 0) + l.qte);
  return mois.map((m) => par.get(m) ?? 0);
}

/** Le coût d'achat PCH d'une unité : valeur ÷ quantité livrée ; rien de livré → null. */
export function coutDeReference(valeur: number, qte: number): number | null {
  return qte > 0 && valeur > 0 ? valeur / qte : null;
}

/** Une quantité au coût d'achat PCH (DZD, arrondi) ; coût inconnu → null (on n'invente pas de prix). */
export function valeurAuCout(qte: number, cout: number | null): number | null {
  return cout === null ? null : Math.round(qte * cout);
}

/** Les fournisseurs des réceptions FO, du plus gros au plus petit, avec leur part (les nôtres restent marqués). */
export function partsFournisseurs<T extends { qte: number; nous: boolean }>(lignes: readonly T[]): (T & { partPct: number | null })[] {
  const total = lignes.reduce((s, l) => s + Math.max(0, l.qte), 0);
  return [...lignes].sort((a, b) => b.qte - a.qte || Number(b.nous) - Number(a.nous)).map((l) => ({ ...l, partPct: partDeMarche(l.qte, total) }));
}

/** Au-delà, la demande non servie devient LE signal d'un produit : 3 établissements, ou 10 % de la demande. */
export const SEUIL_NON_SERVI_ETABLISSEMENTS = 3;
export const SEUIL_NON_SERVI_PART = 0.1;

/**
 * DEMANDE NON SERVIE SIGNIFICATIVE — des hôpitaux ont commandé et la PCH a livré 0 : ça compte dès que plusieurs
 * établissements sont touchés, ou qu'une part notable de la demande (non servi ÷ (non servi + livré)) reste sans réponse.
 */
export function nonServiSignificatif(f: { nonServi: number; livre: number; etablissements: number }): boolean {
  if (!(f.nonServi > 0)) return false;
  if (f.etablissements >= SEUIL_NON_SERVI_ETABLISSEMENTS) return true;
  return f.nonServi / (f.nonServi + Math.max(0, f.livre)) >= SEUIL_NON_SERVI_PART;
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
