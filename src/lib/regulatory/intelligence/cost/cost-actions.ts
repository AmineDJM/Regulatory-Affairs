"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { regAudit } from "../audit";

/**
 * BUDGET IA D'UN DOSSIER.
 *
 * Un plafond n'est utile que s'il ARRÊTE réellement la dépense : le registre refuse un appel
 * quand le dossier a atteint son plafond, et le dit. Ce fichier ne fait que régler ce plafond,
 * sous garde `regulatory.dossier.analyse` (qui déclenche les analyses paie ce qu'elles coûtent)
 * et avec une trace : un plafond relevé est une décision, elle doit être attribuable.
 *
 * Vider le champ = revenir au plafond global (`CTD_BUDGET_USD_DEFAULT`). Mettre 0 est refusé :
 * un plafond nul bloquerait toute analyse sans le dire clairement — mieux vaut désactiver
 * l'analyse que la laisser échouer en silence.
 */

interface Result { ok: boolean; error?: string; message?: string }

const MAX_BUDGET_USD = 10_000;

export async function setDossierBudget(formData: FormData): Promise<Result> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé pour cette entité." };

  const dossierId = String(formData.get("dossierId") ?? "").trim();
  if (!dossierId) return { ok: false, error: "Dossier non précisé." };

  const dossier = await prisma.regulatoryDossier.findFirst({
    where: { id: dossierId, companyId },
    select: { id: true, reference: true, aiBudgetUsd: true },
  });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const raw = String(formData.get("budgetUsd") ?? "").trim().replace(",", ".");
  let value: number | null = null;
  if (raw.length > 0) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: "Montant illisible." };
    if (n <= 0) return { ok: false, error: "Un plafond doit être strictement positif. Laissez le champ vide pour revenir au plafond global." };
    if (n > MAX_BUDGET_USD) return { ok: false, error: `Plafond trop élevé (maximum ${MAX_BUDGET_USD} $).` };
    value = Math.round(n * 10_000) / 10_000;
  }

  await prisma.regulatoryDossier.update({ where: { id: dossier.id }, data: { aiBudgetUsd: value } });
  await regAudit({
    companyId, actorId: user.id, dossierId: dossier.id, action: "AI_BUDGET_SET",
    detail: value == null
      ? `Plafond IA propre au dossier retiré : le plafond global s'applique de nouveau.`
      : `Plafond IA du dossier fixé à ${value.toFixed(2)} $.`,
  });
  revalidatePath(`/regulatory/enregistrement/analyse/${dossier.id}`);

  return {
    ok: true,
    message: value == null ? "Plafond propre au dossier retiré — le plafond global s'applique." : `Plafond fixé à ${value.toFixed(2)} $.`,
  };
}

/**
 * Lance la revue complète d'une version en ANALYSE DIFFÉRÉE : moitié prix, résultats sous 24 h.
 *
 * Le choix appartient à l'utilisateur, pas au code : sur un dossier qu'on examine tout de suite,
 * attendre 24 h n'a aucun sens ; sur une réanalyse complète lancée le soir, l'économie est réelle.
 * L'écran affiche donc les deux voies avec leur coût et leur délai.
 */
export async function submitDeferredReview(formData: FormData): Promise<Result & { estimatedUsd?: number; requests?: number }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé pour cette entité." };

  const dossierId = String(formData.get("dossierId") ?? "").trim();
  const dossier = await prisma.regulatoryDossier.findFirst({
    where: { id: dossierId, companyId },
    select: { id: true, versions: { orderBy: { versionNo: "desc" }, take: 1, select: { id: true } } },
  });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };
  const versionId = dossier.versions[0]?.id;
  if (!versionId) return { ok: false, error: "Aucune version reçue sur ce dossier." };

  // Un lot déjà en cours sur la même version : on ne le double pas — ce serait payer deux fois.
  const running = await prisma.regulatoryAiBatch.findFirst({
    where: { dossierVersionId: versionId, status: { in: ["submitted", "validating", "in_progress", "finalizing"] } },
    select: { id: true, requestCount: true },
  });
  if (running) return { ok: false, error: `Une analyse différée est déjà en cours sur cette version (${running.requestCount} part(s)). Attendez son résultat.` };

  const { submitVersionReviewBatch } = await import("./batch-runner");
  const r = await submitVersionReviewBatch(versionId, { companyId, dossierId: dossier.id, userId: user.id });
  revalidatePath(`/regulatory/enregistrement/analyse/${dossier.id}`);
  return r.ok
    ? { ok: true, message: r.message, estimatedUsd: r.estimatedUsd, requests: r.requests }
    : { ok: false, error: r.error };
}

/**
 * ANALYSE IMMÉDIATE — plein tarif, résultats dans l'heure.
 *
 * L'immédiat est désormais le DÉFAUT ; ce bouton reste utile pour reprendre la main quand un lot
 * différé a été déposé auparavant et qu'on ne veut plus l'attendre : le job porte
 * `mode: "immediate"`, la voie Batch est court-circuitée, et le lot en vol cesse d'être ce que
 * l'écran annonce.
 */
export async function submitImmediateReview(formData: FormData): Promise<Result> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé pour cette entité." };

  const dossierId = String(formData.get("dossierId") ?? "").trim();
  const dossier = await prisma.regulatoryDossier.findFirst({
    where: { id: dossierId, companyId },
    select: { id: true, versions: { orderBy: { versionNo: "desc" }, take: 1, select: { id: true } } },
  });
  if (!dossier) return { ok: false, error: "Dossier introuvable." };
  const versionId = dossier.versions[0]?.id;
  if (!versionId) return { ok: false, error: "Aucune version reçue sur ce dossier." };

  // Une analyse immédiate déjà en file : on ne la double pas — ce serait payer deux fois.
  const queued = await prisma.regulatoryJob.findFirst({
    where: { dossierVersionId: versionId, type: "AI_REVIEW", status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (queued) return { ok: false, error: "Une analyse est déjà en file pour cette version." };

  await prisma.regulatoryJob.create({
    data: { companyId, dossierId, dossierVersionId: versionId, type: "AI_REVIEW", status: "QUEUED", payload: { mode: "immediate" } },
  });
  await regAudit({
    companyId, actorId: user.id, dossierId, dossierVersionId: versionId,
    action: "AI_REVIEW_REQUESTED",
    detail: "Analyse IMMÉDIATE demandée (plein tarif) — la voie différée est court-circuitée pour cette exécution.",
  });
  revalidatePath(`/regulatory/enregistrement/analyse/${dossierId}`);
  return { ok: true };
}
