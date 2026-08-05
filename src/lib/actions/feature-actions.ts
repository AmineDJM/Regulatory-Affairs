"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Validation des nouveautés : passage de la version de TEST à la version de PRODUCTION.
 * Réservé au Super Admin — c'est lui qui décide ce que voit l'entreprise.
 */

const STAGES = ["TEST", "PROD", "OFF"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  TEST: "version de test",
  PROD: "production",
  OFF: "désactivée",
};

async function requireAdmin() {
  const user = await requireUser();
  return user.role === "SUPER_ADMIN" ? user : null;
}

/**
 * Change le stade d'une nouveauté. `PROD` = validée : elle devient visible de TOUT LE MONDE.
 * `TEST` = retour arrière (seuls les comptes en mode test la voient). `OFF` = coupée.
 * Chaque changement est journalisé (qui, quand, quoi).
 */
export async function setFeatureStage(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Réservé au Super Admin." };

  const key = fdStr(formData, "key");
  const stageRaw = fdStr(formData, "stage");
  if (!key || !stageRaw || !(STAGES as readonly string[]).includes(stageRaw)) {
    return { ok: false, error: "Paramètres invalides." };
  }
  const stage = stageRaw as Stage;

  const flag = await prisma.featureFlag.findUnique({ where: { key }, select: { label: true, stage: true } });
  if (!flag) return { ok: false, error: "Nouveauté introuvable." };
  if (flag.stage === stage) return { ok: true };

  await prisma.featureFlag.update({
    where: { key },
    data: {
      stage,
      // On garde la trace de la VALIDATION (passage en production) ; un retour arrière l'efface.
      promotedAt: stage === "PROD" ? new Date() : null,
      promotedById: stage === "PROD" ? user.id : null,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Administration",
    field: "featureStage",
    newValue: stage,
    summary: `Nouveauté « ${flag.label} » → ${STAGE_LABEL[stage]}`,
  });
  // La bascule change ce que voient les pages : on invalide tout le rendu mis en cache.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Active/désactive le MODE TEST du compte courant : voir les nouveautés encore en test.
 * Réservé au Super Admin (c'est lui qui recette avant de valider pour l'entreprise).
 */
export async function toggleMyTestMode(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Réservé au Super Admin." };
  const on = fdStr(formData, "on") === "true";
  await prisma.user.update({ where: { id: user.id }, data: { testMode: on } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Administration",
    summary: on ? "Mode test activé (voit les nouveautés en test)" : "Mode test désactivé",
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
