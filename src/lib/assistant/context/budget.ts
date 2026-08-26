import { estimateTokens, type TokenEstimate } from "./tokens";

/**
 * LE BUDGET DE CONTEXTE — choisir, au lieu de tronquer.
 *
 * LE RÉFLEXE QU'ON REFUSE. Quand un prompt devient trop gros, la solution facile est de couper à
 * N caractères. Elle est mauvaise pour une raison précise : la coupure tombe à un endroit choisi
 * par la position, pas par l'importance. On perd le fait qui décidait de la réponse et l'on garde
 * trois paragraphes de doctrine générale, parce qu'ils étaient plus haut dans la chaîne.
 *
 * CE QU'ON FAIT À LA PLACE. Chaque bloc de contexte déclare CE QU'IL EST : à quel point il fait
 * autorité (`authority`), à quel point il concerne LA question du moment (`relevance`), et s'il
 * est indispensable (`critical`). On classe, puis on remplit le budget. Ce qui saute est ce qui
 * apporte le moins, jamais ce qui arrive le dernier.
 *
 * LES BLOCS CRITIQUES NE SAUTENT JAMAIS. La mission le dit et c'est la règle qui empêche
 * l'optimisation de devenir une régression : « Critical information must not disappear because of
 * a fixed cutoff. » L'identité de la personne servie, ses droits, la politique d'envoi — les
 * retirer pour tenir dans un budget ne rendrait pas Adam plus rapide, cela le rendrait faux, et
 * dans un cas au moins (la politique d'envoi) dangereux. Un dépassement causé par des blocs
 * critiques est donc RAPPORTÉ, pas résolu en silence.
 *
 * LES BUDGETS SONT DES CIBLES, PAS DES COUPERETS — c'est aussi ce que dit la mission. Le
 * dépassement est une information (`overBudget`), pas une exception.
 */

/** Les trois régimes. Le routeur choisit ; le compilateur remplit. */
export type BudgetTier = "FAST" | "NORMAL" | "DEEP";

export interface Budget {
  tier: BudgetTier;
  /** Cible basse — en dessous, on n'a probablement pas assez donné au modèle. */
  min: number;
  /** Cible haute — au-delà, on paie de la latence pour du contexte qu'il ne lira pas. */
  max: number;
}

/**
 * Les valeurs viennent de la mission (§7). FAST sert les questions dont la réponse est un fait :
 * y verser six mille tokens de doctrine, c'est payer une seconde pour rien.
 */
export const BUDGETS: Record<BudgetTier, Budget> = {
  FAST: { tier: "FAST", min: 500, max: 2_000 },
  NORMAL: { tier: "NORMAL", min: 2_000, max: 6_000 },
  DEEP: { tier: "DEEP", min: 6_000, max: 20_000 },
};

/**
 * À QUEL POINT UNE SOURCE FAIT FOI. Sert deux fois : ici pour classer sous contrainte de budget,
 * et dans `authority.ts` pour arbitrer une contradiction. Les deux usages doivent partager la
 * même échelle, sinon on garde dans le prompt une source qu'on désavouerait ensuite.
 */
export type Authority =
  /** L'ERP canonique : la table qui fait loi sur ce fait. */
  | "CANONICAL"
  /** Une projection dérivée du canonique, fraîche et traçable. */
  | "PROJECTION"
  /** Un fait observé chez un fournisseur (Gmail, agenda) — vrai chez lui, pas forcément ERP. */
  | "PROVIDER"
  /** Une preuve non structurée : un mail, un document. C'est un INDICE, pas une vérité ERP. */
  | "EVIDENCE"
  /** Un résumé produit par un modèle. Jamais une vérité sans provenance (§26). */
  | "INFERRED";

export const AUTHORITY_WEIGHT: Record<Authority, number> = {
  CANONICAL: 1, PROJECTION: 0.85, PROVIDER: 0.7, EVIDENCE: 0.45, INFERRED: 0.2,
};

export interface ContextBlock {
  /** Identifiant court et stable — c'est lui qu'on lit dans le journal d'observabilité. */
  id: string;
  /** Le texte réellement versé au prompt. */
  text: string;
  authority: Authority;
  /** 0..1 — à quel point ce bloc concerne LA question posée maintenant. */
  relevance: number;
  /** Indispensable : identité, droits, politique de sécurité. Ne saute JAMAIS. */
  critical?: boolean;
  /** D'où il vient, pour pouvoir citer la source et diagnostiquer (§26). */
  provenance?: string;
  /** Quand la donnée a été lue — la fraîcheur départage deux blocs équivalents (§19). */
  freshAt?: number;
}

export interface FittedContext {
  kept: ContextBlock[];
  dropped: ContextBlock[];
  estimate: TokenEstimate;
  budget: Budget;
  /** Vrai quand les seuls blocs critiques dépassent déjà la cible — un fait à REMONTER. */
  overBudget: boolean;
  /** Vrai quand on est sous la cible basse : le modèle a peut-être trop peu pour répondre. */
  underBudget: boolean;
}

/**
 * LE SCORE. Autorité × pertinence, avec un léger bonus de fraîcheur.
 *
 * L'autorité MULTIPLIE au lieu de s'ajouter, et ce choix a un effet précis : un extrait de mail
 * très « pertinent » au sens lexical (il contient tous les mots de la question) ne peut pas
 * dépasser un fait canonique moyennement pertinent. C'est exactement ce qu'on veut — §10 dit que
 * si l'information existe canoniquement, on la prend, et §18 que les déclarations d'un mail sont
 * des indices, pas la vérité de l'ERP.
 */
export function scoreBlock(b: ContextBlock, now: number = Date.now()): number {
  const relevance = Math.max(0, Math.min(1, b.relevance));
  const base = AUTHORITY_WEIGHT[b.authority] * relevance;
  if (!b.freshAt) return base;
  // Une donnée de la journée garde tout son poids ; au-delà d'une semaine elle en perd un dixième.
  const ageDays = Math.max(0, (now - b.freshAt) / 86_400_000);
  return base * (1 - Math.min(0.1, ageDays * 0.014));
}

/**
 * REMPLIR LE BUDGET.
 *
 * Deux temps, et l'ordre est la garantie : d'abord TOUS les blocs critiques, quel qu'en soit le
 * coût ; ensuite le reste, du mieux-noté au moins bon, tant qu'il reste de la place.
 */
export function fitToBudget(
  blocks: ContextBlock[],
  tier: BudgetTier = "NORMAL",
  now: number = Date.now(),
): FittedContext {
  const budget = BUDGETS[tier];
  const cost = new Map<string, number>();
  for (const b of blocks) cost.set(b.id, estimateTokens(b.text));

  const critical = blocks.filter((b) => b.critical);
  const optional = blocks
    .filter((b) => !b.critical)
    .sort((a, b) => scoreBlock(b, now) - scoreBlock(a, now));

  const kept: ContextBlock[] = [...critical];
  let tokens = critical.reduce((sum, b) => sum + (cost.get(b.id) ?? 0), 0);
  const dropped: ContextBlock[] = [];

  for (const b of optional) {
    const c = cost.get(b.id) ?? 0;
    if (tokens + c <= budget.max) {
      kept.push(b);
      tokens += c;
    } else {
      dropped.push(b);
    }
  }

  const chars = kept.reduce((sum, b) => sum + b.text.length, 0);
  return {
    kept, dropped,
    estimate: { chars, tokens },
    budget,
    // Le dépassement ne peut venir QUE du critique — le reste s'arrête à la cible.
    overBudget: tokens > budget.max,
    underBudget: tokens < budget.min && dropped.length === 0,
  };
}

/** Assembler ce qui a été retenu, dans l'ordre d'autorité puis de score : le plus sûr d'abord. */
export function renderBlocks(fitted: FittedContext, now: number = Date.now()): string {
  return [...fitted.kept]
    .sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return scoreBlock(b, now) - scoreBlock(a, now);
    })
    .map((b) => b.text)
    .filter(Boolean)
    .join("\n\n");
}
