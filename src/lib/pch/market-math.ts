/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES MATHÉMATIQUES DU MARCHÉ — un seul endroit calcule, tout le monde lit.
 *
 * ── POURQUOI CE MODULE EST PUR ────────────────────────────────────────────────────────────
 *
 * Les montants d'un marché (soumis, attribué, valeur contractuelle courante, commandé, livré,
 * facturé, encaissé, restants) sont des VALEURS DÉRIVÉES : chacune se déduit des lignes, des
 * avenants effectifs, des bons et des livraisons. Les stocker reviendrait à tenir deux
 * vérités — la ligne et son total — qui divergeraient à la première correction. Les calculer
 * en trois endroits (l'écran, l'export, Adam) reviendrait au même par un autre chemin.
 *
 * D'où ce module : SANS import (ni Prisma, ni base, ni React), alimenté par des faits minces,
 * testé à part. L'écran PCH, la vue Regulatory·Marchés et la frise d'Adam consomment les mêmes
 * fonctions — un chiffre affiché deux fois est le même calcul exécuté deux fois.
 *
 * ── LE CYCLE DE VIE EST DÉRIVÉ, PAS SAISI ─────────────────────────────────────────────────
 *
 * Même doctrine que le niveau de process Regulatory (`lib/regulatory/process-status.ts`) : le
 * niveau affiché se DÉDUIT des faits (lignes chiffrées, dépôt horodaté, résultats, contrat,
 * bons), et seuls les états DÉCIDÉS par un humain (annulé, suspendu, perdu, clôturé) viennent
 * du statut stocké. Deux champs qui racontent la même chose finissent toujours par mentir
 * l'un des deux.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LES FAITS D'ENTRÉE — minces, exprimés en types primitifs (les Decimal arrivent en number).
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface LigneFaits {
  /** Quantité demandée par l'AO (unités). */
  quantityUnits: number;
  /** Quantité soumise si différente de la demandée. */
  submittedQuantityUnits: number | null;
  /** Quantité attribuée — le cœur de l'attribution partielle. */
  awardedQuantityUnits: number | null;
  /** Notre prix unitaire soumis (DZD). */
  unitPriceDzd: number | null;
  /** Prix unitaire d'attribution (DZD). */
  awardedUnitPriceDzd: number | null;
  /** PchLineStatus : PENDING | QUOTED | SUBMITTED | WON | LOST | UNSUCCESSFUL | CANCELLED. */
  status: string;
}

export interface AvenantFaits {
  /** Impact financier (± DZD) — nul si l'avenant ne touche que les quantités ou les délais. */
  amountDelta: number | null;
  /** Prise d'effet. Nulle = pas encore effectif : il ne compte pas. */
  effectiveAt: Date | null;
  /** LegalDocStatus — CANCELLED exclut l'avenant du calcul. */
  status: string;
}

export interface LigneContractuelleFaits {
  /** En unités ; NÉGATIF sur un avenant de réduction. */
  quantityUnits: number;
  unitPriceDzd: number | null;
  /** La pièce porteuse est-elle EFFECTIVE (contrat actif, ou avenant effectif) ? */
  effective: boolean;
  /** Clé de regroupement produit (id produit, ou désignation à défaut). */
  produitCle: string;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SOUMISSION & ATTRIBUTION — les quantités portent les règles de repli, une fois pour toutes.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Quantité soumise d'une ligne : la quantité posée, à défaut la demandée. */
export function uniteSoumises(l: LigneFaits): number {
  return l.submittedQuantityUnits ?? l.quantityUnits;
}

/**
 * Quantité attribuée d'une ligne. Zéro hors WON — un lot perdu, infructueux ou annulé
 * n'apporte rien, quel que soit ce que ses colonnes contiennent encore.
 * Sur un WON sans quantité saisie, le repli est la quantité SOUMISE (l'attribution totale
 * est le cas courant ; la partielle se dit explicitement).
 */
export function unitesAttribuees(l: LigneFaits): number {
  if (l.status !== "WON") return 0;
  return l.awardedQuantityUnits ?? uniteSoumises(l);
}

/** Valeur soumise d'un lot (unités soumises × prix soumis), 0 sans prix. */
export function valeurSoumise(l: LigneFaits): number {
  if (l.unitPriceDzd === null) return 0;
  return Math.round(uniteSoumises(l) * l.unitPriceDzd);
}

/** Valeur attribuée d'un lot (unités attribuées × prix d'attribution, repli prix soumis). */
export function valeurAttribuee(l: LigneFaits): number {
  const prix = l.awardedUnitPriceDzd ?? l.unitPriceDzd;
  if (prix === null) return 0;
  return Math.round(unitesAttribuees(l) * prix);
}

/** Une attribution est PARTIELLE quand on a gagné moins que ce qu'on a soumis. */
export function attributionPartielle(l: LigneFaits): boolean {
  return l.status === "WON" && l.awardedQuantityUnits !== null
    && l.awardedQuantityUnits < uniteSoumises(l);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CONTRAT — l'initial ne s'écrase jamais ; le courant se calcule.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * VALEUR CONTRACTUELLE COURANTE = montant initial + deltas des avenants EFFECTIFS.
 *
 * « Effectif » = non annulé ET `effectiveAt` posée et passée. Un avenant signé mais pas encore
 * en vigueur ne compte pas — c'est précisément la différence entre « signé » et « effectif »
 * que le modèle distingue.
 */
export function valeurContractuelleCourante(
  montantInitial: number | null,
  avenants: readonly AvenantFaits[],
  quand: Date = new Date(),
): number | null {
  if (montantInitial === null) return null;
  let total = montantInitial;
  for (const a of avenants) {
    if (a.status === "CANCELLED") continue;
    if (!a.effectiveAt || a.effectiveAt > quand) continue;
    total += a.amountDelta ?? 0;
  }
  return Math.round(total);
}

/**
 * QUANTITÉS CONTRACTUELLES COURANTES par produit : la somme des lignes effectives — celles du
 * contrat de base plus les DELTAS des avenants effectifs. Une réduction (delta négatif) ne
 * descend jamais sous zéro : un avenant qui retire plus que le contrat ne portait est une
 * erreur de saisie, pas une dette de quantité.
 */
export function quantitesContractuelles(
  lignes: readonly LigneContractuelleFaits[],
): Map<string, number> {
  const parProduit = new Map<string, number>();
  for (const l of lignes) {
    if (!l.effective) continue;
    parProduit.set(l.produitCle, (parProduit.get(l.produitCle) ?? 0) + l.quantityUnits);
  }
  for (const [cle, total] of parProduit) if (total < 0) parProduit.set(cle, 0);
  return parProduit;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EXÉCUTION — commandé, livré, restants, et le contrôle du dépassement.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface ControleCommande {
  /** La commande tient-elle dans le restant contractuel ? */
  ok: boolean;
  /** Unités en excès quand elle n'y tient pas. */
  excesUnites: number;
  /** Le restant AVANT cette commande. */
  restantAvant: number;
  /** Phrase prête à afficher — l'écran ne re-formule pas la règle. */
  message: string | null;
}

/**
 * CONTRÔLE D'UN BON DE COMMANDE contre le restant contractuel.
 *
 * La règle est un AVERTISSEMENT, pas un mur : les marchés réels connaissent des tolérances et
 * des BC reçus avant l'enregistrement d'un avenant. Bloquer ferait contourner l'outil (saisie
 * hors ERP) ; avertir + tracer garde la donnée dedans et le dépassement VISIBLE. L'appelant
 * décide (et audite) le passage en force.
 */
export function controlerCommande(
  quantiteContractuelle: number,
  dejaCommande: number,
  demande: number,
): ControleCommande {
  const restant = Math.max(0, quantiteContractuelle - dejaCommande);
  if (demande <= restant) {
    return { ok: true, excesUnites: 0, restantAvant: restant, message: null };
  }
  const exces = demande - restant;
  return {
    ok: false,
    excesUnites: exces,
    restantAvant: restant,
    message: `Dépassement contractuel : ${demande} unités demandées pour ${restant} restantes (excès ${exces}).`,
  };
}

/** Restant à commander (jamais négatif — l'excès se lit dans le contrôle, pas ici). */
export function restantACommander(quantiteContractuelle: number, commande: number): number {
  return Math.max(0, quantiteContractuelle - commande);
}

/** Restant à livrer d'un bon. */
export function restantALivrer(commande: number, livre: number): number {
  return Math.max(0, commande - livre);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LE CYCLE DE VIE DÉRIVÉ — les faits décident, sauf quand un humain a tranché.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type NiveauMarche =
  | "BROUILLON" // créé, rien d'engagé
  | "PREPARATION" // lots à l'étude / chiffrés, pas encore déposé
  | "SOUMIS" // déposé, aucun résultat
  | "PERDU" // tous les lots décidés, aucun gagné
  | "CONTRACTUALISATION" // gagné, contrat pas encore enregistré ou pas actif
  | "EXECUTION" // contrat + au moins un bon de commande
  | "CLOTURE" // terminé (décidé)
  | "ANNULE" // annulé (décidé)
  | "SUSPENDU"; // suspendu (décidé)

export interface FaitsMarche {
  /** PchTenderStatus stocké — seuls les états DÉCIDÉS y font foi. */
  status: string;
  submittedAt: Date | null;
  awardDate: Date | null;
  lignes: readonly Pick<LigneFaits, "status" | "unitPriceDzd">[];
  aContratActif: boolean;
  aBonDeCommande: boolean;
}

export interface NiveauDerive {
  niveau: NiveauMarche;
  /** D'où vient le verdict — l'écran l'affiche en infobulle, l'audit le journalise. */
  raison: string;
}

/**
 * DÉRIVE le niveau du marché. Ordre de lecture :
 *   1. les états DÉCIDÉS (annulé / suspendu / clôturé / perdu global) gagnent toujours ;
 *   2. sinon, les faits, du plus avancé au moins avancé — un marché en exécution reste « en
 *      exécution » même si quelqu'un oublie de cocher quoi que ce soit d'autre.
 */
export function deriverNiveau(f: FaitsMarche): NiveauDerive {
  if (f.status === "CANCELLED") return { niveau: "ANNULE", raison: "statut décidé : annulé" };
  if (f.status === "SUSPENDED") return { niveau: "SUSPENDU", raison: "statut décidé : suspendu" };
  if (f.status === "LOST") return { niveau: "PERDU", raison: "statut décidé : perdu" };
  if (f.status === "COMPLETED") return { niveau: "CLOTURE", raison: "statut décidé : terminé" };

  const gagnees = f.lignes.filter((l) => l.status === "WON").length;
  const decidees = f.lignes.filter((l) =>
    l.status === "WON" || l.status === "LOST" || l.status === "UNSUCCESSFUL" || l.status === "CANCELLED",
  ).length;

  if (gagnees > 0) {
    if (f.aBonDeCommande) return { niveau: "EXECUTION", raison: "lots gagnés + bon(s) de commande" };
    if (f.aContratActif) return { niveau: "EXECUTION", raison: "contrat actif enregistré" };
    return { niveau: "CONTRACTUALISATION", raison: `${gagnees} lot(s) gagné(s), contrat à enregistrer` };
  }
  if (f.lignes.length > 0 && decidees === f.lignes.length) {
    return { niveau: "PERDU", raison: "tous les lots décidés, aucun gagné" };
  }
  if (f.awardDate && decidees > 0) {
    // Des résultats sont tombés sans lot gagné, mais tout n'est pas décidé : encore « soumis ».
    return { niveau: "SOUMIS", raison: "résultats partiels, aucun lot gagné à ce stade" };
  }
  if (f.submittedAt) return { niveau: "SOUMIS", raison: "dépôt officiel horodaté" };
  const chiffrees = f.lignes.filter((l) => l.unitPriceDzd !== null || l.status !== "PENDING").length;
  if (chiffrees > 0) return { niveau: "PREPARATION", raison: `${chiffrees} lot(s) à l'étude ou chiffré(s)` };
  return { niveau: "BROUILLON", raison: "aucun lot travaillé, pas de dépôt" };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ÉCHÉANCE DE DÉPÔT — zones de rappel (le balayage prévient à l'ENTRÉE d'une zone, jamais
// tous les jours : une notification quotidienne est une notification qu'on coupe).
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type ZoneDepot = "DEPASSEE" | "URGENTE" | "PROCHE";

/** J-7 → PROCHE, J-2 → URGENTE, terme passé → DEPASSEE ; au-delà de J-7 → null (rien à dire). */
export function zoneDepot(deadline: Date, quand: Date = new Date()): ZoneDepot | null {
  const jours = (deadline.getTime() - quand.getTime()) / 86_400_000;
  if (jours < 0) return "DEPASSEE";
  if (jours <= 2) return "URGENTE";
  if (jours <= 7) return "PROCHE";
  return null;
}

/**
 * FAUT-IL RAPPELER ? Oui si l'échéance est dans une zone ET que le dernier rappel date d'une
 * zone MOINS grave (ou n'existe pas). Un marché rappelé à J-6 se tait jusqu'à J-2, puis
 * jusqu'au dépassement — trois rappels au plus par échéance.
 */
export function doitRappelerDepot(deadline: Date, dernierRappel: Date | null, quand: Date = new Date()): ZoneDepot | null {
  const zone = zoneDepot(deadline, quand);
  if (!zone) return null;
  if (!dernierRappel) return zone;
  const zoneAuDernier = zoneDepot(deadline, dernierRappel);
  return zone !== zoneAuDernier ? zone : null;
}

/**
 * LA PROGRESSION D'EN-TÊTE : Préparation → Soumission → Attribution → Contrat → Exécution →
 * Clôture. Rend l'index de l'étape courante (−1 pour les états hors chemin : annulé,
 * suspendu, perdu — l'en-tête les montre en badge, pas sur la barre).
 */
export const ETAPES_MARCHE = [
  "Préparation", "Soumission", "Attribution", "Contrat", "Exécution", "Clôture",
] as const;

export function etapeCourante(niveau: NiveauMarche): number {
  switch (niveau) {
    case "BROUILLON":
    case "PREPARATION": return 0;
    case "SOUMIS": return 1;
    // Des lots gagnés sans contrat : l'attribution est ACQUISE, le travail courant est le
    // contrat — la barre pointe l'étape à faire, pas la dernière franchie.
    case "CONTRACTUALISATION": return 3;
    case "EXECUTION": return 4;
    case "CLOTURE": return 5;
    default: return -1; // ANNULE / SUSPENDU / PERDU — hors chemin nominal
  }
}
