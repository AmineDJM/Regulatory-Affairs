/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SANTÉ D'UN PRODUIT — la note sur 100 de Produits 360 (Direction, 10/2026 : « Parfait, implémente Produits 360 avec
 * ces poids »). Module PUR : il ne lit rien, il reçoit des faits déjà calculés. La liste, la fiche, l'anneau (client)
 * et les tests le partagent — d'où AUCUN import.
 *
 * ── CINQ COMPOSANTES, CHACUNE RAMENÉE À 0–100 ───────────────────────────────────────────────
 *
 *   Stock (25)            mois de couverture de la chaîne (PCH central + directions régionales + hôpitaux — pas de stock Adventum) : ≥ 3 mois → 100, linéaire jusqu'à 0 à 0 mois ;
 *                         −10 par lot qui périme dans moins de 6 mois (au plus −30).
 *   Couverture terrain (25) part des cibles H·A·B (décideurs, segments A et B) vues À FRÉQUENCE ce cycle.
 *   Prescripteurs (20)    part des praticiens segmentés en A : 25 % de A → 80 points (au-delà, plafonné) ; plus la
 *                         dynamique depuis l'ouverture du dernier cycle : 10 points neutres, ±5 par A net gagné / perdu
 *                         (0 à 20). Sans cycle de comparaison : 10.
 *   Réglementaire (15)    100, moins l'échéance de dépôt du renouvellement de la DE (dépassée −60, ≤ 90 j −45, ≤ 6 mois
 *                         −25) et −15 par variation en attente (au plus −30).
 *   Qualité (15)          100, moins chaque cas de pharmacovigilance OUVERT selon sa gravité (décès −60, grave −40,
 *                         gravité inconnue −25, non grave −15).
 *
 * Une composante SANS DONNÉE (module non visible, aucun relevé, aucun praticien segmenté…) n'est pas un zéro : elle est
 * EXCLUE et les poids restants sont renormalisés — l'écran l'affiche « n/d ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const POIDS_SANTE = { stock: 25, terrain: 25, prescripteurs: 20, reglementaire: 15, qualite: 15 } as const;
export type ComposanteSante = keyof typeof POIDS_SANTE;
export const COMPOSANTES_SANTE = Object.keys(POIDS_SANTE) as ComposanteSante[];

export const LIBELLE_COMPOSANTE: Record<ComposanteSante, string> = {
  stock: "Stock", terrain: "Couverture terrain", prescripteurs: "Prescripteurs", reglementaire: "Réglementaire", qualite: "Qualité",
};

/** La règle de chaque composante, en une ligne — ce que l'anneau montre au clic. */
export const REGLE_COMPOSANTE: Record<ComposanteSante, string> = {
  stock: "≥ 3 mois de couverture = 100, 0 mois = 0 ; −10 par lot qui périme sous 6 mois.",
  terrain: "Part des cibles H·A·B vues au moins autant que leur fréquence ce cycle.",
  prescripteurs: "25 % de A = 80 points ; ±5 par A net gagné ou perdu depuis le dernier cycle.",
  reglementaire: "Renouvellement de la DE à déposer sous 6 mois ou en retard, variations en attente.",
  qualite: "Cas de pharmacovigilance ouverts, pondérés par leur gravité.",
};

const borner = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

// ─────────────────────────── Les cinq notes ───────────────────────────

export const COUVERTURE_CIBLE_MOIS = 3;
export const PENALITE_LOT = 10;
export const PENALITE_LOTS_MAX = 30;

/** STOCK — `null` sans couverture connue (aucun relevé, ou aucun écoulement pour diviser). */
export function noteStock(f: { couvertureMois: number | null; lotsExpirant: number }): number | null {
  if (f.couvertureMois === null || !Number.isFinite(f.couvertureMois)) return null;
  const base = Math.min(1, Math.max(0, f.couvertureMois) / COUVERTURE_CIBLE_MOIS) * 100;
  return Math.round(borner(base - Math.min(PENALITE_LOTS_MAX, PENALITE_LOT * Math.max(0, f.lotsExpirant))));
}

/** COUVERTURE TERRAIN — `null` sans cible H·A·B (pas de segmentation, ou aucune visite requise). */
export function noteTerrain(f: { cibles: number; vuesAFrequence: number }): number | null {
  if (!(f.cibles > 0)) return null;
  return Math.round(borner((Math.min(f.vuesAFrequence, f.cibles) / f.cibles) * 100));
}

export const PART_A_CIBLE = 0.25;

/** PRESCRIPTEURS — `null` sans praticien segmenté A, B, C ou D. */
export function notePrescripteurs(f: { a: number; segmentes: number; mouvementNet: number | null }): number | null {
  if (!(f.segmentes > 0)) return null;
  const base = Math.min(1, f.a / f.segmentes / PART_A_CIBLE) * 80;
  const dynamique = f.mouvementNet === null ? 10 : borner(10 + 5 * f.mouvementNet, 0, 20);
  return Math.round(borner(base + dynamique));
}

/** Le retrait de l'échéance de dépôt du renouvellement de la DE. */
export function penaliteEcheanceDe(joursAvantDepot: number | null): number {
  if (joursAvantDepot === null) return 0;
  if (joursAvantDepot < 0) return 60;
  if (joursAvantDepot <= 90) return 45;
  if (joursAvantDepot <= 183) return 25;
  return 0;
}

/** RÉGLEMENTAIRE — `null` quand aucun dossier n'est visible. */
export function noteReglementaire(f: { dossiers: number; joursAvantDepot: number | null; variationsEnAttente: number }): number | null {
  if (!(f.dossiers > 0)) return null;
  return Math.round(borner(100 - penaliteEcheanceDe(f.joursAvantDepot) - Math.min(30, 15 * Math.max(0, f.variationsEnAttente))));
}

export const POIDS_GRAVITE_PV: Record<string, number> = { DECES: 60, GRAVE: 40, INCONNU: 25, NON_GRAVE: 15 };

/** QUALITÉ — `null` sans le module Pharmacovigilance ; aucun cas ouvert = 100 (un fait, pas une absence). */
export function noteQualite(f: { gravitesOuvertes: readonly (string | null)[] } | null): number | null {
  if (!f) return null;
  const retrait = f.gravitesOuvertes.reduce((s, g) => s + (POIDS_GRAVITE_PV[g ?? "INCONNU"] ?? POIDS_GRAVITE_PV.INCONNU), 0);
  return Math.round(borner(100 - retrait));
}

// ─────────────────────────── La note globale ───────────────────────────

export interface DetailComposante {
  cle: ComposanteSante;
  libelle: string;
  poids: number;
  /** Le poids après renormalisation (en %), `null` quand la composante est exclue. */
  poidsEffectif: number | null;
  note: number | null;
  /** Le fait qui la porte (« 7,3 mois · 1 lot sous 6 mois »), `null` = n/d. */
  fait: string | null;
  regle: string;
}

export interface NoteSante { score: number | null; composantes: DetailComposante[] }

/**
 * LA NOTE SUR 100 — moyenne pondérée des composantes CONNUES, poids renormalisés. Aucune composante : `null` (« n/d »).
 */
export function noteSante(notes: Partial<Record<ComposanteSante, number | null>>, faits: Partial<Record<ComposanteSante, string | null>> = {}): NoteSante {
  const connues = COMPOSANTES_SANTE.filter((c) => typeof notes[c] === "number" && Number.isFinite(notes[c] as number));
  const total = connues.reduce((s, c) => s + POIDS_SANTE[c], 0);
  const score = total > 0 ? Math.round(connues.reduce((s, c) => s + POIDS_SANTE[c] * (notes[c] as number), 0) / total) : null;
  return {
    score,
    composantes: COMPOSANTES_SANTE.map((c) => {
      const n = connues.includes(c) ? Math.round(notes[c] as number) : null;
      return {
        cle: c, libelle: LIBELLE_COMPOSANTE[c], poids: POIDS_SANTE[c],
        poidsEffectif: n === null || total === 0 ? null : Math.round((POIDS_SANTE[c] / total) * 100),
        note: n, fait: n === null ? null : faits[c] ?? null, regle: REGLE_COMPOSANTE[c],
      };
    }),
  };
}

export type TonSante = "success" | "warning" | "danger" | "neutral";

/** ≥ 70 vert, ≥ 50 orange, sinon rouge ; inconnue : gris. */
export function tonSante(score: number | null): TonSante {
  if (score === null) return "neutral";
  return score >= 70 ? "success" : score >= 50 ? "warning" : "danger";
}

// ─────────────────────────── Le cycle ───────────────────────────

export interface FenetreCycle {
  debut: Date;
  /** Exclue : maintenant, ou le lendemain de la fin si le cycle est passé. */
  finExclue: Date;
  /** Fin du cycle (dernier jour inclus). */
  fin: Date;
  /** Le cycle d'avant, sur la MÊME durée écoulée — une comparaison à date, jamais un mois entier contre neuf jours. */
  precedent: { debut: Date; finExclue: Date };
  /** Le cycle de segmentation ouvert, ou le mois civil (cycle promotionnel). */
  source: "SEGMENTATION" | "MOIS";
}

const JOUR = 86_400_000;

/**
 * LA FENÊTRE DU CYCLE : le cycle de segmentation OUVERT quand il y en a un (c'est lui qui fixe les fréquences), sinon le
 * mois civil — le cycle promotionnel (`PromoCycle`) est mensuel.
 */
export function fenetreCycle(maintenant: Date, ouvert?: { debut: Date; fin: Date } | null): FenetreCycle {
  if (ouvert) {
    const debut = new Date(ouvert.debut);
    const finIncl = new Date(ouvert.fin);
    const finExclue = new Date(Math.min(maintenant.getTime(), finIncl.getTime() + JOUR));
    const duree = finIncl.getTime() + JOUR - debut.getTime();
    const ecoule = Math.max(0, finExclue.getTime() - debut.getTime());
    const pDebut = new Date(debut.getTime() - duree);
    return { debut, fin: finIncl, finExclue, precedent: { debut: pDebut, finExclue: new Date(pDebut.getTime() + ecoule) }, source: "SEGMENTATION" };
  }
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 0));
  const ecoule = maintenant.getTime() - debut.getTime();
  const pDebut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 1, 1));
  const pFinMois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  return { debut, fin, finExclue: maintenant, precedent: { debut: pDebut, finExclue: new Date(Math.min(pFinMois.getTime(), pDebut.getTime() + ecoule)) }, source: "MOIS" };
}

// ─────────────────────────── Les lettres ───────────────────────────

export const LETTRES_360 = ["H", "A", "B", "C", "D", "NA", "NC"] as const;
export type Lettre360 = (typeof LETTRES_360)[number];

/**
 * LA LETTRE D'UN PRATICIEN POUR CE PRODUIT : H s'il est décideur, sinon son segment du produit (A–D), NA quand la réponse
 * manque, NC hors cible.
 */
export function lettreDuProduit(r: { cible: boolean; h: boolean; etat: string | null | undefined }): Lettre360 {
  if (!r.cible) return "NC";
  if (r.h) return "H";
  if (r.etat === "A" || r.etat === "B" || r.etat === "C" || r.etat === "D") return r.etat;
  if (r.etat === "NON_CIBLE") return "NC";
  return "NA";
}

/** Une cible H·A·B : décideur, ou segment A / B du produit — et au moins une visite requise. */
export function estCibleHab(p: { cible: boolean; h: boolean; segment: string | null; requis: number }): boolean {
  return p.cible && p.requis > 0 && (p.h || p.segment === "A" || p.segment === "B");
}

export interface MouvementLettres { bVersA: number; aPerdus: number; net: number }

/**
 * LE MOUVEMENT DES SEGMENTS depuis l'instantané du dernier cycle : B → A, A perdus, et le solde net des A — sur les
 * praticiens présents des deux côtés (un praticien entré ou sorti du panel n'est pas un mouvement). `avant` : la lettre
 * figée (« A », « B », « NC », « ? »…).
 */
export function mouvementLettres(avant: ReadonlyMap<string, string>, apres: ReadonlyMap<string, string>): MouvementLettres {
  let bVersA = 0, aPerdus = 0, aGagnes = 0;
  for (const [id, maintenant] of apres) {
    const hier = avant.get(id);
    if (hier === undefined) continue;
    if (hier !== "A" && maintenant === "A") { aGagnes++; if (hier === "B") bVersA++; }
    if (hier === "A" && maintenant !== "A") aPerdus++;
  }
  return { bVersA, aPerdus, net: aGagnes - aPerdus };
}

// ─────────────────────────── L'alerte principale de la liste ───────────────────────────

export type CodeAlerte360 = "PV_OUVERT" | "RUPTURE" | "STOCK_BAS" | "LOT_PERIME" | "H_NON_VUS" | "ECHEANCE_DE" | "VARIATION";
export interface Alerte360 { code: CodeAlerte360; label: string; ton: "danger" | "warning" | "info" }

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const moisCourtDe = (d: Date | string): string => { const x = new Date(d); return `${MOIS_COURTS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };

/**
 * UNE ALERTE PAR PRODUIT dans la liste, la plus grave d'abord. Chaque fait n'arrive que si la personne voit son module
 * (`undefined` = non vu, jamais lu comme « rien à signaler »).
 */
export function alertePrincipale(f: {
  pvOuverts?: number; hopitauxEnRupture?: number; couvertureMois?: number | null; premierLotPerime?: Date | string | null;
  hNonVus?: number; joursAvantDepotDe?: number | null; variationsEnAttente?: number;
}): Alerte360 | null {
  if ((f.pvOuverts ?? 0) > 0) return { code: "PV_OUVERT", label: f.pvOuverts === 1 ? "PV ouvert" : `${f.pvOuverts} PV ouverts`, ton: "danger" };
  if ((f.hopitauxEnRupture ?? 0) > 0) return { code: "RUPTURE", label: f.hopitauxEnRupture === 1 ? "rupture à l'hôpital" : `rupture · ${f.hopitauxEnRupture} hôpitaux`, ton: "danger" };
  if (f.couvertureMois !== null && f.couvertureMois !== undefined && f.couvertureMois < 2) return { code: "STOCK_BAS", label: "stock bas", ton: "danger" };
  if (f.premierLotPerime) return { code: "LOT_PERIME", label: `lot périme en ${moisCourtDe(f.premierLotPerime)}`, ton: "warning" };
  if ((f.hNonVus ?? 0) > 0) return { code: "H_NON_VUS", label: `${f.hNonVus} H non vu${(f.hNonVus ?? 0) > 1 ? "s" : ""}`, ton: "warning" };
  if (f.joursAvantDepotDe !== null && f.joursAvantDepotDe !== undefined && f.joursAvantDepotDe <= 183) return { code: "ECHEANCE_DE", label: "renouvellement DE", ton: "warning" };
  if ((f.variationsEnAttente ?? 0) > 0) return { code: "VARIATION", label: "variation en attente", ton: "info" };
  return null;
}

// ─────────────────────────── L'écriture ───────────────────────────

/** « 7,3 » — un nombre à une décimale, à la française. */
export const decimal = (n: number): string => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
