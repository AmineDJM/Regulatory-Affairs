"use server";

import { revalidatePath } from "next/cache";
import type { Priority, TaskStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

export async function createTask(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };

  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "L'intitulé est obligatoire." };

  const assignedToId = fdStr(formData, "assignedToId") ?? user.id;
  const created = await prisma.task.create({
    data: {
      title,
      description: fdStr(formData, "description"),
      assignedToId,
      createdById: user.id,
      dueDate: fdDate(formData, "dueDate"),
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      module: fdStr(formData, "module"),
      // Course / livraison : adresse (lien Maps) + durée estimée (détection de retard).
      address: fdStr(formData, "address"),
      expectedMinutes: fdNum(formData, "expectedMinutes"),
    },
  });

  // Notify the assignee when delegating to someone else.
  if (assignedToId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        type: "ASSIGNMENT",
        title: "Nouvelle tâche assignée",
        body: title,
        link: "/mon-espace",
      },
    }).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Espace de travail",
    entityType: "TASK", entityId: created.id, summary: `Tâche « ${title} »`,
  });
  revalidatePath("/mon-espace");
  return { ok: true, id: created.id };
}

/** Change a task's status. Allowed for its assignee, its creator, or a manager. */
export async function updateTaskStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "UPDATE")) return { ok: false, error: "Non autorisé." };

  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as TaskStatus;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };

  const task = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true, title: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };

  const allowed = task.assignedToId === user.id || task.createdById === user.id || hasGlobalView(user.role);
  if (!allowed) return { ok: false, error: "Non autorisé." };

  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK",
    entityId: id, field: "status", newValue: status, summary: `Tâche « ${task.title} » → ${status}`,
  });
  revalidatePath("/mon-espace");
  return { ok: true };
}

/** Démarre une tâche « course / déplacement » : horodate le départ (et passe en cours). */
export async function startTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Tâche introuvable." };
  const task = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true, title: true, startedAt: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (!(task.assignedToId === user.id || task.createdById === user.id || hasGlobalView(user.role))) return { ok: false, error: "Non autorisé." };
  await prisma.task.update({ where: { id }, data: { startedAt: task.startedAt ?? new Date(), status: "IN_PROGRESS" } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK", entityId: id, summary: `Départ — « ${task.title} »` });
  revalidatePath("/mon-espace");
  return { ok: true };
}

/**
 * Demande de tâche (ex. depuis un message) : crée une tâche au statut **REQUESTED**
 * assignée à un collègue, qu'il pourra **accepter** ou **refuser**. Comme un DM.
 */
export async function requestTask(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };
  const title = fdStr(formData, "title");
  const assignedToId = fdStr(formData, "assignedToId");
  if (!title) return { ok: false, error: "L'intitulé est obligatoire." };
  if (!assignedToId || assignedToId === user.id) return { ok: false, error: "Choisissez le destinataire de la demande." };

  const created = await prisma.task.create({
    data: {
      title, description: fdStr(formData, "description"), assignedToId, createdById: user.id,
      status: "REQUESTED", priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      dueDate: fdDate(formData, "dueDate"), address: fdStr(formData, "address"), expectedMinutes: fdNum(formData, "expectedMinutes"),
    },
  });
  await prisma.notification.create({
    data: { userId: assignedToId, type: "ASSIGNMENT", title: "Demande de tâche", body: title, link: "/mon-espace" },
  }).catch(() => undefined);
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Espace de travail", entityType: "TASK", entityId: created.id, summary: `Demande de tâche « ${title} »` });
  revalidatePath("/mon-espace");
  return { ok: true, id: created.id };
}

/** Le destinataire accepte (→ TODO) ou refuse (→ DECLINED) une demande de tâche. */
export async function respondTaskRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const accept = fdStr(formData, "accept") === "1";
  if (!id) return { ok: false, error: "Tâche introuvable." };
  const task = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true, title: true, status: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (task.assignedToId !== user.id) return { ok: false, error: "Seul le destinataire peut répondre." };
  if (task.status !== "REQUESTED") return { ok: false, error: "Cette demande a déjà été traitée." };

  await prisma.task.update({ where: { id }, data: { status: accept ? "TODO" : "DECLINED" } });
  if (task.createdById) {
    await prisma.notification.create({
      data: { userId: task.createdById, type: "GENERIC", title: accept ? "Demande de tâche acceptée" : "Demande de tâche refusée", body: task.title, link: "/mon-espace" },
    }).catch(() => undefined);
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK", entityId: id, field: "status", newValue: accept ? "TODO" : "DECLINED", summary: `Demande ${accept ? "acceptée" : "refusée"} — « ${task.title} »` });
  revalidatePath("/mon-espace");
  return { ok: true };
}
