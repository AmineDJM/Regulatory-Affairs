"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { runReviewerSimulation, type SimulationResult } from "./run";

/** Lance la simulation multi-perspectives (G11). NON prédictive. Org-scopé + rôle. */
export async function runSimulationAction(formData: FormData): Promise<SimulationResult & { ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && user.role !== "SUPER_ADMIN") return { ok: false, configured: false, perspectives: [], error: "Non autorisé." };
  const dossierId = formData.get("dossierId") ? String(formData.get("dossierId")) : null;
  if (!dossierId) return { ok: false, configured: false, perspectives: [], error: "Dossier manquant." };

  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, configured: false, perspectives: [], error: "Module non activé." };
  const version = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true } });
  if (!version) return { ok: false, configured: false, perspectives: [], error: "Aucune version." };

  const r = await runReviewerSimulation(version.id, user.id);
  if (r.ok && r.configured) revalidatePath(`/regulatory/enregistrement/analyse/${dossierId}`);
  return r;
}
