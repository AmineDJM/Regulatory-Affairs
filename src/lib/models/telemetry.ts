import { AsyncLocalStorage } from "node:async_hooks";
import type { ModelRole, ModelUsage } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MESURE D'UN TOUR — parce qu'« Adam est lent » n'est pas un diagnostic.
 *
 * ── CE QU'ON VEUT POUVOIR RÉPONDRE ───────────────────────────────────────────────────────
 *
 *   • quelle VOIE a été prise (texte, audio A/B, audio C délégué) ;
 *   • combien d'appels de modèle, PAR RÔLE — c'est la seule façon de vérifier la règle « A et B
 *     ne doivent surtout pas appeler l'orchestrateur inutilement » autrement qu'à l'intuition ;
 *   • le temps jusqu'au PREMIER signe de vie, puis jusqu'au résultat final. Les deux comptent, et
 *     pas de la même façon : un tour qui met 6 s mais montre quelque chose à 400 ms est vécu comme
 *     rapide, un tour qui met 3 s sans rien montrer est vécu comme cassé ;
 *   • le coût — quand il est connu (voir `contract.ts` : jamais de tarif inventé).
 *
 * ── POURQUOI `AsyncLocalStorage` ET PAS UN PARAMÈTRE ─────────────────────────────────────
 *
 * Le compteur devrait sinon traverser la boucle d'agent, les outils, les workers et les
 * adaptateurs — des centaines de signatures, dont la plupart n'ont rien à voir avec la mesure.
 * Un contexte asynchrone donne la portée « ce tour-ci » sans toucher à une seule signature, et
 * il se propage naturellement à travers les `await` et les `Promise.all` — donc à travers la
 * parallélisation, qui est justement ce qu'on veut mesurer.
 *
 * HORS D'UN TOUR, tout est silencieux : jamais d'exception parce qu'un appel a lieu depuis un
 * script, un cron ou un test. Ne pas mesurer est acceptable ; planter à cause du compteur, non.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La VOIE prise par un tour. C'est le fait le plus important à consigner. */
export type TurnRoute =
  | "text"          // demande écrite → orchestrateur directement
  | "voice-direct"  // audio A/B — le temps réel a exécuté seul
  | "voice-deep"    // audio C — le temps réel a délégué à l'orchestrateur
  | "worker"        // sous-tâche lancée par l'orchestrateur
  | "background";   // mission planifiée, brief, cron

export interface ToolTrace {
  name: string;
  ms: number;
  ok: boolean;
  /** true si l'outil a tourné en parallèle d'au moins un autre — pour juger la parallélisation. */
  parallel?: boolean;
}

export interface TurnTrace {
  turnId: string;
  route: TurnRoute;
  startedAt: number;
  calls: ModelUsage[];
  tools: ToolTrace[];
  /** Temps jusqu'au premier signe de vie affiché (texte ou bloc). */
  firstPreviewMs: number | null;
  finalMs: number | null;
  /** Le niveau décidé par le triage, quand il y en a eu un. */
  complexity: "A" | "B" | "C" | null;
}

const storage = new AsyncLocalStorage<TurnTrace>();

let counter = 0;
const newTurnId = (): string => `t${Date.now().toString(36)}${(counter = (counter + 1) % 46656).toString(36).padStart(3, "0")}`;

/** Le tour en cours, s'il y en a un. */
export function currentTurn(): TurnTrace | undefined {
  return storage.getStore();
}

/**
 * Ouvre un tour et exécute `fn` dedans. Tout appel de modèle fait à l'intérieur — y compris dans
 * les branches parallèles — s'y rattache tout seul.
 *
 * UN TOUR NE S'IMBRIQUE PAS. Si un tour est déjà ouvert, on le REJOINT au lieu d'en créer un
 * second : quand la voix délègue (niveau C), l'orchestrateur texte tourne à l'intérieur du tour
 * vocal. Ouvrir un tour imbriqué masquerait ses appels au tour parent — c'est-à-dire cacher
 * exactement la preuve qu'on cherche : « un C fait bien travailler l'orchestrateur ». La voie
 * annoncée reste celle du tour d'ORIGINE, qui est celle que l'utilisateur a vécue.
 */
export function withTurn<T>(route: TurnRoute, fn: (trace: TurnTrace) => Promise<T>): Promise<T> {
  const existing = currentTurn();
  if (existing) return fn(existing);

  const trace: TurnTrace = {
    turnId: newTurnId(),
    route,
    startedAt: Date.now(),
    calls: [],
    tools: [],
    firstPreviewMs: null,
    finalMs: null,
    complexity: null,
  };
  return storage.run(trace, () => fn(trace));
}

export function recordModelCall(usage: ModelUsage): void {
  currentTurn()?.calls.push(usage);
}

export function recordTool(trace: ToolTrace): void {
  currentTurn()?.tools.push(trace);
}

/** Le premier signe de vie. Seul le PREMIER compte : après, l'utilisateur regarde déjà. */
export function markPreview(): void {
  const t = currentTurn();
  if (t && t.firstPreviewMs == null) t.firstPreviewMs = Date.now() - t.startedAt;
}

export function markFinal(): void {
  const t = currentTurn();
  if (t && t.finalMs == null) t.finalMs = Date.now() - t.startedAt;
}

export function markComplexity(level: "A" | "B" | "C"): void {
  const t = currentTurn();
  if (t) t.complexity = level;
}

export interface TurnSummary {
  turnId: string;
  route: TurnRoute;
  complexity: "A" | "B" | "C" | null;
  llmCalls: number;
  callsByRole: Record<ModelRole, number>;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  /** `null` dès qu'un seul appel a un tarif inconnu : un total partiel se lirait comme un total. */
  costUsd: number | null;
  firstPreviewMs: number | null;
  finalMs: number | null;
  totalMs: number;
}

export function summarize(trace: TurnTrace): TurnSummary {
  const callsByRole = { realtime: 0, orchestrator: 0, worker: 0, bulk: 0 } as Record<ModelRole, number>;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  // Un seul tarif manquant rend le TOTAL inconnu. Additionner ce qu'on connaît et présenter la
  // somme comme le coût du tour serait un chiffre faux avec l'air d'un chiffre juste.
  let costUsd: number | null = 0;

  for (const c of trace.calls) {
    callsByRole[c.role] = (callsByRole[c.role] ?? 0) + 1;
    inputTokens += c.inputTokens;
    outputTokens += c.outputTokens;
    cachedInputTokens += c.cachedInputTokens;
    if (c.costUsd == null) costUsd = null;
    else if (costUsd != null) costUsd += c.costUsd;
  }

  return {
    turnId: trace.turnId,
    route: trace.route,
    complexity: trace.complexity,
    llmCalls: trace.calls.length,
    callsByRole,
    toolCalls: trace.tools.length,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    costUsd: costUsd == null ? null : Math.round(costUsd * 1_000_000) / 1_000_000,
    firstPreviewMs: trace.firstPreviewMs,
    finalMs: trace.finalMs,
    totalMs: Date.now() - trace.startedAt,
  };
}

/**
 * Consigne le tour dans le journal serveur. Une ligne, structurée : c'est ce qui permet de suivre
 * une régression de latence dans le temps sans instrumenter un tableau de bord d'abord.
 */
export function logTurn(trace: TurnTrace): TurnSummary {
  const s = summarize(trace);
  console.info("[adam] turn", JSON.stringify(s));
  return s;
}
