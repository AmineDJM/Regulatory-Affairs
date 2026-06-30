"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, MissionRole } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

// Entités pouvant recevoir des accompagnants / délégués de référence.
const PARENT_TYPES: EntityType[] = ["CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENT", "SPONSORING"];
const MISSION_ROLES: MissionRole[] = ["ACCOMPAGNANT", "DELEGATE_REFERENCE"];

/** Chemin de la fiche de l'entité parente (pour notifications & revalidation). */
function parentPath(entityType: EntityType, entityId: string): string {
  switch (entityType) {
    case "CONGRESS_INTERNATIONAL": return `/congress-international/${entityId}`;
    case "CONGRESS_NATIONAL": return `/congress-national/${entityId}`;
    case "EVENT": return `/events/${entityId}`;
    case "SPONSORING": return `/sponsoring/${entityId}`;
    default: return "/";
  }
}

/** Libellé court de l'entité parente (pour les notifications). */
async function parentLabel(entityType: EntityType, entityId: string): Promise<string> {
  try {
    if (entityType === "EVENT") return (await prisma.event.findUnique({ where: { id: entityId }, select: { name: true } }))?.name ?? "événement";
    if (entityType === "SPONSORING") { const r = await prisma.sponsoringRequest.findUnique({ where: { id: entityId }, select: { institution: true, reference: true } }); return r ? `${r.reference} — ${r.institution}` : "sponsoring"; }
    if (entityType === "CONGRESS_INTERNATIONAL") return (await prisma.congressInternational.findUnique({ where: { id: entityId }, select: { name: true } }))?.name ?? "congrès international";
    if (entityType === "CONGRESS_NATIONAL") return (await prisma.congressNational.findUnique({ where: { id: entityId }, select: { name: true } }))?.name ?? "congrès national";
  } catch { /* best-effort */ }
  return "mission";
}

/** Assigne un accompagnant ou un délégué de référence (réservé aux responsables de l'entité). */
export async function assignMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entityType = fdStr(formData, "entityType") as EntityType | null;
  const entityId = fdStr(formData, "entityId");
  const userId = fdStr(formData, "userId");
  if (!entityType || !PARENT_TYPES.includes(entityType) || !entityId || !userId) return { ok: false, error: "Paramètres manquants." };
  if (!(await canAccessEntity(user, entityType, entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };

  const roleRaw = fdStr(formData, "role") as MissionRole | null;
  const role: MissionRole = roleRaw && MISSION_ROLES.includes(roleRaw) ? roleRaw : "ACCOMPAGNANT";
  const note = fdStr(formData, "note");

  try {
    const created = await prisma.missionAssignment.create({
      data: { entityType, entityId, userId, role, note, createdById: user.id },
    });
    const label = await parentLabel(entityType, entityId);
    if (userId !== user.id) {
      await notifyUser({
        userId, type: "ASSIGNMENT",
        title: role === "DELEGATE_REFERENCE" ? "Délégué de référence assigné" : "Vous êtes assigné comme accompagnant",
        body: label, link: "/missions",
      });
    }
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: created.id, summary: `Assignation (${role}) sur ${label}` });
  } catch {
    return { ok: false, error: "Cette personne est déjà assignée à cette mission." };
  }
  revalidatePath(parentPath(entityType, entityId));
  revalidatePath("/missions");
  return { ok: true };
}

/** Retire une assignation (réservé aux responsables de l'entité). */
export async function removeMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const a = await prisma.missionAssignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };

  // Nettoyage des pièces et discussions liées (entité polymorphe).
  await prisma.document.deleteMany({ where: { entityType: "MISSION_ASSIGNMENT", entityId: id } }).catch(() => {});
  await prisma.comment.deleteMany({ where: { entityType: "MISSION_ASSIGNMENT", entityId: id } }).catch(() => {});
  await prisma.missionAssignment.delete({ where: { id } });
  revalidatePath(parentPath(a.entityType, a.entityId));
  revalidatePath("/missions");
  return { ok: true };
}

/** La personne assignée demande un ordre de mission. */
export async function requestMissionOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const a = await prisma.missionAssignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (a.userId !== user.id) return { ok: false, error: "Seule la personne assignée peut demander un ordre de mission." };
  if (a.orderStatus === "ISSUED") return { ok: true };

  await prisma.missionAssignment.update({ where: { id }, data: { orderStatus: "REQUESTED", requestedAt: new Date() } });
  const label = await parentLabel(a.entityType, a.entityId);
  if (a.createdById && a.createdById !== user.id) {
    await notifyUser({ userId: a.createdById, type: "GENERIC", title: "Ordre de mission demandé", body: `${user.name} — ${label}`, link: parentPath(a.entityType, a.entityId) });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: id, summary: `Ordre de mission demandé — ${label}` });
  revalidatePath(parentPath(a.entityType, a.entityId));
  revalidatePath("/missions");
  return { ok: true };
}

/**
 * Le responsable émet l'ordre de mission (après l'avoir éventuellement joint en pièce).
 * La personne assignée est notifiée. Réservé aux responsables de l'entité parente.
 */
export async function issueMissionOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const a = await prisma.missionAssignment.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Assignation introuvable." };
  if (!(await canAccessEntity(user, a.entityType, a.entityId, "UPDATE"))) return { ok: false, error: "Action non autorisée." };

  await prisma.missionAssignment.update({ where: { id }, data: { orderStatus: "ISSUED", issuedAt: new Date(), issuedById: user.id } });
  const label = await parentLabel(a.entityType, a.entityId);
  if (a.userId !== user.id) {
    await notifyUser({ userId: a.userId, type: "ASSIGNMENT", title: "Ordre de mission émis", body: label, link: "/missions" });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: id, summary: `Ordre de mission émis — ${label}` });
  revalidatePath(parentPath(a.entityType, a.entityId));
  revalidatePath("/missions");
  return { ok: true };
}

/** Discussion sur l'assignation : la personne assignée et les responsables peuvent échanger. */
export async function addMissionComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "assignmentId");
  const body = fdStr(formData, "body");
  if (!id || !body) return { ok: false, error: "Commentaire vide." };
  if (!(await canAccessEntity(user, "MISSION_ASSIGNMENT", id, "VIEW"))) return { ok: false, error: "Action non autorisée." };

  await prisma.comment.create({ data: { entityType: "MISSION_ASSIGNMENT", entityId: id, body, authorId: user.id } });
  const a = await prisma.missionAssignment.findUnique({ where: { id }, select: { entityType: true, entityId: true } });
  if (a) revalidatePath(parentPath(a.entityType, a.entityId));
  revalidatePath("/missions");
  return { ok: true };
}
