"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { broadcastNotification, type BroadcastAudience } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Crée et diffuse une notification depuis l'Administration. **Super Admin uniquement.**
 * Audience : tous les comptes actifs / un rôle / des personnes précises.
 */
export async function sendBroadcast(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le titre est requis." };
  const body = fdStr(formData, "body") ?? undefined;
  const link = fdStr(formData, "link") ?? undefined;
  const audience = (fdStr(formData, "audience") ?? "ALL") as BroadcastAudience;
  const role = fdStr(formData, "role");
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);
  const popup = fdStr(formData, "popup") === "on" || fdStr(formData, "popup") === "true";

  if (audience === "USERS" && userIds.length === 0) return { ok: false, error: "Sélectionnez au moins une personne." };
  if (audience === "ROLE" && !role) return { ok: false, error: "Sélectionnez un rôle." };

  const count = await broadcastNotification({ audience, role, userIds, title, body, link, popup });
  if (count === 0) return { ok: false, error: "Aucun destinataire trouvé pour cette audience." };

  await recordAudit({ actorId: admin.id, action: "CREATE", module: "Administration", summary: `Notification${popup ? " (pop-up)" : ""} diffusée à ${count} personne·s — « ${title} »` });
  revalidatePath("/admin/settings");
  return { ok: true, message: `Notification envoyée à ${count} personne·s.` };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  // Scope the update to the owner so a user can only mark their own.
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}
