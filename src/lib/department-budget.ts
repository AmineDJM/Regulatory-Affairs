/**
 * BUDGET PAR DÉPARTEMENT — qui règle quoi.
 *
 * **Trois** natures de budget, et surtout **trois responsables distincts** :
 *
 *   • `OPERATING` — les MOYENS GÉNÉRAUX du département (fournitures, prestations,
 *     déplacements). C'est le DIRECTEUR DU DÉPARTEMENT qui les tient, l'administration qui
 *     les dote ;
 *   • `HR` — la MASSE SALARIALE et le recrutement. Les RESSOURCES HUMAINES, exclusivement ;
 *   • `ACTIVITY` — le budget MÉTIER, celui de l'activité propre du département : Ad & Pro
 *     pour le marketing, paiement des BV pour le Regulatory, etc.
 *
 * La séparation n'est pas cosmétique. Un directeur administratif n'a pas à connaître la masse
 * salariale d'un département pour lui accorder des fournitures, les RH n'ont pas à arbitrer
 * ses achats, et le budget métier ne se confond pas avec le fonctionnement — le premier
 * finance ce que le département PRODUIT, le second ce qu'il consomme pour exister. Le modèle
 * porte une ligne par (département, année, nature), si bien que les responsables **n'écrivent
 * jamais la même ligne** — l'un ne peut pas écraser l'autre, même par erreur.
 *
 * ⚠️ **Personne ne s'accorde son propre budget.** Celui qui gère une nature peut la RÉGLER
 * quand l'administration lui en a donné le pouvoir, mais l'augmentation passe par une DEMANDE
 * (dotation ou rallonge) tranchée par l'administration : c'est ce qui rend vérifiable la règle
 * « budget fixé par les RH, validé par l'administration », au lieu d'en faire un usage.
 *
 * Ce fichier ne contient que des fonctions PURES : la décision « qui a le droit de régler
 * quoi » doit se lire et se tester sans base de données.
 */

export type DeptBudgetKind = "OPERATING" | "HR" | "ACTIVITY";

export const DEPT_BUDGET_KINDS: readonly DeptBudgetKind[] = ["OPERATING", "HR", "ACTIVITY"];

export const DEPT_BUDGET_LABEL: Record<DeptBudgetKind, string> = {
  OPERATING: "Moyens généraux",
  HR: "Masse salariale",
  ACTIVITY: "Budget métier (activité)",
};

export const DEPT_BUDGET_HINT: Record<DeptBudgetKind, string> = {
  OPERATING: "Tenu par le directeur du département : fournitures, prestations, déplacements — tout sauf la masse salariale.",
  HR: "Réservé aux ressources humaines : salaires, charges et recrutement du département.",
  ACTIVITY: "L'activité propre du département : Ad & Pro pour le marketing, paiement des BV pour le Regulatory…",
};

/** Ce qu'on sait de la personne qui veut régler un budget. */
export interface BudgetSetter {
  role: string;
  secondaryRole?: string | null;
  /** Droit BUDGETS/UPDATE (ou VALIDATE) — le « gestionnaire de budget ». */
  canManageBudgets: boolean;
  /** Droit RH/UPDATE — le service du personnel. */
  canManageHr: boolean;
  /**
   * Départements dont cette personne est le RESPONSABLE (ou l'adjoint) — résolus depuis
   * l'organigramme. C'est ce qui lui ouvre les moyens généraux et le budget métier DE SON
   * département, et de lui seul : « le directeur tient ses moyens généraux » ne peut pas se
   * dire par un rôle, puisque chaque directeur en a un différent.
   */
  headOfDepartmentIds?: string[];
}

/** Le Super Admin arbitre partout : c'est le seul rôle qui n'a pas à se voir refuser une case. */
function isSuperAdmin(u: BudgetSetter): boolean {
  return u.role === "SUPER_ADMIN" || u.secondaryRole === "SUPER_ADMIN";
}

/**
 * Cette personne peut-elle régler CETTE nature de budget ?
 *
 * On ne se contente pas de « a un droit budgétaire » : le point de la demande est justement que
 * le budget des employés N'EST PAS réglé par la même personne que le reste.
 *
 * Fonction PURE — testée.
 */
export function canSetDepartmentBudget(user: BudgetSetter, kind: DeptBudgetKind): boolean {
  if (isSuperAdmin(user)) return true;
  return kind === "HR" ? user.canManageHr : user.canManageBudgets;
}

/** Les natures que cette personne peut régler (pour n'afficher que des cases utiles). */
export function settableKinds(user: BudgetSetter): DeptBudgetKind[] {
  return DEPT_BUDGET_KINDS.filter((k) => canSetDepartmentBudget(user, k));
}

// ───────────────── Autorisations réglées par le Super Admin ─────────────────

/**
 * AU-DELÀ DU SOCLE PAR RÔLE — le Super Admin ouvre nommément.
 *
 * Le socle ci-dessus dit « le gestionnaire de budget règle le fonctionnement, les RH règlent
 * les employés ». C'est vrai partout, pour tous les départements. Il manquait de quoi dire
 * « le responsable du Commercial règle le fonctionnement DE SON département » — ni plus, ni
 * ailleurs. C'est ce que ces règles apportent.
 *
 * Trois portées distinctes, parce que ce ne sont pas les mêmes personnes : VOIR le budget,
 * ÉDITER le fonctionnement, ÉDITER les employés. Quelqu'un peut consulter sans rien régler.
 *
 * **Les règles s'AJOUTENT, elles ne retranchent jamais.** Deux raisons :
 *   • poser la première autorisation ne doit pas, par effet de bord, retirer l'accès aux RH
 *     sur le budget des employés — un réglage d'ouverture ne se transforme pas en fermeture ;
 *   • un droit qui disparaît sans qu'on l'ait demandé se diagnostique très mal.
 * Pour restreindre, on retire le droit de module — c'est là que ça se décide.
 *
 * La règle GÉNÉRALE (`departmentId = null`) et celle du département se CUMULENT de la même
 * façon : la première ouvre largement, la seconde ajoute quelqu'un pour ce département seul.
 */
export interface DeptBudgetGrant {
  accessRoles: string[];
  accessUserIds: string[];
  operatingRoles: string[];
  operatingUserIds: string[];
  hrRoles: string[];
  hrUserIds: string[];
  /** Budget MÉTIER : listes propres — ouvrir les moyens généraux n'ouvre pas l'activité. */
  activityRoles: string[];
  activityUserIds: string[];
}

export const EMPTY_GRANT: DeptBudgetGrant = {
  accessRoles: [], accessUserIds: [], operatingRoles: [], operatingUserIds: [], hrRoles: [], hrUserIds: [],
  activityRoles: [], activityUserIds: [],
};

/** Les listes nommées qui ouvrent l'ÉDITION de chaque nature. */
function namedListsFor(kind: DeptBudgetKind, g: DeptBudgetGrant): { roles: string[]; userIds: string[] } {
  if (kind === "HR") return { roles: g.hrRoles, userIds: g.hrUserIds };
  if (kind === "ACTIVITY") return { roles: g.activityRoles, userIds: g.activityUserIds };
  return { roles: g.operatingRoles, userIds: g.operatingUserIds };
}

/** Ce qu'on sait de la personne dont on évalue les autorisations. */
export interface GrantSubject {
  id: string;
  role: string;
  secondaryRole?: string | null;
}

function named(subject: GrantSubject, roles: string[], userIds: string[]): boolean {
  if (userIds.includes(subject.id)) return true;
  return roles.includes(subject.role) || (subject.secondaryRole ? roles.includes(subject.secondaryRole) : false);
}

/**
 * Fusionne la règle générale et celle d'un département. L'union, jamais l'intersection :
 * une règle de département RESTREINDRAIT la règle générale si on intersectait, ce qui
 * contredirait la promesse « les autorisations s'ajoutent ».
 */
export function mergeGrants(general: DeptBudgetGrant | null, own: DeptBudgetGrant | null): DeptBudgetGrant {
  const u = (a: string[] = [], b: string[] = []) => Array.from(new Set([...a, ...b]));
  return {
    accessRoles: u(general?.accessRoles, own?.accessRoles),
    accessUserIds: u(general?.accessUserIds, own?.accessUserIds),
    operatingRoles: u(general?.operatingRoles, own?.operatingRoles),
    operatingUserIds: u(general?.operatingUserIds, own?.operatingUserIds),
    hrRoles: u(general?.hrRoles, own?.hrRoles),
    hrUserIds: u(general?.hrUserIds, own?.hrUserIds),
    activityRoles: u(general?.activityRoles, own?.activityRoles),
    activityUserIds: u(general?.activityUserIds, own?.activityUserIds),
  };
}

/**
 * Peut-on VOIR le budget de ce département ?
 *
 * Qui peut l'éditer peut évidemment le lire — l'inverse serait absurde. S'y ajoutent le socle
 * de lecture (le droit de consulter le module Budgets) et les personnes nommées.
 */
export function canViewDepartmentBudget(
  subject: GrantSubject,
  user: BudgetSetter,
  grant: DeptBudgetGrant,
  canViewBudgetsModule: boolean,
  departmentId?: string | null,
): boolean {
  if (canEditAnyKind(subject, user, grant, departmentId)) return true;
  if (canViewBudgetsModule) return true;
  return named(subject, grant.accessRoles, grant.accessUserIds);
}

/**
 * Cette personne DIRIGE-T-ELLE ce département (responsable ou adjoint) ?
 *
 * C'est ce qui lui ouvre les moyens généraux et le budget métier de SON département — et de
 * lui seul. Aucun rôle ne peut porter cette règle : chaque directeur a un département
 * différent, et « directeur » n'est pas un rôle de la matrice mais une place dans
 * l'organigramme.
 */
export function isDepartmentDirector(user: BudgetSetter, departmentId: string | null | undefined): boolean {
  if (!departmentId) return false;
  return (user.headOfDepartmentIds ?? []).includes(departmentId);
}

/**
 * Peut-on ÉDITER cette nature sur CE département ?
 *
 * Trois portes, dans cet ordre : le socle par rôle (administration, RH), la direction du
 * département (moyens généraux et budget métier — jamais la masse salariale, qui reste aux
 * RH), et enfin les personnes nommées par le Super Admin sur ce département.
 *
 * `departmentId` est facultatif pour ne pas casser les appels historiques, mais sans lui la
 * porte « directeur » ne peut évidemment pas s'ouvrir.
 */
export function canEditDepartmentBudget(
  subject: GrantSubject,
  user: BudgetSetter,
  kind: DeptBudgetKind,
  grant: DeptBudgetGrant,
  departmentId?: string | null,
): boolean {
  if (canSetDepartmentBudget(user, kind)) return true;
  // Le directeur tient SES moyens généraux et SON budget métier. La masse salariale, non :
  // « gérée exclusivement par les ressources humaines » ne souffre pas d'exception locale.
  if (kind !== "HR" && isDepartmentDirector(user, departmentId)) return true;
  const lists = namedListsFor(kind, grant);
  return named(subject, lists.roles, lists.userIds);
}

function canEditAnyKind(
  subject: GrantSubject, user: BudgetSetter, grant: DeptBudgetGrant, departmentId?: string | null,
): boolean {
  return DEPT_BUDGET_KINDS.some((k) => canEditDepartmentBudget(subject, user, k, grant, departmentId));
}

/** Les natures éditables sur CE département (socle + direction + autorisations). */
export function editableKindsOn(
  subject: GrantSubject, user: BudgetSetter, grant: DeptBudgetGrant, departmentId?: string | null,
): DeptBudgetKind[] {
  return DEPT_BUDGET_KINDS.filter((k) => canEditDepartmentBudget(subject, user, k, grant, departmentId));
}

/**
 * Peut-on DEMANDER une dotation ou une rallonge sur ce département ?
 *
 * Plus large que l'édition, et volontairement : demander n'est pas décider. Quiconque voit le
 * budget peut dire « il en manque » — c'est l'administration qui tranche. Refuser la demande à
 * ceux qui ne peuvent pas éditer reviendrait à exiger qu'ils passent par un couloir, ce qui ne
 * laisse aucune trace.
 */
export function canRequestDepartmentBudget(
  subject: GrantSubject,
  user: BudgetSetter,
  grant: DeptBudgetGrant,
  canViewBudgetsModule: boolean,
  departmentId?: string | null,
): boolean {
  return canViewDepartmentBudget(subject, user, grant, canViewBudgetsModule, departmentId);
}

/**
 * Peut-on ACCORDER une dotation / rallonge ? L'administration, et elle seule.
 *
 * C'est le cœur de « fixé par les RH, validé par l'administration » : si celui qui demande
 * pouvait aussi accorder, la validation ne serait qu'un mot.
 */
export function canDecideDepartmentBudgetRequest(user: BudgetSetter): boolean {
  return isSuperAdmin(user) || user.canManageBudgets;
}

/** Régler les autorisations est une prérogative du Super Admin, et de lui seul. */
export function canManageDepartmentBudgetAccess(user: BudgetSetter): boolean {
  return isSuperAdmin(user);
}

/** Un montant saisi est-il recevable ? (négatif = erreur de saisie, pas une reprise) */
export function normalizeAmount(raw: string | number | null | undefined): number | { error: string } {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return { error: "Le montant n'est pas un nombre." };
  if (n < 0) return { error: "Un budget ne peut pas être négatif." };
  return n;
}

/** Une année d'exercice plausible — au-delà, c'est une faute de frappe, pas une prévision. */
export function normalizeYear(raw: string | number | null | undefined, current = new Date().getFullYear()): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 2000 || n > current + 10) return current;
  return n;
}

export type BudgetHealth = "ON_TRACK" | "AT_RISK" | "OVER_BUDGET" | "UNSET";

/**
 * Où en est la consommation d'un budget départemental.
 *
 * `UNSET` est une réponse à part entière : un département sans budget réglé n'est pas « à 0 %
 * de consommation », il n'a simplement pas encore de budget — le dire évite de faire passer
 * une absence de décision pour une bonne nouvelle.
 *
 * Fonction PURE — testée.
 */
export function budgetHealth(allocated: number, consumed: number): BudgetHealth {
  if (!(allocated > 0)) return "UNSET";
  const pct = consumed / allocated;
  if (pct >= 1) return "OVER_BUDGET";
  if (pct >= 0.8) return "AT_RISK";
  return "ON_TRACK";
}

/** Part consommée, bornée à 100 % pour l'affichage (le dépassement se dit par la couleur). */
export function consumedPercent(allocated: number, consumed: number): number {
  if (!(allocated > 0)) return 0;
  return Math.min(100, Math.round((consumed / allocated) * 100));
}

export interface DeptBudgetRow {
  departmentId: string;
  departmentName: string;
  /** Chemin complet dans l'arbre (« Commercial › Ville ») — deux « Ville » ne se confondent pas. */
  path: string;
  companyName: string | null;
  members: number;
  operating: number;
  hr: number;
  activity: number;
  /** Masse salariale RÉELLE de l'année, calculée depuis la paie. */
  hrConsumed: number;
  /** Moyens généraux RÉELLEMENT consommés — dépenses imputées, avec justificatif. */
  operatingConsumed: number;
  /** Budget métier RÉELLEMENT consommé. */
  activityConsumed: number;
}

/** Le montant alloué d'une nature, sur une ligne. */
export function allocatedOf(row: DeptBudgetRow, kind: DeptBudgetKind): number {
  return kind === "HR" ? row.hr : kind === "ACTIVITY" ? row.activity : row.operating;
}

/** Le montant consommé d'une nature, sur une ligne. */
export function consumedOf(row: DeptBudgetRow, kind: DeptBudgetKind): number {
  return kind === "HR" ? row.hrConsumed : kind === "ACTIVITY" ? row.activityConsumed : row.operatingConsumed;
}

/**
 * Une ligne TELLE QUE LA VOIT UNE PERSONNE : les montants, plus ce qu'elle a le droit d'y
 * faire. Les droits sont résolus côté serveur et transportés avec la ligne — une case
 * verrouillée à l'écran ne protège rien si le serveur ne sait pas pourquoi elle l'est.
 */
export interface DeptBudgetViewRow extends DeptBudgetRow {
  /** Natures éditables sur CE département (socle par rôle + autorisations). */
  editable: DeptBudgetKind[];
  /** Autorisation propre à ce département (hors règle générale) — pour l'écran de réglage. */
  grant: DeptBudgetGrant;
  /** Une règle propre existe-t-elle ? (distingue « aucune règle » de « règle vide ») */
  hasOwnRule: boolean;
}

export interface DeptBudgetTotals {
  operating: number;
  hr: number;
  activity: number;
  hrConsumed: number;
  operatingConsumed: number;
  activityConsumed: number;
  members: number;
}

/** Totaux d'un tableau de départements — ce qui se lit en bas de colonne. */
export function totals(rows: DeptBudgetRow[]): DeptBudgetTotals {
  return rows.reduce<DeptBudgetTotals>(
    (a, r) => ({
      operating: a.operating + r.operating,
      hr: a.hr + r.hr,
      activity: a.activity + r.activity,
      hrConsumed: a.hrConsumed + r.hrConsumed,
      operatingConsumed: a.operatingConsumed + r.operatingConsumed,
      activityConsumed: a.activityConsumed + r.activityConsumed,
      members: a.members + r.members,
    }),
    { operating: 0, hr: 0, activity: 0, hrConsumed: 0, operatingConsumed: 0, activityConsumed: 0, members: 0 },
  );
}
