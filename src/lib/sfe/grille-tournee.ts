import { debutDeSemaine, gestesPossibles, type EtatVisite, type StatutPlan } from "./tournee";

/**
 * LA GRILLE DU PLAN DE TOURNÉE — un emploi du temps : les JOURS en colonnes, les PROFESSIONNELS DE SANTÉ dans les
 * cellules (Direction, 06/10).
 *
 * ── UNE SEULE VÉRITÉ ────────────────────────────────────────────────────────────────────────
 *
 * La grille n'a pas de table à elle. Une cellule EST une paire `AAAA-MM-JJ|doctorId` — la forme que le planificateur
 * envoie à `planifierVisites` et que l'action relit — et, une fois enregistrée, une `MedicalVisit` du plan. Son état
 * (à faire, rapport fait, non tenue) vient de `etatVisite`, la MÊME fonction que « Ma journée » : la grille le lit,
 * elle ne le recalcule pas (§118.5).
 *
 * Module PUR (aucun import lourd) : l'écran — composant client — l'importe sans tirer la base dans le navigateur.
 */

/** La clé d'une cellule — la même forme que `clePaire` (lib/queries/tour-schedule) et que l'action. */
export const cleCellule = (jour: string, doctorId: string): string => `${jour}|${doctorId}`;

/** Une clé relue ; `null` quand elle est illisible — on ne devine pas une paire qu'on ne lit pas (§118.71). */
export function lireCellule(cle: string): { jour: string; doctorId: string } | null {
  const i = cle.indexOf("|");
  if (i <= 0) return null;
  const jour = cle.slice(0, i);
  const doctorId = cle.slice(i + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !doctorId) return null;
  return { jour, doctorId };
}

/** `AAAA-MM-JJ` d'une date LOCALE — le jour tel que le KAM le lit. */
export function jourIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dateDuJour = (j: string): Date => {
  const [a, m, d] = j.split("-").map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/**
 * LES SEMAINES DU PLAN — ses jours ouvrés groupés par semaine (dimanche → jeudi, `debutDeSemaine`). Un plan mensuel
 * fait quatre ou cinq semaines : la grille en montre UNE à la fois, sinon vingt-deux colonnes ne tiennent sur aucun
 * écran.
 */
export function semainesDuPlan(joursOuvres: readonly string[]): { debut: string; jours: string[] }[] {
  const parSemaine = new Map<string, string[]>();
  for (const j of [...joursOuvres].sort()) {
    const debut = jourIso(debutDeSemaine(dateDuJour(j)));
    parSemaine.set(debut, [...(parSemaine.get(debut) ?? []), j]);
  }
  return [...parSemaine.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([debut, jours]) => ({ debut, jours }));
}

/** La semaine à ouvrir : celle d'aujourd'hui (un vendredi ouvre sa semaine) quand elle est dans le plan, sinon la première. */
export function semaineInitiale(semaines: readonly { debut: string }[], aujourdhui: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aujourdhui)) return 0;
  const debut = jourIso(debutDeSemaine(dateDuJour(aujourdhui)));
  const i = semaines.findIndex((s) => s.debut === debut);
  return i >= 0 ? i : 0;
}

/** Ce qu'il faut savoir d'un praticien pour l'ordonner dans sa journée. */
export interface PraticienOrdonnable {
  name: string;
  wilaya: string | null;
  institution: string | null;
}

/**
 * LES PRATICIENS DE CHAQUE JOUR, dans l'ordre d'une tournée : par wilaya, puis par établissement, puis par nom — ceux
 * d'un même hôpital se suivent. Tous les jours ouvrés figurent (une colonne vide se montre vide) ; une paire posée sur
 * un jour qui n'est plus ouvré reste visible sous son jour plutôt que de disparaître (§118.71).
 */
export function praticiensParJour(
  paires: Iterable<string>,
  joursOuvres: readonly string[],
  infoDe: (doctorId: string) => PraticienOrdonnable,
): Map<string, string[]> {
  const parJour = new Map<string, string[]>(joursOuvres.map((j) => [j, []]));
  for (const cle of paires) {
    const c = lireCellule(cle);
    if (!c) continue;
    parJour.set(c.jour, [...(parJour.get(c.jour) ?? []), c.doctorId]);
  }
  const fr = (a: string | null, b: string | null) => (a ?? "￿").localeCompare(b ?? "￿", "fr");
  for (const [j, ids] of parJour) {
    parJour.set(j, [...new Set(ids)].sort((a, b) => {
      const x = infoDe(a), y = infoDe(b);
      return fr(x.wilaya, y.wilaya) || fr(x.institution, y.institution) || x.name.localeCompare(y.name, "fr");
    }));
  }
  return new Map([...parJour.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/** Un geste sur la grille : la nouvelle sélection, ou le refus qui dit pourquoi (§118.30). */
export type GesteGrille = { ok: true; paires: Set<string> } | { ok: false; raison: string };

const VERROU =
  "Cette visite est verrouillée : déjà rapportée (ou dite non tenue), ou passée sur un plan déjà validé — elle reste au plan.";

/** RETIRER un praticien d'un jour — jamais une visite verrouillée (rapportée, ou passée d'un plan validé, §118.193). */
export function retirerCellule(paires: ReadonlySet<string>, cle: string, verrouillees: ReadonlySet<string>): GesteGrille {
  if (!paires.has(cle)) return { ok: false, raison: "Ce praticien n'est plus prévu ce jour-là." };
  if (verrouillees.has(cle)) return { ok: false, raison: VERROU };
  const n = new Set(paires);
  n.delete(cle);
  return { ok: true, paires: n };
}

/**
 * DÉPLACER un praticien vers un autre jour. Refusé quand la visite est verrouillée, quand le jour visé n'est pas un
 * jour ouvré du plan (l'action refuserait hors période), ou quand le praticien y est déjà prévu (deux visites le même
 * jour chez le même médecin ne font qu'une).
 */
export function deplacerCellule(
  paires: ReadonlySet<string>,
  cle: string,
  versJour: string,
  joursOuvres: readonly string[],
  verrouillees: ReadonlySet<string>,
): GesteGrille {
  const c = lireCellule(cle);
  if (!c || !paires.has(cle)) return { ok: false, raison: "Ce praticien n'est plus prévu ce jour-là." };
  if (c.jour === versJour) return { ok: true, paires: new Set(paires) };
  if (verrouillees.has(cle)) return { ok: false, raison: VERROU };
  if (!joursOuvres.includes(versJour)) return { ok: false, raison: "Ce jour n'est pas un jour ouvré de la période du plan." };
  const vers = cleCellule(versJour, c.doctorId);
  if (paires.has(vers)) return { ok: false, raison: "Ce praticien est déjà prévu ce jour-là." };
  const n = new Set(paires);
  n.delete(cle);
  n.add(vers);
  return { ok: true, paires: n };
}

/**
 * LA GRILLE SE MODIFIE-T-ELLE ? Tant que le plan est OUVERT (brouillon, rejeté, rouvert en révision) et par qui peut
 * l'écrire — la MÊME règle que `planifierVisites` (`gestesPossibles(...).modifiable` + `peutEcrirePourLeKam`). Soumis
 * ou validé, sa structure se lit : l'action le refuserait de toute façon.
 */
export function grilleModifiable(statut: StatutPlan, peutEcrire: boolean): boolean {
  return peutEcrire && gestesPossibles(statut).modifiable;
}

/**
 * LE PLAN A-T-IL ÉTÉ VALIDÉ ? Validé, ou validé puis rouvert (une révision en cours, ou resoumise après révision) :
 * ses visites sont parties dans l'emploi du temps du KAM, et la grille ouvre leur rapport.
 */
export function planDejaValide(statut: StatutPlan, revisionCount: number): boolean {
  return statut === "APPROVED" || revisionCount > 0;
}

/**
 * L'ÉTAT D'UNE CELLULE. `etatEnregistre` est l'état de la visite enregistrée (`etatVisite`), `null` quand la paire n'est
 * pas encore enregistrée. Avant validation, une visite « à faire » ou « perdue » n'est encore qu'une intention : elle
 * se dit « prévue ». Un fait (rapport fait, non tenue) se montre toujours.
 */
export type EtatCellule = "NON_ENREGISTREE" | "PREVUE" | "A_VENIR" | EtatVisite;

/**
 * Une visite validée dont le JOUR n'est pas encore arrivé est « à venir » : elle ne se rapporte pas avant d'avoir eu
 * lieu — un compte rendu écrit la veille est une intention, pas un fait. Les jours se comparent en `AAAA-MM-JJ`.
 */
export function etatCellule(input: {
  etatEnregistre: EtatVisite | null;
  planValide: boolean;
  jour: string;
  aujourdhui: string;
}): EtatCellule {
  if (input.etatEnregistre === null) return "NON_ENREGISTREE";
  if (!input.planValide && (input.etatEnregistre === "A_FAIRE" || input.etatEnregistre === "PERDUE")) return "PREVUE";
  if (input.etatEnregistre === "A_FAIRE" && input.jour > input.aujourdhui) return "A_VENIR";
  return input.etatEnregistre;
}

export const ETAT_CELLULE_LABELS: Record<EtatCellule, string> = {
  NON_ENREGISTREE: "Non enregistrée",
  PREVUE: "Prévue",
  A_VENIR: "À venir",
  A_FAIRE: "À faire",
  FAITE: "Rapport fait",
  PERDUE: "Non réalisée — délai dépassé",
  ANNULEE: "Annulée",
  REPORTEE: "Reportée",
};

export type TonCellule = "neutral" | "success" | "warning" | "info" | "danger";

export function tonEtatCellule(e: EtatCellule): TonCellule {
  if (e === "FAITE") return "success";
  if (e === "PERDUE" || e === "NON_ENREGISTREE") return "warning";
  if (e === "ANNULEE" || e === "REPORTEE") return "info";
  return "neutral";
}

/**
 * CE QU'UN CLIC SUR LA CELLULE FAIT — la règle des boutons de « Ma journée » : « Rapport » sur une visite à faire,
 * « Corriger » sur un rapport fait dont la fenêtre de 48 h est encore ouverte, rien sinon (ni sur une visite à venir).
 * Seulement sur un plan validé, et pour le KAM lui-même (c'est son stock qui sort, et son compte rendu).
 */
export type GesteCellule = "RAPPORTER" | "CORRIGER" | "AUCUN";

export function gesteCellule(input: {
  etat: EtatCellule;
  heuresRestantes: number;
  planValide: boolean;
  jeSuisLeKam: boolean;
}): GesteCellule {
  if (!input.planValide || !input.jeSuisLeKam) return "AUCUN";
  if (input.etat === "A_FAIRE") return "RAPPORTER";
  if (input.etat === "FAITE" && input.heuresRestantes > 0) return "CORRIGER";
  return "AUCUN";
}
