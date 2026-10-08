/**
 * BUDGET MARKETING — QUELLES ENVELOPPES APPARTIENNENT À LA DIRECTION MARKETING (Direction, 08/10).
 *
 * « Un module copie de Budget, mais Budget Marketing : Ad & Pro + toutes les enveloppes que la Direction Marketing
 * aura développées. Le module Budgets reste tel quel et ses infos marketing remontent depuis le Budget Marketing. »
 *
 * UNE SEULE SOURCE : une enveloppe marketing est une ligne `BudgetEnvelope` ordinaire, marquée `domaine = MARKETING`.
 * Budgets la lit (et l'additionne) comme avant ; Budget Marketing ne lit QUE celles-là. Rien n'est recopié, donc les
 * deux écrans ne peuvent pas diverger.
 *
 * Module PUR, sans aucun import : il est lu par les écrans clients (client-bundle-guard), par `rbac.ts` et par les
 * requêtes. La migration `20270116090000_budget_marketing` applique `domaineParDefaut` en SQL, mot pour mot.
 */

export const DOMAINE_MARKETING = "MARKETING" as const;
export const DOMAINE_GENERAL = "GENERAL" as const;
export type DomaineBudget = typeof DOMAINE_MARKETING | typeof DOMAINE_GENERAL;

/** Les écrans du module. */
export const CHEMIN_BUDGET_MARKETING = "/budget-marketing";

/** La famille Ad & Pro telle que les enveloppes la portent (modules d'enveloppe et de catégorie). */
export const MODULES_AD_PRO_BUDGET = [
  "SPONSORING", "EVENTS", "CONGRESS_NATIONAL", "CONGRESS_INTERNATIONAL", "PROMO_MATERIAL", "AD_PRO_OTHER",
] as const;

/** Les catégories créées d'office pour une enveloppe Ad & Pro neuve — une par nature, chacune liée à son module. */
export const CATEGORIES_AD_PRO: readonly { nom: string; module: (typeof MODULES_AD_PRO_BUDGET)[number] }[] = [
  { nom: "Sponsoring", module: "SPONSORING" },
  { nom: "Événements", module: "EVENTS" },
  { nom: "Congrès nationaux", module: "CONGRESS_NATIONAL" },
  { nom: "Congrès internationaux", module: "CONGRESS_INTERNATIONAL" },
  { nom: "Matériel promotionnel", module: "PROMO_MATERIAL" },
  { nom: "Autres", module: "AD_PRO_OTHER" },
];

const AD_PRO = new Set<string>(MODULES_AD_PRO_BUDGET);

export function estModuleAdPro(m: string | null | undefined): boolean {
  return m != null && AD_PRO.has(m);
}

/** L'enveloppe est-elle tenue par la Direction Marketing ? (Champ absent = enveloppe générale.) */
export function estEnveloppeMarketing(e: { domaine?: string | null }): boolean {
  return e.domaine === DOMAINE_MARKETING;
}

/**
 * LE DOMAINE D'UNE ENVELOPPE EXISTANTE, à la bascule : MARKETING quand elle ne couvre QUE la famille Ad & Pro (au moins
 * un module, aucun autre). Une enveloppe mixte — Ad & Pro ET moyens généraux, par exemple — reste générale : la donner
 * à la Direction Marketing lui confierait aussi des dépenses qui ne sont pas les siennes. Sans `modules`, le module
 * principal (déprécié) décide.
 */
export function domaineParDefaut(e: { modules?: readonly string[] | null; module?: string | null }): DomaineBudget {
  const liste = e.modules && e.modules.length > 0 ? e.modules : e.module ? [e.module] : [];
  return liste.length > 0 && liste.every((m) => AD_PRO.has(m)) ? DOMAINE_MARKETING : DOMAINE_GENERAL;
}

/** La portée d'un écran : Budgets montre tout, Budget Marketing seulement le marketing. */
export type PorteeBudget = "TOUT" | "MARKETING";

export function dansLaPortee(e: { domaine?: string | null }, portee: PorteeBudget | undefined): boolean {
  return portee !== "MARKETING" || estEnveloppeMarketing(e);
}

export interface LigneTotal { total: number; allocated: number; consumed: number }

/** Additionne des enveloppes — la même règle pour Budgets et pour Budget Marketing. */
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
