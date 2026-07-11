import { prisma } from "@/lib/prisma";
import { regAudit } from "../audit";
import { AI_READABLE_EXTRACTION_STATUSES } from "../extract/extract-text";
import { sectionByCode } from "../ctd/taxonomy";
import { agentByKey, agentsForSections, type AgentSpec } from "./registry";
import { runAgent, type AgentDoc, type AgentResult } from "./agent-core";

/**
 * ORCHESTRATEUR DES AGENTS (G6) — sélectionne les documents pertinents pour un agent, l'exécute
 * via le noyau encadré, puis PERSISTE ses constats comme findings PROJET (source=AI, draft=true,
 * jamais bloquants), citation du corpus incluse dans la preuve. Les abstentions sont tracées.
 *
 * Déclenché À LA DEMANDE par un humain (jamais autonome). Idempotent par agent : ré-exécuter
 * un agent remplace uniquement ses propres constats (code AGENT:<clé>).
 */

const agentCode = (key: string) => `AGENT:${key}`;

function docsForAgent<T extends AgentDoc>(spec: AgentSpec, docs: T[]): T[] {
  if (spec.ctdScope.length === 0) return docs; // transverse : tout le dossier
  return docs.filter((d) => d.ctdSection && spec.ctdScope.some((p) => d.ctdSection === p || d.ctdSection!.startsWith(`${p}.`)));
}

export interface AgentRunSummary {
  ok: boolean;
  agentKey: string;
  agentName: string;
  configured: boolean;
  abstained: boolean;
  message?: string;
  findings: number;
  error?: string;
}

/** Exécute UN agent sur une version de dossier et persiste ses constats. `deps` injectable (tests). */
export async function runAgentOnVersion(
  dossierVersionId: string,
  agentKey: string,
  deps?: Parameters<typeof runAgent>[2],
): Promise<AgentRunSummary> {
  const spec = agentByKey(agentKey);
  if (!spec) return { ok: false, agentKey, agentName: agentKey, configured: false, abstained: false, findings: 0, error: "Agent inconnu." };

  const version = await prisma.regulatoryDossierVersion.findUnique({
    where: { id: dossierVersionId },
    select: { id: true, dossier: { select: { id: true, companyId: true } } },
  });
  if (!version) return { ok: false, agentKey, agentName: spec.name, configured: false, abstained: false, findings: 0, error: "Version introuvable." };

  const rawDocs = await prisma.regulatoryDocument.findMany({
    where: { dossierVersionId, securityStatus: { in: ["SAFE", "SUSPICIOUS"] }, extractionStatus: { in: AI_READABLE_EXTRACTION_STATUSES } },
    orderBy: { createdAt: "asc" },
    select: { id: true, originalFilename: true, ctdSection: true, extraction: { select: { content: true } } },
  });
  const allDocs: (AgentDoc & { id: string })[] = rawDocs.map((d) => ({
    id: d.id, filename: d.originalFilename, ctdSection: d.ctdSection,
    ctdTitle: d.ctdSection ? sectionByCode(d.ctdSection)?.title ?? null : null, text: d.extraction?.content ?? "",
  }));
  const scoped = docsForAgent(spec, allDocs);

  const result: AgentResult = await runAgent(spec, scoped, deps);

  // Persistance idempotente : on remplace uniquement les constats de CET agent.
  await prisma.regulatoryFinding.deleteMany({ where: { dossierVersionId, code: agentCode(agentKey), source: "AI" } });

  if (result.ok && result.findings.length > 0) {
    // Rattache chaque constat au document scoppé le plus proche de sa section (sinon null).
    await prisma.regulatoryFinding.createMany({
      data: result.findings.map((f) => {
        const cite = f.citation ? `\n\nSource : ${f.citation.authority} · ${f.citation.code} v${f.citation.version} · ${f.citation.path}` : "";
        const docId = f.sectionCode ? scoped.find((d) => d.ctdSection === f.sectionCode)?.id ?? null : null;
        return {
          dossierVersionId, code: agentCode(agentKey), severity: f.severity, category: f.category.slice(0, 40),
          title: `[${spec.name}] ${f.title}`.slice(0, 200), detail: (f.detail + cite).slice(0, 2000),
          evidence: (f.evidence || null)?.slice(0, 1200) ?? null, sectionCode: f.sectionCode, documentId: docId,
          source: "AI" as const, blocker: false, draft: true,
        };
      }),
    });
  }

  await regAudit({
    companyId: version.dossier.companyId, actorId: "system", dossierId: version.dossier.id, dossierVersionId,
    action: result.abstained ? "AGENT_ABSTAINED" : "AGENT_RUN",
    detail: result.abstained
      ? `Agent « ${spec.name} » (v${spec.promptVersion}) : ${result.message ?? "abstention"} — aucun constat inventé.`
      : `Agent « ${spec.name} » (v${spec.promptVersion}) : ${result.findings.length} constat(s) PROJET${result.error ? ` — ${result.error}` : ""}.`,
    meta: { agentKey, promptVersion: spec.promptVersion, citations: result.citations.length },
  });

  return {
    ok: result.ok, agentKey, agentName: spec.name, configured: result.configured,
    abstained: result.abstained, message: result.message, findings: result.findings.length, error: result.error,
  };
}

/** Liste des agents applicables aux sections présentes dans une version (pour l'UI). */
export async function applicableAgents(dossierVersionId: string): Promise<{ key: string; name: string; requiresSource: boolean }[]> {
  const docs = await prisma.regulatoryDocument.findMany({
    where: { dossierVersionId, ctdSection: { not: null } },
    select: { ctdSection: true },
  });
  const sections = docs.map((d) => d.ctdSection!).filter(Boolean);
  return agentsForSections(sections).map((a) => ({ key: a.key, name: a.name, requiresSource: a.requiresSource }));
}
