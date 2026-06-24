"use server";

import { revalidatePath } from "next/cache";
import type { InfluenceLevel, Priority, VisitStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

export async function createDoctor(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom du médecin est obligatoire." };

  // A delegate owns the doctors they create; a manager may assign one.
  const delegateId = user.role === "MEDICAL_DELEGATE" ? user.id : fdStr(formData, "delegateId") ?? null;

  const created = await prisma.medicalDoctor.create({
    data: {
      name,
      specialty: fdStr(formData, "specialty"),
      institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"),
      region: fdStr(formData, "region"),
      phone: fdStr(formData, "phone"),
      email: fdStr(formData, "email"),
      influenceLevel: (fdStr(formData, "influenceLevel") as InfluenceLevel) ?? "MEDIUM",
      prescriptionPotential: (fdStr(formData, "prescriptionPotential") as Priority) ?? "MEDIUM",
      targetProducts: fdStr(formData, "targetProducts"),
      delegateId,
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Promotion médicale",
    entityType: "DOCTOR", entityId: created.id, summary: `Médecin « ${name} »`,
  });
  revalidatePath("/medical");
  return { ok: true, id: created.id };
}

export async function createVisit(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé." };

  const doctorId = fdStr(formData, "doctorId");
  const delegateId = user.role === "MEDICAL_DELEGATE" ? user.id : fdStr(formData, "delegateId") ?? user.id;

  const created = await prisma.medicalVisit.create({
    data: {
      date: fdDate(formData, "date") ?? new Date(),
      doctorId,
      delegateId,
      region: fdStr(formData, "region"),
      objective: fdStr(formData, "objective"),
      presentedProducts: fdStr(formData, "presentedProducts"),
      status: (fdStr(formData, "status") as VisitStatus) ?? "PLANNED",
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: created.id, summary: `Visite planifiée`,
  });
  revalidatePath("/medical");
  return { ok: true, id: created.id };
}

export async function updateVisit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Visite introuvable." };
  if (!(await canAccessEntity(user, "VISIT", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const before = await prisma.medicalVisit.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Visite introuvable." };
  const status = (fdStr(formData, "status") as VisitStatus) ?? before.status;

  await prisma.medicalVisit.update({
    where: { id },
    data: {
      status,
      report: fdStr(formData, "report"),
      doctorFeedback: fdStr(formData, "doctorFeedback"),
      followUpActions: fdStr(formData, "followUpActions"),
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "VISIT", entityId: id, field: "status", oldValue: before.status, newValue: status,
    summary: "Compte rendu de visite",
  });
  revalidatePath("/medical");
  return { ok: true };
}
