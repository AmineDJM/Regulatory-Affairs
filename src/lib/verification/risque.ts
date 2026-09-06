/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'IL FAUT VÉRIFIER, ET JUSQU'OÙ (mandat 6 §49) — pur : aucun modèle, aucune base.
 *
 * ── POURQUOI « TOUT VÉRIFIER » EST UNE MAUVAISE RÉPONSE ─────────────────────────────────
 *
 * Vérifier deux fois chaque chiffre double le coût et la latence, et — c'est le point qu'on
 * oublie — **fait baisser la qualité perçue** : quand tout est marqué « vérifié », plus rien
 * ne l'est. Une pastille sur les 400 lignes d'un export ne dit rien ; une phrase sur le seul
 * montant qui part chez un fournisseur dit tout.
 *
 * L'inverse — ne rien vérifier — a un coût qui ne se voit qu'une fois, très cher : un virement
 * fondé sur une addition fausse, un dossier déposé avec la mauvaise référence.
 *
 * La vérification est donc **proportionnée**, et la proportion se CALCULE. Ce module dit, pour
 * une affirmation donnée : à quel point c'est engageant, et quelles méthodes appliquer.
 *
 * ── CE QUI FAIT MONTER LE RISQUE ────────────────────────────────────────────────────────
 *
 * Quatre facteurs, indépendants, et aucun n'est « l'importance ressentie » :
 *
 *   · L'IRRÉVERSIBILITÉ. Un e-mail parti ne revient pas (§48). Une lecture, si.
 *   · L'EXPOSITION. Qui verra le résultat : moi, mon équipe, une autorité, un partenaire.
 *   · L'ENJEU. Ce que ça engage : un montant, un délai réglementaire, une clause.
 *   · LA FRAGILITÉ DE L'OBTENTION. Un chiffre lu dans une colonne est solide ; le même
 *     reconstitué par un modèle à partir d'un PDF scanné ne l'est pas, et c'est indépendant
 *     de son importance.
 *
 * Le dernier facteur est celui qu'on oublie, et c'est le plus prédictif : la plupart des
 * erreurs coûteuses ne portent pas sur des sujets négligés, elles portent sur des sujets
 * importants dont la donnée a été obtenue par un chemin fragile.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Comment le résultat a été obtenu — ce qui décide de sa fragilité. */
export const OBTENTIONS = [
  /** Lu dans une colonne, tel quel. Le chemin le plus solide. */
  "LECTURE_DIRECTE",
  /** Calculé par du code déterministe à partir de lectures directes. */
  "CALCUL_DETERMINISTE",
  /** Agrégé sur plusieurs sources qu'il a fallu rapprocher. */
  "AGREGATION",
  /** Extrait d'un document structuré (tableur, XML, formulaire). */
  "EXTRACTION_STRUCTUREE",
  /** Extrait par un modèle d'un texte libre, d'un PDF, d'une image. */
  "LECTURE_PAR_MODELE",
  /** Produit par un modèle sans source citable. Le chemin le plus fragile. */
  "ASSERTION_MODELE",
] as const;
export type Obtention = (typeof OBTENTIONS)[number];

export const EXPOSITIONS = ["MOI", "EQUIPE", "DIRECTION", "PARTENAIRE", "AUTORITE"] as const;
export type Exposition = (typeof EXPOSITIONS)[number];

export interface Affirmation {
  /** Ce qui est affirmé, en français — sert au libellé du contrôle. */
  quoi: string;
  obtention: Obtention;
  exposition: Exposition;
  /** L'effet est-il défaisable ? (§48 : un e-mail parti, non.) */
  reversible: boolean;
  /** Un montant en jeu, s'il y en a un. */
  montantDzd?: number | null;
  /** Un délai réglementaire ou contractuel est-il engagé ? */
  echeanceEngagee?: boolean;
  /** Le nombre d'éléments : 400 lignes ne se vérifient pas comme un chiffre. */
  cardinalite?: number | null;
}

export const NIVEAUX = ["AUCUN", "LEGER", "APPUYE", "ADVERSARIAL"] as const;
export type Niveau = (typeof NIVEAUX)[number];

/**
 * LES POIDS, EXPOSÉS POUR ÊTRE DISCUTÉS.
 *
 * L'obtention pèse le plus (0 à 40) parce que c'est le facteur prédictif, et le plancher de
 * `ASSERTION_MODELE` est haut : une affirmation sans source citable est douteuse même sur un
 * sujet sans enjeu, puisque rien ne permet de la contredire.
 */
const POIDS_OBTENTION: Readonly<Record<Obtention, number>> = {
  LECTURE_DIRECTE: 0,
  CALCUL_DETERMINISTE: 5,
  EXTRACTION_STRUCTUREE: 12,
  AGREGATION: 20,
  LECTURE_PAR_MODELE: 32,
  ASSERTION_MODELE: 40,
};

const POIDS_EXPOSITION: Readonly<Record<Exposition, number>> = {
  MOI: 0, EQUIPE: 6, DIRECTION: 12, PARTENAIRE: 20, AUTORITE: 25,
};

/** Le montant, en paliers : la différence entre 1 000 et 2 000 DZD n'existe pas ici. */
function poidsMontant(dzd: number | null | undefined): number {
  if (!dzd || dzd <= 0) return 0;
  if (dzd < 50_000) return 3;
  if (dzd < 500_000) return 8;
  if (dzd < 5_000_000) return 15;
  return 20;
}

export interface Evaluation {
  score: number;
  niveau: Niveau;
  /** Les facteurs, chacun avec sa part — pour contester un poids, pas un verdict. */
  facteurs: { quoi: string; points: number }[];
  /** Le facteur dominant, nommé : c'est la phrase à dire si on demande pourquoi. */
  principal: string;
  /** Ce que la vérification NE prouvera pas, quel que soit son niveau. */
  limites: string[];
}

const SEUILS: readonly { min: number; niveau: Niveau }[] = [
  { min: 70, niveau: "ADVERSARIAL" },
  { min: 40, niveau: "APPUYE" },
  { min: 15, niveau: "LEGER" },
  { min: 0, niveau: "AUCUN" },
];

export function evaluer(a: Affirmation): Evaluation {
  const facteurs: { quoi: string; points: number }[] = [];
  const push = (quoi: string, points: number) => { if (points > 0) facteurs.push({ quoi, points }); };

  push(`obtention : ${a.obtention.toLowerCase().replace(/_/g, " ")}`, POIDS_OBTENTION[a.obtention]);
  push(`vu par : ${a.exposition.toLowerCase()}`, POIDS_EXPOSITION[a.exposition]);
  if (!a.reversible) push("effet IRRÉVERSIBLE", 22);
  push(`montant en jeu`, poidsMontant(a.montantDzd));
  if (a.echeanceEngagee) push("une échéance réglementaire ou contractuelle est engagée", 15);
  // UNE CARDINALITÉ ÉLEVÉE N'AUGMENTE PAS LE RISQUE PAR ÉLÉMENT — elle augmente la chance
  // qu'AU MOINS UN soit faux, ce qui est une raison d'échantillonner, pas de tout revérifier.
  if ((a.cardinalite ?? 0) >= 20) push(`${a.cardinalite} éléments : au moins un a des chances d'être faux`, 10);

  const score = facteurs.reduce((s, f) => s + f.points, 0);
  const niveau = SEUILS.find((s) => score >= s.min)!.niveau;
  const principal = facteurs.length ? [...facteurs].sort((x, y) => y.points - x.points)[0]!.quoi : "aucun facteur de risque";

  const limites = [
    "une vérification qui passe ne prouve pas que le résultat est VRAI : elle prouve qu'aucune des méthodes appliquées ne l'a contredit",
  ];
  if (a.obtention === "ASSERTION_MODELE") {
    limites.push("aucune source citable : la seule vérification possible est de CHERCHER la source, pas de recouper l'affirmation avec elle-même");
  }

  return { score, niveau, facteurs, principal, limites };
}
