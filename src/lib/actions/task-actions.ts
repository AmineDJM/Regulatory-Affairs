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
