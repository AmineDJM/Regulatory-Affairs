"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  canSetDepartmentBudget, canEditDepartmentBudget, canManageDepartmentBudgetAccess,
  mergeGrants, normalizeAmount, normalizeYear, DEPT_BUDGET_LABEL, EMPTY_GRANT,
  type DeptBudgetKind, type BudgetSetter, type DeptBudgetGrant, type GrantSubject,
} from "@/lib/department-budget";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const PATH = "/budgets/departements";

/** Le porteur de droits, tel que le module pur l'attend. */
function setterOf(user: { role: string; secondaryRole?: string | null; id: string }): BudgetSetter {
  const u = user as Parameters<typeof userCan>[0];
  return {
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    canManageBudgets: userCan(u, "BUDGETS", "UPDATE") || userCan(u, "BUDGETS", "VALIDATE"),
    canManageHr: userCan(u, "RH", "UPDATE"),
  };
}

function subjectOf(user: { id: string; role: string; secondaryRole?: string | null }): GrantSubject {
  return { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null };
}

/** Autorisations applicables à un département : la règle générale PLUS la sienne. */
async function grantFor(departmentId: string): Promise<DeptBudgetGrant> {
  const rows = await prisma.departmentBudgetAccess.findMany({
    where: { OR: [{ departmentId }, { departmentId: null }] },
  });
  const pick = (r: (typeof rows)[number] | undefined): DeptBudgetGrant | null =>
    r ? {
      accessRoles: r.accessRoles, accessUserIds: r.accessUserIds,
      operatingRoles: r.operatingRoles, operatingUserIds: r.operatingUserIds,
      hrRoles: r.hrRoles, hrUserIds: r.hrUserIds,
    } : null;
  return mergeGrants(pick(rows.find((r) => r.departmentId === null)), pick(rows.find((r) => r.departmentId === departmentId)));
}

/** Cases cochées d'un formulaire, dédoublonnées et débarrassées des valeurs vides. */
function list(formData: FormData, name: string): string[] {
  return Array.from(new Set(formData.getAll(name).filter((v): v is string => typeof v === "string" && v.trim().length > 0)));
}

/**
 * AUTORISATIONS — qui voit, qui édite quoi, sur quel département.
 *
 * Réservé au **Super Admin** : régler les deux budgets ne donne pas le droit de régler QUI y a
 * accès. `departmentId` vide = la règle GÉNÉRALE, valable pour tous les départements.
 *
 * Les listes remplacent celles de la règle concernée — c'est un formulaire de cases à cocher,
 * décocher doit retirer. Mais une règle n'en écrase jamais une autre : la générale et celle du
 * département restent deux lignes distinctes, cumulées à la lecture.
 */
export async function setDepartmentBudgetAccess(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageDepartmentBudgetAccess(setterOf(user))) {
    return { ok: false, error: "Régler les accès aux budgets départementaux est réservé au Super Admin." };
  }

  const raw = fdStr(formData, "departmentId");
  const departmentId = raw && raw !== "__GENERAL__" ? raw : null;

  let label = "tous les départements";
  if (departmentId) {
    const d = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    if (!d) return { ok: false, error: "Département introuvable." };
    label = d.name;
  }

  const data = {
    accessRoles: list(formData, "accessRoles"),
    accessUserIds: list(formData, "accessUserIds"),
    operatingRoles: list(formData, "operatingRoles"),
    operatingUserIds: list(formData, "operatingUserIds"),
    hrRoles: list(formData, "hrRoles"),
    hrUserIds: list(formData, "hrUserIds"),
  };

  // `upsert` sur `departmentId` ne marche pas pour la règle générale : `null` n'est pas une
  // clé unique exploitable côté Prisma (deux NULL ne s'égalent pas en SQL). L'unicité est bien
  // garantie en base par un index partiel — ici on cherche puis on écrit.
  if (departmentId) {
    await prisma.departmentBudgetAccess.upsert({
      where: { departmentId },
      create: { departmentId, ...data, setById: user.id },
      update: { ...data, setById: user.id },
    });
  } else {
    const existing = await prisma.departmentBudgetAccess.findFirst({ where: { departmentId: null }, select: { id: true } });
    if (existing) await prisma.departmentBudgetAccess.update({ where: { id: existing.id }, data: { ...data, setById: user.id } });
    else await prisma.departmentBudgetAccess.create({ data: { departmentId: null, ...data, setById: user.id } });
  }

  const count = Object.values(data).reduce((n, l) => n + l.length, 0);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET",
    entityId: departmentId ?? "general",
    summary: `Accès au budget — ${label} : ${count === 0 ? "toutes les autorisations retirées" : `${count} autorisation(s)`}`,
  });

  revalidatePath(PATH);
  return { ok: true, id: departmentId ?? "general" };
}

/**
 * Règle le budget d'un département pour une année et une nature.
 *
 * Le droit est vérifié PAR NATURE : c'est tout l'objet du dispositif. L'administrateur qui
 * tenterait de fixer la masse salariale se voit refuser, et réciproquement — même si les deux
 * cases sont dans le même tableau.
 */
export async function setDepartmentBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const departmentId = fdStr(formData, "departmentId");
  const rawKind = fdStr(formData, "kind");
  if (!departmentId || (rawKind !== "OPERATING" && rawKind !== "HR")) return { ok: false, error: "Paramètres manquants." };
  const kind: DeptBudgetKind = rawKind;

  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  // Le droit se vérifie SUR CE DÉPARTEMENT : le socle par rôle, plus l'autorisation que le
  // Super Admin a éventuellement posée ici ou en règle générale. On relit les règles au moment
  // d'écrire — celles affichées à l'ouverture de l'écran ont pu changer depuis.
  const grant = await grantFor(departmentId);
  if (!canEditDepartmentBudget(subjectOf(user), setterOf(user), kind, grant)) {
    return {
      ok: false,
      error: kind === "HR"
        ? "Le budget des employés est réglé par les ressources humaines, ou par les personnes que le Super Admin a autorisées."
        : "Le budget de fonctionnement est réglé par l'administrateur, ou par les personnes que le Super Admin a autorisées.",
    };
  }

  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  const year = normalizeYear(fdStr(formData, "year"));
  const notes = fdStr(formData, "notes");

  const before = await prisma.departmentBudget.findUnique({
    where: { departmentId_year_kind: { departmentId, year, kind } },
    select: { amount: true },
  });

  await prisma.departmentBudget.upsert({
    where: { departmentId_year_kind: { departmentId, year, kind } },
    create: { departmentId, year, kind, amount, notes, setById: user.id },
    update: { amount, notes, setById: user.id },
  });

  const previous = before ? Number(before.amount) : null;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: departmentId,
    summary: `Budget ${DEPT_BUDGET_LABEL[kind]} ${year} — ${department.name} : ${previous ?? "—"} → ${amount} DZD`,
  });

  revalidatePath(PATH);
  revalidatePath("/budgets");
  return { ok: true, id: departmentId };
}
