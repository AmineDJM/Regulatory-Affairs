/**
 * BUDGET PAR DÉPARTEMENT — qui règle quoi.
 *
 * Deux natures de budget, et surtout **deux responsables distincts** :
 *
 *   • `OPERATING` — le fonctionnement du département, **hors employés** (déplacements,
 *     matériel, prestations). C'est l'ADMINISTRATEUR qui le règle ;
 *   • `HR` — la masse salariale et le recrutement. C'est le service RESSOURCES HUMAINES.
 *
 * La séparation n'est pas cosmétique. Un directeur administratif n'a pas à connaître la masse
 * salariale d'un département pour lui accorder un budget de déplacement, et les RH n'ont pas à
 * arbitrer ses achats. Le modèle porte donc une ligne par (département, année, nature), si bien
 * que les deux responsables **n'écrivent jamais la même ligne** — l'un ne peut pas écraser
 * l'autre, même par erreur.
 *
 * Ce fichier ne contient que des fonctions PURES : la décision « qui a le droit de régler
 * quoi » doit se lire et se tester sans base de données.
 */

export type DeptBudgetKind = "OPERATING" | "HR";

export const DEPT_BUDGET_KINDS: readonly DeptBudgetKind[] = ["OPERATING", "HR"];

export const DEPT_BUDGET_LABEL: Record<DeptBudgetKind, string> = {
  OPERATING: "Fonctionnement (hors employés)",
  HR: "Employés & recrutement",
};

export const DEPT_BUDGET_HINT: Record<DeptBudgetKind, string> = {
  OPERATING: "Réglé par l'administrateur : déplacements, matériel, prestations — tout sauf la masse salariale.",
  HR: "Réglé par les ressources humaines : salaires, charges et recrutement du département.",
};

/** Ce qu'on sait de la personne qui veut régler un budget. */
export interface BudgetSetter {
  role: string;
  secondaryRole?: string | null;
  /** Droit BUDGETS/UPDATE (ou VALIDATE) — le « gestionnaire de budget ». */
  canManageBudgets: boolean;
  /** Droit RH/UPDATE — le service du personnel. */
  canManageHr: boolean;
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
}

export const EMPTY_GRANT: DeptBudgetGrant = {
  accessRoles: [], accessUserIds: [], operatingRoles: [], operatingUserIds: [], hrRoles: [], hrUserIds: [],
};

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
): boolean {
  if (canEditAnyKind(subject, user, grant)) return true;
  if (canViewBudgetsModule) return true;
  return named(subject, grant.accessRoles, grant.accessUserIds);
}

/** Peut-on ÉDITER cette nature sur ce département : le socle par rôle OU une autorisation. */
export function canEditDepartmentBudget(
  subject: GrantSubject,
  user: BudgetSetter,
  kind: DeptBudgetKind,
  grant: DeptBudgetGrant,
): boolean {
  if (canSetDepartmentBudget(user, kind)) return true;
  return kind === "HR"
    ? named(subject, grant.hrRoles, grant.hrUserIds)
    : named(subject, grant.operatingRoles, grant.operatingUserIds);
}

function canEditAnyKind(subject: GrantSubject, user: BudgetSetter, grant: DeptBudgetGrant): boolean {
  return DEPT_BUDGET_KINDS.some((k) => canEditDepartmentBudget(subject, user, k, grant));
}

/** Les natures éditables sur CE département (socle + autorisations). */
export function editableKindsOn(subject: GrantSubject, user: BudgetSetter, grant: DeptBudgetGrant): DeptBudgetKind[] {
  return DEPT_BUDGET_KINDS.filter((k) => canEditDepartmentBudget(subject, user, k, grant));
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
  /** Masse salariale RÉELLE de l'année, calculée depuis la paie. */
  hrConsumed: number;
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

/** Totaux d'un tableau de départements — ce qui se lit en bas de colonne. */
export function totals(rows: DeptBudgetRow[]): { operating: number; hr: number; hrConsumed: number; members: number } {
  return rows.reduce(
    (a, r) => ({
      operating: a.operating + r.operating,
      hr: a.hr + r.hr,
      hrConsumed: a.hrConsumed + r.hrConsumed,
      members: a.members + r.members,
    }),
    { operating: 0, hr: 0, hrConsumed: 0, members: 0 },
  );
}
