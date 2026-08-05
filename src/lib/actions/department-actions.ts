"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getDepartmentSubtreeIds } from "@/lib/departments";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Gestion de la STRUCTURE de l'entreprise (départements et sous-départements, N niveaux)
 * depuis le module Ressources humaines. Réservée aux RH (droit RH:UPDATE) — c'est le DRH
 * qui possède l'organisation, pas l'administration technique.
 */

const DENIED: ActionResult = { ok: false, error: "Réservé aux ressources humaines." };
const RH_PATHS = ["/rh", "/rh/departements", "/admin/organigramme"];
const revalidateAll = () => RH_PATHS.forEach((p) => revalidatePath(p));

function canManageStructure(user: Awaited<ReturnType<typeof requireUser>>): boolean {
  return userCan(user, "RH", "UPDATE");
}

/** Code technique dérivé d'un nom (MAJUSCULES, sans accents, séparateurs → « _ »). */
function codeFromName(s: string): string {
  const base = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return base || "DEPT";
}

async function uniqueCode(base: string, exceptId?: string): Promise<string> {
  let code = base;
  for (let n = 2; n < 100; n++) {
    const clash = await prisma.department.findFirst({ where: { code, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return code;
    code = `${base}_${n}`;
  }
  return `${base}_${Date.now()}`;
}

/** Le libellé texte de l'employé est un CACHE du département : on le tient à jour. */
async function syncMemberLabels(departmentId: string, name: string): Promise<void> {
  await prisma.employee.updateMany({ where: { departmentId }, data: { department: name } });
}

// ─────────────────────────────── Départements ───────────────────────────────

/** Crée un département (racine si `parentId` vide) ou un sous-département, à N niveaux. */
export async function createDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageStructure(user)) return DENIED;
  const name = fdStr(formData, "name")?.trim();
  if (!name) return { ok: false, error: "Le nom du département est obligatoire." };
  if (await prisma.department.findUnique({ where: { name }, select: { id: true } })) {
    return { ok: false, error: "Un département porte déjà ce nom." };
  }

  const parentId = fdStr(formData, "parentId") || null;
  if (parentId && !(await prisma.department.findUnique({ where: { id: parentId }, select: { id: true } }))) {
    return { ok: false, error: "Département parent introuvable." };
  }

  const code = await uniqueCode(codeFromName(fdStr(formData, "code") || name));
  const created = await prisma.department.create({
    data: {
      name, code, parentId,
      description: fdStr(formData, "description"),
      headId: fdStr(formData, "headId") || null,
      deputyId: fdStr(formData, "deputyId") || null,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines",
    summary: `${parentId ? "Sous-département" : "Département"} « ${name} » créé`,
  });
  revalidateAll();
  return { ok: true, id: created.id };
}

/**
 * Modifie un département : nom, code, description, RESPONSABLE, ADJOINT et rattachement.
 * Le re-rattachement interdit les CYCLES (un département ne peut pas devenir l'enfant de
 * l'un de ses propres descendants).
 */
export async function updateDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageStructure(user)) return DENIED;
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name")?.trim();
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  const dept = await prisma.department.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!dept) return { ok: false, error: "Département introuvable." };
  if (await prisma.department.findFirst({ where: { name, NOT: { id } }, select: { id: true } })) {
    return { ok: false, error: "Un autre département porte déjà ce nom." };
  }

  const parentId = fdStr(formData, "parentId") || null;
  if (parentId) {
    if (parentId === id) return { ok: false, error: "Un département ne peut pas être son propre parent." };
    const descendants = await getDepartmentSubtreeIds(id);
    if (descendants.includes(parentId)) {
      return { ok: false, error: "Rattachement impossible : la cible est un sous-département de celui-ci (cycle)." };
    }
    if (!(await prisma.department.findUnique({ where: { id: parentId }, select: { id: true } }))) {
      return { ok: false, error: "Département parent introuvable." };
    }
  }

  const code = fdStr(formData, "code") ? await uniqueCode(codeFromName(fdStr(formData, "code")!), id) : undefined;
  await prisma.department.update({
    where: { id },
    data: {
      name, parentId,
      description: fdStr(formData, "description"),
      headId: fdStr(formData, "headId") || null,
      deputyId: fdStr(formData, "deputyId") || null,
      ...(code ? { code } : {}),
    },
  });
  if (name !== dept.name) await syncMemberLabels(id, name);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines",
    summary: `Département « ${name} » modifié`,
  });
  revalidateAll();
  return { ok: true };
}

/**
 * Supprime un département. Ses SOUS-DÉPARTEMENTS remontent d'un cran (rattachés au parent
 * du supprimé, donc jamais orphelins) et ses membres repassent « non affectés ».
 */
export async function deleteDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageStructure(user)) return DENIED;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const dept = await prisma.department.findUnique({ where: { id }, select: { name: true, parentId: true } });
  if (!dept) return { ok: false, error: "Département introuvable." };

  await prisma.employee.updateMany({ where: { departmentId: id }, data: { departmentId: null, department: null } });
  await prisma.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
  // Les enfants remontent au parent du département supprimé (pas d'orphelin).
  await prisma.department.updateMany({ where: { parentId: id }, data: { parentId: dept.parentId } });
  await prisma.department.delete({ where: { id } });

  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Ressources humaines",
    summary: `Département « ${dept.name} » supprimé`,
  });
  revalidateAll();
  return { ok: true };
}

// ─────────────────────── Rattachement des personnes ───────────────────────

/**
 * Rattache un EMPLOYÉ à un département (ou l'en détache si vide). Met à jour le cache de
 * libellé et propage au compte applicatif lié (les permissions/notifications lisent `User`).
 */
export async function assignEmployeeDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageStructure(user)) return DENIED;
  const employeeId = fdStr(formData, "employeeId");
  if (!employeeId) return { ok: false, error: "Employé manquant." };
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, fullName: true, userId: true } });
  if (!employee) return { ok: false, error: "Employé introuvable." };

  const departmentId = fdStr(formData, "departmentId") || null;
  let label: string | null = null;
  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    if (!dept) return { ok: false, error: "Département introuvable." };
    label = dept.name;
  }

  await prisma.employee.update({ where: { id: employeeId }, data: { departmentId, department: label } });
  if (employee.userId) await prisma.user.update({ where: { id: employee.userId }, data: { departmentId } });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines",
    entityType: "EMPLOYEE", entityId: employeeId, field: "department", newValue: label ?? "—",
    summary: `${employee.fullName} → ${label ?? "non affecté"}`,
  });
  revalidateAll();
  revalidatePath(`/rh/${employeeId}`);
  return { ok: true };
}

/** Définit le MANAGER explicite (N+1) d'un employé — prioritaire sur le responsable de département. */
export async function assignEmployeeManager(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageStructure(user)) return DENIED;
  const employeeId = fdStr(formData, "employeeId");
  if (!employeeId) return { ok: false, error: "Employé manquant." };
  const managerId = fdStr(formData, "managerId") || null;
  if (managerId === employeeId) return { ok: false, error: "Un employé ne peut pas être son propre responsable." };

  // Anti-cycle : la cible ne doit pas déjà dépendre de cet employé.
  if (managerId) {
    let cur: string | null = managerId;
    for (let i = 0; i < 20 && cur; i++) {
      if (cur === employeeId) return { ok: false, error: "Rattachement impossible : cela créerait une boucle hiérarchique." };
      const up: { managerId: string | null } | null = await prisma.employee.findUnique({ where: { id: cur }, select: { managerId: true } });
      cur = up?.managerId ?? null;
    }
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fullName: true } });
  if (!employee) return { ok: false, error: "Employé introuvable." };
  await prisma.employee.update({ where: { id: employeeId }, data: { managerId } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines",
    entityType: "EMPLOYEE", entityId: employeeId, field: "managerId",
    summary: `Responsable hiérarchique de ${employee.fullName} mis à jour`,
  });
  revalidateAll();
  revalidatePath(`/rh/${employeeId}`);
  return { ok: true };
}
