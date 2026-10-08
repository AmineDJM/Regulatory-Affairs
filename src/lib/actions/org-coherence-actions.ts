"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { alignerSurLaFiche, alignerTousLesComptes, alignerLibellesDuDepartement } from "@/lib/org/source-unique";
import { chargerOrganigramme } from "@/lib/org/coherence-donnees";
import { superviseurPropose } from "@/lib/org/coherence";

/**
 * LE CONTRÔLE DE COHÉRENCE DE L'ORGANIGRAMME — les corrections d'un clic (Direction, 10/2026). Super Admin seul, comme
 * le réarrangement de l'organigramme ; chaque correction est auditée. L'organigramme est la seule source : on aligne
 * TOUJOURS la copie sur lui, jamais l'inverse.
 */

const REFUS: ActionResult = { ok: false, error: "Réservé au Super Admin." };
const chemins = () => { revalidatePath("/organigramme"); revalidatePath("/business-units", "layout"); revalidatePath("/rh/departements"); };

/** Un compte aligné sur le département de sa fiche salarié. */
export async function alignerCompteSurFiche(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return REFUS;
  const employeeId = fdStr(formData, "employeeId");
  if (!employeeId) return { ok: false, error: "Fiche introuvable." };
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { fullName: true } });
  if (!e) return { ok: false, error: "Fiche introuvable." };
  await alignerSurLaFiche(employeeId);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Organigramme", entityType: "EMPLOYEE", entityId: employeeId, summary: `Compte de ${e.fullName} aligné sur sa fiche (contrôle de cohérence)` });
  chemins();
  return { ok: true };
}

/** Tous les comptes et tous les libellés alignés sur l'organigramme, d'un geste. */
export async function alignerToutSurOrganigramme(formData: FormData): Promise<ActionResult> {
  void formData;
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return REFUS;
  const comptes = await alignerTousLesComptes();
  const departements = await prisma.department.findMany({ select: { id: true } });
  for (const d of departements) await alignerLibellesDuDepartement(d.id);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Organigramme", summary: `Contrôle de cohérence : ${comptes} compte(s) et les libellés alignés sur l'organigramme` });
  chemins();
  return { ok: true, message: `${comptes} compte(s) corrigé(s).` };
}

/** Rattache une Business Unit à son département. */
export async function rattacherBuAuDepartement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return REFUS;
  const businessUnitId = fdStr(formData, "businessUnitId");
  const departmentId = fdStr(formData, "departmentId");
  if (!businessUnitId || !departmentId) return { ok: false, error: "Choisissez le département." };
  const [bu, dep] = await Promise.all([
    prisma.businessUnit.findUnique({ where: { id: businessUnitId }, select: { name: true } }),
    prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } }),
  ]);
  if (!bu || !dep) return { ok: false, error: "BU ou département introuvable." };
  await prisma.businessUnit.update({ where: { id: businessUnitId }, data: { departmentId } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Organigramme", entityType: "BUSINESS_UNIT", entityId: businessUnitId, field: "departmentId", newValue: dep.name, summary: `BU « ${bu.name} » rattachée à « ${dep.name} »` });
  chemins();
  return { ok: true };
}

/** Désigne le responsable d'un département. */
export async function designerResponsableDepartement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return REFUS;
  const departmentId = fdStr(formData, "departmentId");
  const employeeId = fdStr(formData, "employeeId");
  if (!departmentId || !employeeId) return { ok: false, error: "Choisissez le responsable." };
  const [dep, e] = await Promise.all([
    prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { fullName: true, isActive: true } }),
  ]);
  if (!dep || !e || !e.isActive) return { ok: false, error: "Département ou personne introuvable." };
  await prisma.department.update({ where: { id: departmentId }, data: { headId: employeeId } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Organigramme", entityType: "EMPLOYEE", entityId: employeeId, field: "headId", newValue: dep.name, summary: `${e.fullName} désigné(e) responsable de « ${dep.name} »` });
  chemins();
  return { ok: true };
}

/** Le superviseur d'une BU remplacé par celui que propose l'organigramme (le responsable de son département). */
export async function appliquerSuperviseurPropose(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return REFUS;
  const businessUnitId = fdStr(formData, "businessUnitId");
  if (!businessUnitId) return { ok: false, error: "BU introuvable." };
  const d = await chargerOrganigramme();
  const bu = d.bus.find((b) => b.id === businessUnitId);
  if (!bu) return { ok: false, error: "BU introuvable." };
  const propose = superviseurPropose(bu, d.departements, d.employes);
  if (!propose) return { ok: false, error: "L'organigramme ne propose personne : rattachez la BU à un département qui a un responsable." };
  await prisma.businessUnit.update({ where: { id: businessUnitId }, data: { supervisorId: propose } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Organigramme", entityType: "BUSINESS_UNIT", entityId: businessUnitId, field: "supervisorId", newValue: propose, summary: `Superviseur de la BU « ${bu.name} » aligné sur l'organigramme` });
  chemins();
  return { ok: true };
}
