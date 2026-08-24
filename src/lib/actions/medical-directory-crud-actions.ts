"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getMyCompanies } from "@/lib/company";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LES ANNUAIRES DE PRATICIENS — plusieurs listes nommées, pas une seule.
 *
 * Une entreprise tient « Cardiologues Centre », « Prescripteurs Oncologie », « Congrès 2026 ».
 * Les fondre en un seul annuaire rend chacun inutilisable : on importe trois cents noms pour une
 * campagne, et l'annuaire de tout le monde est pollué pour six mois.
 *
 * Un annuaire RANGE, il n'AUTORISE pas : le cloisonnement par entité et la portée du délégué
 * (`delegateId`) restent les seules règles d'accès. Ranger un praticien dans un annuaire ne
 * l'ouvre à personne de plus.
 */

const PATH = "/medical/annuaire";

async function companyAllowed(userId: string, companyId: string | null): Promise<boolean> {
  if (!companyId) return true;
  const mine = await getMyCompanies(userId);
  return mine.some((c) => c.id === companyId);
}

export async function createMedicalDirectory(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Donnez un nom à l'annuaire." };

  const companyId = fdStr(formData, "companyId");
  if (!(await companyAllowed(user.id, companyId))) return { ok: false, error: "Cette entité n'est pas dans votre périmètre." };

  const created = await prisma.medicalDirectory.create({
    data: { name, description: fdStr(formData, "description"), companyId: companyId || null, createdById: user.id },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Annuaire", entityType: "DOCTOR", entityId: created.id,
    summary: `Annuaire « ${name} » créé`,
  });
  revalidatePath(PATH);
  return { ok: true, id: created.id };
}

/** Renomme un annuaire (et corrige sa description ou son entité). */
export async function updateMedicalDirectory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Annuaire introuvable." };
  const existing = await prisma.medicalDirectory.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return { ok: false, error: "Annuaire introuvable." };

  const companyRaw = formData.get("companyId");
  if (companyRaw != null && !(await companyAllowed(user.id, String(companyRaw) || null))) {
    return { ok: false, error: "Cette entité n'est pas dans votre périmètre." };
  }

  const name = fdStr(formData, "name") || existing.name;
  await prisma.medicalDirectory.update({
    where: { id },
    data: {
      name,
      ...(formData.has("description") ? { description: fdStr(formData, "description") } : {}),
      ...(companyRaw != null ? { companyId: String(companyRaw) || null } : {}),
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Annuaire", entityType: "DOCTOR", entityId: id,
    summary: `Annuaire modifié : ${existing.name}${name !== existing.name ? ` → ${name}` : ""}`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Supprime un annuaire. Ses PRATICIENS ne sont jamais supprimés : ils repassent dans l'annuaire
 * général (`ON DELETE SET NULL`). Ranger trois cents noms dans une liste ne doit pas offrir un
 * moyen de les perdre tous d'un clic.
 */
export async function deleteMedicalDirectory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Annuaire introuvable." };
  const existing = await prisma.medicalDirectory.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return { ok: false, error: "Annuaire introuvable." };

  const count = await prisma.medicalDoctor.count({ where: { directoryId: id } });
  await prisma.medicalDirectory.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Annuaire", entityType: "DOCTOR", entityId: id,
    summary: `Annuaire « ${existing.name} » supprimé — ${count} praticien(s) rendus à l'annuaire général, aucun supprimé`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/** Range un ou plusieurs praticiens dans un annuaire — ou les en sort (`directoryId` vide). */
export async function moveDoctorsToDirectory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const ids = [...new Set(formData.getAll("doctorId").map(String).filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "Aucun praticien sélectionné." };

  const directoryId = fdStr(formData, "directoryId");
  let directoryName = "Annuaire général";
  if (directoryId) {
    const d = await prisma.medicalDirectory.findUnique({ where: { id: directoryId }, select: { name: true } });
    if (!d) return { ok: false, error: "Annuaire introuvable." };
    directoryName = d.name;
  }

  const mine = await getMyCompanies(user.id);
  const movable = await prisma.medicalDoctor.findMany({
    where: { id: { in: ids }, OR: [{ companyId: null }, { companyId: { in: mine.map((c) => c.id) } }] },
    select: { id: true },
  });
  if (movable.length === 0) return { ok: false, error: "Ces praticiens ne sont pas dans votre périmètre." };

  await prisma.medicalDoctor.updateMany({
    where: { id: { in: movable.map((d) => d.id) } },
    data: { directoryId: directoryId || null },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Annuaire",
    summary: `${movable.length} praticien(s) rangé(s) dans « ${directoryName} »`,
  });
  revalidatePath(PATH);
  return { ok: true, message: `${movable.length} praticien(s) rangé(s) dans « ${directoryName} ».` };
}
