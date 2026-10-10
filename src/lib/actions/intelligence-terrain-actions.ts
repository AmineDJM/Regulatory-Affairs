"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { analyserInfluence, recalculerScoresInfluence, type BilanAnalyse } from "@/lib/influence-luna";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * INTELLIGENCE TERRAIN — les gestes de la console (graphe d'influence). RÉSERVÉS AU SUPER ADMINISTRATEUR, sans délégation
 * possible (Direction, 10/2026 : « visible uniquement par le Super Administrateur ») : le rôle est relu à chaque appel.
 */

const REFUS = "Réservé au Super Admin.";
const CHEMIN = "/admin/intelligence-terrain";

/** « Relancer l'analyse » : structure, nouveaux rapports par Luna (depuis le filigrane), scores. */
export async function relancerAnalyseInfluence(): Promise<ActionResult & { bilan?: BilanAnalyse }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: REFUS };
  const bilan = await analyserInfluence({ userId: user.id });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Intelligence terrain",
    summary: `Analyse d'influence relancée — ${bilan.rapportsLus} rapport(s) lu(s), ${bilan.liensProposes} lien(s) proposé(s), Luna : ${bilan.luna}`,
  });
  revalidatePath(CHEMIN);
  return { ok: true, bilan };
}

/** Confirmer ou rejeter un lien PROPOSÉ par Luna. Un lien rejeté reste (Luna ne le reproposera pas). */
export async function deciderLienInfluence(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: REFUS };
  const relationId = fdStr(formData, "relationId");
  const decision = fdStr(formData, "decision");
  if (!relationId || (decision !== "CONFIRMEE" && decision !== "REJETEE")) return { ok: false, error: "Décision invalide." };
  const lien = await prisma.praticienRelation.findUnique({ where: { id: relationId }, select: { id: true, statut: true, type: true } });
  if (!lien) return { ok: false, error: "Lien introuvable." };
  if (lien.statut !== "PROPOSEE") return { ok: false, error: "Ce lien a déjà été tranché." };
  await prisma.praticienRelation.update({
    where: { id: relationId },
    data: { statut: decision, decideParId: user.id, decideLe: new Date(), ...(decision === "CONFIRMEE" ? { confidence: 1 } : {}) },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Intelligence terrain", entityId: relationId, field: "statut",
    oldValue: "PROPOSEE", newValue: decision, summary: `Lien d'influence ${decision === "CONFIRMEE" ? "confirmé" : "rejeté"} (${lien.type})`,
  });
  // Le score suit : un lien confirmé pèse 1, un rejeté ne pèse plus.
  await recalculerScoresInfluence().catch((e) => console.error("[influence] scores", e));
  revalidatePath(CHEMIN);
  return { ok: true, id: relationId };
}
