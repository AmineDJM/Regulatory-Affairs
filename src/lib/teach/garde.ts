/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA GARANTIE D'ENSEIGNEMENT — « règle enregistrée » n'est vrai que si l'outil a tourné (§119).
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * Suite Playwright live, deuxième passage : le PDG écrit « Retiens cette règle : … », Adam
 * répond « Règle enregistrée : … » — et la base ne contient AUCUNE règle. Le tour précédent
 * de la même conversation portait la même demande et la même réponse ; la règle avait été
 * supprimée depuis. Le modèle a lu l'historique comme s'il était la base, et a affirmé un
 * effet qu'il n'a pas produit. C'est le pire défaut d'un assistant : un faux succès.
 *
 * ── CE QUE LE CODE GARANTIT ──────────────────────────────────────────────────────────────
 *
 * Un énoncé d'enseignement + une réponse qui PRÉTEND avoir retenu + aucun outil Teach appelé
 * dans CE tour = incohérence. Le code redonne alors UNE fois la main au modèle, avec l'ordre
 * d'appeler l'outil ; s'il ne le fait toujours pas — ou s'il ne le peut pas — la réponse dit
 * la vérité : rien n'a été enregistré. Le modèle décide QUOI retenir (nature, périmètre,
 * paramètres) ; le code décide que « retenu » se prouve par un reçu, jamais par une phrase.
 *
 * Fichier PUR : aucun import, réexporté vers la conversation par `platform/in-process/teach/bloc.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les outils dont l'appel PROUVE qu'un enseignement a été traité (créé, révisé, désactivé, supprimé). */
export const OUTILS_ENSEIGNEMENT: readonly string[] = ["teach_adam", "update_rule", "disable_rule", "delete_rule"];

const plier = (s: string): string =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();

/**
 * UN ÉNONCÉ D'ENSEIGNEMENT : la personne pose une règle durable. Formes fermées et
 * explicites — « retiens cette règle », « désormais », « dorénavant », « à partir de
 * maintenant », « nouvelle règle », « apprends que ». Une QUESTION sur les règles
 * (« quelles règles sur les devis ? ») n'en est pas un : elle se lit, elle ne s'enseigne pas.
 */
const ENSEIGNEMENT = /\b(retiens|retenez|retenir|memorise|memorisez|apprends|apprenez|enregistre|enregistrez|note|notez)\b.{0,40}\b(regle|consigne|principe|convention|standard|politique|preference)\b|\b(desormais|dorenavant|a partir de maintenant|a l avenir|a compter d aujourd hui|nouvelle regle|regle a retenir)\b/;
const INTERROGATION_SUR_REGLES = /^(quelle|quelles|quel|quels|liste|montre|affiche|rappelle|c est quoi|qu est ce que)\b/;

export function estEnonceEnseignement(question: string): boolean {
  const t = plier(question);
  if (!t) return false;
  if (INTERROGATION_SUR_REGLES.test(t)) return false;
  return ENSEIGNEMENT.test(t);
}

/**
 * LA RÉPONSE PRÉTEND AVOIR RETENU. Formes affirmatives d'un effet — « règle enregistrée »,
 * « c'est noté », « je retiendrai », « j'ai enregistré ». Une question de clarification (« pour
 * vous seul ou pour la société ? ») ne prétend rien : elle ne déclenche pas la garde.
 */
const PRETENTION = /\b(regle|consigne|preference|convention)\b.{0,30}\b(enregistree|enregistre|notee|note|retenue|retenu|creee|cree|mise a jour|activee|active|appliquee)\b|\bc est (bien )?(note|retenu|enregistre|fait)\b|\bje (le |la |m en )?(retiendrai|souviendrai|appliquerai desormais)\b|\bj ai (bien )?(enregistre|note|retenu|memorise)\b|\b(desormais|dorenavant|a partir de maintenant),? (je|j |chaque|toute|tout|toutes|tous)\b/;

export function pretendAvoirRetenu(reponse: string): boolean {
  return PRETENTION.test(plier(reponse));
}

export type VerdictGarde = "RAS" | "RAPPELER" | "DEMENTIR";

/**
 * LE VERDICT. RAS quand rien n'est à garantir (pas un enseignement, un outil Teach a tourné, ou la
 * réponse ne prétend rien). RAPPELER une fois quand le modèle peut encore appeler l'outil.
 * DEMENTIR quand le rappel a déjà eu lieu, ou que l'outil n'est pas disponible à cette personne.
 */
export function gardeEnseignement(args: {
  question: string;
  reponse: string;
  outilsUtilises: readonly string[];
  outilsDisponibles: readonly string[];
  dejaRappele: boolean;
}): VerdictGarde {
  if (!estEnonceEnseignement(args.question)) return "RAS";
  if (args.outilsUtilises.some((o) => OUTILS_ENSEIGNEMENT.includes(o))) return "RAS";
  if (!pretendAvoirRetenu(args.reponse)) return "RAS";
  const peutEnseigner = args.outilsDisponibles.includes("teach_adam");
  if (!peutEnseigner || args.dejaRappele) return "DEMENTIR";
  return "RAPPELER";
}

/** Le rappel injecté au modèle — un tour de plus, pas une consigne de prompt qu'un document pourrait contredire. */
export const RAPPEL_ENSEIGNEMENT =
  "CONTRÔLE DU SERVEUR : tu viens d'affirmer avoir retenu une règle, mais AUCUN outil `teach_adam` (ni `update_rule`, "
  + "`disable_rule`, `delete_rule`) n'a été appelé dans ce tour. L'historique de la conversation n'est PAS la base : une "
  + "règle qui y figure a pu être supprimée. Appelle maintenant l'outil qui convient avec l'énoncé exact de la personne, "
  + "puis réponds en t'appuyant sur son résultat. Si tu juges que ce n'est pas une règle à enseigner, dis-le sans "
  + "prétendre l'avoir enregistrée.";

/** Le démenti : la vérité, dite à la place d'un succès inventé. */
export const DEMENTI_ENSEIGNEMENT =
  "Je n'ai PAS enregistré cette règle : aucun outil d'enseignement n'a tourné dans ce tour, et je ne vais pas vous "
  + "dire le contraire. Reformulez-la en une phrase (« Désormais… ») et je l'enregistrerai en vous montrant son reçu.";
