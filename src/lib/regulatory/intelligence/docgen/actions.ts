"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { buildFindingsReport, buildReserveResponseLetter, type GenerateResult } from "./reports";

/**
 * DOCUMENTS PRODUITS DEPUIS L'ANALYSE — deux, et seulement deux, parce que ce sont les seuls
 * que le service ne pouvait pas obtenir autrement : le RAPPORT DE CONSTATS (ce qu'on pose en
 * réunion) et la LETTRE DE RÉPONSE aux réserves ANPP (verbatim + réponses).
 *
 * La génération à partir de modèles à trous (note de pré-soumission, formulaire
 * d'enregistrement…) a été retirée : elle rendait des coquilles à remplir à la main, ce qui
 * n'est pas du travail fait — et encombrait l'écran d'analyse.
 */

const str = (fd: FormData, k: string) => { const v = fd.get(k); return v ? String(v).trim() : null; };

async function scopeCompanyId(): Promise<string | null> {
  return resolveRegCompanyId(getCompanyScope());
}

/** Rapport de constats (.docx) de la dernière version — le document qu'on pose en réunion. */
export async function generateFindingsReportAction(formData: FormData): Promise<GenerateResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const dossierId = str(formData, "dossierId");
  if (!dossierId) return { ok: false, error: "Paramètres manquants." };

  const companyId = await scopeCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { ok: false, error: "Aucune version." };

  const r = await buildFindingsReport({ dossierVersionId: version.id, actorId: user.id });
  if (r.ok) revalidatePath(`/regulatory/enregistrement/analyse/${dossierId}`);
  return r;
}

/** Lettre de réponse aux réserves d'un cycle (.docx) — verbatim ANPP + réponses, jamais d'invention. */
export async function generateReserveLetterAction(formData: FormData): Promise<GenerateResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.reserve.manage") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const cycleId = str(formData, "cycleId");
  if (!cycleId) return { ok: false, error: "Paramètres manquants." };

  const companyId = await scopeCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  // Le cycle doit appartenir au périmètre de l'organisation courante — jamais de fuite inter-entités.
  const cycle = await prisma.regulatoryReserveCycle.findFirst({
    where: { id: cycleId, dossier: { companyId } }, select: { id: true, dossierId: true },
  });
  if (!cycle) return { ok: false, error: "Cycle introuvable." };

  const r = await buildReserveResponseLetter({ cycleId: cycle.id, actorId: user.id });
  if (r.ok) revalidatePath(`/regulatory/enregistrement/analyse/${cycle.dossierId}`);
  return r;
}
