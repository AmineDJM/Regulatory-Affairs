/**
 * Centre de contrôle IA — réglages globaux + journal d'usage (serveur uniquement).
 *
 * Le Super Admin peut couper l'IA globalement ou par fonction sans toucher au code
 * ni aux variables d'environnement. Chaque point d'entrée IA appelle
 * `aiFeatureEnabled(feature)` avant d'appeler le modèle, et `logAiUsage(...)` après.
 */
import { prisma } from "./prisma";

export type AiFeature =
  | "assistant"
  | "nudge"
  | "brain"
  | "briefing"
  | "process_intel"
  | "field_report"
  | "voice";

export interface AiSettingsView {
  masterEnabled: boolean;
  assistantEnabled: boolean;
  proactiveNudgesEnabled: boolean;
  brainEnabled: boolean;
  processIntelEnabled: boolean;
  fieldReportAiEnabled: boolean;
  voiceTranscriptEnabled: boolean;
}

const DEFAULTS: AiSettingsView = {
  masterEnabled: true,
  assistantEnabled: true,
  proactiveNudgesEnabled: true,
  brainEnabled: true,
  processIntelEnabled: true,
  fieldReportAiEnabled: true,
  voiceTranscriptEnabled: true,
};

/** Quelle bascule gouverne quelle fonction. */
const FEATURE_KEY: Record<AiFeature, keyof AiSettingsView> = {
  assistant: "assistantEnabled",
  nudge: "proactiveNudgesEnabled",
  brain: "brainEnabled",
  briefing: "brainEnabled",
  process_intel: "processIntelEnabled",
  field_report: "fieldReportAiEnabled",
  voice: "voiceTranscriptEnabled",
};

/**
 * Lit les réglages. Renvoie les valeurs par défaut si la ligne n'existe pas
 * encore (ou en cas de souci BDD : les réglages sont un confort, pas une garde
 * de sécurité — l'autorisation reste gérée par le RBAC). Toujours frais : une
 * bascule du Super Admin prend effet immédiatement (lecture d'une seule ligne).
 */
export async function getAiSettings(): Promise<AiSettingsView> {
  try {
    const row = await prisma.aiSetting.findUnique({ where: { id: "global" } });
    if (!row) return DEFAULTS;
    return {
      masterEnabled: row.masterEnabled,
      assistantEnabled: row.assistantEnabled,
      proactiveNudgesEnabled: row.proactiveNudgesEnabled,
      brainEnabled: row.brainEnabled,
      processIntelEnabled: row.processIntelEnabled,
      fieldReportAiEnabled: row.fieldReportAiEnabled,
      voiceTranscriptEnabled: row.voiceTranscriptEnabled,
    };
  } catch {
    return DEFAULTS;
  }
}

/** L'IA est-elle activée pour cette fonction ? (interrupteur général ET bascule de la fonction) */
export async function aiFeatureEnabled(feature: AiFeature): Promise<boolean> {
  const s = await getAiSettings();
  return s.masterEnabled && s[FEATURE_KEY[feature]];
}

export interface AiUsageInput {
  feature: AiFeature;
  provider?: "anthropic" | "openai";
  model?: string | null;
  userId?: string | null;
  ok: boolean;
  latencyMs?: number | null;
  errorCode?: string | null;
  /** Boucle agent uniquement : ressenti (1er mot), tours, outils appelés / en erreur, temps outils. */
  ttftMs?: number | null;
  turns?: number | null;
  toolCalls?: number | null;
  toolErrors?: number | null;
  toolLatencyMs?: number | null;
}

/** Journalise un appel IA (best-effort, ne lève jamais). */
export async function logAiUsage(input: AiUsageInput): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        feature: input.feature,
        provider: input.provider ?? "anthropic",
        model: input.model ?? null,
        userId: input.userId ?? null,
        ok: input.ok,
        latencyMs: input.latencyMs ?? null,
        errorCode: input.errorCode ?? null,
        ttftMs: input.ttftMs ?? null,
        turns: input.turns ?? null,
        toolCalls: input.toolCalls ?? null,
        toolErrors: input.toolErrors ?? null,
        toolLatencyMs: input.toolLatencyMs ?? null,
      },
    });
  } catch {
    /* best-effort */
  }
}
