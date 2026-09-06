/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CHOISIR L'ARCHITECTURE LA MOINS CHÈRE QUI TIENT LE PLANCHER (mandat 6 §50) — pur.
 *
 * ── LE PIPELINE, DANS CET ORDRE ET PAS UN AUTRE ─────────────────────────────────────────
 *
 *   classer  →  plancher exigé  →  risque  →  candidates  →  la MOINS CHÈRE qui tient
 *            →  évaluer le résultat  →  escalader SEULEMENT si la qualité a échoué
 *
 * L'ordre est le garde-fou. Un pipeline qui commencerait par « quelle est l'option la moins
 * chère » et vérifierait ensuite si elle passe finirait par arrondir le plancher vers le bas :
 * c'est ce que fait tout optimiseur à qui l'on présente la contrainte après l'objectif.
 *
 * ── CE QUI EST INTERDIT, ET POURQUOI ────────────────────────────────────────────────────
 *
 * 1. **Descendre vers une paire (classe, modèle) NON MESURÉE.** L'absence de mesure ressemble
 *    à l'absence de problème, et un optimiseur y verrait la meilleure affaire du catalogue.
 * 2. **Descendre sur une mesure trop maigre.** « 100 % sur trois essais » est une anecdote.
 *    `observationsMin` monte avec l'enjeu de la classe.
 * 3. **Descendre du tout sur les classes engageantes.** FINANCE, REGULATORY, LEGAL, DECISION,
 *    DOCUMENT_EXECUTIF ne se désescaladent pas, même mesure égale : un dépôt ne se rejoue pas.
 * 4. **Compenser une régression de qualité par une économie.** Le score de §43 exclut déjà le
 *    coût pour cette raison ; ici, la contrainte est vérifiée AVANT le tri par prix, jamais
 *    dans le même calcul.
 *
 * ── LE NORTH STAR ───────────────────────────────────────────────────────────────────────
 *
 * Coût par mission RÉUSSIE, pas coût par mission. Un modèle deux fois moins cher qui échoue une
 * fois sur trois coûte plus cher, parce qu'on paie l'échec ET la reprise — et on paie surtout
 * le temps de la personne qui découvre l'erreur, que ce ratio ne capture pas et qu'il faut
 * donc dire à côté.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { plancherDe, type Classe } from "@/lib/cout/plancher";

/** Une architecture candidate : un modèle, un effort, et ce que ça coûte. */
export interface Candidate {
  /** L'identifiant du modèle tel que le registre le connaît. */
  modele: string;
  /** L'effort de raisonnement demandé — il change le coût ET la qualité. */
  effort: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  /** Le coût estimé de l'appel, en dollars. Vient des tarifs RÉELS du registre. */
  coutUsd: number;
  /** La latence attendue, en millisecondes. Mesurée, pas devinée. */
  msAttendu: number;
}

/** Ce qu'on a MESURÉ pour une paire (classe, modèle, effort). Rien d'autre ne compte. */
export interface Mesure {
  classe: Classe;
  modele: string;
  effort: Candidate["effort"];
  /** La part de réussite observée sur les evals de cette classe. */
  exactitude: number;
  /** Le nombre d'erreurs d'arithmétique observées. */
  erreursArithmetiques: number;
  /** Combien d'observations. En dessous du minimum de la classe, la mesure ne compte pas. */
  observations: number;
  /** Quand — une mesure trop vieille sur un modèle qui a bougé n'est plus une mesure. */
  quand: Date;
}

export const REFUS = [
  /** Aucune mesure pour cette paire : on ne descend pas vers l'inconnu. */
  "NON_MESURE",
  /** Trop peu d'observations pour cette classe. */
  "MESURE_MAIGRE",
  /** La mesure existe et elle est SOUS le plancher. */
  "SOUS_LE_PLANCHER",
  /** La classe interdit toute désescalade, quelle que soit la mesure. */
  "CLASSE_SANS_DESESCALADE",
  /** La mesure est trop ancienne pour être opposable. */
  "MESURE_PERIMEE",
] as const;
export type MotifRefus = (typeof REFUS)[number];

export interface Ecarte {
  candidate: Candidate;
  motif: MotifRefus;
  /** La phrase exacte, avec les nombres — pour contester le refus, pas le subir. */
  explication: string;
}

export interface Choix {
  classe: Classe;
  retenu: Candidate;
  /** POURQUOI celui-là : la phrase à mettre au journal. */
  justification: string;
  /** Ce qui a été écarté, et pour quel motif. */
  ecartes: Ecarte[];
  /** L'économie réalisée par rapport à la référence, quand il y en a une. */
  economieUsd: number;
  /** VRAI quand le choix est une désescalade appuyée sur une mesure. */
  desescalade: boolean;
  /** Ce que ce choix N'EST PAS — toujours renseigné. */
  limites: string[];
}

/** Une mesure plus vieille que ça ne vaut plus : les modèles bougent sous le même nom. */
export const FRAICHEUR_MAX_JOURS = 90;

const cle = (c: Classe, m: string, e: string) => `${c}|${m}|${e}`;

/**
 * CHOISIT. `reference` est l'architecture par défaut — celle qu'on prendrait sans réfléchir ;
 * elle est TOUJOURS recevable, ce qui garantit qu'un choix existe même sans aucune mesure.
 *
 * Le tri se fait sur le coût, mais SEULEMENT parmi les candidates qui ont franchi la porte de
 * qualité. Un candidat non mesuré n'est pas « moins bon » : il est hors course.
 */
export function choisir(
  classe: Classe,
  reference: Candidate,
  candidates: readonly Candidate[],
  mesures: readonly Mesure[],
  maintenant: Date = new Date(),
): Choix {
  const p = plancherDe(classe);
  const index = new Map(mesures.map((m) => [cle(m.classe, m.modele, m.effort), m]));
  const ecartes: Ecarte[] = [];
  const recevables: Candidate[] = [];

  for (const c of candidates) {
    // La référence passe toujours : sans elle, une absence totale de mesure bloquerait tout.
    if (c.modele === reference.modele && c.effort === reference.effort) { recevables.push(c); continue; }

    // MOINS CHER QUE LA RÉFÉRENCE ? Sinon ce n'est pas une désescalade, c'est une escalade, et
    // une escalade ne se justifie pas par le prix — elle se justifie par un échec de qualité.
    if (c.coutUsd >= reference.coutUsd) { recevables.push(c); continue; }

    if (!p.desescaladeAutorisee) {
      ecartes.push({
        candidate: c, motif: "CLASSE_SANS_DESESCALADE",
        explication: `${classe} ne se désescalade pas, même à mesure égale : ${p.pourquoi}`,
      });
      continue;
    }

    const m = index.get(cle(classe, c.modele, c.effort));
    if (!m) {
      ecartes.push({
        candidate: c, motif: "NON_MESURE",
        explication: `aucune qualité mesurée pour ${c.modele} (${c.effort}) sur ${classe} : une paire non mesurée n'est pas une option bon marché, c'est une inconnue`,
      });
      continue;
    }
    const jours = (maintenant.getTime() - m.quand.getTime()) / 86_400_000;
    if (jours > FRAICHEUR_MAX_JOURS) {
      ecartes.push({
        candidate: c, motif: "MESURE_PERIMEE",
        explication: `la mesure de ${c.modele} sur ${classe} date de ${Math.round(jours)} jours : les modèles bougent sous le même nom`,
      });
      continue;
    }
    if (m.observations < p.observationsMin) {
      ecartes.push({
        candidate: c, motif: "MESURE_MAIGRE",
        explication: `${m.observations} observation(s) pour ${c.modele} sur ${classe}, il en faut ${p.observationsMin} : « ${Math.round(m.exactitude * 100)} % » sur si peu est une anecdote, pas une mesure`,
      });
      continue;
    }
    if (m.exactitude < p.exactitude || m.erreursArithmetiques > p.erreursArithmetiquesTolerees) {
      ecartes.push({
        candidate: c, motif: "SOUS_LE_PLANCHER",
        explication: `${c.modele} mesure ${Math.round(m.exactitude * 100)} % sur ${classe}${m.erreursArithmetiques > 0 ? ` avec ${m.erreursArithmetiques} erreur(s) d'arithmétique` : ""} — le plancher est ${Math.round(p.exactitude * 100)} %`,
      });
      continue;
    }
    recevables.push(c);
  }

  // ── LE TRI PAR PRIX, ET SEULEMENT MAINTENANT ────────────────────────────────────────
  // La qualité a déjà tranché. À qualité recevable égale, on prend le moins cher ; à coût égal,
  // le plus rapide. La latence arrive en TROISIÈME, comme la hiérarchie le dit.
  const trie = [...recevables].sort((a, b) => a.coutUsd - b.coutUsd || a.msAttendu - b.msAttendu);
  const retenu = trie[0] ?? reference;
  const desescalade = retenu.coutUsd < reference.coutUsd;
  const economieUsd = Math.max(0, reference.coutUsd - retenu.coutUsd);

  const limites = [
    "ce choix repose sur des mesures passées : il ne garantit pas la qualité de CET appel, il garantit qu'on n'a pas descendu sous un plancher mesuré",
  ];
  if (!p.desescaladeAutorisee) limites.push(`${classe} refuse toute désescalade par construction — aucune économie n'est cherchée ici, et c'est délibéré`);
  if (ecartes.some((e) => e.motif === "NON_MESURE")) limites.push("des options moins chères existent mais n'ont jamais été mesurées sur cette classe : les mesurer est la façon d'économiser, pas les essayer en production");

  return {
    classe, retenu, ecartes, economieUsd, desescalade, limites,
    justification: desescalade
      ? `${retenu.modele} (${retenu.effort}) au lieu de ${reference.modele} : qualité MESURÉE au-dessus du plancher ${Math.round(p.exactitude * 100)} % de ${classe}, économie ${economieUsd.toFixed(4)} $`
      : `${retenu.modele} (${retenu.effort}) — ${ecartes.length ? `aucune option moins chère ne franchit la porte de qualité (${ecartes.length} écartée(s))` : "aucune option moins chère n'était proposée"}`,
  };
}

/**
 * L'ESCALADE : elle se déclenche sur un ÉCHEC DE QUALITÉ, jamais sur une impression.
 *
 * `raison` doit être un constat, pas un sentiment — le verdict de §49, un contrôle qualité de
 * mission raté, une erreur d'arithmétique trouvée. C'est pour cela que cette fonction refuse
 * une raison vide : une escalade sans motif écrit est une dépense sans justification, et
 * §50 exige que 100 % des appels premium soient justifiables.
 */
export function escalader(
  courant: Candidate,
  superieurs: readonly Candidate[],
  raison: string,
): { retenu: Candidate; justification: string } | { refus: string } {
  if (!raison.trim()) {
    return { refus: "une escalade exige un CONSTAT écrit (un verdict de vérification, un contrôle raté, une erreur trouvée) — pas une impression" };
  }
  const plusChers = superieurs
    .filter((s) => s.coutUsd > courant.coutUsd)
    .sort((a, b) => a.coutUsd - b.coutUsd);
  const retenu = plusChers[0];
  if (!retenu) {
    return { refus: `aucune architecture supérieure à ${courant.modele} n'est disponible : l'escalade s'arrête ici, et il faut le DIRE plutôt que réessayer le même` };
  }
  return {
    retenu,
    justification: `escalade ${courant.modele} → ${retenu.modele} (+${(retenu.coutUsd - courant.coutUsd).toFixed(4)} $) : ${raison}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LE NORTH STAR
// ═══════════════════════════════════════════════════════════════════════════════════════════

export interface Bilan {
  missions: number;
  reussies: number;
  coutTotalUsd: number;
  /** Le coût des missions RATÉES — la part qu'on oublie toujours de compter. */
  coutDesEchecsUsd: number;
}

export interface NorthStar {
  /** Coût par mission RÉUSSIE. `null` quand aucune n'a réussi : diviser par zéro mentirait. */
  coutParReussiteUsd: number | null;
  coutParMissionUsd: number | null;
  tauxReussite: number;
  /** La part du budget partie dans des missions ratées. */
  partGachee: number;
  phrase: string;
  limites: string[];
}

export function northStar(b: Bilan): NorthStar {
  const taux = b.missions > 0 ? b.reussies / b.missions : 0;
  const parReussite = b.reussies > 0 ? b.coutTotalUsd / b.reussies : null;
  const parMission = b.missions > 0 ? b.coutTotalUsd / b.missions : null;
  const partGachee = b.coutTotalUsd > 0 ? b.coutDesEchecsUsd / b.coutTotalUsd : 0;

  return {
    coutParReussiteUsd: parReussite,
    coutParMissionUsd: parMission,
    tauxReussite: taux,
    partGachee,
    phrase: parReussite === null
      ? `aucune mission réussie sur ${b.missions} : le coût par réussite n'existe pas, et le présenter comme nul serait un mensonge`
      : `${parReussite.toFixed(4)} $ par mission réussie (${b.reussies}/${b.missions}), dont ${Math.round(partGachee * 100)} % du budget parti dans des missions ratées`,
    limites: [
      "ce ratio ne compte PAS le temps de la personne qui découvre une erreur, ni la confiance perdue — les deux coûts les plus lourds d'un échec",
      "comparer deux périodes n'a de sens qu'à corpus comparable : un mois avec plus de missions difficiles fait monter le ratio sans qu'aucune régression ait eu lieu",
    ],
  };
}

/**
 * LA PORTE DE RÉGRESSION : un routeur qui s'optimise ne s'installe QUE s'il ne régresse pas.
 *
 * Une économie qui s'accompagne d'une baisse de qualité est refusée, quel que soit son montant.
 * C'est la hiérarchie du mandat, tenue par une comparaison et non par un arbitrage : les deux
 * grandeurs ne sont jamais additionnées, donc jamais compensables.
 */
export function porteDeRegression(
  avant: { exactitude: number; coutUsd: number },
  apres: { exactitude: number; coutUsd: number },
  toleranceQualite = 0,
): { accepte: boolean; pourquoi: string } {
  const deltaQ = apres.exactitude - avant.exactitude;
  const deltaC = apres.coutUsd - avant.coutUsd;
  if (deltaQ < -toleranceQualite) {
    return {
      accepte: false,
      pourquoi: `REFUSÉ : la qualité passe de ${Math.round(avant.exactitude * 100)} % à ${Math.round(apres.exactitude * 100)} %. Une économie de ${Math.abs(deltaC).toFixed(4)} $ ne rachète pas un point de qualité — les deux ne s'additionnent pas.`,
    };
  }
  if (deltaC > 0 && deltaQ <= 0) {
    return { accepte: false, pourquoi: `REFUSÉ : plus cher (${deltaC.toFixed(4)} $) sans gain de qualité.` };
  }
  return {
    accepte: true,
    pourquoi: deltaC < 0
      ? `accepté : ${Math.abs(deltaC).toFixed(4)} $ économisés, qualité ${deltaQ >= 0 ? "maintenue ou meilleure" : "inchangée"}`
      : `accepté : +${Math.round(deltaQ * 100)} points de qualité pour ${deltaC.toFixed(4)} $`,
  };
}
