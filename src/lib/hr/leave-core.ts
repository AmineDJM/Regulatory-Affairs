import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { LeaveType, UserRole, HrRequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { getAppSettings } from "@/lib/settings";
import { saveFile, validateUpload } from "@/lib/storage";
import { getManagerOf, getManagementChain } from "@/lib/departments";
import { stageNotifyRoles, type LeaveDecider } from "@/lib/leave-workflow";

/**
 * LE CONGÉ EST **UNE** DEMANDE — quel que soit l'écran d'où elle part.
 *
 * Deux portes existaient : « Mon espace › Demander un congé » (LeaveRequest) et
 * « Mon dossier RH › Nouvelle demande › Congé annuel » (HrDocumentRequest). Deux portes,
 * deux tables, deux vérités : un congé déposé par la seconde n'apparaissait ni dans
 * « Absents aujourd'hui », ni dans la file des congés à valider, ni dans le solde. Ce module
 * est le passage unique — les deux portes y mènent, et une seule demande en sort.
 *
 * Module SERVEUR (prisma, stockage) : jamais importé par un composant client.
 */

/** Jours calendaires inclusifs entre deux dates (min 1). */
export function leaveDaysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Traduction des types de demande RH en types de congé. « Sortie exceptionnelle » n'a pas
 * d'équivalent : c'est une absence ponctuelle, elle atterrit en OTHER (jamais débitée du solde).
 */
export const HR_TYPE_TO_LEAVE: Partial<Record<HrRequestType, LeaveType>> = {
  ANNUAL_LEAVE: "ANNUAL",
  SICK_LEAVE: "SICK",
  UNPAID_LEAVE: "UNPAID",
  MATERNITY_LEAVE: "MATERNITY",
  SPECIAL_LEAVE: "SPECIAL",
  EXCEPTIONAL_EXIT: "OTHER",
};

/** Ce type de demande RH est-il en réalité un congé / une absence ? */
export function hrTypeIsLeave(type: HrRequestType): boolean {
  return type in HR_TYPE_TO_LEAVE;
}

/** Les écrans qui montrent un congé — tous rafraîchis ensemble, sinon deux pages se contredisent. */
export function revalidateLeaveViews(employeeId?: string): void {
  revalidatePath("/mon-espace");
  revalidatePath("/mon-dossier");
  revalidatePath("/rh");
  revalidatePath("/rh/conges");
  if (employeeId) revalidatePath(`/rh/${employeeId}`);
}

/**
 * Crée la demande et l'engage dans le circuit **N+1 → RH → DG**.
 *
 * Le circuit démarre au N+1 résolu par l'organigramme. Si personne ne surplombe le demandeur
 * (direction, ou fiche non rattachée), on ne laisse pas la demande dans le vide : elle entre
 * directement à l'étape RH. Un responsable SANS COMPTE applicatif ne peut rien signer — même
 * traitement.
 */
export async function createLeaveRequest(
  actorId: string,
  employee: { id: string; fullName: string; userId: string | null },
  input: { type: LeaveType; startDate: Date; endDate: Date; days: number; reason: string | null },
): Promise<{ id: string; stage: "MANAGER" | "HR" }> {
  const manager = await getManagerOf(employee.id).catch(() => null);
  const managerUserId = manager?.userId ?? null;
  const stage = managerUserId ? "MANAGER" : "HR";

  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      days: input.days,
      reason: input.reason,
      createdById: actorId,
      stage,
      managerId: manager?.employeeId ?? null,
    },
  });

  await recordAudit({
    actorId, action: "CREATE", module: "Ressources humaines",
    entityType: "LEAVE_REQUEST", entityId: created.id,
    summary: `Demande de congé — ${employee.fullName} (${input.days} j)`,
  });

  const period = `${input.startDate.toLocaleDateString("fr-FR")} → ${input.endDate.toLocaleDateString("fr-FR")}`;
  if (stage === "MANAGER" && managerUserId) {
    await notifyUser({
      userId: managerUserId, type: "GENERIC", title: "Congé à valider (votre équipe)",
      body: `${employee.fullName} — ${period} (${input.days} j).`, link: "/mon-espace",
    });
  } else {
    await notifyRoles(stageNotifyRoles("HR") as UserRole[], {
      type: "GENERIC", title: "Congé à valider",
      body: `${employee.fullName} — ${period} (${input.days} j).`, link: "/rh",
    });
  }
  return { id: created.id, stage };
}

/**
 * Verse des justificatifs sur une demande de congé (certificat médical, formulaire signé…).
 * Renvoie un message d'erreur bloquant, ou null. Le stockage peut tomber ; la demande, elle,
 * doit vivre — on conserve alors la trace du fichier.
 */
export async function attachLeaveFiles(leaveId: string, files: File[], uploaderId: string): Promise<string | null> {
  const maxMb = (await getAppSettings()).maxUploadMb;
  for (const file of files) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return invalid;
    const key = `LEAVE_REQUEST/${leaveId}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      console.error("[leave] storage write failed, recording metadata only", err);
    }
    await prisma.document.create({
      data: {
        name: file.name, category: "OTHER", entityType: "LEAVE_REQUEST", entityId: leaveId,
        fileKey: key, mimeType: file.type || null, sizeBytes: file.size,
        confidentiality: "CONFIDENTIAL", uploadedById: uploaderId,
      },
    });
  }
  return null;
}

/**
 * Le pouvoir de trancher d'une personne sur UNE demande précise : est-elle le N+1 résolu,
 * porte-t-elle la fonction RH, est-elle la direction ? Trois questions, trois sources —
 * l'organigramme, les droits du module RH, la vue globale.
 */
export async function leaveDecider(
  user: SessionUser,
  leave: { managerId: string | null; employeeId: string },
): Promise<LeaveDecider> {
  // Vue globale = Direction / Super Admin, rôle principal OU secondaire.
  const isDg = hasGlobalView(user);
  const isHr = userCan(user, "RH", "VALIDATE");

  let isManager = false;
  if (leave.managerId) {
    const mgr = await prisma.employee.findUnique({ where: { id: leave.managerId }, select: { userId: true } });
    isManager = mgr?.userId === user.id;
  }
  // Le N+1 enregistré à la soumission peut avoir changé (mutation, départ) : on accepte aussi
  // toute personne au-dessus dans la chaîne ACTUELLE, sinon la demande reste orpheline.
  if (!isManager) {
    const chain = await getManagementChain(leave.employeeId).catch(() => []);
    isManager = chain.some((m) => m.userId === user.id);
  }
  return { id: user.id, isManager, isHr, isDg };
}
