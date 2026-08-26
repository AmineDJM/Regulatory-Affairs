/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TRIAGE A / B / C — quand Adam agit seul, et quand il fait travailler l'orchestrateur.
 *
 * ── LA RÈGLE, ET CE QU'ELLE N'EST PAS ────────────────────────────────────────────────────
 *
 * Le critère est la CONNAISSANCE DU PLAN, pas la taille de la demande :
 *
 *   A — DIRECT           une opération, plan évident.
 *   B — MULTI-ACTION     plusieurs opérations, mais le plan reste évident.
 *   C — COGNITIF         il faut DÉCOUVRIR quoi faire : investiguer, croiser des sources,
 *                        comprendre une cause, inventer la marche à suivre.
 *
 * **Le nombre d'actions ne définit PAS la complexité.** « Envoie Regulatory à Amine, crée une
 * tâche à Khaled et rappelle-moi vendredi » compte trois opérations et reste un B : chaque geste
 * est connu, il n'y a rien à découvrir. « Analyse pourquoi Regulatory prend du retard » compte
 * zéro opération nommée et c'est un C : le travail EST la découverte.
 *
 * ── POURQUOI CETTE DISTINCTION COÛTE CHER SI ON LA RATE ──────────────────────────────────
 *
 * Déléguer un B à l'orchestrateur, c'est payer un modèle de raisonnement pour exécuter une liste
 * qu'on avait déjà. À l'oral, c'est pire que le coût : c'est un silence de plusieurs secondes au
 * milieu d'une phrase, pour un travail que la session temps réel savait faire elle-même.
 *
 * L'erreur inverse — traiter un C comme un B — produit une réponse assurée et fausse, ce qui est
 * bien plus grave. D'où l'asymétrie assumée de la consigne : **dans le doute, déléguer**.
 *
 * ── CE QUE CE MODULE EST ET N'EST PAS ────────────────────────────────────────────────────
 *
 * Ce n'est pas un classifieur. Le triage est fait par le modèle temps réel, qui est le seul à
 * avoir le contexte de l'appel. Ce module tient DEUX choses :
 *
 *   1. le texte de la règle — une seule source, citée dans les instructions de session, pour
 *      qu'un test puisse vérifier que la règle envoyée au modèle est bien celle-ci ;
 *   2. la lecture APRÈS COUP de ce qui s'est passé, pour mesurer — c'est la seule façon de
 *      répondre à « est-ce qu'il délègue trop ? » autrement qu'à l'impression.
 *
 * Module PUR : aucun import, testable sans base ni réseau.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type ComplexityLevel = "A" | "B" | "C";

/**
 * LA RÈGLE ENVOYÉE AU MODÈLE TEMPS RÉEL. Une seule source : les instructions de session la
 * citent, un test vérifie qu'elle y est. Une doctrine recopiée à la main dans un prompt finit
 * par diverger de celle qu'on croit appliquer.
 *
 * ELLE EST COURTE, ET C'EST UNE CONTRAINTE, PAS UN STYLE. Le contexte d'une session temps réel
 * se paie en LATENCE : un plafond de caractères garde les instructions vocales tenables
 * (`voice-realtime.test.ts`). Une première version faisait le double ; elle disait la même chose
 * en expliquant davantage — de l'explication payée à chaque tour de parole. Tout ce qui reste
 * ici porte le critère ou un exemple qui le tranche.
 */
export const TRIAGE_RULE = `TRIAGE — à chaque demande, choisis ton niveau :
A — DIRECT : une opération, tu sais déjà laquelle → tu la fais.
B — MULTI-ACTION DIRECT : plusieurs opérations, tu sais déjà lesquelles → tu les fais, sans déléguer.
C — COGNITIF : tu ne sais pas encore QUOI faire (investiguer, croiser des sources, comprendre une cause) → tu délègues.
LE CRITÈRE EST LA CONNAISSANCE DU PLAN. Le NOMBRE D'ACTIONS ne définit PAS la complexité : « envoie Regulatory à Amine, tâche à Khaled, rappel vendredi » = trois opérations, aucune découverte → B, tu le fais ; « pourquoi Regulatory prend du retard ? » = rien de nommé, tout à découvrir → C.
DANS LE DOUTE, DÉLÈGUE. Mais ne délègue JAMAIS par réflexe une demande dont tu connais déjà les gestes : c'est un silence payé pour rien.`;

/**
 * CE QUI S'EST RÉELLEMENT PASSÉ pendant un tour — lu après coup, à partir des faits.
 *
 * On ne demande pas au modèle de s'auto-évaluer : on regarde ce qu'il a fait. Un modèle qui
 * déclare « c'était un B » puis délègue quand même n'aurait rien appris à personne.
 */
export function observedLevel(input: { toolCalls: number; delegated: boolean }): ComplexityLevel {
  if (input.delegated) return "C";
  return input.toolCalls >= 2 ? "B" : "A";
}

/**
 * UNE DÉLÉGATION SANS MOTIF DE DÉCOUVERTE EST SUSPECTE.
 *
 * Le motif est demandé au modèle au moment de déléguer. S'il est vide ou creux, c'est le signe
 * d'un réflexe plutôt que d'un jugement — exactement le sur-recours qu'on veut voir dans les
 * mesures plutôt que de le découvrir sur une facture.
 *
 * Volontairement PERMISSIF : on signale, on ne bloque pas. Bloquer une délégation sur une
 * heuristique de texte transformerait une mesure en panne.
 */
export function delegationLooksReflexive(reason: string | undefined): boolean {
  const r = (reason ?? "").trim();
  if (r.length < 12) return true;
  // Un motif qui ne fait que répéter la demande n'explique aucune DÉCOUVERTE nécessaire.
  return !/(pourquoi|cause|analys|investig|comprend|croiser|plusieurs sources|déterminer|découvrir|évaluer|diagnost|explor|arbitr|comparer|synth)/i.test(r);
}

/** Le libellé lisible d'un niveau — journaux et écran d'observabilité. */
export const LEVEL_LABEL: Record<ComplexityLevel, string> = {
  A: "A — direct",
  B: "B — multi-action direct",
  C: "C — cognitif (délégué)",
};
