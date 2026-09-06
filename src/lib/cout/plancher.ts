/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLANCHER DE QUALITÉ, PAR CLASSE DE TÂCHE (mandat 6 §50) — pur.
 *
 * ── LA HIÉRARCHIE, ET LE FAIT QU'ELLE NE SE NÉGOCIE PAS ─────────────────────────────────
 *
 *     QUALITÉ  >  COÛT  >  LATENCE
 *
 * Elle est écrite ici parce qu'un optimiseur de coût, laissé à lui-même, converge toujours vers
 * le moins cher : c'est sa définition. Ce qui l'en empêche n'est pas une bonne intention, c'est
 * un PLANCHER par classe de tâche, en dessous duquel aucune économie n'est recevable — quel que
 * soit le gain.
 *
 * ── POURQUOI DES CLASSES PLUTÔT QU'UN SEUL SEUIL ────────────────────────────────────────
 *
 * Parce que « une erreur » ne veut pas dire la même chose partout. Se tromper de trois jours sur
 * une date de réunion se rattrape ; se tromper de trois dinars sur une facture fournisseur se
 * découvre au rapprochement bancaire, six semaines plus tard, et coûte une demi-journée à deux
 * personnes. Une classe FINANCE à 100 % n'est donc pas de la préciosité : c'est le constat que
 * le coût d'une erreur arithmétique dépasse de plusieurs ordres de grandeur ce qu'on économise
 * en descendant d'un modèle.
 *
 * ── LA RÈGLE QUI FAIT TOUT LE TRAVAIL ───────────────────────────────────────────────────
 *
 * **Une paire (classe, modèle) dont la qualité n'a PAS été mesurée n'est pas une option bon
 * marché : c'est une inconnue.** On ne descend jamais vers l'inconnu. C'est la même doctrine
 * qu'en §49 (« une méthode qui n'a pas pu tourner ne confirme rien ») et qu'en §118.9 (« seul
 * TROUVÉ autorise à agir ») — appliquée à l'argent. Sans cette règle, l'optimiseur choisirait
 * systématiquement le modèle le moins cher, puisque l'absence de mesure ressemble à l'absence
 * de problème.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const CLASSES = [
  /** « Quel est le statut du dossier X ? » — une lecture, une réponse. */
  "RECHERCHE",
  /** Sortir des champs d'un document ou d'un texte. */
  "EXTRACTION",
  /** Comparer, expliquer, dégager une tendance. */
  "ANALYSE",
  /** Tout ce qui produit un nombre qui engage de l'argent. */
  "FINANCE",
  /** Dossiers, délais, autorités : une erreur se paie en mois. */
  "REGULATORY",
  /** Clauses, obligations, échéances contractuelles. */
  "LEGAL",
  /** Une recommandation sur laquelle une personne va s'appuyer pour trancher. */
  "DECISION",
  /** Un document qui sortira de la maison sous notre nom. */
  "DOCUMENT_EXECUTIF",
  /** Reformuler, résumer, mettre en forme sans enjeu. */
  "TRIVIAL",
] as const;
export type Classe = (typeof CLASSES)[number];

export interface Plancher {
  classe: Classe;
  /** La part de réussite exigée sur les evals de cette classe. Jamais franchie vers le bas. */
  exactitude: number;
  /** Le nombre d'erreurs d'arithmétique tolérées. Zéro veut dire zéro. */
  erreursArithmetiquesTolerees: number;
  /** POURQUOI ce plancher — le coût d'une erreur, en français. */
  pourquoi: string;
  /**
   * Cette classe autorise-t-elle une DÉSESCALADE vers un modèle moins cher, quand la mesure
   * le permet ? Faux là où même une qualité mesurée équivalente ne justifie pas le risque de
   * dérive : un dépôt réglementaire ne se rejoue pas.
   */
  desescaladeAutorisee: boolean;
  /** Le nombre minimal d'observations pour qu'une mesure de qualité soit RECEVABLE. */
  observationsMin: number;
}

/**
 * LES PLANCHERS.
 *
 * `observationsMin` mérite un mot : une qualité « 100 % » sur trois essais n'est pas une mesure,
 * c'est une anecdote. Plus la classe est engageante, plus on exige d'observations avant
 * d'autoriser une économie sur sa foi — c'est ce qui empêche d'installer un modèle moins cher
 * sur un coup de chance statistique.
 */
export const PLANCHERS: Readonly<Record<Classe, Plancher>> = {
  RECHERCHE: {
    classe: "RECHERCHE", exactitude: 0.95, erreursArithmetiquesTolerees: 0,
    pourquoi: "une réponse fausse à une question factuelle se propage : elle est recopiée dans un mail, puis dans une décision",
    desescaladeAutorisee: true, observationsMin: 20,
  },
  EXTRACTION: {
    classe: "EXTRACTION", exactitude: 0.97, erreursArithmetiquesTolerees: 0,
    pourquoi: "un champ mal extrait entre dans l'ERP et devient la vérité de référence pour tout le monde",
    desescaladeAutorisee: true, observationsMin: 30,
  },
  ANALYSE: {
    classe: "ANALYSE", exactitude: 0.92, erreursArithmetiquesTolerees: 0,
    pourquoi: "une analyse fausse oriente une décision, mais elle est relue — le plancher est réel sans être maximal",
    desescaladeAutorisee: true, observationsMin: 25,
  },
  FINANCE: {
    classe: "FINANCE", exactitude: 0.99, erreursArithmetiquesTolerees: 0,
    pourquoi: "une erreur de trois dinars se découvre au rapprochement bancaire six semaines plus tard et coûte une demi-journée à deux personnes — sans commune mesure avec l'économie d'un modèle",
    desescaladeAutorisee: false, observationsMin: 50,
  },
  REGULATORY: {
    classe: "REGULATORY", exactitude: 0.99, erreursArithmetiquesTolerees: 0,
    pourquoi: "une erreur de dossier ou de délai se paie en MOIS, et un dépôt ne se rejoue pas",
    desescaladeAutorisee: false, observationsMin: 50,
  },
  LEGAL: {
    classe: "LEGAL", exactitude: 0.99, erreursArithmetiquesTolerees: 0,
    pourquoi: "une clause mal lue engage la société pour la durée du contrat",
    desescaladeAutorisee: false, observationsMin: 50,
  },
  DECISION: {
    classe: "DECISION", exactitude: 0.98, erreursArithmetiquesTolerees: 0,
    pourquoi: "une personne va s'appuyer là-dessus pour trancher, et ne refera pas le raisonnement",
    desescaladeAutorisee: false, observationsMin: 40,
  },
  DOCUMENT_EXECUTIF: {
    classe: "DOCUMENT_EXECUTIF", exactitude: 0.98, erreursArithmetiquesTolerees: 0,
    pourquoi: "le document sort de la maison sous notre nom : l'erreur est publique et datée",
    desescaladeAutorisee: false, observationsMin: 40,
  },
  TRIVIAL: {
    classe: "TRIVIAL", exactitude: 0.85, erreursArithmetiquesTolerees: 0,
    pourquoi: "reformuler sans enjeu : c'est ICI qu'on économise agressivement, et nulle part ailleurs",
    desescaladeAutorisee: true, observationsMin: 10,
  },
};

export const plancherDe = (c: Classe): Plancher => PLANCHERS[c];

/**
 * LES CLASSES QUI NE SE DÉSESCALADENT JAMAIS, listées pour être lues d'un coup d'œil.
 * Quatre sur neuf : ce n'est pas une exception, c'est la moitié du travail sérieux.
 */
export const SANS_DESESCALADE: readonly Classe[] = CLASSES.filter((c) => !PLANCHERS[c].desescaladeAutorisee);
