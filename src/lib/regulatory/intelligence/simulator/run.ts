import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { askClaude, aiConfigured } from "@/lib/ai";
import { extractLooseJson } from "../ai/json";
import { regAudit } from "../audit";
import { PROCEDURE_TYPE_LABELS } from "../labels";

/**
 * REVIEWER SIMULATOR (G11) — stress test MULTI-PERSPECTIVES du dossier. **Simulation interne
 * NON PRÉDICTIVE** : ce n'est jamais une décision de l'ANPP, seulement un exercice d'anticipation
 * des questions probables. IA encadrée (Zod, anti-injection), opt-in sur clé ; sinon abstention.
 */

export const PERSPECTIVES: { key: string; label: string; focus: string }[] = [
  { key: "RECEVABILITE", label: "Recevabilité", focus: "pièces administratives minimales, formulaire, droits" },
  { key: "M1", label: "Module 1 (Algérie)", focus: "exigences administratives ANPP, RCP/notice/étiquetage" },
  { key: "CMC", label: "Qualité (CMC)", focus: "substance active, produit fini, procédé, spécifications" },
  { key: "ANALYTIQUE", label: "Analytique", focus: "méthodes et validation (ICH Q2)" },
  { key: "STABILITE", label: "Stabilité", focus: "études zone IVb, durée de conservation" },
  { key: "BIOEQUIVALENCE", label: "Bioéquivalence", focus: "produit de référence, design d'étude (génériques)" },
  { key: "CLINIQUE", label: "Clinique", focus: "efficacité, sécurité, indication" },
  { key: "PV", label: "Pharmacovigilance", focus: "profil de sécurité, plan de gestion des risques" },
  { key: "MEDICO_ECO", label: "Médico-économique", focus: "intérêt thérapeutique, positionnement" },
  { key: "COMMISSION", label: "Commission d'enregistrement", focus: "synthèse et points de blocage probables" },
];

const PerspectiveSchema = z.object({
  perspective: z.string().min(1).max(60),
  verdict: z.enum(["FAVORABLE", "RESERVES", "DEFAVORABLE"]).catch("RESERVES"),
  questions: z.array(z.string().max(400)).max(6).default([]),
  risks: z.array(z.string().max(400)).max(6).default([]),
});
const OutputSchema = z.object({ overall: z.string().max(1500).optional().default(""), perspectives: z.array(PerspectiveSchema).max(12) });

export interface SimPerspective { perspective: string; verdict: string; questions: string[]; risks: string[] }
export interface SimulationResult { ok: boolean; configured: boolean; simulationId?: string; perspectives: SimPerspective[]; overall?: string; error?: string }

export type AiFn = (prompt: string, opts: { system?: string; maxTokens?: number; temperature?: number }) => Promise<{ ok: boolean; configured: boolean; text?: string; error?: string }>;

const SYSTEM = [
  "Tu SIMULES un examen réglementaire multi-perspectives INTERNE pour un dossier CTD destiné à l'ANPP (Algérie).",
  "Cette simulation est NON PRÉDICTIVE : ce n'est en AUCUN CAS une décision de l'ANPP, seulement un exercice d'anticipation des questions probables.",
  "RÈGLES : 1) réponds UNIQUEMENT en JSON conforme au schéma ; 2) pour chaque perspective, donne un verdict SIMULÉ (FAVORABLE|RESERVES|DEFAVORABLE), des questions probables et des risques ; 3) reste factuel et prudent ; 4) n'invente pas de données absentes du résumé.",
].join("\n");

/** Résumé compact et FIABLE du dossier (nos propres données structurées) pour le prompt. */
async function dossierSummary(dossierVersionId: string): Promise<string> {
  const [version, assessment, facts, docs] = await Promise.all([
    prisma.regulatoryDossierVersion.findUnique({ where: { id: dossierVersionId }, select: { dossier: { select: { procedureType: true, title: true } } } }),
    prisma.regulatoryAssessment.findUnique({ where: { dossierVersionId }, select: { completeness: true, conforme: true, blockers: true, criticals: true, majors: true } }),
    prisma.regulatoryFact.findMany({ where: { dossierVersionId, status: { in: ["CONFIRMED", "CORRECTED"] } }, select: { label: true, value: true, approvedValue: true }, take: 30 }),
    prisma.regulatoryDocument.findMany({ where: { dossierVersionId, ctdSection: { not: null } }, select: { ctdSection: true }, take: 200 }),
  ]);
  const sections = [...new Set(docs.map((d) => d.ctdSection))].join(", ");
  const factLines = facts.map((f) => `- ${f.label} : ${f.approvedValue ?? f.value}`).join("\n");
  return [
    `Procédure : ${version ? PROCEDURE_TYPE_LABELS[version.dossier.procedureType] : "?"}`,
    assessment ? `Complétude : ${assessment.completeness}% ; bloqueurs : ${assessment.blockers} ; critiques : ${assessment.criticals} ; majeurs : ${assessment.majors} ; conforme : ${assessment.conforme}` : "Aucun bilan déterministe.",
    `Sections CTD présentes : ${sections || "aucune"}`,
    `Faits approuvés du jumeau numérique :\n${factLines || "(aucun fait approuvé)"}`,
  ].join("\n");
}

export async function runReviewerSimulation(dossierVersionId: string, actorId: string, aiFn: AiFn = askClaude): Promise<SimulationResult> {
  const version = await prisma.regulatoryDossierVersion.findUnique({ where: { id: dossierVersionId }, select: { dossier: { select: { id: true, companyId: true } } } });
  if (!version) return { ok: false, configured: aiConfigured(), perspectives: [], error: "Version introuvable." };

  if (!aiConfigured() && aiFn === askClaude) {
    return { ok: true, configured: false, perspectives: [], error: "IA non configurée (ANTHROPIC_API_KEY absente) — simulation indisponible, aucune donnée simulée." };
  }

  const summary = await dossierSummary(dossierVersionId);
  const prompt = [
    "RÉSUMÉ DU DOSSIER (données fiables, issues de l'analyse interne) :",
    summary,
    "",
    `PERSPECTIVES À SIMULER : ${PERSPECTIVES.map((p) => `${p.label} (${p.focus})`).join(" ; ")}.`,
    'Renvoie STRICTEMENT : {"overall":"synthèse simulée","perspectives":[{"perspective":"...","verdict":"FAVORABLE|RESERVES|DEFAVORABLE","questions":["..."],"risks":["..."]}]}.',
  ].join("\n");

  // Plafond de jetons LARGE (10 perspectives riches) pour éviter la troncature — cause n°1 des
  // « Réponse IA non exploitable » ; et parsing TOLÉRANT (récupère même une réponse tronquée).
  const res = await aiFn(prompt, { system: SYSTEM, maxTokens: 6000, temperature: 0.3 });
  if (!res.ok) return { ok: false, configured: res.configured, perspectives: [], error: res.error };
  const parsed = extractLooseJson(res.text ?? "");
  if (parsed === null) return { ok: false, configured: res.configured, perspectives: [], error: "Réponse IA non exploitable." };
  const validated = OutputSchema.safeParse(parsed);
  if (!validated.success) return { ok: false, configured: res.configured, perspectives: [], error: "Sortie non conforme au schéma." };

  const perspectives: SimPerspective[] = validated.data.perspectives.map((p) => ({ perspective: p.perspective, verdict: p.verdict, questions: p.questions, risks: p.risks }));
  const sim = await prisma.regulatorySimulation.create({
    data: { dossierVersionId, perspectives: perspectives as unknown as object, overall: validated.data.overall || null, configured: true, createdById: actorId },
    select: { id: true },
  });
  await regAudit({ companyId: version.dossier.companyId, actorId, dossierId: version.dossier.id, dossierVersionId, action: "SIMULATION_RUN", detail: `Simulation multi-perspectives (NON prédictive) : ${perspectives.length} perspective(s).` });
  return { ok: true, configured: true, simulationId: sim.id, perspectives, overall: validated.data.overall };
}
