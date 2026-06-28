"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_ADOPTION_SETTINGS } from "@/lib/adoption";
import { fdNum, type ActionResult } from "@/lib/actions/types";

/**
 * Réglage du score d'adoption — **réservé au Super Admin**. Définit librement les
 * poids de chaque dimension et les seuils de libellé. N'influe que sur la
 * pondération/segmentation ; le score reste calculé sur des données réelles.
 */
export async function saveAdoptionSettings(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const D = DEFAULT_ADOPTION_SETTINGS;
  // Poids : entiers ≥ 0 (au moins un poids > 0). Seuils : 0–100, ordonnés.
  const weight = (k: string, def: number) => {
    const v = fdNum(formData, k);
    return v === null ? def : Math.max(0, Math.min(100, Math.round(v)));
  };
  const w = {
    wRegularity: weight("wRegularity", D.weights.regularity),
    wTime: weight("wTime", D.weights.time),
    wBreadth: weight("wBreadth", D.weights.breadth),
    wDiversity: weight("wDiversity", D.weights.diversity),
    wDurable: weight("wDurable", D.weights.durable),
    wInteraction: weight("wInteraction", D.weights.interaction),
    wRecency: weight("wRecency", D.weights.recency),
  };
  if (Object.values(w).reduce((s, x) => s + x, 0) <= 0) {
    return { ok: false, error: "Au moins un poids doit être supérieur à zéro." };
  }
  const t = {
    tChampion: weight("tChampion", D.thresholds.champion),
    tActive: weight("tActive", D.thresholds.active),
    tModerate: weight("tModerate", D.thresholds.moderate),
    tWeak: weight("tWeak", D.thresholds.weak),
  };
  if (!(t.tChampion > t.tActive && t.tActive > t.tModerate && t.tModerate > t.tWeak)) {
    return { ok: false, error: "Les seuils doivent être strictement décroissants (Champion > Actif > Modéré > Faible)." };
  }

  // Cibles « 100 % » : entiers ≥ 1 (sauf modules où 0 = cible auto par rôle), plafonnées.
  const tgt = (k: string, def: number, min = 1, max = 1000) => {
    const v = fdNum(formData, k);
    return v === null ? def : Math.max(min, Math.min(max, Math.round(v)));
  };
  const g = {
    tgtTimeHours: tgt("tgtTimeHours", D.targets.timeHours, 1, 720),
    tgtActiveDays: tgt("tgtActiveDays", D.targets.activeDays, 1, 30),
    tgtDiversity: tgt("tgtDiversity", D.targets.diversity, 1, 50),
    tgtDurable: tgt("tgtDurable", D.targets.durable, 1, 500),
    tgtInteraction: tgt("tgtInteraction", D.targets.interaction, 1, 1000),
    tgtModules: tgt("tgtModules", D.targets.modules, 0, 30),
  };

  await prisma.adoptionSetting.upsert({
    where: { id: "global" },
    create: { id: "global", ...w, ...t, ...g, updatedById: admin.id },
    update: { ...w, ...t, ...g, updatedById: admin.id },
  });
  // Les snapshots mis en cache deviennent obsolètes → forcer un recalcul à la
  // prochaine lecture de chaque pastille (réinitialise l'horodatage de fraîcheur).
  await prisma.user.updateMany({ data: { adoptionScoreAt: null } });
  await recordAudit({ actorId: admin.id, action: "UPDATE", module: "Administration", summary: "Réglage du score d'adoption (poids/seuils)" });
  revalidatePath("/admin/adoption");
  return { ok: true };
}

/**
 * Remet à **zéro** les temps d'activité enregistrés (champ `durationMs` des relevés) —
 * réservé au Super Admin. On ne supprime aucun relevé (l'audit appareil/géoloc/page reste
 * intact) : seule la durée est remise à 0, pour repartir sur le **nouveau** comptage précis
 * (temps réellement au premier plan). Les pastilles se recalculent ensuite. Données réelles,
 * aucune valeur fabriquée.
 */
export async function resetActivityTime(): Promise<ActionResult> {
  const admin = await requireUser();
  if (admin.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const res = await prisma.activityLog.updateMany({ data: { durationMs: 0 } });
  await prisma.user.updateMany({ data: { adoptionScoreAt: null } });
  await recordAudit({ actorId: admin.id, action: "UPDATE", module: "Administration", summary: `Temps d'activité remis à zéro (${res.count} relevés)` });
  revalidatePath("/admin/adoption");
  return { ok: true, message: `Temps d'activité remis à zéro (${res.count} relevés). Le nouveau comptage précis prend le relais.` };
}
