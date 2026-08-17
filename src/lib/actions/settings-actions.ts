"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import { fdNum, type ActionResult } from "@/lib/actions/types";

/** Réglages d'instance (limites de taille d'upload). **Super Admin uniquement.** */
export async function saveAppSettings(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const clamp = (v: number | null, def: number, max = 2048) => (v === null ? def : Math.max(1, Math.min(max, Math.round(v))));
  // Documents (via Server Action) : plafonné à 256 Mo = la limite de corps de Next (next.config).
  const maxUploadMb = clamp(fdNum(formData, "maxUploadMb"), DEFAULT_APP_SETTINGS.maxUploadMb, 256);
  const maxDriveUploadMb = clamp(fdNum(formData, "maxDriveUploadMb"), DEFAULT_APP_SETTINGS.maxDriveUploadMb);

  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", maxUploadMb, maxDriveUploadMb, updatedById: admin.id },
    update: { maxUploadMb, maxDriveUploadMb, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Limites d'upload — Documents ${maxUploadMb} Mo, Drive ${maxDriveUploadMb} Mo`,
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Débloque / masque l'onglet Regulatory « Enregistrement » (analyseur CTD). **Super Admin uniquement.** */
export async function setRegEnrollmentEnabled(enabled: boolean): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", regEnrollmentEnabled: enabled, updatedById: admin.id },
    update: { regEnrollmentEnabled: enabled, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Onglet Regulatory « Enregistrement » ${enabled ? "débloqué" : "masqué"}`,
  });
  revalidatePath("/admin");
  revalidatePath("/regulatory");
  return { ok: true };
}

/**
 * Rôles « superviseurs Regulatory » (en plus du Super Admin) : fixent priorité et dates
 * cibles, reçoivent les notifications (nouveau dossier / dépôt) et demandent des MàJ de
 * statut. **Super Admin uniquement.**
 */
export async function setRegulatorySupervisorRoles(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const roles = [...new Set(formData.getAll("roles").map(String).filter(Boolean))];
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", regulatorySupervisorRoles: roles, updatedById: admin.id },
    update: { regulatorySupervisorRoles: roles, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Superviseurs Regulatory — ${roles.length} rôle(s) configuré(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/regulatory");
  return { ok: true };
}

/**
 * Segments thérapeutiques proposés par le tableau Regulatory (menu de la colonne « Segments »).
 * Une liste VIDE rétablit la liste par défaut intégrée. **Super Admin uniquement.**
 */
export async function setRegulatoryTherapeuticSegments(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  // On dédoublonne SANS tenir compte de la casse/des espaces, mais on garde l'écriture d'origine
  // (le premier vu) : « Oncologie » et « oncologie » ne doivent pas coexister dans le menu.
  const seen = new Set<string>();
  const segments: string[] = [];
  for (const raw of formData.getAll("segments").map(String)) {
    const v = raw.replace(/\s+/g, " ").trim();
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    segments.push(v);
  }
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", regulatoryTherapeuticSegments: segments, updatedById: admin.id },
    update: { regulatoryTherapeuticSegments: segments, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Segments thérapeutiques Regulatory — ${segments.length} segment(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/regulatory");
  revalidatePath("/business-development/pipeline");
  return { ok: true };
}

/**
 * Rôles autorisés à CRÉER des catégories de Drive (espaces partagés en onglets), en plus du
 * Super Admin toujours autorisé. **Super Admin uniquement.**
 */
export async function setDriveSpaceCreatorRoles(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const roles = [...new Set(formData.getAll("roles").map(String).filter(Boolean))];
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", driveSpaceCreatorRoles: roles, updatedById: admin.id },
    update: { driveSpaceCreatorRoles: roles, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Créateurs de catégories Drive — ${roles.length} rôle(s) configuré(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/drive");
  return { ok: true };
}

/**
 * Rôles autorisés à voir l'onglet « Overview » des Rapports terrain (graphes d'analyse),
 * en plus du Super Admin toujours autorisé. **Super Admin uniquement.**
 */
export async function setFieldReportsOverviewRoles(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const roles = [...new Set(formData.getAll("roles").map(String).filter(Boolean))];
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", fieldReportsOverviewRoles: roles, updatedById: admin.id },
    update: { fieldReportsOverviewRoles: roles, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Accès Overview Rapports terrain — ${roles.length} rôle(s) configuré(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/field-reports/overview");
  return { ok: true };
}

/**
 * Qui peut CONSULTER l'organigramme : rôles (ex. Ressources humaines) et/ou personnes nommées,
 * en plus du Super Admin toujours autorisé. La MODIFICATION (rattachements, postes, carte)
 * reste réservée au Super Admin. **Super Admin uniquement.**
 */
export async function setOrgChartViewers(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const roles = [...new Set(formData.getAll("roles").map(String).filter(Boolean))];
  const userIds = [...new Set(formData.getAll("userIds").map(String).filter(Boolean))];
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", orgChartViewerRoles: roles, orgChartViewerUserIds: userIds, updatedById: admin.id },
    update: { orgChartViewerRoles: roles, orgChartViewerUserIds: userIds, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Consultation de l'organigramme — ${roles.length} rôle(s), ${userIds.length} personne(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/organigramme");
  return { ok: true };
}

/** Capacité globale du Drive + quota par utilisateur (Go). **Super Admin uniquement.** */
export async function saveDriveStorageSettings(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const clampGb = (v: number | null, def: number) => (v === null ? def : Math.max(1, Math.min(10000, Math.round(v))));
  const driveCapacityGb = clampGb(fdNum(formData, "driveCapacityGb"), DEFAULT_APP_SETTINGS.driveCapacityGb);
  const driveUserQuotaGb = clampGb(fdNum(formData, "driveUserQuotaGb"), DEFAULT_APP_SETTINGS.driveUserQuotaGb);

  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", driveCapacityGb, driveUserQuotaGb, updatedById: admin.id },
    update: { driveCapacityGb, driveUserQuotaGb, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Stockage Drive — capacité ${driveCapacityGb} Go, quota utilisateur ${driveUserQuotaGb} Go`,
  });
  revalidatePath("/admin");
  return { ok: true };
}
