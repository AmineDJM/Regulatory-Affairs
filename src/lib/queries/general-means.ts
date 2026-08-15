import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { mergeGrants, canViewDepartmentBudget, editableKindsOn, EMPTY_GRANT, type DeptBudgetGrant, type BudgetSetter, type DeptBudgetKind } from "@/lib/department-budget";
import { headedDepartmentIds } from "@/lib/queries/department-budget";
import { pettyCashBalance, currentPeriod, nextRechargeDate, type PettyCashBalance, type PettyCashStatus } from "@/lib/petty-cash";
import { isFullyClassified } from "@/lib/budget/imputation";

/**
 * MOYENS GÉNÉRAUX — la lecture consolidée d'un département : son budget, ses dépenses, sa
 * caisse d'avance.
 *
 * Ces trois choses vivaient séparément : le budget dans un tableau, les achats dans les
 * demandes administratives, l'argent liquide nulle part. Impossible de répondre à « combien
 * a-t-on dépensé ce mois-ci, et me reste-t-il de quoi payer ? » sans additionner à la main.
 */

/** La liste affichée est plafonnée pour rester lisible ; les TOTAUX, eux, ne le sont pas. */
export const LIST_LIMIT = 200;

export interface GeneralMeansExpense {
  id: string;
  label: string;
  amount: number;
  date: string;
  kind: DeptBudgetKind;
  notes: string | null;
  /** Payée sur la caisse d'avance ? (sinon : virement / Finances) */
  fromPettyCash: boolean;
  /** Pièces justificatives — une dépense sans pièce n'est qu'une affirmation. */
  documents: { id: string; name: string }[];
  /** Le DÉTAIL du ticket : ce qui a été acheté, en quelle quantité, à quel prix, et où c'est classé. */
  lines: { id: string; label: string; quantity: number; amount: number; budgetCategoryId: string | null }[];
  /** Classement budgétaire du ticket entier — `null` = à classer. */
  budgetCategoryId: string | null;
  /** Le chemin lisible de ce classement (« Enveloppe › Catégorie »), pour l'afficher tel quel. */
  budgetLabel: string | null;
  /** Reste-t-il une part non classée sur cette dépense ? (elle est alors signalée) */
  toClassify: boolean;
  createdBy: string;
}

export interface GeneralMeansCash {
  id: string;
  period: string;
  amount: number;
  status: PettyCashStatus;
  holder: string;
  holderId: string | null;
  receivedAt: string | null;
  note: string | null;
  balance: PettyCashBalance;
  lines: GeneralMeansExpense[];
}

/** Le réglage mensuel de la caisse (posé par les RH) et sa prochaine échéance. */
export interface GeneralMeansPlan {
  monthlyAmount: number;
  rechargeDay: number;
  holderId: string | null;
  holder: string;
  isActive: boolean;
  nextRechargeAt: string | null;
}

/** Une demande de rallonge, telle qu'elle se lit et se tranche. */
export interface GeneralMeansTopUp {
  id: string;
  amountRequested: number;
  amountGranted: number | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requester: string;
  createdAt: string;
  decisionNote: string | null;
}

export interface GeneralMeansView {
  department: { id: string; name: string; path: string };
  year: number;
  allocated: number;
  consumed: number;
  remaining: number;
  /** Consommé sur les AUTRES natures (budget métier, formation) — montré à part pour que la
   *  liste se réconcilie avec l'enveloppe sans qu'on croie l'avoir entamée. */
  otherConsumed: number;
  /** Nombre RÉEL de dépenses de l'année (la liste, elle, est plafonnée). */
  expenseCount: number;
  /** La liste affichée est-elle tronquée ? */
  truncated: boolean;
  /** L'utilisateur tient-il ce budget (directeur, RH nommé, administration) ? */
  canSpend: boolean;
  /** Peut-il remettre une caisse et trancher les rallonges ? (administration) */
  canAllot: boolean;
  /** Est-il le DÉTENTEUR de la caisse courante ? (c'est lui qui confirme la réception) */
  isHolder: boolean;
  /** Peut-il corriger ou supprimer une dépense payée SUR LA CAISSE ? C'est de l'argent
   *  physique : seule la personne qui le détient — ou la direction — y touche. Calculé ici
   *  avec la MÊME règle que le serveur, pour qu'un bouton visible ne mène pas à un refus. */
  canAmendCash: boolean;
  cash: GeneralMeansCash | null;
  /** Réglage mensuel — `null` tant que les RH ne l'ont pas posé. */
  plan: GeneralMeansPlan | null;
  /** Demandes de rallonge sur la caisse en cours, la plus récente d'abord. */
  topUps: GeneralMeansTopUp[];
  /** Caisses des mois précédents, la plus récente d'abord. */
  history: { id: string; period: string; amount: number; spent: number; status: PettyCashStatus }[];
  expenses: GeneralMeansExpense[];
}

function grantOf(rows: { departmentId: string | null; accessRoles: string[]; accessUserIds: string[]; operatingRoles: string[]; operatingUserIds: string[]; hrRoles: string[]; hrUserIds: string[]; activityRoles: string[]; activityUserIds: string[] }[], departmentId: string): DeptBudgetGrant {
  const as = (r: (typeof rows)[number] | undefined): DeptBudgetGrant | null =>
    r ? {
      accessRoles: r.accessRoles, accessUserIds: r.accessUserIds,
      operatingRoles: r.operatingRoles, operatingUserIds: r.operatingUserIds,
      hrRoles: r.hrRoles, hrUserIds: r.hrUserIds,
      activityRoles: r.activityRoles, activityUserIds: r.activityUserIds,
    } : null;
  return mergeGrants(as(rows.find((r) => r.departmentId === null)), as(rows.find((r) => r.departmentId === departmentId)));
}

/**
 * Le département dont on montre les moyens généraux : celui demandé, à défaut celui que la
 * personne DIRIGE, à défaut le sien. Sans ce repli, l'assistante devrait connaître l'identifiant
 * de son propre département pour voir sa caisse.
 */
export async function resolveGeneralMeansDepartment(user: SessionUser, requested?: string | null): Promise<string | null> {
  if (requested) return requested;
  const headed = await headedDepartmentIds(user.id);
  if (headed.length > 0) return headed[0];
  // La caisse qu'on détient désigne le département aussi sûrement qu'un rattachement.
  const held = await prisma.pettyCashAllotment.findFirst({
    where: { holderId: user.id },
    orderBy: { period: "desc" },
    select: { departmentId: true },
  });
  if (held) return held.departmentId;
  const emp = await prisma.employee.findUnique({ where: { userId: user.id }, select: { departmentId: true } });
  return emp?.departmentId ?? null;
}

export async function getGeneralMeans(
  user: SessionUser,
  departmentId: string,
  year: number,
  period: string = currentPeriod(),
): Promise<GeneralMeansView | null> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  if (!department) return null;

  const headed = await headedDepartmentIds(user.id);
  const rights: BudgetSetter = {
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    canManageBudgets: userCan(user, "BUDGETS", "UPDATE") || userCan(user, "BUDGETS", "VALIDATE"),
    canManageHr: userCan(user, "RH", "UPDATE"),
    headOfDepartmentIds: headed,
  };
  const subject = { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null };
  const canViewModule = userCan(user, "BUDGETS", "VIEW");

  const accessRows = await prisma.departmentBudgetAccess.findMany({
    where: { OR: [{ departmentId }, { departmentId: null }] },
  });
  const grant = grantOf(accessRows, departmentId);

  const cashHere = await prisma.pettyCashAllotment.findFirst({
    where: { departmentId, period },
    include: {
      holder: { select: { id: true, name: true } },
      expenses: {
        orderBy: { date: "desc" },
        include: {
          createdBy: { select: { name: true } },
          lines: { orderBy: { createdAt: "asc" }, select: { id: true, label: true, quantity: true, amount: true, budgetCategoryId: true } },
        },
      },
      topUps: {
        orderBy: { createdAt: "desc" },
        include: { requestedBy: { select: { name: true } } },
      },
    },
  });
  const planRow = await prisma.pettyCashPlan.findUnique({
    where: { departmentId },
    include: { holder: { select: { name: true } } },
  });
  const isHolder = cashHere?.holderId === user.id;
  // LE DROIT DE MODULE SUFFIT. Celui qui achète au quotidien (l'assistante de direction) a le
  // module « Moyens généraux » et rien d'autre : exiger en plus une autorisation budgétaire la
  // renvoyait vers un écran vide sur son propre budget. Le module ouvre SON département ; les
  // autres restent gouvernés par les autorisations budgétaires, comme avant.
  const hasModule = userCan(user, "GENERAL_MEANS", "VIEW");

  if (!isHolder && !hasModule && !canViewDepartmentBudget(subject, rights, grant, canViewModule, departmentId)) return null;

  const [budget, expenses, totals, expenseCount, history] = await Promise.all([
    prisma.departmentBudget.findUnique({
      where: { departmentId_year_kind: { departmentId, year, kind: "OPERATING" } },
      select: { amount: true },
    }),
    prisma.departmentBudgetExpense.findMany({
      where: { departmentId, year, kind: { not: "HR" } },
      orderBy: { date: "desc" },
      take: LIST_LIMIT,
      include: {
        createdBy: { select: { name: true } },
        lines: { orderBy: { createdAt: "asc" }, select: { id: true, label: true, quantity: true, amount: true, budgetCategoryId: true } },
      },
    }),
    // LE CONSOMMÉ NE SE CALCULE PAS SUR LA LISTE AFFICHÉE. Elle est plafonnée pour rester
    // lisible ; additionner ses lignes revenait à ignorer en silence tout ce qui dépasse le
    // plafond — un budget qui s'allège tout seul au 201ᵉ achat. La base additionne, elle.
    prisma.departmentBudgetExpense.groupBy({
      by: ["kind"],
      where: { departmentId, year, kind: { not: "HR" } },
      _sum: { amount: true },
    }),
    prisma.departmentBudgetExpense.count({ where: { departmentId, year, kind: { not: "HR" } } }),
    prisma.pettyCashAllotment.findMany({
      where: { departmentId, period: { not: period } },
      orderBy: { period: "desc" },
      take: 12,
      include: { expenses: { select: { amount: true } } },
    }),
  ]);

  // Les pièces des dépenses de la CAISSE aussi : son mois peut relever d'une autre année que
  // celle consultée, et la ligne se serait alors affichée « sans pièce » alors qu'elle en a une.
  const docIds = Array.from(new Set([...expenses.map((e) => e.id), ...(cashHere?.expenses ?? []).map((e) => e.id)]));
  const docRows = docIds.length
    ? await prisma.document.findMany({
        where: { entityType: "DEPARTMENT_EXPENSE", entityId: { in: docIds } },
        select: { id: true, name: true, entityId: true },
      })
    : [];
  const docsByExpense = new Map<string, { id: string; name: string }[]>();
  for (const d of docRows) {
    const arr = docsByExpense.get(d.entityId) ?? [];
    arr.push({ id: d.id, name: d.name });
    docsByExpense.set(d.entityId, arr);
  }

  // LE CHEMIN LISIBLE DU CLASSEMENT. On ne montre pas un identifiant à quelqu'un qui n'a pas
  // le module Budget : on lui montre « Enveloppe › Catégorie », c'est-à-dire ce qu'il a choisi.
  const usedCategoryIds = Array.from(new Set([
    ...expenses.map((e) => e.budgetCategoryId),
    ...expenses.flatMap((e) => e.lines.map((l) => l.budgetCategoryId)),
    ...(cashHere?.expenses ?? []).map((e) => e.budgetCategoryId),
    ...(cashHere?.expenses ?? []).flatMap((e) => e.lines.map((l) => l.budgetCategoryId)),
  ].filter((x): x is string => Boolean(x))));
  const categoryRows = usedCategoryIds.length
    ? await prisma.budgetCategoryLine.findMany({
        where: { id: { in: usedCategoryIds } },
        select: { id: true, name: true, envelope: { select: { name: true } } },
      })
    : [];
  const categoryPath = new Map(categoryRows.map((c) => [c.id, `${c.envelope.name} › ${c.name}`]));

  type ExpenseRow = {
    id: string; label: string; amount: unknown; date: Date; kind: string; notes: string | null;
    pettyCashId?: string | null; budgetCategoryId: string | null;
    lines: { id: string; label: string; quantity: unknown; amount: unknown; budgetCategoryId: string | null }[];
    createdBy: { name: string | null } | null;
  };
  const toExpense = (e: ExpenseRow, fromPettyCash?: boolean): GeneralMeansExpense => {
    const lines = e.lines.map((l) => ({
      id: l.id, label: l.label, quantity: toNumber(l.quantity), amount: toNumber(l.amount),
      budgetCategoryId: l.budgetCategoryId,
    }));
    const amount = toNumber(e.amount);
    return {
      id: e.id,
      label: e.label,
      amount,
      date: e.date.toISOString(),
      kind: e.kind as DeptBudgetKind,
      notes: e.notes,
      fromPettyCash: fromPettyCash ?? Boolean(e.pettyCashId),
      documents: docsByExpense.get(e.id) ?? [],
      lines,
      budgetCategoryId: e.budgetCategoryId,
      budgetLabel: e.budgetCategoryId ? categoryPath.get(e.budgetCategoryId) ?? null : null,
      // « À classer » se calcule avec la MÊME règle que le budget : ce qui reste après les
      // articles classés, quand le ticket lui-même n'a pas de case.
      toClassify: !isFullyClassified({ amount, budgetCategoryId: e.budgetCategoryId, lines }),
      createdBy: e.createdBy?.name ?? "",
    };
  };

  const allExpenses = expenses.map((e) => toExpense(e));
  const allocated = budget ? toNumber(budget.amount) : 0;
  // L'ENVELOPPE AFFICHÉE EST CELLE DES MOYENS GÉNÉRAUX. On ne lui soustrait donc QUE les
  // dépenses de cette nature : imputer un achat « budget métier » sur l'enveloppe des moyens
  // généraux faisait fondre celle-ci pour de l'argent qu'elle n'a jamais porté — et faisait
  // diverger cet écran de la page Budgets, qui compte nature par nature.
  const sumOf = (k: DeptBudgetKind): number => toNumber(totals.find((t) => t.kind === k)?._sum.amount ?? 0);
  const consumed = sumOf("OPERATING");
  const otherConsumed = totals
    .filter((t) => t.kind !== "OPERATING")
    .reduce((a, t) => a + toNumber(t._sum.amount ?? 0), 0);

  const cashLines: GeneralMeansExpense[] = (cashHere?.expenses ?? []).map((e) => toExpense(e, true));

  const cash: GeneralMeansCash | null = cashHere
    ? {
        id: cashHere.id,
        period: cashHere.period,
        amount: toNumber(cashHere.amount),
        status: cashHere.status as PettyCashStatus,
        holder: cashHere.holder?.name ?? "",
        holderId: cashHere.holderId,
        receivedAt: cashHere.receivedAt ? cashHere.receivedAt.toISOString() : null,
        note: cashHere.note,
        balance: pettyCashBalance(
          { id: cashHere.id, period: cashHere.period, amount: toNumber(cashHere.amount), status: cashHere.status as PettyCashStatus },
          cashLines,
        ),
        lines: cashLines,
      }
    : null;

  const plan: GeneralMeansPlan | null = planRow
    ? {
        monthlyAmount: toNumber(planRow.monthlyAmount),
        rechargeDay: planRow.rechargeDay,
        holderId: planRow.holderId,
        holder: planRow.holder?.name ?? "",
        isActive: planRow.isActive,
        nextRechargeAt: planRow.isActive ? nextRechargeDate(planRow.rechargeDay, new Date()).toISOString() : null,
      }
    : null;

  return {
    department: {
      id: department.id,
      name: department.name,
      path: department.parent ? `${department.parent.name} › ${department.name}` : department.name,
    },
    year,
    allocated,
    consumed,
    remaining: allocated - consumed,
    otherConsumed,
    expenseCount,
    truncated: expenseCount > LIST_LIMIT,
    // SAISIR UNE DÉPENSE : le droit de module suffit (c'est le geste quotidien de l'acheteur),
    // ou le fait de tenir ce budget. Elle est de toute façon déduite du budget, pièce à l'appui.
    canSpend: userCan(user, "GENERAL_MEANS", "CREATE")
      || editableKindsOn(subject, rights, grant, departmentId).some((k) => k !== "HR"),
    // Doter la caisse et arbitrer : l'administration, les finances — et les RESSOURCES
    // HUMAINES, qui pilotent le module des moyens généraux de tous les départements.
    canAllot: hasGlobalView(user) || rights.canManageBudgets || rights.canManageHr,
    isHolder,
    canAmendCash: isHolder || hasGlobalView(user),
    cash,
    plan,
    topUps: (cashHere?.topUps ?? []).map((t) => ({
      id: t.id,
      amountRequested: toNumber(t.amountRequested),
      amountGranted: t.amountGranted === null ? null : toNumber(t.amountGranted),
      reason: t.reason,
      status: t.status as "PENDING" | "APPROVED" | "REJECTED",
      requester: t.requestedBy?.name ?? "",
      createdAt: t.createdAt.toISOString(),
      decisionNote: t.decisionNote,
    })),
    history: history.map((h) => ({
      id: h.id,
      period: h.period,
      amount: toNumber(h.amount),
      spent: h.expenses.reduce((a, e) => a + toNumber(e.amount), 0),
      status: h.status as PettyCashStatus,
    })),
    expenses: allExpenses,
  };
}
