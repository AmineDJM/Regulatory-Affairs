"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma, type EntityType, type DoctorTitle, type MedicalSector } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Personnes prises en charge d'un congrès (national/international) + demande de
 * leurs pièces d'identité. La liste est stockée en JSON sur le congrès ; les
 * pièces d'identité sont des Documents (catégorie ID_DOCUMENT) du congrès.
 */
type Kind = "INTERNATIONAL" | "NATIONAL";
interface Benef { id: string; name: string; role?: string; doctorId?: string; institution?: string }

function entityTypeOf(kind: Kind): EntityType {
  return kind === "INTERNATIONAL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL";
}
function pathOf(kind: Kind, id: string): string {
  return `/${kind === "INTERNATIONAL" ? "congress-international" : "congress-national"}/${id}`;
}
async function loadCongress(kind: Kind, id: string) {
  const select = { id: true, name: true, beneficiaries: true, requesterId: true } as const;
  return kind === "INTERNATIONAL"
    ? prisma.congressInternational.findUnique({ where: { id }, select })
    : prisma.congressNational.findUnique({ where: { id }, select });
}
async function saveBeneficiaries(kind: Kind, id: string, list: Benef[]) {
  const data = { beneficiaries: list as unknown as Prisma.InputJsonValue };
  if (kind === "INTERNATIONAL") await prisma.congressInternational.update({ where: { id }, data });
  else await prisma.congressNational.update({ where: { id }, data });
}
function asList(value: unknown): Benef[] {
  return Array.isArray(value) ? (value as Benef[]) : [];
}

export async function addCongressBeneficiary(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind") as Kind;
  const id = fdStr(formData, "id");
  const et = entityTypeOf(kind);
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!(await canAccessEntity(user, et, id, "UPDATE"))) return { ok: false, error: "Modification non autorisée." };
  const c = await loadCongress(kind, id);
  if (!c) return { ok: false, error: "Congrès introuvable." };

  const role = fdStr(formData, "role") ?? undefined;
  let benef: Benef;

  const existingDoctorId = fdStr(formData, "doctorId");
  if (fdStr(formData, "createDoctor") === "on") {
    // Création inline d'un profil médecin dans l'annuaire, puis rattachement.
    const name = fdStr(formData, "name");
    if (!name) return { ok: false, error: "Le nom du médecin est obligatoire." };
    const institutionId = fdStr(formData, "institutionId") || null;
    const inst = institutionId ? await prisma.medicalInstitution.findUnique({ where: { id: institutionId }, select: { name: true } }) : null;
    const spec = fdStr(formData, "specialtyId")
      ? await prisma.medicalSpecialty.findUnique({ where: { id: fdStr(formData, "specialtyId")! }, select: { name: true } })
      : null;
    const SECTORS: MedicalSector[] = ["HOSPITAL", "LIBERAL", "BOTH"];
    const sectorRaw = fdStr(formData, "sector");
    const titleRaw = fdStr(formData, "title");
    const doctor = await prisma.medicalDoctor.create({
      data: {
        name,
        title: titleRaw ? (titleRaw as DoctorTitle) : undefined,
        sector: sectorRaw && SECTORS.includes(sectorRaw as MedicalSector) ? (sectorRaw as MedicalSector) : undefined,
        specialtyId: fdStr(formData, "specialtyId") || null,
        specialty: spec?.name ?? null,
        institutionId,
        institution: inst?.name ?? null,
        createdById: user.id,
      },
      select: { id: true, name: true, institution: true },
    });
    benef = { id: randomUUID(), name: doctor.name, role, doctorId: doctor.id, institution: doctor.institution ?? undefined };
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Promotion médicale", entityType: "DOCTOR", entityId: doctor.id, summary: `Médecin « ${doctor.name} » créé depuis un congrès` });
  } else if (existingDoctorId) {
    // Rattachement d'un praticien existant de l'annuaire.
    const doctor = await prisma.medicalDoctor.findUnique({ where: { id: existingDoctorId }, select: { id: true, name: true, institution: true } });
    if (!doctor) return { ok: false, error: "Praticien introuvable." };
    benef = { id: randomUUID(), name: doctor.name, role, doctorId: doctor.id, institution: doctor.institution ?? undefined };
  } else {
    // Personne libre (pas de profil médecin).
    const name = fdStr(formData, "name");
    if (!name) return { ok: false, error: "Le nom de la personne est obligatoire." };
    benef = { id: randomUUID(), name, role };
  }

  const list = asList(c.beneficiaries);
  list.push(benef);
  await saveBeneficiaries(kind, id, list);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: et, entityId: id, summary: `Personne prise en charge ajoutée — ${benef.name}` });
  revalidatePath(pathOf(kind, id));
  return { ok: true };
}

/** Référentiel pour le sélecteur de praticiens / la création inline (annuaire, spécialités, établissements). */
export async function listBeneficiaryRefs(): Promise<{
  doctors: { id: string; name: string; institution: string | null; specialty: string | null }[];
  specialties: { id: string; name: string }[];
  institutions: { id: string; name: string; city: string | null }[];
}> {
  await requireUser();
  const [doctors, specialties, institutions] = await Promise.all([
    prisma.medicalDoctor.findMany({ select: { id: true, name: true, institution: true, specialty: true }, orderBy: { name: "asc" }, take: 2000 }),
    prisma.medicalSpecialty.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.medicalInstitution.findMany({ where: { isActive: true }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
  ]);
  return { doctors, specialties, institutions };
}

export async function removeCongressBeneficiary(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind") as Kind;
  const id = fdStr(formData, "id");
  const benefId = fdStr(formData, "benefId");
  if (!id || !benefId) return { ok: false, error: "Identifiant manquant." };
  const et = entityTypeOf(kind);
  if (!(await canAccessEntity(user, et, id, "UPDATE"))) return { ok: false, error: "Modification non autorisée." };
  const c = await loadCongress(kind, id);
  if (!c) return { ok: false, error: "Congrès introuvable." };

  const list = asList(c.beneficiaries).filter((b) => b.id !== benefId);
  await saveBeneficiaries(kind, id, list);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: et, entityId: id, summary: "Personne prise en charge retirée" });
  revalidatePath(pathOf(kind, id));
  return { ok: true };
}

/** Demande au demandeur de joindre les pièces d'identité des personnes prises en charge. */
export async function requestBeneficiaryIds(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind") as Kind;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const et = entityTypeOf(kind);
  if (!(await canAccessEntity(user, et, id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  const c = await loadCongress(kind, id);
  if (!c) return { ok: false, error: "Congrès introuvable." };
  if (c.requesterId) {
    await notifyUser({ userId: c.requesterId, type: "ASSIGNMENT", title: "Pièces d'identité demandées", body: `${c.name} — merci de joindre les pièces d'identité des personnes prises en charge.`, link: pathOf(kind, id) });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: et, entityId: id, summary: "Pièces d'identité demandées" });
  revalidatePath(pathOf(kind, id));
  return { ok: true };
}
