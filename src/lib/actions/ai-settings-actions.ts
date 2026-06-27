"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdBool, type ActionResult } from "@/lib/actions/types";

/**
 * Centre de contrôle IA — enregistre les bascules d'activation (Super Admin).
 * Aucune clé n'est stockée ni modifiée ici : les secrets restent dans
 * l'environnement (Render). On ne gère que l'activation par fonction.
 */
export async function updateAiSettings(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (!userCan(admin, "ADMIN", "UPDATE") || admin.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Réservé au Super Admin." };
  }

  const data = {
    masterEnabled: fdBool(formData, "masterEnabled"),
    assistantEnabled: fdBool(formData, "assistantEnabled"),
    proactiveNudgesEnabled: fdBool(formData, "proactiveNudgesEnabled"),
    brainEnabled: fdBool(formData, "brainEnabled"),
    processIntelEnabled: fdBool(formData, "processIntelEnabled"),
    fieldReportAiEnabled: fdBool(formData, "fieldReportAiEnabled"),
    voiceTranscriptEnabled: fdBool(formData, "voiceTranscriptEnabled"),
    updatedById: admin.id,
  };

  await prisma.aiSetting.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Centre de contrôle IA",
    summary: data.masterEnabled
      ? "Mise à jour des activations IA"
      : "IA coupée globalement (interrupteur général)",
  });
  revalidatePath("/admin/ai");
  return { ok: true };
}
