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
