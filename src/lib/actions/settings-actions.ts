"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import { fdNum, type ActionResult } from "@/lib/actions/types";
import { normalizeHidden } from "@/lib/modules-visibility";

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
  revalidatePath("/regulatory/pipeline");
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

/**
 * PIPELINE — qui CONSULTE les dossiers verrouillés, et qui tient le CADENAS.
 *
 * Deux listes distinctes, et c'est le cœur du réglage : consulter un portefeuille encore
 * confidentiel est une confidence ; l'ouvrir, c'est le publier à toute l'entreprise, et cela ne
 * se reprend pas. Le Super Admin reste toujours inclus dans les deux — c'est lui qui distribue
 * ces accès, et un réglage malheureux ne doit pas pouvoir l'enfermer dehors.
 * **Super Admin uniquement.**
 */
export async function setPipelineAccess(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const viewerRoles = [...new Set(formData.getAll("viewerRoles").map(String).filter(Boolean))];
  const viewerUserIds = [...new Set(formData.getAll("viewerUserIds").map(String).filter(Boolean))];
  const managerRoles = [...new Set(formData.getAll("managerRoles").map(String).filter(Boolean))];
  const managerUserIds = [...new Set(formData.getAll("managerUserIds").map(String).filter(Boolean))];
  const data = {
    pipelineViewerRoles: viewerRoles,
    pipelineViewerUserIds: viewerUserIds,
    pipelineManagerRoles: managerRoles,
    pipelineManagerUserIds: managerUserIds,
    updatedById: admin.id,
  };
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Accès au pipeline réglementaire — consultation : ${viewerRoles.length} rôle(s) / ${viewerUserIds.length} personne(s) ; cadenas : ${managerRoles.length} rôle(s) / ${managerUserIds.length} personne(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/regulatory");
  revalidatePath("/regulatory/pipeline");
  return { ok: true };
}

/**
 * ACCÈS DU MODULE DIRECTIVES — qui LIT les notes de service, qui en RÉDIGE.
 *
 * Ce qui ne se règle PAS ici : la PUBLICATION. Elle appartient à la direction générale et au
 * Super Admin, en dur (`lib/directives/audience.ts`). En faire un réglage reviendrait à
 * permettre qu'une case cochée par mégarde donne le pouvoir d'écrire au nom de la direction —
 * et une note lue ne se rattrape pas.
 *
 * **Super Admin uniquement.**
 */
export async function setDirectiveAccess(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const readerRoles = [...new Set(formData.getAll("readerRoles").map(String).filter(Boolean))];
  const readerUserIds = [...new Set(formData.getAll("readerUserIds").map(String).filter(Boolean))];
  const issuerRoles = [...new Set(formData.getAll("issuerRoles").map(String).filter(Boolean))];
  const issuerUserIds = [...new Set(formData.getAll("issuerUserIds").map(String).filter(Boolean))];
  const data = {
    directiveReaderRoles: readerRoles,
    directiveReaderUserIds: readerUserIds,
    directiveIssuerRoles: issuerRoles,
    directiveIssuerUserIds: issuerUserIds,
    updatedById: admin.id,
  };
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Accès aux directives — lecture : ${readerRoles.length} rôle(s) / ${readerUserIds.length} personne(s) ; rédaction : ${issuerRoles.length} rôle(s) / ${issuerUserIds.length} personne(s)`,
  });
  revalidatePath("/admin");
  revalidatePath("/directives");
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

/**
 * MODULES MASQUÉS — retirer un ou plusieurs modules de la plateforme. **Super Admin uniquement.**
 *
 * Ce n'est pas une permission : c'est un état de service. Rien n'est supprimé — ni les données,
 * ni les droits, ni les actions serveur. Démasquer rend le module tel qu'il était.
 *
 * La console d'administration est écartée par `normalizeHidden` : la masquer fermerait la porte
 * de l'intérieur, sans moyen de revenir autrement qu'en écrivant en base.
 */
export async function setHiddenModules(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const hidden = normalizeHidden(formData.getAll("modules").map(String));
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", hiddenModules: hidden, updatedById: admin.id },
    update: { hiddenModules: hidden, updatedById: admin.id },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: hidden.length === 0
      ? "Modules masqués — tous les modules remis en service"
      : `Modules masqués — ${hidden.length} module(s) retiré(s) : ${hidden.join(", ")}`,
  });
  // Le menu est calculé dans le layout : sans revalidation de la racine, il resterait tel quel
  // jusqu'au prochain rechargement complet.
  revalidatePath("/", "layout");
  return { ok: true };
}
