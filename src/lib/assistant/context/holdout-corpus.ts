import type { GoldenCase } from "./golden-corpus";

/**
 * LE JEU RÉSERVÉ — écrit APRÈS le gel du routeur, et jamais utilisé pour le régler.
 *
 * POURQUOI IL EXISTE. Le banc principal a servi à CORRIGER le routeur : à chaque échec, on a
 * changé le code (ou l'attente, quand l'attente était fausse). Un score de 100 % obtenu ainsi ne
 * prouve rien sur les phrases qu'on n'a pas encore vues — c'est un score d'apprentissage, pas un
 * score de généralisation, et les confondre est la façon la plus courante de se mentir avec un
 * chiffre.
 *
 * LA RÈGLE QUI REND CE FICHIER UTILE, et elle n'a de valeur que si on la tient :
 *
 *   ON NE MODIFIE PAS LE ROUTEUR POUR FAIRE PASSER CES CAS.
 *
 * Ils ont été écrits d'un jet, comme le PDG parlerait, sans regarder ce que le routeur en fait.
 * Le premier passage donne la mesure honnête. Si un cas échoue, il RESTE en échec dans le
 * rapport : c'est une information sur les limites du routeur, et cette information vaut plus
 * qu'un point de pourcentage.
 *
 * Le jour où l'on voudra vraiment corriger l'une de ces limites, la marche à suivre est de
 * DÉPLACER le cas vers le banc principal (il devient un cas d'apprentissage) et d'écrire de
 * nouveaux cas réservés. Sans quoi ce fichier redevient un banc d'apprentissage déguisé.
 */

const C = "composed" as const;

export const HOLDOUT_CORPUS: GoldenCase[] = [
  // Boîte mail
  { id: "h-01", utterance: "Il y a du courrier ce matin ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "LEGAL", source: C },
  { id: "h-02", utterance: "Khaled m'a envoyé quelque chose ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C },
  { id: "h-03", utterance: "Réponds à Deepak que je valide.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C },
  { id: "h-04", utterance: "Pourquoi je ne reçois plus rien de l'ANPP ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },

  // Agenda
  { id: "h-05", utterance: "J'ai un rendez-vous cet après-midi ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "CALENDAR", source: C },
  { id: "h-06", utterance: "Déplace la réunion de jeudi à vendredi.", expectedRoute: "ACTION", expectedDomain: "CALENDAR", source: C },
  { id: "h-07", utterance: "Quand est-ce que je vois Raihana ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "GENERAL", source: C },

  // Regulatory
  { id: "h-08", utterance: "Où en est Bosutinib ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C },
  { id: "h-09", utterance: "Qui a déposé le dossier Lenvatinib ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
  { id: "h-10", utterance: "Réassigne Bosutinib à Fatma Zahra.", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: C },
  { id: "h-11", utterance: "Pourquoi la présoumission a été refusée ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "h-12", utterance: "Combien de dossiers chez le fabricant indien ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
  { id: "h-13", utterance: "Cherche les réserves ANPP sur Lenvatinib.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "REGULATORY", source: C },

  // Finance
  { id: "h-14", utterance: "On a payé l'imprimeur ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "h-15", utterance: "Quel est le total des factures du mois ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "h-16", utterance: "Rembourse la note de frais de Khaled.", expectedRoute: "ACTION", expectedDomain: "FINANCE", source: C },
  { id: "h-17", utterance: "Est-ce que notre trésorerie tient jusqu'en mars ?", expectedRoute: "DEEP_REASONING", expectedDomain: "FINANCE", source: C },

  // RH
  { id: "h-18", utterance: "Qui part en congé en août ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: C },
  { id: "h-19", utterance: "Embauche-t-on cette année ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: C },
  { id: "h-20", utterance: "Modifie la fiche de paie de Raihana.", expectedRoute: "ACTION", expectedDomain: "HR", source: C },

  // Documents / Legal
  { id: "h-21", utterance: "Retrouve l'avenant signé en janvier.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: C },
  { id: "h-22", utterance: "Le bon de commande de l'agence est où ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: C },
  { id: "h-23", utterance: "Quels documents Raihana a déposés hier ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "DRIVE", source: C },

  // Missions / attentes
  { id: "h-24", utterance: "Sur quoi j'attends Deepak ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C },
  { id: "h-25", utterance: "Relance tous ceux qui n'ont pas répondu.", expectedRoute: "ACTION", expectedDomain: "MISSION", source: C },
  { id: "h-26", utterance: "Ça avance, l'appel d'offres ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C },

  // Annuaire / identité
  { id: "h-27", utterance: "Le mail de l'imprimeur ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "h-28", utterance: "Comment tu t'appelles déjà ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },

  // Administration
  { id: "h-29", utterance: "Qui a les droits sur les Finances ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "ADMIN", source: C },
  { id: "h-30", utterance: "Active le compte de la nouvelle assistante.", expectedRoute: "ACTION", expectedDomain: "ADMIN", source: C },

  // Raisonnement
  { id: "h-31", utterance: "Qu'est-ce qui nous ralentit le plus ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "h-32", utterance: "Compare le coût des congrès et du sponsoring.", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: C },
  { id: "h-33", utterance: "Quel risque si l'ANPP refuse Bosutinib ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },

  // Suivi de conversation
  { id: "h-34", utterance: "Et Khaled ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C, ctx: { lastKind: "GMAIL_FROM" } },
  { id: "h-35", utterance: "Écris-lui.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C, ctx: { lastPerson: "Deepak" } },
  { id: "h-36", utterance: "Vas-y, envoie.", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C, ctx: { hasPendingMail: true } },
  { id: "h-37", utterance: "Et donc ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C, ctx: { hasOpenDelivery: true } },

  // Dégradé
  { id: "h-38", utterance: "ou en est bosutinib", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C },
  { id: "h-39", utterance: "hmm", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "h-40", utterance: "Supprime tout ça.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C },
];
