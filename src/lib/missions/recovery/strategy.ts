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
  /** Replanifier : la MÉTHODE était mauvaise, l'objectif reste bon. */
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
  NOT_FOUND: ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  INSUFFICIENT_DATA: ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  AMBIGUOUS_ENTITY: ["DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  // Un droit manquant ne se contourne pas, ne s'élargit pas, ne se réessaie pas (§108).
  MISSING_PERMISSION: ["ESCALADER"],
  MISSING_INPUT: ["DEMANDER_HUMAIN", "ESCALADER"],
  CAPABILITY_FAILURE: ["RETRY", "DECOUPER", "REPLANIFIER", "ESCALADER"],
  PROVIDER_FAILURE: ["RETRY", "RETRY_BACKOFF", "ESCALADER"],
  INCOMPATIBLE_RESULT: ["REPLANIFIER", "AUTRE_SOURCE", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  MISSING_TEMPLATE: ["AUTRE_SOURCE", "DEMANDER_HUMAIN", "ESCALADER"],
  MISSING_DOCUMENT: ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
  // ATTENDRE N'EST PAS ÉCHOUER. On ne « récupère » pas d'une attente : on relance la personne,
  // puis on remonte si elle ne répond toujours pas. Il n'y a rien à chercher ailleurs.
  WAITING_HUMAN: ["DEMANDER_HUMAIN", "ESCALADER"],
  UNKNOWN_FORMAT: ["AUTRE_SOURCE", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
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
