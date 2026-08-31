import { TIERS, positionWeight, type SfeConfig } from "@/lib/sfe";

/**
 * LA JOURNÉE DU KAM — qui aller voir aujourd'hui, et pourquoi.
 *
 * ── LE PROBLÈME QUE CE MODULE RÉSOUT ────────────────────────────────────────────────────────
 *
 * Le pilotage savait dire, à la fin du mois, qu'un délégué avait fait 41 visites sur 55. Il ne
 * lui disait jamais QUI VOIR CE MATIN. Or c'est la seule question qu'un homme de terrain se
 * pose en montant dans sa voiture — et un outil qui n'y répond pas se fait remplacer par un
 * carnet, ce qui fait disparaître le réalisé et rend le cockpit aveugle. La saisie ne se
 * décrète pas : elle s'obtient en rendant l'écran UTILE avant d'être obligatoire.
 *
 * ── LES RÈGLES, ET POURQUOI CELLES-LÀ ───────────────────────────────────────────────────────
 *
 *  1. **La priorité vient du RETARD sur la fréquence cible**, pas du potentiel seul. Un « très
 *     fort potentiel » vu trois fois ce mois-ci est à jour ; un « moyen » jamais vu ne l'est
 *     pas. Trier sur le potentiel enverrait le délégué toujours chez les mêmes.
 *  2. **À retard égal, le potentiel tranche** — c'est là que l'heure de visite rapporte le plus.
 *  3. **À potentiel égal, le plus anciennement vu passe devant** : c'est ce qui empêche un
 *     praticien de sortir du radar pendant six mois.
 *  4. **Un praticien dont la fréquence cible est nulle (palier très faible) n'est jamais
 *     proposé** — le paramétrage dit qu'on ne l'attend pas ; le proposer quand même ferait
 *     mentir le réglage que la Direction a posé.
 *  5. **La raison est RENDUE avec la ligne.** « 3 attendues, 1 faite » se discute ; un ordre
 *     sans justification se subit — et un délégué qui ne comprend pas l'ordre le suit une
 *     semaine puis l'ignore.
 *
 * La tournée est une PROPOSITION : rien n'empêche de visiter quelqu'un qui n'y figure pas, et
 * la saisie d'une visite hors tournée est exactement aussi simple. Un plan qui interdit
 * d'improviser est un plan qu'on abandonne le jour où un praticien rappelle.
 *
 * Module PUR : ni base, ni import lourd. Testé.
 */

/** Un praticien du panel, réduit à ce qui décide de sa priorité. */
export interface PanelDoctor {
  id: string;
  name: string;
  /** Palier de potentiel (`SegmentLevel`) — pilote la fréquence attendue. */
  potential: string;
  specialty: string | null;
  institution: string | null;
  city: string | null;
  /** Dernière visite CONNUE, toutes périodes confondues. Null = jamais vu. */
  lastVisitAt: Date | null;
  /** Visites déjà faites CE MOIS-CI (c'est le cycle sur lequel la fréquence se juge). */
  visitsThisMonth: number;
}

/** Une ligne de la tournée proposée : le praticien, son retard, et la raison qu'on affiche. */
export interface TourneeItem {
  doctorId: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  city: string | null;
  potential: string;
  /** Visites attendues ce mois selon le palier (paramétrage Direction). */
  expected: number;
  done: number;
  /** Ce qui reste à faire ce mois pour ce praticien (jamais négatif). */
  missing: number;
  /** Jours depuis la dernière visite connue. Null = jamais visité. */
  daysSince: number | null;
  /** La phrase affichée sous le nom — elle doit se lire seule. */
  reason: string;
}

const DAY = 86_400_000;

/** Jours pleins écoulés depuis une date (null si inconnue). */
export function daysSince(date: Date | null, today: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / DAY));
}

/** Rang du palier de potentiel (0 = le plus fort) — l'ordre d'affichage fait foi. */
export function tierRank(potential: string): number {
  const i = (TIERS as readonly string[]).indexOf(potential);
  return i < 0 ? TIERS.length : i;
}

/**
 * La phrase qui accompagne une ligne. Elle dit le FAIT, pas l'injonction : « 3 attendues,
 * 1 faite » se vérifie, « à visiter en priorité » ne se vérifie pas.
 */
export function reasonFor(expected: number, done: number, since: number | null): string {
  if (since === null) return expected > 1 ? `Jamais visité — ${expected} visites attendues ce mois` : "Jamais visité";
  const retard = since >= 60 ? ` — pas vu depuis ${Math.floor(since / 30)} mois` : since >= 30 ? " — pas vu depuis un mois" : ` — vu il y a ${since} j`;
  if (done === 0) return `${expected} attendue${expected > 1 ? "s" : ""} ce mois, aucune faite${retard}`;
  return `${expected} attendue${expected > 1 ? "s" : ""} ce mois, ${done} faite${done > 1 ? "s" : ""}${retard}`;
}

/**
 * LA TOURNÉE PROPOSÉE — les praticiens en retard de fréquence, les plus utiles d'abord.
 *
 * `limit` borne la liste à ce qu'une journée contient réellement : proposer quarante noms
 * revient à n'en proposer aucun. Le reste du panel reste accessible par la recherche.
 */
export function buildTournee(
  doctors: readonly PanelDoctor[],
  config: SfeConfig,
  today: Date,
  limit = 8,
): TourneeItem[] {
  const items: TourneeItem[] = [];
  for (const d of doctors) {
    const expected = config.frequencyByTier[d.potential] ?? 0;
    // Règle 4 : le paramétrage dit qu'on n'attend rien de ce palier — on ne le propose pas.
    if (expected <= 0) continue;
    const missing = Math.max(0, expected - d.visitsThisMonth);
    if (missing <= 0) continue; // à jour ce mois : il n'a rien à faire dans la tournée
    const since = daysSince(d.lastVisitAt, today);
    items.push({
      doctorId: d.id, name: d.name, specialty: d.specialty, institution: d.institution, city: d.city,
      potential: d.potential, expected, done: d.visitsThisMonth, missing, daysSince: since,
      reason: reasonFor(expected, d.visitsThisMonth, since),
    });
  }
  return items
    .sort((a, b) =>
      // 1. le plus en retard ; 2. le plus fort potentiel ; 3. le plus anciennement vu
      b.missing - a.missing
      || tierRank(a.potential) - tierRank(b.potential)
      || (b.daysSince ?? Number.MAX_SAFE_INTEGER) - (a.daysSince ?? Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name, "fr"),
    )
    .slice(0, limit);
}

/**
 * LA LIGNE DE CHIFFRES DU MOIS — le seul tableau de bord d'un délégué.
 *
 * Quatre nombres, pas quarante : ce qu'il a fait, ce qu'on attend, la part de son panel qu'il
 * a touchée, et les jours ouvrés qui restent. Un cinquième chiffre ne serait plus lu.
 */
export interface MonthProgress {
  done: number;
  target: number;
  /** Réalisation en %, bornée à l'affichage (on ne cache pas un dépassement : il est dit). */
  donePct: number;
  panelSize: number;
  covered: number;
  coveragePct: number;
  /** Jours ouvrés restants dans le mois, aujourd'hui inclus. */
  workdaysLeft: number;
  /** Rythme à tenir sur les jours restants pour atteindre la cible. 0 = cible atteinte. */
  perDay: number;
}

const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 100) : 0);

/** Jours ouvrés (lun-jeu + dim, semaine algérienne) restants dans le mois, aujourd'hui inclus. */
export function workdaysLeft(today: Date): number {
  // La semaine ouvrée algérienne va du DIMANCHE au JEUDI : vendredi et samedi sont le
  // week-end. Compter à la française donnerait un rythme faux de deux jours par semaine.
  const year = today.getFullYear();
  const month = today.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = today.getDate(); d <= last; d++) {
    const jour = new Date(year, month, d).getDay(); // 0 = dimanche … 5 = vendredi, 6 = samedi
    if (jour !== 5 && jour !== 6) n += 1;
  }
  return n;
}

export function monthProgress(input: {
  done: number; target: number; panelSize: number; covered: number; today: Date;
}): MonthProgress {
  const left = workdaysLeft(input.today);
  const reste = Math.max(0, input.target - input.done);
  return {
    done: input.done,
    target: input.target,
    donePct: pct(input.done, input.target),
    panelSize: input.panelSize,
    covered: input.covered,
    coveragePct: pct(input.covered, input.panelSize),
    workdaysLeft: left,
    perDay: reste === 0 || left === 0 ? 0 : Math.ceil(reste / left),
  };
}

/**
 * LES PRODUITS À PRÉSENTER, dans l'ordre de la mallette — P1 d'abord.
 *
 * C'est ce qui rend la saisie possible en trois gestes : on ne montre PAS le catalogue, on
 * montre les produits que CE délégué porte CE mois-ci, rangés par position de détail. Les
 * deux premiers arrivent pré-cochés : ce sont ceux qu'il présente presque toujours, et
 * décocher est plus rapide que chercher.
 */
export interface CarriedProduct {
  productId: string;
  name: string;
  position: number;
  /** Pré-coché à l'ouverture de la saisie. */
  preselected: boolean;
}

export function carriedProducts(
  assignments: readonly { productId: string; name: string; position: number }[],
  config: SfeConfig,
  preselectCount = 2,
): CarriedProduct[] {
  const sorted = [...assignments].sort((a, b) =>
    positionWeight(b.position, config.positionWeights) - positionWeight(a.position, config.positionWeights)
    || a.name.localeCompare(b.name, "fr"),
  );
  return sorted.map((a, i) => ({
    productId: a.productId, name: a.name, position: a.position,
    // Seuls les P1 se pré-cochent : pré-cocher un P3 ferait enregistrer une présentation qui
    // n'a pas eu lieu, et un chiffre faux vaut moins qu'un chiffre absent.
    preselected: i < preselectCount && a.position === 1,
  }));
}
