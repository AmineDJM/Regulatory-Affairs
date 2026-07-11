"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { aiConfigured } from "@/lib/ai";
import { regCan, resolveRegCompanyId } from "../access";
import { runAgentOnVersion, applicableAgents, type AgentRunSummary } from "./orchestrator";

/**
 * Actions des agents spécialisés (G6) — exécution À LA DEMANDE par un humain habilité.
 * Vérifie le rôle (regCan) ET l'appartenance du dossier au périmètre de l'organisation.
 * L'IA n'est appelée que si configurée ; sinon abstention honnête (aucune simulation).
 */

const str = (fd: FormData, k: string) => { const v = fd.get(k); return v ? String(v).trim() : null; };

async function scopeCompanyId(): Promise<string | null> {
  return resolveRegCompanyId(getCompanyScope());
}

export async function runAgentAction(formData: FormData): Promise<AgentRunSummary & { ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && !regCan(user, "regulatory.rules.view") && user.role !== "SUPER_ADMIN") {
    return { ok: false, agentKey: "", agentName: "", configured: false, abstained: false, findings: 0, error: "Non autorisé." };
  }
  const dossierId = str(formData, "dossierId");
  const agentKey = str(formData, "agentKey");
  if (!dossierId || !agentKey) return { ok: false, agentKey: agentKey ?? "", agentName: "", configured: false, abstained: false, findings: 0, error: "Paramètres manquants." };

  const companyId = await scopeCompanyId();
  if (!companyId) return { ok: false, agentKey, agentName: "", configured: false, abstained: false, findings: 0, error: "Module non activé." };

  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { ok: false, agentKey, agentName: "", configured: false, abstained: false, findings: 0, error: "Aucune version." };

  if (!aiConfigured()) {
    return { ok: true, agentKey, agentName: "", configured: false, abstained: true, findings: 0, message: "IA non configurée (ANTHROPIC_API_KEY absente) — agent non exécuté, aucune simulation." };
  }

  const summary = await runAgentOnVersion(version.id, agentKey);
  revalidatePath(`/regulatory/enregistrement/analyse/${dossierId}`);
  return summary;
}

/** Agents applicables au dossier + état de configuration IA (pour l'UI). */
export async function listApplicableAgents(dossierId: string): Promise<{ configured: boolean; agents: { key: string; name: string; requiresSource: boolean }[] }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.workspace.view") && user.role !== "SUPER_ADMIN") return { configured: false, agents: [] };
  const companyId = await scopeCompanyId();
  if (!companyId) return { configured: false, agents: [] };
  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { configured: aiConfigured(), agents: [] };
  return { configured: aiConfigured(), agents: await applicableAgents(version.id) };
}
