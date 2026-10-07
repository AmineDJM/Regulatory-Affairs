import type { Capacite, Comparaison, GrilleFrequence, InOut, Lettre, MethodeAffinite, Statut } from "./regles";

/**
 * LA SYNTHÈSE PAR SECTEUR — calculs PURS, partagés par le serveur et l'écran (Direction, 07/10).
 *
 *   • la MATRICE d'un secteur : H, A, B, C, D, NA × In / Out (inconnu compté Out, comme dans le classeur) ;
 *   • les CONTACTS nécessaires par cycle : nombre × fréquence de la grille, ligne par ligne ;
 *   • la CHARGE face à la capacité des KAM du secteur (contacts / jour × jours du cycle × nombre de KAM) ;
 *   • la lettre PROVISOIRE d'une ligne qu'on vient de modifier, le temps que le serveur rende la sienne.
 *
 * Zéro import de valeur : un composant client peut le lire sans rien tirer de lourd.
 */

export const LETTRES_MATRICE = ["H", "A", "B", "C", "D", "NA"] as const;
export type LettreMatrice = (typeof LETTRES_MATRICE)[number];
export type Matrice = Record<LettreMatrice, { IN: number; OUT: number }>;

/**
 * LES VALEURS PROPOSÉES quand une BU n'a encore rien publié — celles de la Direction marketing et du directeur des
 * opérations. Elles ne s'appliquent qu'une fois PUBLIÉES par une personne : le formulaire les montre, rien de plus.
 */
export const PROPOSITION = {
  seuilPotentiel: 22,
  seuilAffinite: 0.1,
  reference: { valeur: 0.0721, annee: 2026 },
  grille: { H_IN: 2, H_OUT: 2, AB_IN: 2, AB_OUT: 2, CD_IN: 1, CD_OUT: 1 } satisfies GrilleFrequence,
  capacite: { contactsParJour: 7, joursParCycle: 20 } satisfies Capacite,
} as const;

export function matriceVide(): Matrice {
  return { H: { IN: 0, OUT: 0 }, A: { IN: 0, OUT: 0 }, B: { IN: 0, OUT: 0 }, C: { IN: 0, OUT: 0 }, D: { IN: 0, OUT: 0 }, NA: { IN: 0, OUT: 0 } };
}

/** La matrice d'un groupe de praticiens. Les non ciblés (NC) n'y entrent pas. */
export function matriceDe(lignes: readonly { lettre: Lettre; inOut: InOut | null }[]): Matrice {
  const m = matriceVide();
  for (const l of lignes) {
    if (l.lettre === "NC") continue;
    m[l.lettre][l.inOut === "IN" ? "IN" : "OUT"]++;
  }
  return m;
}

export function totalMatrice(m: Matrice): { IN: number; OUT: number; total: number } {
  let i = 0, o = 0;
  for (const k of LETTRES_MATRICE) { i += m[k].IN; o += m[k].OUT; }
  return { IN: i, OUT: o, total: i + o };
}

export interface LigneContacts { cle: string; libelle: string; nombre: number; frequence: number; contacts: number }

/**
 * LES CONTACTS D'UN CYCLE : nombre × fréquence. H partage la ligne « H, A & B » tant que sa fréquence est celle de
 * A & B (le classeur de la Direction) ; dès qu'elle diffère, H a ses propres lignes.
 */
export function contactsDe(m: Matrice, g: GrilleFrequence): { lignes: LigneContacts[]; total: number } {
  const ligne = (cle: string, libelle: string, nombre: number, frequence: number): LigneContacts => ({ cle, libelle, nombre, frequence, contacts: nombre * frequence });
  const lignes: LigneContacts[] = [];
  const hAvecAB = g.H_IN === g.AB_IN && g.H_OUT === g.AB_OUT;
  if (hAvecAB) {
    lignes.push(ligne("HAB_IN", "H, A & B — In", m.H.IN + m.A.IN + m.B.IN, g.AB_IN));
    lignes.push(ligne("HAB_OUT", "H, A & B — Out", m.H.OUT + m.A.OUT + m.B.OUT, g.AB_OUT));
  } else {
    lignes.push(ligne("H_IN", "H — In", m.H.IN, g.H_IN));
    lignes.push(ligne("H_OUT", "H — Out", m.H.OUT, g.H_OUT));
    lignes.push(ligne("AB_IN", "A & B — In", m.A.IN + m.B.IN, g.AB_IN));
    lignes.push(ligne("AB_OUT", "A & B — Out", m.A.OUT + m.B.OUT, g.AB_OUT));
  }
  lignes.push(ligne("CD_IN", "C & D — In", m.C.IN + m.D.IN, g.CD_IN));
  lignes.push(ligne("CD_OUT", "C & D — Out", m.C.OUT + m.D.OUT, g.CD_OUT));
  return { lignes, total: lignes.reduce((s, l) => s + l.contacts, 0) };
}

export type Ton = "ok" | "attention" | "depasse";

/**
 * LA CHARGE face à la capacité : vert jusqu'à 90 %, orange jusqu'à 100 %, rouge au-delà. Un secteur sans KAM n'a
 * aucune capacité : la charge se dit « dépassée » dès qu'il demande un contact.
 */
export function chargeDe(contacts: number, cap: Capacite, nbKam: number): { capacite: number; parJour: number; taux: number; ton: Ton } {
  const capacite = cap.contactsParJour * cap.joursParCycle * nbKam;
  const parJour = nbKam > 0 ? contacts / cap.joursParCycle / nbKam : contacts / cap.joursParCycle;
  const taux = capacite > 0 ? Math.round((contacts / capacite) * 100) : contacts > 0 ? Infinity : 0;
  return { capacite, parJour, taux, ton: taux > 100 ? "depasse" : taux > 90 ? "attention" : "ok" };
}

/** Les en-têtes des deux questions — l'écran et l'export disent la même chose. */
export const enteteQ1 = (metrique: string | null | undefined): string => `Q1 · ${(metrique ?? "").trim() || "patients / semaine"}`;
export const enteteQ2 = (produit: string | null | undefined): string => `Q2 · sur 10, sous ${(produit ?? "").trim().toLowerCase() || "le produit"}`;
/** Le libellé d'une lettre dans une cellule (NC se dit en toutes lettres). */
export const libelleLettre = (l: Lettre): string => (l === "NC" ? "non ciblé" : l);

/** « 2,35 » — deux décimales, virgule. */
export const deuxDecimales = (n: number): string => n.toFixed(2).replace(".", ",");

/**
 * LA LETTRE PROVISOIRE d'une ligne qu'on vient de modifier — la même règle que le moteur pour la méthode « sur 10 »
 * déclarée : décideur → H ; une réponse manque → NA ; 0 patient → non ciblé ; sinon potentiel ≥ seuil, affinité
 * (sur 10 ÷ 10) au-delà du seuil (strict par défaut). Le serveur rend ensuite la sienne, qui fait foi.
 */
export function lettreProvisoire(p: {
  statut: Statut | null; q1: number | null; q2: number | null; hStatuts: readonly Statut[];
  seuilPotentiel: number; seuilAffinite: number; comparaison: Comparaison; potentielNulNonCible: boolean;
  /** Q2 ÷ 10 (défaut) ou Q2 ÷ Q1 (méthode du classeur). */
  methode?: MethodeAffinite;
  /** 0 patient = NA (non applicable) plutôt que non ciblé. */
  potentielNulNA?: boolean;
}): Lettre {
  if (p.statut && p.hStatuts.includes(p.statut)) return "H";
  if (p.q1 === null || p.q2 === null) return "NA";
  if (p.q1 === 0 && p.potentielNulNA) return "NA";
  if (p.q1 === 0 && p.potentielNulNonCible) return "NC";
  const haut = p.q1 >= p.seuilPotentiel;
  const a = (p.methode === "RATIO_FICHIER" ? (p.q1 > 0 ? p.q2 / p.q1 : 0) : p.q2 / 10), eps = 1e-9;
  const affin = p.comparaison === ">" ? a > p.seuilAffinite + eps : a >= p.seuilAffinite - eps;
  return haut ? (affin ? "A" : "B") : affin ? "C" : "D";
}
