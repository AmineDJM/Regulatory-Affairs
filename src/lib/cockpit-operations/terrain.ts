import { couvertureEnMois, estPerime } from "@/lib/stocks/pch-central";
import type { ATraiter } from "./calculs";

/**
 * COCKPIT OPÉRATIONS · LE TERRAIN — les calculs PURS ajoutés par la maquette validée (10/2026) : l'équipe aujourd'hui
 * (terrain, mission, congé), les visites du jour, les ruptures que les KAM signalent, les stocks relevés dans les
 * hôpitaux, le score KPI de l'équipe. Testés sans base ; une donnée absente rend null, jamais zéro.
 */

const JOUR = 86_400_000;
const nb = (n: number) => Math.round(n).toLocaleString("fr-FR");

// ─────────────────────────── L'équipe aujourd'hui ───────────────────────────

export type GenreJour = "CONGE" | "MISSION" | "TERRAIN" | "AUCUN";

export interface StatutDuJour { genre: GenreJour; libelle: string }

/**
 * OÙ EST LE DÉLÉGUÉ AUJOURD'HUI : en congé (approuvé) l'emporte sur tout, puis une mission (congrès, événement) qui
 * couvre le jour, puis le terrain si son plan prévoit des visites (avec la ville la plus fréquente). Sinon : rien de
 * prévu — dit tel quel.
 */
export function statutDuJour(input: {
  conge: { libelle: string } | null;
  mission: { libelle: string; ville: string | null } | null;
  visitesPrevues: number;
  ville: string | null;
}): StatutDuJour {
  if (input.conge) return { genre: "CONGE", libelle: input.conge.libelle };
  if (input.mission) return { genre: "MISSION", libelle: [input.mission.libelle, input.mission.ville].filter(Boolean).join(" · ") };
  if (input.visitesPrevues > 0) return { genre: "TERRAIN", libelle: input.ville ? `terrain · ${input.ville}` : "terrain" };
  return { genre: "AUCUN", libelle: "rien de prévu" };
}

/** La ville du jour : la plus fréquente parmi les praticiens à voir (à égalité, l'ordre alphabétique). */
export function villeDuJour(villes: readonly (string | null | undefined)[]): string | null {
  const c = new Map<string, number>();
  for (const v of villes) { const t = v?.trim(); if (t) c.set(t, (c.get(t) ?? 0) + 1); }
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))[0]?.[0] ?? null;
}

/**
 * LES VISITES DU JOUR selon les PLANS : prévues = visites du plan du jour qui ne sont ni reportées ni annulées ;
 * réalisées = celles-là, rapportées (terminées). Une visite hors plan ne compte pas au dénominateur.
 */
export function visitesDuJour(visites: readonly { statut: string; planifiee: boolean }[]): { prevues: number; realisees: number } {
  const plan = visites.filter((v) => v.planifiee && v.statut !== "POSTPONED" && v.statut !== "CANCELLED");
  return { prevues: plan.length, realisees: plan.filter((v) => v.statut === "COMPLETED").length };
}

/** LE SCORE KPI DE L'ÉQUIPE : la moyenne des scores connus (chaque score est déjà la moyenne pondérée de la personne). */
export function scoreEquipe(scores: readonly (number | null | undefined)[]): { score: number | null; notes: number } {
  const s = scores.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return { score: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null, notes: s.length };
}

// ─────────────────────────── Ruptures signalées dans les rapports ───────────────────────────

const RUPTURE = /\b(rupture|en manque de|manque de stock|plus de stock|pas de stock|stock (a|est) (zero|vide|epuise)|indisponib|epuise)/;

/** Le compte rendu signale-t-il une rupture ? (minuscules, sans accents). */
export function signaleUneRupture(texte: string | null | undefined): boolean {
  if (!texte) return false;
  return RUPTURE.test(texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " "));
}

export interface SignalementRupture {
  /** L'établissement (annuaire), sinon son libellé. */
  etablissementCle: string;
  etablissement: string;
  productId: string;
  produit: string;
  delegue: string | null;
  date: Date;
}

/**
 * UN HÔPITAL SIGNALE UNE RUPTURE (rapport de visite) ALORS QUE LA PCH CENTRALE A DU STOCK : le réapprovisionnement de
 * l'hôpital est à demander. Un élément par établissement × produit (le signalement le plus récent).
 */
export function aTraiterRupturesSignalees(signalements: readonly SignalementRupture[], stockPchCentral: ReadonlyMap<string, number | null>, href: string): ATraiter[] {
  const par = new Map<string, SignalementRupture>();
  for (const s of signalements) {
    const k = `${s.etablissementCle}|${s.productId}`;
    const x = par.get(k);
    if (!x || s.date > x.date) par.set(k, s);
  }
  const out: ATraiter[] = [];
  for (const s of par.values()) {
    const stock = stockPchCentral.get(s.productId) ?? null;
    if (stock === null || !(stock > 0)) continue;
    out.push({
      cle: `rupture-signalee:${s.etablissementCle}:${s.productId}`, ton: "ko",
      titre: `${s.etablissement} signale une rupture de ${s.produit}${s.delegue ? ` (rapport de ${s.delegue.split(" ")[0]})` : ""}`,
      detail: `stock PCH central ${nb(stock)} → réapprovisionnement à demander`,
      href, action: "Agir", poids: Math.round(stock),
    });
  }
  return out;
}

/** LES PLANS DE TOURNÉE À VALIDER (Force de vente). */
export function aTraiterPlansAValider(plans: readonly { nom: string; planId: string | null }[]): ATraiter[] {
  if (!plans.length) return [];
  const noms = plans.slice(0, 3).map((p) => p.nom.split(" ")[0]).join(", ") + (plans.length > 3 ? ` +${plans.length - 3}` : "");
  return [{
    cle: "plans-a-valider", ton: "w",
    titre: `${plans.length} plan${plans.length > 1 ? "s" : ""} de tournée à valider`,
    detail: noms,
    href: plans.length === 1 && plans[0].planId ? `/medical/plan-de-tournee?plan=${plans[0].planId}` : "/medical/plan-de-tournee",
    action: "Ouvrir", poids: plans.length,
  }];
}

// ─────────────────────────── Stocks relevés par les délégués ───────────────────────────

export interface ReleveHopital {
  cle: string;
  hopital: string;
  produit: string;
  quantite: number;
  date: Date;
  /** Consommation mensuelle de cet hôpital pour ce produit (DR) — null si inconnue. */
  conso: number | null;
}

export interface LigneReleve extends ReleveHopital { mois: number | null; age: number; perime: boolean }

/**
 * LES DERNIERS RELEVÉS D'HÔPITAUX : les mois de couverture (stock ÷ consommation de l'hôpital), l'âge du relevé
 * (orange au-delà de 30 jours). Les plus courts d'abord ; une couverture inconnue après les connues.
 */
export function relevesHopitaux(lignes: readonly ReleveHopital[], maintenant: Date, max = 8): LigneReleve[] {
  return lignes
    .map((l) => {
      const age = Math.max(0, Math.floor((maintenant.getTime() - l.date.getTime()) / JOUR));
      return { ...l, mois: l.quantite === 0 ? 0 : couvertureEnMois(l.quantite, l.conso), age, perime: estPerime(age) };
    })
    .sort((a, b) => (a.mois ?? Infinity) - (b.mois ?? Infinity) || a.age - b.age)
    .slice(0, max);
}

// ─────────────────────────── Cette semaine ───────────────────────────

export interface EvenementSemaine { cle: string; ton: "v" | "i" | "ok"; titre: string; detail: string; le: Date }

/** Les 7 prochains jours (aujourd'hui compris), en jours civils locaux. */
export function septJours(maintenant: Date): { debut: Date; fin: Date } {
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return { debut, fin: new Date(debut.getTime() + 7 * JOUR) };
}

/** Le chevauchement d'une période avec une fenêtre (bornes incluses ; une fin absente = le jour du début). */
export function chevauche(debut: Date | null, fin: Date | null, f: { debut: Date; fin: Date }): boolean {
  if (!debut) return false;
  const finP = fin ?? debut;
  return debut.getTime() < f.fin.getTime() && finP.getTime() >= f.debut.getTime();
}

/** Les événements de la semaine, dans l'ordre des dates. */
export const trierSemaine = (e: readonly EvenementSemaine[], max = 6): EvenementSemaine[] => [...e].sort((a, b) => a.le.getTime() - b.le.getTime()).slice(0, max);
