/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PROPOSER PLUTÔT QUE DEMANDER — mais pas n'importe quoi, ni n'importe quand (§88-89).
 *
 * ── LES DEUX DÉFAUTS SYMÉTRIQUES ─────────────────────────────────────────────────────────
 *
 * Le timide : « Je peux faire X si tu veux. » Il transfère la charge de décider à la personne
 * qu'il est censé décharger, et il le fait pour tout, y compris pour ce qui est évident.
 *
 * L'envahissant : il propose tout, tout le temps. Au bout de trois jours, on ne lit plus.
 *
 * Le bon comportement est « J'ai préparé la relance — je l'envoie ? » sur ce qui compte, et le
 * silence sur le reste. Ce fichier calcule ce « ce qui compte ».
 *
 * ── POURQUOI UN CALCUL ET PAS UN JUGEMENT DE MODÈLE ──────────────────────────────────────
 *
 * Parce qu'un modèle sollicité à chaque occasion produira une réponse différente selon son
 * humeur du contexte, et qu'on ne pourra pas expliquer à l'utilisateur pourquoi Adam l'a
 * dérangé cette fois-ci et pas la précédente. Ici, les cinq facteurs sont nommés, pondérés, et
 * le résultat s'explique en une phrase.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES CINQ FACTEURS. Quatre poussent à parler, un retient.
 *
 * Chacun est une note de 0 à 1, et chacun a une raison d'exister :
 *
 *   `impact`       — ce que ça change pour l'entreprise. Une facture de 4 M DZD n'est pas un
 *                    rendez-vous à déplacer.
 *   `urgence`      — combien de temps reste-t-il ? Une échéance passée n'attend plus.
 *   `confiance`    — sait-on VRAIMENT ? Proposer sur la foi d'une supposition est le meilleur
 *                    moyen de rendre toutes les propositions suivantes suspectes (§107).
 *   `reversible`   — si c'est annulable d'un clic, on peut proposer plus librement. Un envoi
 *                    externe, non.
 *   `coutAttention`— ce que ça coûte à la personne de LIRE. C'est le seul facteur qui retient,
 *                    et sans lui l'assistant devient une source de bruit.
 */
export interface Facteurs {
  impact: number;
  urgence: number;
  confiance: number;
  reversible: number;
  coutAttention: number;
}

/** Ce que l'on fait du score. Trois issues, pas dix. */
export const CONDUITES = ["AGIR", "PROPOSER", "SE_TAIRE"] as const;
export type Conduite = (typeof CONDUITES)[number];

export interface Decision {
  conduite: Conduite;
  score: number;
  /** Pourquoi — en français, lisible par la personne concernée. */
  raison: string;
}

const borne = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * LE POIDS DE CHAQUE FACTEUR.
 *
 * `confiance` pèse le plus lourd, et c'est délibéré : une proposition fondée sur une
 * supposition coûte plus cher que dix silences. Elle apprend à l'utilisateur à se méfier, et
 * cette méfiance-là s'applique ensuite à tout le reste.
 */
const POIDS = { impact: 0.28, urgence: 0.22, confiance: 0.35, reversible: 0.15 };

/**
 * FAUT-IL PARLER, ET POUR DIRE QUOI ?
 *
 * ── LES DEUX SEUILS ET CE QUI LES SÉPARE ─────────────────────────────────────────────────
 *
 * `AGIR` n'est PAS « faire sans demander ». C'est « faire ce qui est réversible et sans
 * conséquence externe, puis le dire ». Préparer un brouillon, classer un document, créer une
 * tâche. Le seuil est haut ET conditionné à la réversibilité : une action irréversible ne
 * franchit jamais ce seuil, quel que soit son score.
 *
 * `PROPOSER` est le cas normal : le travail est fait, la personne n'a qu'à dire oui.
 */
export function conduire(f: Facteurs, opts: { effetExterne?: boolean } = {}): Decision {
  const c = {
    impact: borne(f.impact),
    urgence: borne(f.urgence),
    confiance: borne(f.confiance),
    reversible: borne(f.reversible),
    coutAttention: borne(f.coutAttention),
  };

  const pousse = c.impact * POIDS.impact + c.urgence * POIDS.urgence
    + c.confiance * POIDS.confiance + c.reversible * POIDS.reversible;
  const score = borne(pousse - c.coutAttention * 0.3);

  // UNE CONFIANCE FAIBLE FAIT TAIRE, quel que soit le reste. Un enjeu énorme dont on n'est pas
  // sûr ne justifie pas de déranger : il justifie de vérifier d'abord.
  if (c.confiance < 0.5) {
    return {
      conduite: "SE_TAIRE",
      score,
      raison: "l'information n'est pas assez sûre pour être proposée — il faut la confirmer d'abord",
    };
  }

  if (score >= 0.7 && c.reversible >= 0.8 && !opts.effetExterne) {
    return {
      conduite: "AGIR",
      score,
      raison: "réversible, sans effet hors de l'entreprise, et manifestement utile : préparé puis annoncé",
    };
  }

  if (score >= 0.45) {
    return { conduite: "PROPOSER", score, raison: "préparé — reste à donner votre accord" };
  }

  return {
    conduite: "SE_TAIRE",
    score,
    raison: c.coutAttention > 0.6
      ? "l'enjeu ne justifie pas le temps de lecture qu'il demanderait"
      : "l'enjeu est trop faible pour mériter une interruption",
  };
}

/**
 * LES FACTEURS D'UNE RELANCE D'ENGAGEMENT — le cas concret le plus fréquent.
 *
 * Il est calculé plutôt que saisi : un engagement en retard porte déjà tout ce qu'il faut. Le
 * point notable est la confiance, qui vaut 1 quand l'engagement est explicite — on ne suppose
 * rien, quelqu'un a promis quelque chose et la date est passée.
 */
export function facteursRelance(opts: {
  joursDeRetard: number;
  montantDZD?: number | null;
  /** Le nombre de rappels déjà envoyés : plus il est élevé, plus la lecture coûte. */
  relancesDeja: number;
  engagementExplicite: boolean;
}): Facteurs {
  return {
    impact: opts.montantDZD ? borne(Math.log10(Math.max(opts.montantDZD, 1)) / 7) : 0.4,
    urgence: borne(opts.joursDeRetard / 14),
    confiance: opts.engagementExplicite ? 1 : 0.4,
    // Une relance est réversible par nature : elle ne fait rien d'irréparable.
    reversible: 1,
    coutAttention: borne(0.2 + opts.relancesDeja * 0.2),
  };
}
