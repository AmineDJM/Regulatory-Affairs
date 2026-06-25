"use server";

import { revalidatePath } from "next/cache";
import type { FeedbackStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const STATUSES: FeedbackStatus[] = ["NEW", "SEEN", "IN_PROGRESS", "DONE"];

/** N'importe quel utilisateur connecté peut envoyer un retour libre. */
export async function submitFeedback(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const message = fdStr(formData, "message");
  if (!message) return { ok: false, error: "Le message est obligatoire." };

  const created = await prisma.feedback.create({
    data: { userId: user.id, message, module: fdStr(formData, "module") },
  });
  await notifyRoles(["SUPER_ADMIN"], {
    type: "GENERIC",
    title: "Nouveau feedback",
    body: `${user.name} — ${message.slice(0, 80)}`,
    link: "/admin/feedback",
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Feedback",
    entityType: "FEEDBACK", entityId: created.id, summary: message.slice(0, 80),
  });
  revalidatePath("/feedback");
  revalidatePath("/admin/feedback");
  return { ok: true, id: created.id };
}

/** Réservé au Super Admin : marquer un feedback vu / en cours / traité. */
export async function updateFeedbackStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as FeedbackStatus | null;
  if (!id || !status || !STATUSES.includes(status)) return { ok: false, error: "Statut invalide." };

  await prisma.feedback.update({
    where: { id },
    data: { status, handledById: user.id, adminNote: fdStr(formData, "adminNote") },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Feedback",
    entityType: "FEEDBACK", entityId: id, field: "status", newValue: status, summary: `Feedback → ${status}`,
  });
  revalidatePath("/admin/feedback");
  return { ok: true };
}
