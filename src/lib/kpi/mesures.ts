import { couvertureAFrequence, realiseRequis, type PraticienSuivi } from "@/lib/force-de-vente/calculs";
import type { LettreKpi } from "./briques";

/**
 * LA PART PURE DES BRIQUES — ce qu'elles COMPTENT, une fois les lignes lues. Testée sans base.
 *
 * Le serveur (`briques-calcul.ts`) lit les visites, le panel, les plans, les fiches, les tâches, et les passe ici. Les
 * règles de la force de vente ne sont pas réécrites : la couverture à fréquence et le réalisé plafonné sont CEUX du
 * pilotage (`force-de-vente/calculs.ts`), appliqués à une fenêtre de N mois (requis du cycle × N).
 */

const MS_H = 3_600_000;

/** Un praticien du panel sur la fenêtre : son requis du cycle et les visites réalisées sur toute la fenêtre. */
export type PraticienFenetre = PraticienSuivi;

/** Le requis d'un cycle, porté à la fenêtre (× nombre de mois). */
export function aLaFenetre(p: readonly PraticienFenetre[], mois: number): PraticienFenetre[] {
  return p.map((x) => ({ ...x, requis: x.requis * mois }));
}

const retenu = (lettres: readonly LettreKpi[] | undefined) => (l: string | null) => !lettres || lettres.length === 0 || (l !== null && (lettres as readonly string[]).includes(l));

/** Contacts requis et réalisés (plafonnés) d'un panel, sur la fenêtre. */
export function contacts(p: readonly PraticienFenetre[], mois: number, lettres?: readonly LettreKpi[]): { requis: number; realise: number } {
  const garde = retenu(lettres);
  const r = realiseRequis(aLaFenetre(p.filter((x) => garde(x.lettre)), mois));
  return { requis: r.requis, realise: r.realise };
}

/** Cibles (lettres retenues, requis > 0) et cibles vues à fréquence, sur la fenêtre. H · A · B par défaut. */
export function ciblesAFrequence(p: readonly PraticienFenetre[], mois: number, lettres?: readonly LettreKpi[]): { cibles: number; vues: number } {
  const c = couvertureAFrequence(aLaFenetre(p, mois), lettres && lettres.length ? lettres : ["H", "A", "B"]);
  return { cibles: c.cibles, vues: c.vues };
}

/**
 * Cibles vues AU MOINS N FOIS PAR MOIS (N × mois sur la fenêtre). Lettre H par défaut — les décideurs. Une cible
 * se compte dès qu'elle porte une lettre retenue, même si sa fréquence demandée est inférieure à N.
 */
export function ciblesVuesN(p: readonly PraticienFenetre[], mois: number, n: number, lettres?: readonly LettreKpi[]): { cibles: number; vues: number } {
  const garde = retenu(lettres && lettres.length ? lettres : ["H"]);
  const cibles = p.filter((x) => x.lettre !== null && garde(x.lettre));
  return { cibles: cibles.length, vues: cibles.filter((x) => x.faites >= n * mois).length };
}

export interface VisitePourRapport {
  date: Date;
  statut: string;
  /** L'heure du rapport : premier compte rendu vocal rattaché, sinon dernière modification (borne haute) — null = pas de rapport. */
  rapportLe: Date | null;
}

/**
 * RAPPORTS RENDUS DANS LE DÉLAI. Au dénominateur : les visites ni annulées ni reportées dont le rapport est fait OU
 * dont le délai est écoulé (une visite d'hier dont le rapport peut encore venir n'est pas un manquement). Au
 * numérateur : celles dont le rapport est arrivé au plus `heures` après la visite.
 */
export function rapportsDansDelai(visites: readonly VisitePourRapport[], heures: number, maintenant: Date): { aRapporter: number; dansDelai: number } {
  let aRapporter = 0, dansDelai = 0;
  for (const v of visites) {
    if (v.statut === "CANCELLED" || v.statut === "POSTPONED") continue;
    const limite = v.date.getTime() + heures * MS_H;
    if (!v.rapportLe && limite > maintenant.getTime()) continue;
    aRapporter++;
    if (v.rapportLe && v.rapportLe.getTime() <= limite) dansDelai++;
  }
  return { aRapporter, dansDelai };
}

/** PLANS DE TOURNÉE validés ET soumis avant leur échéance. */
export function plansATemps(plans: readonly { statut: string; submittedAt: Date | null; submissionDueAt: Date }[]): { plans: number; aTemps: number } {
  return {
    plans: plans.length,
    aTemps: plans.filter((p) => p.statut === "APPROVED" && p.submittedAt !== null && p.submittedAt.getTime() <= p.submissionDueAt.getTime()).length,
  };
}

/** NOTE DE COACHING : moyenne des fiches (total ÷ maximum), en pourcentage. Aucune fiche : null. */
export function noteCoaching(fiches: readonly { total: number; max: number }[]): number | null {
  const lues = fiches.filter((f) => f.max > 0);
  if (lues.length === 0) return null;
  return Math.round((lues.reduce((s, f) => s + f.total / f.max, 0) / lues.length) * 1000) / 10;
}

/**
 * TÂCHES FAITES À TEMPS : parmi les tâches dont l'échéance est passée (annulées, refusées exclues), celles terminées au
 * plus tard le jour de l'échéance (jusqu'à 23 h 59).
 */
export function tachesATemps(taches: readonly { dueDate: Date; completedAt: Date | null; statut: string }[], maintenant: Date): { echues: number; aTemps: number } {
  let echues = 0, aTemps = 0;
  for (const t of taches) {
    if (t.statut === "CANCELLED" || t.statut === "DECLINED") continue;
    const finDuJour = new Date(t.dueDate.getFullYear(), t.dueDate.getMonth(), t.dueDate.getDate() + 1).getTime();
    if (finDuJour > maintenant.getTime() && !(t.statut === "DONE" && t.completedAt)) continue;
    echues++;
    if (t.statut === "DONE" && t.completedAt && t.completedAt.getTime() < finDuJour) aTemps++;
  }
  return { echues, aTemps };
}

/** La médiane d'une liste d'heures ; null si vide. */
export function mediane(valeurs: readonly number[]): number | null {
  const v = valeurs.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return Math.round((v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2) * 10) / 10;
}

/** Délais de réponse (heures) des étapes dont l'heure d'arrivée est connue. */
export function delaisDeReponse(etapes: readonly { creeLe: Date; decideLe: Date | null; arriveeConnue: boolean }[]): number[] {
  return etapes.flatMap((e) => (e.arriveeConnue && e.decideLe ? [Math.max(0, (e.decideLe.getTime() - e.creeLe.getTime()) / MS_H)] : []));
}
