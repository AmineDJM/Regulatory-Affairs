/**
 * LES BUDGETS DES PÔLES — QUI TIENT QUELLE ENVELOPPE (Direction, 08/10).
 *
 * « Ajouter un module de budget pour Regulatory, donc Budget Regulatory, et un Budget Operations & Sales (il y gère la
 * masse salariale de sa force de vente et ses dépenses hors Ad&Pro bien sûr). » — après le Budget Marketing.
 *
 * UNE SEULE SOURCE, TROIS PÔLES : une enveloppe de pôle est une ligne `BudgetEnvelope` ordinaire, marquée par son
 * `domaine` (MARKETING, REGULATORY, OPERATIONS ; GENERAL sinon). Budgets les lit TOUTES et les additionne ; chaque
 * module de pôle ne lit que les siennes. Rien n'est recopié : les écrans ne peuvent pas diverger.
 *
 * Module PUR, sans aucun import : lu par `rbac.ts`, par les requêtes et par les écrans clients (client-bundle-guard).
 */

export const DOMAINES_POLE = ["MARKETING", "REGULATORY", "OPERATIONS"] as const;
export type DomainePole = (typeof DOMAINES_POLE)[number];
export type DomaineBudget = DomainePole | "GENERAL";

/** La portée d'un écran : Budgets montre tout, un module de pôle seulement son domaine. */
export type PorteeBudget = "TOUT" | DomainePole;

export type ModuleBudgetPole = "BUDGET_MARKETING" | "BUDGET_REGULATORY" | "BUDGET_OPERATIONS";

export interface FicheDomaine {
  module: ModuleBudgetPole;
  chemin: string;
  /** Le nom du module (« Budget Regulatory »). */
  titre: string;
  /** Qui tient ces enveloppes (« Géré par … »). */
  gestionnaire: string;
  /** Le mot court (« enveloppe marketing », « enveloppe Regulatory »). */
  court: string;
  /** Le libellé d'étiquette dans Budgets (« · Regulatory »). */
  etiquette: string;
  /** La phrase sous le titre de la vue d'ensemble. */
  description: string;
}

export const DOMAINES: Record<DomainePole, FicheDomaine> = {
  MARKETING: {
    module: "BUDGET_MARKETING", chemin: "/budget-marketing", titre: "Budget Marketing",
    gestionnaire: "la Direction Marketing", court: "marketing", etiquette: "Marketing",
    description: "Ad & Pro et les enveloppes de la Direction Marketing.",
  },
  REGULATORY: {
    module: "BUDGET_REGULATORY", chemin: "/budget-regulatory", titre: "Budget Regulatory",
    gestionnaire: "Regulatory", court: "Regulatory", etiquette: "Regulatory",
    description: "Les bons de versement 25 % et 75 % et les frais réglementaires.",
  },
  OPERATIONS: {
    module: "BUDGET_OPERATIONS", chemin: "/budget-operations", titre: "Budget Operations & Sales",
    gestionnaire: "la Direction des Opérations", court: "Operations & Sales", etiquette: "Operations & Sales",
    description: "La masse salariale de la force de vente et les dépenses hors Ad & Pro.",
  },
};

export function estDomainePole(d: string | null | undefined): d is DomainePole {
  return d != null && (DOMAINES_POLE as readonly string[]).includes(d);
}

/** Le domaine d'une enveloppe (champ absent ou inconnu = générale). */
export function domaineDe(e: { domaine?: string | null }): DomaineBudget {
  return estDomainePole(e.domaine) ? e.domaine : "GENERAL";
}

/** Le pôle qui tient l'enveloppe, `null` pour une enveloppe générale. */
export function poleDe(e: { domaine?: string | null }): DomainePole | null {
  return estDomainePole(e.domaine) ? e.domaine : null;
}

export function dansLaPortee(e: { domaine?: string | null }, portee: PorteeBudget | undefined): boolean {
  return portee === undefined || portee === "TOUT" || domaineDe(e) === portee;
}

export interface LigneTotal { total: number; allocated: number; consumed: number }

/** Additionne des enveloppes — la même règle pour Budgets et pour chaque module de pôle. */
export function totaliser<T extends LigneTotal>(items: readonly T[]): { count: number; total: number; allocated: number; consumed: number; remaining: number } {
  const total = items.reduce((a, i) => a + i.total, 0);
  const allocated = items.reduce((a, i) => a + i.allocated, 0);
  const consumed = items.reduce((a, i) => a + i.consumed, 0);
  return { count: items.length, total, allocated, consumed, remaining: total - consumed };
}

/** Bornes d'une enveloppe annuelle (1er janvier → 31 décembre, en UTC). Année absurde → l'année en cours. */
export function bornesAnnee(annee: number | null | undefined, maintenant: Date = new Date()): { debut: Date; fin: Date } {
  const a = annee && Number.isInteger(annee) && annee >= 2000 && annee <= 2100 ? annee : maintenant.getUTCFullYear();
  return { debut: new Date(Date.UTC(a, 0, 1)), fin: new Date(Date.UTC(a, 11, 31, 23, 59, 59)) };
}

/** La famille Regulatory telle que les enveloppes la portent. */
export const MODULES_REGULATORY_BUDGET = ["REGULATORY"] as const;

/**
 * À LA BASCULE (migration `20270117100000_budget_regulatory_operations`) : une enveloppe GÉNÉRALE qui ne couvre QUE
 * Regulatory devient REGULATORY. Une enveloppe mixte reste générale ; une enveloppe déjà d'un pôle ne bouge pas. Rien
 * n'est deviné pour les Opérations : « Logistique » ou « PCH » ne disent pas, à eux seuls, qui tient l'enveloppe.
 */
export function domaineRegulatoryParDefaut(e: { domaine?: string | null; modules?: readonly string[] | null; module?: string | null }): DomaineBudget {
  const actuel = domaineDe(e);
  if (actuel !== "GENERAL") return actuel;
  const liste = e.modules && e.modules.length > 0 ? e.modules : e.module ? [e.module] : [];
  const reg = new Set<string>(MODULES_REGULATORY_BUDGET);
  return liste.length > 0 && liste.every((m) => reg.has(m)) ? "REGULATORY" : "GENERAL";
}
