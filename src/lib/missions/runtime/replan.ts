/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUAND UNE MISSION MÉRITE UN PLAN DE PLUS — et pourquoi la réponse n'est plus un nombre.
 *
 * Ces constantes sont ici, et non dans `platform/in-process/missions/runtime.ts`, parce que le
 * BATTEMENT vit ailleurs et en a besoin pour sa requête de sélection. Le défaut mesuré quand
 * elles étaient enfermées côté pilote : la requête du battement ne sélectionnait que les
 * missions portant une étape PENDING ou FAILED, et une mission dont TOUTES les étapes ont
 * abouti mais que le juge a refusée n'en porte aucune. Elle n'était donc jamais candidate,
 * jamais conduite, jamais replanifiée — alors que c'est le cas CENTRAL de la famille
 * COMPOSITION : le plan a oublié la primitive, tout est vert, l'objectif n'est pas atteint.
 *
 * ── CE QUI A CHANGÉ : LE PLAFOND GLOBAL EST MORT (§118.42) ──────────────────────────────
 *
 * `PLANS_MAX = 4` bornait la MISSION ENTIÈRE. Deux défauts, et ils se cumulaient :
 *
 *   • il était GLOBAL. Sur une mission de sept jalons, un seul jalon qui s'y reprend à quatre
 *     fois consommait le budget des six autres. La mission mourait pour une difficulté locale
 *     déjà résolue, en laissant six intentions jamais compilées ;
 *   • il était AVEUGLE AU CONTENU. Il comptait pareil un planificateur qui répare quelque chose
 *     à chaque tour et un planificateur qui remet le même plan devant le même mur.
 *
 * Ce qui décide maintenant, c'est le PROGRÈS. Tant que le refus CHANGE, quelque chose a été
 * réparé et un tour de plus vaut son prix ; dès qu'il REVIENT identique, le planificateur est
 * bloqué et le tour suivant produirait la même réponse, plus chère. `Mission.replanBloque`
 * porte ce verdict, et c'est lui que la requête du battement lit — la fin de la boucle est une
 * propriété de la base, pas une discipline d'appelant.
 *
 * Le plafond ne disparaît pas : il devient OPÉRATIONNEL (§118.2) et LOCAL. Sur une mission à
 * jalons il vit dans `horizon/budget.ts`, par jalon. Sur une mission courte, `PLANS_MAX_PLAT`
 * borne la dépense d'une mission qui changerait de refus indéfiniment par petits pas — un cas
 * où « ça change » ne prouve plus qu'on approche.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les états d'où une replanification a un sens. Ailleurs, il n'y a rien à replanifier. */
export const ETATS_REPLANIFIABLES = ["FAILED", "BLOCKED", "PARTIAL"] as const;
export type EtatReplanifiable = (typeof ETATS_REPLANIFIABLES)[number];

export const estReplanifiable = (statut: string): boolean =>
  (ETATS_REPLANIFIABLES as readonly string[]).includes(statut);

/**
 * LE PLAFOND OPÉRATIONNEL D'UNE MISSION SANS JALONS.
 *
 * Douze, et non quatre : l'arrêt normal vient désormais de la RÉPÉTITION du refus, qui tombe
 * en général au deuxième ou au troisième tour. Ce chiffre n'est atteint que par une mission qui
 * change de refus douze fois de suite — un cas où continuer coûte plus qu'il ne rapporte, et où
 * la bonne réponse est de le DIRE à la personne plutôt que de continuer sans elle.
 *
 * Il ne borne PAS la taille d'une mission (§118.2) : une mission à jalons compile un sous-plan
 * par jalon et n'est jamais jugée sur ce compteur.
 */
export const PLANS_MAX_PLAT = 12;

/**
 * LA SIGNATURE D'UN REFUS — ses CODES, jamais ses clés d'étape.
 *
 * Un planificateur qui reprend son plan renomme presque toujours ses clés. Signer `code@étape`
 * rendrait chaque refus « nouveau » et le détecteur de répétition ne se déclencherait jamais.
 * Ce qui dit « c'est le même mur », c'est l'ensemble des codes, trié et dédoublonné.
 */
export function signatureDuRefus(issues: readonly { code: string }[]): string {
  return [...new Set(issues.map((i) => i.code))].sort().join("|");
}

export interface EtatReplan {
  planVersion: number;
  replanRefus: string | null;
  replanBloque: boolean;
}

export interface VerdictReplan {
  autorise: boolean;
  motif: "PREMIER" | "PROGRES" | "REPETITION" | "PLAFOND" | "DEJA_BLOQUE";
  phrase: string;
}

/**
 * A-T-ON LE DROIT D'ÉCRIRE UN PLAN DE PLUS POUR CETTE MISSION (sans jalons) ?
 *
 * `refus` est la signature de ce que le compilateur vient de refuser — `null` quand la
 * replanification est déclenchée par autre chose qu'un refus de compilation (un échec d'étape,
 * un juge qui refuse l'objectif). Dans ce cas il n'y a rien à comparer : c'est un motif NEUF,
 * et il mérite un tour.
 */
export function peutReplanifierMission(
  etat: EtatReplan,
  refus: string | null,
  plafond: number = PLANS_MAX_PLAT,
): VerdictReplan {
  if (etat.replanBloque) {
    return {
      autorise: false,
      motif: "DEJA_BLOQUE",
      phrase: "Le planificateur a déjà buté deux fois sur le même refus. Tant qu'aucune information "
        + "neuve n'arrive — une réponse, un événement, une consigne —, un plan de plus rendrait la "
        + "même réponse.",
    };
  }
  if (etat.planVersion >= plafond) {
    return {
      autorise: false,
      motif: "PLAFOND",
      phrase: `${etat.planVersion} plans ont déjà été écrits. Le plafond est opérationnel — il borne `
        + `la dépense, il ne dit pas que la difficulté est insurmontable : ce qui bloque demande `
        + `maintenant un regard humain.`,
    };
  }
  if (refus === null) {
    return { autorise: true, motif: "PREMIER", phrase: "Un motif neuf de replanifier." };
  }
  if (etat.replanRefus !== null && etat.replanRefus === refus) {
    return {
      autorise: false,
      motif: "REPETITION",
      phrase: `Le compilateur oppose exactement le même refus qu'au tour précédent (${refus}) : `
        + `le planificateur n'a rien réparé.`,
    };
  }
  return {
    autorise: true,
    motif: "PROGRES",
    phrase: etat.replanRefus === null
      ? "Premier refus de compilation : le planificateur mérite la correction."
      : `Le refus a changé (${etat.replanRefus} → ${refus}) : quelque chose a été réparé.`,
  };
}
