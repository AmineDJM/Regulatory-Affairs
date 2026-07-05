"use server";

import { revalidatePath } from "next/cache";
import type { DoctorTitle, InfluenceLevel, MedicalSector, Priority, SegmentLevel, VisitStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

const SECTORS: MedicalSector[] = ["HOSPITAL", "LIBERAL", "BOTH"];
const TITLES: DoctorTitle[] = [
  "PROFESSEUR", "MAITRE_CONFERENCES", "MAITRE_ASSISTANT", "PRATICIEN_SPECIALISTE",
  "ASSISTANT", "RESIDENT", "GENERALISTE", "PHARMACIEN", "AUTRE",
];

/** Résout le nom d'une spécialité (dénormalisé sur le médecin → la cascade
 *  Congrès qui lit `doctor.specialty` continue de fonctionner sans changement). */
async function specialtyName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const s = await prisma.medicalSpecialty.findUnique({ where: { id }, select: { name: true } });
  return s?.name ?? null;
}

function parseSector(v: string | null): MedicalSector {
  return v && SECTORS.includes(v as MedicalSector) ? (v as MedicalSector) : "LIBERAL";
}
const SEGMENTS: SegmentLevel[] = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"];
function parseSegment(v: string | null): SegmentLevel {
  return v && SEGMENTS.includes(v as SegmentLevel) ? (v as SegmentLevel) : "MEDIUM";
}
/** Mappe l'échelle 5 niveaux vers les anciens champs (cohérence des lecteurs hérités). */
const segToInfluence: Record<SegmentLevel, InfluenceLevel> = {
  VERY_HIGH: "KEY_OPINION_LEADER", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", VERY_LOW: "LOW",
};
const segToPriority: Record<SegmentLevel, Priority> = {
  VERY_HIGH: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", VERY_LOW: "LOW",
};
function parseTitle(v: string | null): DoctorTitle {
  return v && TITLES.includes(v as DoctorTitle) ? (v as DoctorTitle) : "AUTRE";
}

// ─────────────────────────── Spécialités ───────────────────────────

export async function createSpecialty(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de la spécialité est obligatoire." };
  const existing = await prisma.medicalSpecialty.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (existing) return { ok: false, error: "Cette spécialité existe déjà." };
  const created = await prisma.medicalSpecialty.create({
    data: { name, color: fdStr(formData, "color"), notes: fdStr(formData, "notes"), createdById: user.id },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Promotion médicale", summary: `Spécialité « ${name} »` });
  revalidatePath("/medical");
  return { ok: true, id: created.id };
}

export async function updateSpecialty(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  await prisma.medicalSpecialty.update({ where: { id }, data: { name, color: fdStr(formData, "color"), notes: fdStr(formData, "notes") } });
  // Re-synchronise le libellé dénormalisé sur les médecins rattachés.
  await prisma.medicalDoctor.updateMany({ where: { specialtyId: id }, data: { specialty: name } });
  revalidatePath("/medical");
  return { ok: true };
}

export async function deleteSpecialty(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  // Le FK est SetNull : les médecins basculent en « Sans spécialité » (non supprimés).
  await prisma.medicalDoctor.updateMany({ where: { specialtyId: id }, data: { specialty: null } });
  await prisma.medicalSpecialty.delete({ where: { id } });
  revalidatePath("/medical");
  return { ok: true };
}

// ─────────────────────────── Médecins ───────────────────────────

/** Supprime un médecin de l'annuaire (MEDICAL:DELETE). Ses visites sont supprimées
 *  en cascade ; il est retiré des listes d'invités de congrès (IDs orphelins ignorés). */
export async function deleteDoctor(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "DELETE")) return { ok: false, error: "Suppression réservée (droit Supprimer sur Promotion médicale)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const doc = await prisma.medicalDoctor.findUnique({ where: { id }, select: { name: true } });
  if (!doc) return { ok: false, error: "Médecin introuvable." };
  await prisma.medicalVisit.deleteMany({ where: { doctorId: id } });
  await prisma.medicalDoctor.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Promotion médicale", entityType: "DOCTOR", entityId: id, summary: `Médecin supprimé — ${doc.name}` });
  revalidatePath("/medical");
  return { ok: true };
}

/** Supprime une visite (MEDICAL:DELETE, ou le délégué auteur de la visite). */
export async function deleteVisit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const visit = await prisma.medicalVisit.findUnique({ where: { id }, select: { delegateId: true, doctor: { select: { name: true } } } });
  if (!visit) return { ok: false, error: "Visite introuvable." };
  if (!userCan(user, "MEDICAL", "DELETE") && visit.delegateId !== user.id) return { ok: false, error: "Non autorisé." };
  await prisma.medicalVisit.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Promotion médicale", entityType: "VISIT", entityId: id, summary: `Visite supprimée — ${visit.doctor?.name ?? ""}` });
  revalidatePath("/medical");
  return { ok: true };
}


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
  const specialtyId = fdStr(formData, "specialtyId");
  const sName = await specialtyName(specialtyId);

  const created = await prisma.medicalDoctor.create({
    data: {
      name,
      title: parseTitle(fdStr(formData, "title")),
      specialtyId,
      specialty: sName ?? fdStr(formData, "specialty"),
      sector: parseSector(fdStr(formData, "sector")),
      institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"),
      region: fdStr(formData, "region"),
      phone: fdStr(formData, "phone"),
      email: fdStr(formData, "email"),
      influence: parseSegment(fdStr(formData, "influence")),
      potential: parseSegment(fdStr(formData, "potential")),
      affinity: parseSegment(fdStr(formData, "affinity")),
      // Champs hérités tenus cohérents avec l'échelle 5 niveaux.
      influenceLevel: segToInfluence[parseSegment(fdStr(formData, "influence"))],
      prescriptionPotential: segToPriority[parseSegment(fdStr(formData, "potential"))],
      targetProducts: fdStr(formData, "targetProducts"),
      comments: fdStr(formData, "comments"),
      delegateId,
      companyId: fdStr(formData, "companyId") || null,
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

export async function updateDoctor(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Médecin introuvable." };
  if (!(await canAccessEntity(user, "DOCTOR", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  const before = await prisma.medicalDoctor.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Médecin introuvable." };

  const name = fdStr(formData, "name") ?? before.name;
  const specialtyId = fdStr(formData, "specialtyId");
  const sName = await specialtyName(specialtyId);
  // Un manager (vue globale) peut réassigner le délégué ; un délégué reste propriétaire.
  const isManager = user.role !== "MEDICAL_DELEGATE";

  await prisma.medicalDoctor.update({
    where: { id },
    data: {
      name,
      title: parseTitle(fdStr(formData, "title")),
      specialtyId,
      specialty: sName ?? (specialtyId ? before.specialty : fdStr(formData, "specialty")),
      sector: parseSector(fdStr(formData, "sector")),
      institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"),
      region: fdStr(formData, "region"),
      phone: fdStr(formData, "phone"),
      email: fdStr(formData, "email"),
      influence: parseSegment(fdStr(formData, "influence") ?? before.influence),
      potential: parseSegment(fdStr(formData, "potential") ?? before.potential),
      affinity: parseSegment(fdStr(formData, "affinity") ?? before.affinity),
      influenceLevel: segToInfluence[parseSegment(fdStr(formData, "influence") ?? before.influence)],
      prescriptionPotential: segToPriority[parseSegment(fdStr(formData, "potential") ?? before.potential)],
      targetProducts: fdStr(formData, "targetProducts"),
      comments: fdStr(formData, "comments"),
      companyId: fdStr(formData, "companyId") || null,
      ...(isManager ? { delegateId: fdStr(formData, "delegateId") } : {}),
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Promotion médicale",
    entityType: "DOCTOR", entityId: id, summary: `Médecin « ${name} » mis à jour`,
  });
  revalidatePath("/medical");
  return { ok: true };
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
