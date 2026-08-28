import { prisma } from "@/lib/prisma";
import type { CompiledMission, CompiledStep, StepSpec } from "@/lib/missions/compiler/compile";
import { MissionState, StepState, assertTransition } from "@/lib/missions/runtime/state";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PERSISTANCE — une mission survit à tout ce qui peut l'interrompre (§3).
 *
 * ── CE QU'ELLE DOIT SURVIVRE, LITTÉRALEMENT ──────────────────────────────────────────────
 *
 * L'application fermée, la connexion coupée, le serveur redémarré, le fournisseur en erreur,
 * cinq jours d'attente. Aucune de ces situations n'est exceptionnelle sur une mission de
 * plusieurs jours : ce sont les conditions NORMALES d'existence d'une mission longue.
 *
 * ── POURQUOI IL N'Y A PAS DE TABLE DE POINTS DE REPRISE ──────────────────────────────────
 *
 * Parce qu'une étape TERMINÉE, avec son reçu, EST le point de reprise. Une seconde table
 * dirait la même chose une deuxième fois, et divergerait le jour où un chemin d'erreur
 * n'écrirait que l'une des deux. Au redémarrage, le moteur relit les étapes : celles qui
 * portent un reçu ne sont pas rejouées. C'est tout le mécanisme, et il tient en une phrase.
 *
 * ── LA RÉ-ENTRANCE ───────────────────────────────────────────────────────────────────────
 *
 * `materialiser` peut être rappelée sur la même mission sans rien dupliquer : la clé d'étape
 * est unique par mission, en BASE. Ce n'est pas une politesse — un replan la rappelle, et une
 * duplication produirait un second envoi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface MaterialiserOptions {
  ownerId: string;
  title: string;
  goalRaw: string;
  parentMissionId?: string | null;
  maxConcurrency?: number;
  /** Quand elle est fournie, on MET À JOUR cette mission au lieu d'en créer une (replan). */
  missionId?: string;
}

/** Ce que le moteur relit au démarrage : l'état exact, sans rien reconstruire de mémoire. */
export interface EtatMission {
  id: string;
  status: MissionState;
  ownerId: string;
  planVersion: number;
  maxConcurrency: number;
  acceptance: string[];
  goalRaw: string;
  objective: string;
  /**
   * LA CARTE DU PLAN telle que le planificateur l'a rendue : axes, livrables attendus,
   * stratégie d'accord, critère arithmétique de fin. Lue par le contrôle qualité (qui vérifie
   * que les livrables annoncés existent) et par le juge (qui lit le critère de fin).
   */
  planMeta: Record<string, unknown>;
  steps: EtatEtape[];
}

export interface EtatEtape {
  id: string;
  key: string;
  title: string;
  workstream: string;
  nodeType: string;
  capability: string | null;
  input: Record<string, unknown>;
  status: StepState;
  attempt: number;
  maxAttempts: number;
  idempotencyKey: string | null;
  result: unknown;
  receipt: string | null;
  error: string | null;
  errorKind: string | null;
  waitFor: Record<string, unknown> | null;
  /** { from, path, as } — non nul quand l'étape est un MODÈLE à démultiplier (§10). */
  forEach: { from: string; path: string; as: string } | null;
  /** Ce que le MOTEUR doit savoir pour exécuter l'étape — schéma de sortie, condition de fin. */
  spec: StepSpec | null;
  needsIdempotencyKey: boolean;
  planVersion: number;
  dependsOn: string[];
}

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * L'éventail relu depuis la base — RETYPÉ, jamais cru sur parole.
 *
 * Un JSON en base peut avoir été écrit par une version antérieure du code. Un `from` manquant
 * ferait chercher la collection dans une étape nommée « undefined » ; mieux vaut n'y voir aucun
 * éventail et laisser l'étape s'exécuter normalement.
 */
function lireEventail(v: unknown): { from: string; path: string; as: string } | null {
  const o = asObj(v);
  const from = typeof o.from === "string" ? o.from : "";
  const path = typeof o.path === "string" ? o.path : "";
  const as = typeof o.as === "string" ? o.as : "";
  return from && path && as ? { from, path, as } : null;
}

/**
 * ÉCRIT LE PLAN COMPILÉ EN BASE, et rend l'identifiant de la mission.
 *
 * ── POURQUOI LES ARÊTES SONT ÉCRITES APRÈS LES NŒUDS, EN DEUX TEMPS ─────────────────────
 *
 * Une arête référence deux étapes par leur identifiant de base ; elles doivent donc toutes
 * exister d'abord. On aurait pu stocker les dépendances en JSON sur l'étape et s'épargner la
 * table — au prix de ne plus pouvoir demander « quelles étapes attendent celle-ci ? » sans
 * relire toute la mission. Le moteur pose cette question à chaque étape terminée.
 */
export async function materialiser(
  compiled: CompiledMission,
  opts: MaterialiserOptions,
): Promise<string> {
  const donneesMission = {
    kind: "RUNTIME",
    title: opts.title,
    objective: compiled.objective,
    goalRaw: opts.goalRaw,
    acceptance: compiled.acceptance,
    complexity: compiled.complexity,
    scale: compiled.scale,
    maxConcurrency: opts.maxConcurrency ?? 6,
    parentMissionId: opts.parentMissionId ?? null,
    planMeta: compiled.planMeta as never,
  };

  const mission = opts.missionId
    ? await prisma.mission.update({
        where: { id: opts.missionId },
        // LE REPLAN INCRÉMENTE LA VERSION plutôt que d'effacer l'ancienne (§21). Les étapes déjà
        // faites gardent leur version : c'est ce qui permet de dire « ceci a été fait sous le
        // plan 1 » au lieu de laisser croire que le plan actuel a tout produit.
        data: { ...donneesMission, planVersion: { increment: 1 } },
      })
    : await prisma.mission.create({
        data: { ...donneesMission, ownerId: opts.ownerId, status: "PLANNING" },
      });

  const version = mission.planVersion;

  // ── 1. LES NŒUDS ────────────────────────────────────────────────────────────────────
  for (const s of compiled.steps) {
    await prisma.missionStep.upsert({
      where: { missionId_key: { missionId: mission.id, key: s.key } },
      create: {
        missionId: mission.id,
        key: s.key,
        title: s.title,
        workstream: s.workstream ?? "default",
        nodeType: s.nodeType,
        capability: s.capability,
        input: s.input as never,
        maxAttempts: s.maxAttempts,
        waitFor: (s.waitFor ?? undefined) as never,
        forEach: (s.forEach ?? undefined) as never,
        spec: (s.spec ?? undefined) as never,
        needsIdempotencyKey: s.needsIdempotencyKey,
        planVersion: version,
        status: "PENDING",
      },
      // UNE ÉTAPE DÉJÀ TERMINÉE N'EST PAS RÉÉCRITE — c'est l'invariant qui protège du double
      // envoi lors d'un replan. On ne met à jour que ce qui est encore devant nous.
      update: {},
    });
  }

  const enBase = await prisma.missionStep.findMany({
    where: { missionId: mission.id },
    select: { id: true, key: true, status: true },
  });
  const parCle = new Map(enBase.map((s) => [s.key, s]));

  // Le rafraîchissement des étapes NON commencées : titre, entrée, dépendances peuvent avoir
  // changé au replan. Celles qui tournent ou sont finies gardent ce sous quoi elles ont tourné.
  for (const s of compiled.steps) {
    const ligne = parCle.get(s.key);
    if (!ligne || ligne.status !== "PENDING") continue;
    await prisma.missionStep.update({
      where: { id: ligne.id },
      data: {
        title: s.title,
        workstream: s.workstream ?? "default",
        nodeType: s.nodeType,
        capability: s.capability,
        input: s.input as never,
        maxAttempts: s.maxAttempts,
        waitFor: (s.waitFor ?? undefined) as never,
        forEach: (s.forEach ?? undefined) as never,
        spec: (s.spec ?? undefined) as never,
        needsIdempotencyKey: s.needsIdempotencyKey,
        planVersion: version,
      },
    });
  }

  // ── 2. LES ARÊTES ───────────────────────────────────────────────────────────────────
  for (const s of compiled.steps) {
    const cible = parCle.get(s.key);
    if (!cible) continue;
    for (const d of s.dependsOn) {
      const source = parCle.get(d);
      if (!source) continue;
      await prisma.missionStepDep.upsert({
        where: { stepId_dependsOnId: { stepId: cible.id, dependsOnId: source.id } },
        create: { stepId: cible.id, dependsOnId: source.id },
        update: {},
      });
    }
  }

  await journaliser(mission.id, "PLAN_COMPILED",
    `Plan v${version} : ${compiled.steps.length} étapes, profondeur ${compiled.depth}, `
    + `effet maximal ${compiled.maxEffect}.`,
    { planVersion: version, steps: compiled.steps.length, maxEffect: compiled.maxEffect, capabilities: compiled.capabilities });

  return mission.id;
}

/** RELIT TOUT L'ÉTAT. Le moteur ne garde rien en mémoire d'un tour à l'autre — c'est ce qui le rend reprenable. */
export async function chargerEtat(missionId: string): Promise<EtatMission | null> {
  const m = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      steps: {
        include: { deps: { include: { dependsOn: { select: { key: true } } } } },
        // L'ORDRE EST STABLE, ET C'EST NÉCESSAIRE : sans lui, Postgres rend les étapes dans
        // l'ordre où il les trouve, qui change avec les mises à jour. L'écran de mission
        // réordonnerait ses lignes à chaque rafraîchissement, et un test comparant une liste
        // d'étapes échouerait un jour sur deux sans qu'aucun code ait bougé.
        orderBy: [{ createdAt: "asc" }, { key: "asc" }],
      },
    },
  });
  if (!m) return null;

  return {
    id: m.id,
    status: m.status as MissionState,
    ownerId: m.ownerId,
    planVersion: m.planVersion,
    maxConcurrency: m.maxConcurrency,
    acceptance: asStrings(m.acceptance),
    goalRaw: m.goalRaw ?? m.objective,
    objective: m.objective,
    planMeta: asObj(m.planMeta),
    steps: m.steps.map((s) => ({
      id: s.id,
      key: s.key,
      title: s.title,
      workstream: s.workstream,
      nodeType: s.nodeType,
      capability: s.capability,
      input: asObj(s.input),
      status: s.status as StepState,
      attempt: s.attempt,
      maxAttempts: s.maxAttempts,
      idempotencyKey: s.idempotencyKey,
      result: s.result,
      receipt: s.receipt,
      error: s.error,
      errorKind: s.errorKind,
      waitFor: s.waitFor ? asObj(s.waitFor) : null,
      forEach: lireEventail(s.forEach),
      spec: s.spec ? (asObj(s.spec) as StepSpec) : null,
      needsIdempotencyKey: s.needsIdempotencyKey,
      planVersion: s.planVersion,
      dependsOn: s.deps.map((d) => d.dependsOn.key),
    })),
  };
}

/**
 * CHANGE L'ÉTAT DE LA MISSION — en passant par la machine à états, jamais autour.
 *
 * L'assertion lève : une transition impossible est un bug du moteur, et le découvrir trois
 * jours plus tard sur une mission incohérente coûte infiniment plus cher qu'un plantage net.
 */
export async function transitionner(
  missionId: string,
  vers: MissionState,
  raison?: string,
): Promise<void> {
  const m = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true } });
  if (!m) throw new Error(`mission introuvable : ${missionId}`);
  const depuis = m.status as MissionState;
  if (depuis === vers) return;
  assertTransition(depuis, vers);

  await prisma.mission.update({
    where: { id: missionId },
    data: {
      status: vers,
      ...(vers === "RUNNING" ? { startedAt: new Date() } : {}),
      ...(vers === "COMPLETED" || vers === "CANCELLED" ? { closedAt: new Date() } : {}),
    },
  });
  await journaliser(missionId, "STATE_CHANGED", raison ?? `${depuis} → ${vers}`, { from: depuis, to: vers });
}

/**
 * LE JOURNAL — on RÉUTILISE `MissionEvent` (§17 : pas de deuxième registre d'événements).
 *
 * `MissionEvent` est déjà le récit d'une mission, avec son acteur et son horodatage. Créer un
 * « MissionRuntimeLog » à côté aurait donné deux histoires de la même mission, et la question
 * « que s'est-il passé ? » aurait eu deux réponses.
 */
export async function journaliser(
  missionId: string,
  kind: string,
  summary: string,
  detail?: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  await prisma.missionEvent.create({
    data: { missionId, kind, summary, detail: (detail ?? undefined) as never, actorId: actorId ?? null },
  });
}

/** Incrémente les compteurs d'observabilité (§54). Additif, pour rester juste en concurrence. */
export async function compter(
  missionId: string,
  d: { modelCalls?: number; toolCalls?: number; tokensIn?: number; tokensOut?: number; costUsd?: number },
): Promise<void> {
  await prisma.mission.update({
    where: { id: missionId },
    data: {
      modelCalls: { increment: d.modelCalls ?? 0 },
      toolCalls: { increment: d.toolCalls ?? 0 },
      tokensIn: { increment: d.tokensIn ?? 0 },
      tokensOut: { increment: d.tokensOut ?? 0 },
      costUsd: { increment: d.costUsd ?? 0 },
    },
  });
}

/**
 * LA CLÉ D'IDEMPOTENCE D'UNE ÉTAPE (§15).
 *
 * Elle est DÉTERMINISTE : les mêmes entrées produisent la même clé, quel que soit le nombre de
 * redémarrages. C'est exactement ce qui fait qu'un crash à l'étape 73 ne renvoie pas les
 * soixante-douze e-mails précédents — la base refuse la seconde insertion.
 *
 * La cible est incluse parce que l'unicité utile n'est pas « cette étape » mais « cette action
 * vers cette personne » : deux itérations d'un même éventail portent la même clé d'étape et ne
 * doivent surtout pas se dédupliquer l'une l'autre.
 */
export function cleIdempotence(
  missionId: string,
  stepKey: string,
  capability: string,
  cible: string | null,
): string {
  return [missionId, stepKey, capability, cible ?? "-"].join("|");
}
