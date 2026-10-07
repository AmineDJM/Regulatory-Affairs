import { joursOuvres } from "@/lib/segmentation/cycle";
import type { Lettre, Statut } from "@/lib/segmentation/regles";

/**
 * FORCE DE VENTE — les calculs PURS du pilotage (Direction, 07/10), testés sans base.
 *
 *   • le jour du cycle en JOURS OUVRÉS (vendredi et samedi chômés — la règle de la segmentation) et l'« attendu à J<n> » ;
 *   • le RÉALISÉ face au requis : visites terminées, plafonnées au requis de chaque praticien (la règle du cycle de
 *     segmentation : une 5e visite au même médecin ne comble pas un autre trou) ;
 *   • la COUVERTURE à fréquence des cibles H · A · B ;
 *   • le tri « par retard sur le requis », les cycles sans visite, les cibles hors panel.
 *
 * Le « requis » d'un praticien vient de `lettre-requise.ts` (la lettre de segmentation, sinon le palier de potentiel) :
 * ici on ne fait que compter. Seul import : `joursOuvres`, pur lui aussi.
 */

/** Le cycle = le mois calendaire (PromoCycle). Le jour N sur le total, en jours ouvrés. */
export function jourDuCycle(year: number, month: number, maintenant: Date): { jour: number; total: number } {
  const debut = new Date(Date.UTC(year, month - 1, 1));
  const fin = new Date(Date.UTC(year, month, 0));
  const total = joursOuvres(debut, fin);
  const auj = new Date(Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()));
  if (auj < debut) return { jour: 0, total };
  if (auj > fin) return { jour: total, total };
  return { jour: joursOuvres(debut, auj), total };
}

/** Ce qu'on attend au jour N : le requis au prorata des jours ouvrés écoulés. */
export function attenduAuJour(requis: number, jour: number, total: number): number {
  if (total <= 0 || requis <= 0) return 0;
  return Math.round((requis * Math.min(jour, total)) / total);
}

/** Un praticien suivi sur le cycle : sa lettre (null = hors segmentation), son requis, les visites faites. */
export interface PraticienSuivi {
  doctorId: string;
  lettre: Lettre | null;
  requis: number;
  faites: number;
}

/** Réalisé / requis d'un panel — le réalisé plafonné au requis de chaque praticien (requis 0 : rien ne compte). */
export function realiseRequis(praticiens: readonly PraticienSuivi[]): { realise: number; requis: number } {
  let realise = 0, requis = 0;
  for (const p of praticiens) {
    if (p.requis <= 0) continue;
    requis += p.requis;
    realise += Math.min(p.faites, Math.ceil(p.requis));
  }
  return { realise, requis: Math.round(requis * 10) / 10 };
}

/** Vu « à fréquence » : au moins autant de visites que le requis du cycle. */
export const aFrequence = (p: Pick<PraticienSuivi, "requis" | "faites">): boolean => p.requis > 0 && p.faites >= p.requis;

/**
 * LA COUVERTURE À FRÉQUENCE des cibles d'une famille de lettres (H · A · B par défaut) : combien en ont reçu au moins
 * leur requis. Une cible sans visite requise (fréquence 0) n'entre pas au dénominateur.
 */
export function couvertureAFrequence(
  praticiens: readonly PraticienSuivi[],
  lettres: readonly Lettre[] = ["H", "A", "B"],
): { cibles: number; vues: number; pct: number | null } {
  const cibles = praticiens.filter((p) => p.lettre !== null && lettres.includes(p.lettre) && p.requis > 0);
  const vues = cibles.filter(aFrequence).length;
  return { cibles: cibles.length, vues, pct: cibles.length ? Math.round((vues / cibles.length) * 100) : null };
}

/** Le taux d'avancement d'une ligne (réalisé ÷ requis) — null sans requis. */
export const tauxRealise = (r: { realise: number; requis: number }): number | null => (r.requis > 0 ? r.realise / r.requis : null);

/**
 * « TRIÉS PAR RETARD SUR LE REQUIS » : le plus en retard d'abord (le plus faible réalisé ÷ requis), puis le plus gros
 * requis ; une ligne sans requis va à la fin ; à égalité, l'ordre alphabétique.
 */
export function trierParRetard<T extends { nom: string; realise: number; requis: number }>(lignes: readonly T[]): T[] {
  return [...lignes].sort((a, b) => {
    const ta = tauxRealise(a), tb = tauxRealise(b);
    if (ta === null || tb === null) return ta === null && tb === null ? a.nom.localeCompare(b.nom, "fr") : ta === null ? 1 : -1;
    return ta - tb || b.requis - a.requis || a.nom.localeCompare(b.nom, "fr");
  });
}

/**
 * Combien de cycles (mois) depuis la dernière visite : 0 = vu ce mois-ci, 1 = le mois dernier… null = jamais vu.
 */
export function cyclesSansVisite(derniere: Date | null, year: number, month: number): number | null {
  if (!derniere) return null;
  return Math.max(0, year * 12 + (month - 1) - (derniere.getFullYear() * 12 + derniere.getMonth()));
}

export interface CibleAVoir {
  doctorId: string;
  nom: string;
  lieu: string | null;
  lettre: Lettre;
  statut: Statut | null;
  cycles: number | null;
}

/**
 * À VOIR EN PRIORITÉ : les H et A non vus depuis au moins `seuil` cycle(s) (jamais vu compris) — H d'abord, puis le plus
 * ancien (jamais vu en tête), puis le nom.
 */
export function aVoirEnPriorite(cibles: readonly CibleAVoir[], seuil = 1, max = 5): CibleAVoir[] {
  const rang = (l: Lettre) => (l === "H" ? 0 : 1);
  return cibles
    .filter((c) => (c.lettre === "H" || c.lettre === "A") && (c.cycles === null || c.cycles >= seuil))
    .sort((a, b) => rang(a.lettre) - rang(b.lettre) || (b.cycles ?? Infinity) - (a.cycles ?? Infinity) || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, max);
}

/** « H · 2 cycles », « A · jamais vu ». */
export function libelleRetardCible(c: Pick<CibleAVoir, "lettre" | "cycles">): string {
  if (c.cycles === null) return `${c.lettre} · jamais vu`;
  return `${c.lettre} · ${c.cycles} cycle${c.cycles > 1 ? "s" : ""}`;
}

/** L'état du plan de tournée tel que le pilotage le dit : validé, à valider, brouillon, absent. */
export type EtatPlan = "VALIDE" | "A_VALIDER" | "BROUILLON" | "ABSENT";
export function etatPlan(statut: string | null): EtatPlan {
  if (!statut) return "ABSENT";
  if (statut === "APPROVED") return "VALIDE";
  if (statut === "SUBMITTED" || statut === "ESCALATED") return "A_VALIDER";
  return "BROUILLON";
}
export const ETAT_PLAN_LABELS: Record<EtatPlan, string> = { VALIDE: "validé", A_VALIDER: "à valider", BROUILLON: "brouillon", ABSENT: "absent" };

/** Un coaching est en retard au-delà de `jours` sans fiche (jamais coaché compris). */
export function coachingEnRetard(dernier: Date | null, maintenant: Date, jours = 60): boolean {
  if (!dernier) return true;
  return maintenant.getTime() - dernier.getTime() > jours * 86_400_000;
}

/**
 * HORS PANEL : les cibles H ou A d'un secteur qu'AUCUN panel de KAM ne contient (secteur ∪ rattachement). Rendues par
 * secteur ; une ligne sans secteur n'est rangée nulle part.
 */
export function horsPanelParSecteur(
  lignes: readonly { doctorId: string; lettre: Lettre | null; secteurId: string | null }[],
  dansUnPanel: ReadonlySet<string>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of lignes) {
    if (!l.secteurId || (l.lettre !== "H" && l.lettre !== "A") || dansUnPanel.has(l.doctorId)) continue;
    out.set(l.secteurId, [...(out.get(l.secteurId) ?? []), l.doctorId]);
  }
  return out;
}

/**
 * LA TENDANCE SUR N CYCLES — les points d'une petite courbe (SVG `polyline`), un taux 0..1 par cycle (null = cycle
 * sans donnée, sauté). Rend null quand moins de deux points existent : une courbe d'un point ne dit rien.
 */
export function pointsSparkline(taux: readonly (number | null)[], largeur = 70, hauteur = 20, marge = 2): string | null {
  const n = taux.length;
  const pts = taux.flatMap((t, i) => {
    if (t === null || !Number.isFinite(t)) return [];
    const x = n > 1 ? (i / (n - 1)) * largeur : 0;
    const y = marge + (1 - Math.max(0, Math.min(1, t))) * (hauteur - 2 * marge);
    return [`${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`];
  });
  return pts.length >= 2 ? pts.join(" ") : null;
}

/** La tendance monte, descend, ou reste — le dernier point face à la moyenne des précédents (±5 points). */
export function sensTendance(taux: readonly (number | null)[]): "hausse" | "baisse" | "stable" | null {
  const vals = taux.filter((t): t is number => t !== null && Number.isFinite(t));
  if (vals.length < 2) return null;
  const dernier = vals[vals.length - 1];
  const avant = vals.slice(0, -1).reduce((s, v) => s + v, 0) / (vals.length - 1);
  return dernier - avant > 0.05 ? "hausse" : avant - dernier > 0.05 ? "baisse" : "stable";
}

/** « 6,9 » — une décimale, virgule. */
export const uneDecimale = (n: number): string => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « Cycle d'octobre », « Cycle de novembre 2025 » (l'année quand ce n'est pas celle d'aujourd'hui). */
export function libelleCycle(year: number, month: number, maintenant: Date = new Date()): string {
  const m = MOIS[month - 1] ?? String(month);
  return `Cycle ${/^[aeiouyàâéèêî]/i.test(m) ? "d'" : "de "}${m}${year !== maintenant.getFullYear() ? ` ${year}` : ""}`;
}

/** « octobre », « novembre 2025 ». */
export const nomDuMois = (year: number, month: number, maintenant: Date = new Date()): string =>
  `${MOIS[month - 1] ?? month}${year !== maintenant.getFullYear() ? ` ${year}` : ""}`;

/** Le mois précédent. */
export const moisPrecedent = (year: number, month: number): { y: number; m: number } => (month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 });
export const moisSuivant = (year: number, month: number): { y: number; m: number } => (month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 });
