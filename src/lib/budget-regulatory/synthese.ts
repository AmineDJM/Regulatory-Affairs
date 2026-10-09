/**
 * BUDGET REGULATORY — LA VUE D'ENSEMBLE ALLÉGÉE (Direction, 09/10) : les règles PURES des « Prochains BV » et de la
 * courbe de consommation prolongée par les BV 75 % attendus.
 *
 * Module sans valeur importée (seulement des types) : lu par l'écran serveur et testé. Aucune donnée inventée — un BV
 * dont on ne sait pas quand il tombera n'a pas de mois (« — »), et la courbe le dit plutôt que de le placer au hasard.
 */

import type { LigneBv, NatureBv } from "./bv";

/** OÙ EN EST UN BV : à demander (le 75 % attendu) ou déjà demandé, chez les Finances. */
export type EtatProchainBv = "A_DEMANDER" | "DEMANDE";

export interface ProchainBv {
  dossierId: string;
  reference: string;
  /** Le produit : nom commercial, sinon DCI. */
  produit: string;
  nature: NatureBv;
  montant: number;
  /** « AAAA-MM » attendu, `null` quand aucune date ne le dit. */
  mois: string | null;
  etat: EtatProchainBv;
}

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;

/** « AAAA-MM » (UTC) d'une date ISO ou d'un `Date` — `null` si absente ou illisible. */
export function moisDe(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** « 2026-11 » → « novembre » (« novembre 2026 » avec `avecAnnee`) ; « — » si le mois est inconnu. */
export function libelleMois(ym: string | null | undefined, avecAnnee = false): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
  if (!m) return "—";
  const nom = MOIS_LONGS[Number(m[2]) - 1];
  if (!nom) return "—";
  return avecAnnee ? `${nom} ${m[1]}` : nom;
}

/**
 * LES PROCHAINS BV — ce qui reste à demander ou à régler, dossier par dossier.
 *  • le 75 % ATTENDU (3 × le 25 % connu, pas encore demandé) : tombe au mois du DÉPÔT PRÉVU du dossier (il se paie avant) ;
 *  • un BV déjà DEMANDÉ et pas réglé : au mois de sa demande, « chez les Finances ».
 * Triés par mois (les sans-date à la fin), puis par référence.
 */
export function prochainsBv(lignes: readonly LigneBv[], depotPrevu: Readonly<Record<string, string | null>>): ProchainBv[] {
  const rows: ProchainBv[] = [];
  for (const l of lignes) {
    const base = { dossierId: l.dossierId, reference: l.reference, produit: l.nom ?? l.dci };
    if (l.bv25.statut === "DEMANDE" && l.bv25.demande > 0) {
      rows.push({ ...base, nature: "25", montant: l.bv25.demande, mois: moisDe(l.bv25.date), etat: "DEMANDE" });
    }
    if (l.bv75.statut === "DEMANDE" && l.bv75.demande > 0) {
      rows.push({ ...base, nature: "75", montant: l.bv75.demande, mois: moisDe(l.bv75.date), etat: "DEMANDE" });
    }
    if (l.prevision75 > 0) {
      rows.push({ ...base, nature: "75", montant: l.prevision75, mois: moisDe(depotPrevu[l.dossierId] ?? null), etat: "A_DEMANDER" });
    }
  }
  return rows.sort((a, b) => {
    if (a.mois !== b.mois) {
      if (a.mois === null) return 1;
      if (b.mois === null) return -1;
      return a.mois < b.mois ? -1 : 1;
    }
    return a.reference.localeCompare(b.reference, "fr") || a.nature.localeCompare(b.nature);
  });
}

/** LE BV 75 % À VENIR, en un chiffre : le montant attendu et le nombre de dossiers qui le portent. */
export function resumePrevision(lignes: readonly Pick<LigneBv, "prevision75">[]): { montant: number; dossiers: number } {
  let montant = 0;
  let dossiers = 0;
  for (const l of lignes) {
    if (l.prevision75 > 0) { montant += l.prevision75; dossiers += 1; }
  }
  return { montant, dossiers };
}

/** OÙ EN EST L'ANNÉE : la part de la période déjà écoulée, de 0 à 100 (entier). */
export function avancementPeriode(from: Date | string, to: Date | string, now: Date): number {
  const a = (typeof from === "string" ? new Date(from) : from).getTime();
  const b = (typeof to === "string" ? new Date(to) : to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round(Math.min(1, Math.max(0, (now.getTime() - a) / (b - a))) * 100);
}

export interface PointCumul { month: string; label: string; cumulative: number }
export interface PrevisionMensuelle { mois: string | null; montant: number }

export interface CourbeProjetee {
  labels: string[];
  /** Le cumul réel, jusqu'au mois en cours (puis `null`). */
  reel: (number | null)[];
  /** Le cumul prolongé des BV 75 % attendus, du mois en cours à la fin (avant : `null`). */
  projete: (number | null)[];
  /** Le mois en cours dans la série. */
  indexMaintenant: number;
  /** Les BV attendus sans mois connu : absents de la courbe, comptés ici. */
  nonDates: { nombre: number; montant: number };
}

/**
 * LA COURBE : consommation cumulée réelle jusqu'à aujourd'hui, puis — en pointillé — ce que les BV 75 % attendus y
 * ajouteront, mois par mois. Un BV attendu ce mois-ci ou avant (en retard) tombe au mois SUIVANT : ce qui est passé est
 * déjà dans le réel, ce qui n'est pas encore payé ne peut pas l'être. Un mois hors période est ramené à ses bornes.
 */
export function courbeProjection(points: readonly PointCumul[], previsions: readonly PrevisionMensuelle[], now: Date): CourbeProjetee {
  const n = points.length;
  const vide: CourbeProjetee = { labels: [], reel: [], projete: [], indexMaintenant: 0, nonDates: { nombre: 0, montant: 0 } };
  if (n === 0) return vide;

  const cle = moisDe(now) as string;
  let idx = points.findIndex((p) => p.month === cle);
  if (idx === -1) idx = cle < points[0].month ? 0 : n - 1;

  const ajouts = new Array<number>(n).fill(0);
  const nonDates = { nombre: 0, montant: 0 };
  for (const p of previsions) {
    if (!p.mois || !/^\d{4}-\d{2}$/.test(p.mois)) { nonDates.nombre += 1; nonDates.montant += p.montant; continue; }
    let i = points.findIndex((pt) => pt.month === p.mois);
    if (i === -1) i = p.mois < points[0].month ? 0 : n - 1;
    ajouts[Math.min(n - 1, Math.max(idx + 1, i))] += p.montant;
  }

  const base = points[idx].cumulative;
  let cumulAjouts = 0;
  const projete = points.map((_, i) => {
    cumulAjouts += ajouts[i];
    return i < idx ? null : base + cumulAjouts;
  });
  return {
    labels: points.map((p) => p.label),
    reel: points.map((p, i) => (i <= idx ? p.cumulative : null)),
    projete,
    indexMaintenant: idx,
    nonDates,
  };
}
