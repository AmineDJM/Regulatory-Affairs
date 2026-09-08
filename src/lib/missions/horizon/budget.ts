/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMBIEN DE FOIS ON A LE DROIT DE SE REPRENDRE — et pourquoi la réponse n'est pas un nombre.
 *
 * ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * `PLANS_MAX = 4` était un plafond GLOBAL : quatre plans pour toute la mission. Sur une mission
 * courte, il est généreux. Sur une mission de vingt jalons, il est absurde — un seul jalon qui
 * s'y reprend à quatre fois consomme le budget des dix-neuf autres, et la mission meurt pour
 * une difficulté locale déjà résolue. Le compteur était aussi indifférent au CONTENU : il
 * comptait pareil un planificateur qui répare quelque chose à chaque tour et un planificateur
 * qui remet le même plan devant le même mur.
 *
 * ── LE CRITÈRE EST LE PROGRÈS (§118.18) ────────────────────────────────────────────────
 *
 * Tant que le refus CHANGE, quelque chose a été réparé et un tour de plus vaut son prix. Dès
 * qu'il REVIENT identique, le planificateur est bloqué : le tour suivant produira la même
 * réponse, plus chère. C'est cette règle-là — pas un nombre — qui décide.
 *
 * Le plafond ne disparaît pas pour autant : il devient OPÉRATIONNEL (§118.2). Il borne la
 * dépense d'un jalon qui progresse indéfiniment par petits pas, cas où « ça change » ne prouve
 * plus qu'on approche. Il est LOCAL, il porte sa raison, et il ne définit pas la persévérance.
 *
 * PUR : ce module ne lit rien et n'écrit rien. Le pilote lui donne l'état du jalon et le refus
 * qui vient d'arriver ; il rend un verdict et sa phrase.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE PLAFOND OPÉRATIONNEL PAR JALON.
 *
 * Douze, et non quatre : un jalon est une portion de mission, ses reprises sont locales et bon
 * marché (on ne recompile pas les dix-neuf autres jalons), et l'arrêt normal vient de la
 * répétition du refus, pas d'ici. Ce chiffre n'est atteint que par un jalon qui change de refus
 * douze fois de suite — un cas où continuer coûte plus qu'il ne rapporte, et où la bonne
 * réponse est de le DIRE.
 */
export const REPLANS_PAR_JALON = 12;

/**
 * LA SIGNATURE D'UN REFUS — ses CODES, jamais ses clés d'étape.
 *
 * Un planificateur qui reprend son plan renomme presque toujours ses clés. Signer `code@étape`
 * rendrait chaque refus « nouveau » et le détecteur de répétition ne se déclencherait jamais :
 * on paierait le plafond entier face à un mur. Ce qui dit « c'est le même mur », c'est
 * l'ensemble des codes, trié et dédoublonné.
 */
export function signatureRefus(issues: readonly { code: string }[]): string {
  return [...new Set(issues.map((i) => i.code))].sort().join("|");
}

export interface EtatBudget {
  /** Combien de sous-plans ce jalon a déjà consommés. */
  replans: number;
  /** La signature du dernier refus rencontré ici — `null` au premier passage. */
  dernierRefus: string | null;
}

export interface VerdictBudget {
  autorise: boolean;
  /** `REPETITION` | `PLAFOND` quand on refuse ; `PROGRES` | `PREMIER` quand on autorise. */
  motif: "PREMIER" | "PROGRES" | "REPETITION" | "PLAFOND";
  /** Ce qu'on dira au journal et à la personne. Une phrase, jamais un code nu. */
  phrase: string;
}

/**
 * A-T-ON LE DROIT D'ÉCRIRE UN SOUS-PLAN DE PLUS POUR CE JALON ?
 *
 * `refus` est la signature de ce que le compilateur vient de refuser — `null` quand on n'a
 * encore rien tenté (premier passage) : il n'y a alors rien à comparer, et on part.
 */
export function peutReplanifier(
  etat: EtatBudget,
  refus: string | null,
  plafond: number = REPLANS_PAR_JALON,
): VerdictBudget {
  if (etat.replans >= plafond) {
    return {
      autorise: false,
      motif: "PLAFOND",
      phrase: `${etat.replans} sous-plans ont déjà été écrits pour ce jalon. Le plafond est opérationnel — `
        + `il borne la dépense, il ne dit pas que la difficulté est insurmontable : ce qui bloque `
        + `demande maintenant un regard humain.`,
    };
  }
  if (refus === null) {
    return { autorise: true, motif: "PREMIER", phrase: "Premier sous-plan de ce jalon." };
  }
  if (etat.dernierRefus !== null && etat.dernierRefus === refus) {
    return {
      autorise: false,
      motif: "REPETITION",
      phrase: `Le compilateur oppose exactement le même refus qu'au tour précédent (${refus}). `
        + `Le planificateur n'a rien réparé : un tour de plus rendrait la même réponse, plus chère.`,
    };
  }
  return {
    autorise: true,
    motif: "PROGRES",
    phrase: etat.dernierRefus === null
      ? "Le sous-plan est refusé pour la première fois : le planificateur mérite la correction."
      : `Le refus a changé (${etat.dernierRefus} → ${refus}) : quelque chose a été réparé, le tour suivant vaut son prix.`,
  };
}
