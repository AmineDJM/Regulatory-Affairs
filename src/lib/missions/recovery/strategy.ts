/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * NE JAMAIS S'ARRÊTER À LA PREMIÈRE DIFFICULTÉ (§74-78).
 *
 * ── LE COMPORTEMENT QU'ON REMPLACE ───────────────────────────────────────────────────────
 *
 * « Je n'ai pas trouvé le contrat de Redouane. » Point. L'utilisateur, lui, sait très bien que
 * le contrat existe : il est dans le Drive, mal rangé, ou en pièce jointe d'un mail de mars.
 * Un assistant qui s'arrête là n'a pas échoué à trouver — il a échoué à CHERCHER.
 *
 * ── CE QUE CE FICHIER FAIT ───────────────────────────────────────────────────────────────
 *
 * Il transforme un échec en DÉCISION : quelle est la nature du problème, et que fait-on
 * ensuite ? La classification est explicite (douze causes), la stratégie qui en découle aussi.
 * Aucune des deux n'est laissée au jugement du moment.
 *
 * ── L'INVARIANT DUR (§76) ────────────────────────────────────────────────────────────────
 *
 * Un résultat dont Adam SAIT qu'il ne correspond pas à l'objectif ne peut jamais terminer la
 * mission. C'est écrit ici sous forme de code : `estFinPossible` refuse de conclure tant qu'il
 * reste une stratégie non essayée.
 *
 * ── LA LIMITE, POSÉE AUSSI FERMEMENT (§107, §108) ────────────────────────────────────────
 *
 * La persévérance n'autorise NI l'invention, NI le contournement. Chercher ailleurs, oui.
 * Deviner une adresse pour pouvoir « réussir », non. Passer outre un droit, non. Ce fichier
 * porte donc la persévérance ET les niveaux de certitude qui l'empêchent de mentir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les douze causes d'échec, telles que §75 les nomme. */
export const ERROR_KINDS = [
  /** La chose cherchée n'a pas été trouvée LÀ où on a cherché. Pas « elle n'existe pas ». */
  "NOT_FOUND",
  /** Trouvée, mais trop pauvre pour conclure. */
  "INSUFFICIENT_DATA",
  /** Plusieurs candidats plausibles — deux « Ahmed », deux marchés du même produit. */
  "AMBIGUOUS_ENTITY",
  /** L'acteur n'a pas le droit. Jamais rejouable : réessayer ne fait pas apparaître un droit. */
  "MISSING_PERMISSION",
  /** Une donnée d'entrée manque, et seul un humain peut la fournir. */
  "MISSING_INPUT",
  /** La capacité a échoué pour une raison qui lui est propre. */
  "CAPABILITY_FAILURE",
  /** Le fournisseur est tombé, a limité le débit, a expiré. Presque toujours transitoire. */
  "PROVIDER_FAILURE",
  /** Le résultat n'a pas la FORME attendue — une liste espérée, un texte reçu. */
  "INCOMPATIBLE_RESULT",
  /** Le modèle de document de l'entreprise est introuvable (§81). */
  "MISSING_TEMPLATE",
  /** Un document précis, nommé, est introuvable. */
  "MISSING_DOCUMENT",
  /** On attend une personne. Ce n'est pas un échec : c'est un état. */
  "WAITING_HUMAN",
  /** Le fichier existe mais on ne sait pas le lire. */
  "UNKNOWN_FORMAT",
  /**
   * LE CONTRÔLE QUALITÉ A REFUSÉ — et c'est une cause d'échec comme une autre.
   *
   * Elle manquait ici, et son absence avait une conséquence exacte : `tenterRecours` commence
   * par vérifier que le motif figure dans cette liste, et rendait `false` pour tout nœud QA.
   * Un run réel l'a montré — le contrôle refuse trois fois, la mission passe BLOCKED, et
   * `STEP_RECOVERY` reste à zéro. L'échelle de recours existait, le barreau n'était pas posé.
   *
   * Le recours utile ici n'est pas de rejouer le contrôle — il redirait la même chose — mais
   * d'ÉLARGIR ou de changer de source pour que la matière manquante arrive. D'où sa place dans
   * l'échelle ci-dessous.
   */
  "QA_FAILED",
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

/** Ce qu'on peut faire ensuite. Ordonné du moins cher au plus coûteux pour l'humain. */
export const STRATEGIES = [
  /** Refaire tel quel — n'a de sens que sur une panne transitoire. */
  "RETRY",
  /** Refaire plus tard, en espaçant. */
  "RETRY_BACKOFF",
  /** Chercher AILLEURS. C'est la stratégie qui distingue un agent d'un script (§77). */
  "AUTRE_SOURCE",
  /** Élargir : moins de filtres, plus de synonymes, une période plus large. */
  "ELARGIR",
  /** Découper : ce qui échoue en un coup peut réussir en trois. */
  "DECOUPER",
  /**
   * ADAPTER — réparer la FORME du résultat, sans rien rechercher.
   *
   * Une donnée absente et une donnée mal formée n'appellent pas le même geste, et les
   * confondre a un coût mesuré : un run réel a dépensé quatre planifications et 191 secondes
   * de modèle parce qu'un résultat de mauvaise forme partait chercher ailleurs. Chercher
   * ailleurs ne change pas la forme de ce qui a DÉJÀ été produit en amont.
   *
   * Ce barreau ne rappelle aucune capacité : il relit le résultat acquis et l'interprète
   * correctement quand c'est possible sans ambiguïté. C'est le moins cher de tous — zéro appel.
   */
  "ADAPTER",
  /**
   * REPLAN_LOCAL — récrire LA PARTIE du plan qui ne marche pas, et elle seule.
   *
   * Distinct de `REPLANIFIER`, qui régénère le DAG entier avec le contexte complet. Une
   * dépendance fausse ou une étape mal câblée ne remet pas en cause la structure de la
   * mission : les étapes abouties restent, les preuves acquises restent, et l'on ne demande
   * que les étapes manquantes.
   */
  "REPLAN_LOCAL",
  /** Replanifier TOUT : la structure de la mission elle-même n'est plus valide. */
  "REPLANIFIER",
  /** Demander à la personne qui SAIT — ciblé, pas un appel à l'aide général (§41). */
  "DEMANDER_HUMAIN",
  /** Remonter au propriétaire de la mission. L'avant-dernier recours. */
  "ESCALADER",
  /** Dire qu'on ne sait pas, en disant ce qui a été tenté. Le dernier recours, et il est HONNÊTE. */
  "DECLARER_INCONNU",
] as const;
export type Strategy = (typeof STRATEGIES)[number];

/**
 * L'ÉCHELLE DE RECOURS PAR CAUSE — dans l'ordre où on les essaie.
 *
 * ── POURQUOI UNE TABLE ET PAS UN MODÈLE ──────────────────────────────────────────────────
 *
 * Parce que « qu'est-ce qu'on fait quand un fournisseur tombe ? » n'est pas une question de
 * jugement : c'est on réessaie. Confier ça à un modèle, c'est payer un appel pour obtenir une
 * réponse connue d'avance — et courir le risque qu'il en donne une autre.
 *
 * ── LA LECTURE DES CAS QUI COMPTENT ──────────────────────────────────────────────────────
 *
 * `NOT_FOUND` ne finit PAS par « déclarer inconnu » tout de suite : il essaie une autre source,
 * puis élargit, puis demande à un humain. C'est §77 en une ligne.
 *
 * `MISSING_PERMISSION` ne réessaie JAMAIS et n'élargit jamais : un droit ne s'obtient pas en
 * insistant, et essayer par un autre chemin serait exactement le contournement que §108
 * interdit. On escalade, immédiatement, vers quelqu'un qui peut décider.
 */
export const ECHELLE: Record<ErrorKind, readonly Strategy[]> = {
  // ── DONNÉE ABSENTE — on cherche AILLEURS, puis PLUS LARGE, puis on demande ──────────
  //
  // Le replan LOCAL vient avant l'humain : récrire la partie du plan qui cherchait au mauvais
  // endroit est automatique et bon marché ; déranger quelqu'un ne l'est pas.
  NOT_FOUND: ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  MISSING_DOCUMENT: ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  INSUFFICIENT_DATA: ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],

  // ── AMBIGUÏTÉ — elle ne se lève pas en cherchant, elle se lève en demandant ────────
  AMBIGUOUS_ENTITY: ["DEMANDER_HUMAIN", "DECLARER_INCONNU"],

  // ── DROIT MANQUANT — ni rejeu, ni élargissement, ni détour (§108) ─────────────────
  MISSING_PERMISSION: ["ESCALADER"],
  MISSING_INPUT: ["DEMANDER_HUMAIN", "ESCALADER"],

  // ── PANNE TECHNIQUE — le seul cas où refaire À L'IDENTIQUE a un sens ──────────────
  CAPABILITY_FAILURE: ["RETRY", "DECOUPER", "REPLAN_LOCAL", "REPLANIFIER", "ESCALADER"],
  PROVIDER_FAILURE: ["RETRY", "RETRY_BACKOFF", "ESCALADER"],

  /**
   * ── MAUVAISE FORME — ET C'EST LA CORRECTION QUI A COÛTÉ LE PLUS CHER ────────────────
   *
   * `AUTRE_SOURCE` était en tête, avec un raisonnement qui semblait juste : « le Drive rend le
   * mauvais document, essayons Legal ». Il l'est pour une donnée ABSENTE. Il ne l'est pas pour
   * une donnée MAL FORMÉE : changer de grenier ne change pas la forme d'un résultat qu'une
   * étape amont a DÉJÀ produit.
   *
   * Un run réel a chiffré l'erreur : quatre planifications et 191 secondes de modèle sur un
   * éventail dont le chemin ne résolvait pas, parce que l'échelle est partie visiter six
   * greniers avant d'atteindre le seul barreau qui pouvait servir.
   *
   * L'ordre correct part du moins cher : ADAPTER relit le résultat acquis sans aucun appel ;
   * REPLAN_LOCAL récrit la seule partie fautive du plan ; REPLANIFIER, qui régénère tout, reste
   * le dernier recours automatique.
   */
  INCOMPATIBLE_RESULT: ["ADAPTER", "REPLAN_LOCAL", "REPLANIFIER", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  UNKNOWN_FORMAT: ["ADAPTER", "AUTRE_SOURCE", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],

  MISSING_TEMPLATE: ["AUTRE_SOURCE", "DEMANDER_HUMAIN", "ESCALADER"],

  // ATTENDRE N'EST PAS ÉCHOUER. On ne « récupère » pas d'une attente : on relance la personne,
  // puis on remonte si elle ne répond toujours pas. Il n'y a rien à chercher ailleurs.
  WAITING_HUMAN: ["DEMANDER_HUMAIN", "ESCALADER"],

  /**
   * LE CONTRÔLE QUALITÉ A REFUSÉ — il manque de la MATIÈRE, pas un rejeu.
   *
   * Rejouer le contrôle sans avoir rien réparé redirait la même chose en consommant une
   * tentative pour l'apprendre. On élargit, on change de grenier, puis on récrit localement.
   */
  QA_FAILED: ["ELARGIR", "AUTRE_SOURCE", "REPLAN_LOCAL", "REPLANIFIER", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
};

/**
 * LA PROCHAINE STRATÉGIE À ESSAYER, connaissant celles déjà tentées.
 *
 * Rend `null` quand l'échelle est épuisée — et c'est le SEUL cas où la mission peut s'arrêter
 * sur cette étape. Tant qu'il reste un barreau, il y a quelque chose à faire.
 */
export function prochaineStrategie(
  kind: ErrorKind,
  dejaTentees: readonly Strategy[],
): Strategy | null {
  const echelle = ECHELLE[kind] ?? ["ESCALADER"];
  return echelle.find((s) => !dejaTentees.includes(s)) ?? null;
}

/**
 * §76 — PEUT-ON CONCLURE ?
 *
 * Un « non » ici est un refus d'arrêter. C'est la règle qui empêche la mission de rendre une
 * réponse dont elle SAIT qu'elle ne répond pas à la question, et c'est celle qui coûte le plus
 * cher quand elle manque : le PDG croit avoir une réponse, agit dessus, et découvre trois jours
 * plus tard que personne n'avait cherché.
 */
export function estFinPossible(opts: {
  objectifAtteint: boolean;
  kind: ErrorKind | null;
  dejaTentees: readonly Strategy[];
}): boolean {
  if (opts.objectifAtteint) return true;
  if (!opts.kind) return false;
  return prochaineStrategie(opts.kind, opts.dejaTentees) === null;
}

/** Un échec est-il rejouable tel quel ? Sert au moteur, pour ne pas gaspiller des tentatives. */
export function rejouable(kind: ErrorKind): boolean {
  const e = ECHELLE[kind] ?? [];
  return e.includes("RETRY") || e.includes("RETRY_BACKOFF");
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §107 — LA PERSÉVÉRANCE N'AUTORISE PAS L'INVENTION.
 *
 * Quatre niveaux, et ils ne se remplacent pas. Chercher longtemps ne transforme JAMAIS un
 * `CANDIDAT` en `TROUVÉ` : seule une preuve le fait. Un agent qui persévère sans ces niveaux
 * finit par répondre quelque chose de plausible — ce qui est pire que de ne rien répondre,
 * parce que personne ne saura que c'était une supposition.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const CERTITUDES = ["TROUVE", "DEDUIT", "CANDIDAT", "INCONNU"] as const;
export type Certitude = (typeof CERTITUDES)[number];

export const LIBELLE_CERTITUDE: Record<Certitude, string> = {
  TROUVE: "trouvé dans l'ERP",
  DEDUIT: "déduit d'autres données",
  CANDIDAT: "probable, à confirmer",
  INCONNU: "introuvable",
};

/**
 * COMMENT UN RÉSULTAT DOIT ÊTRE PRÉSENTÉ selon sa certitude.
 *
 * Le point important est le troisième : un CANDIDAT doit être annoncé comme tel ET nommer ce
 * qui le confirmerait. « C'est probablement le contrat de mars — confirmez-vous ? » est une
 * réponse utile ; « c'est le contrat de mars » ne l'est pas, si on n'en est pas sûr.
 */
export function presenter(c: Certitude, valeur: string, source?: string): string {
  switch (c) {
    case "TROUVE": return source ? `${valeur} (${source})` : valeur;
    case "DEDUIT": return `${valeur} — déduit${source ? ` de ${source}` : ""}, non confirmé par une source directe`;
    case "CANDIDAT": return `${valeur} — probable${source ? ` d'après ${source}` : ""}, à confirmer`;
    case "INCONNU": return "introuvable en l'état";
  }
}

/** Un candidat peut-il être utilisé pour une ACTION ? Non, et c'est le point (§107). */
export function utilisablePourAgir(c: Certitude): boolean {
  return c === "TROUVE";
}
