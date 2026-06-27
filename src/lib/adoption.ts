/**
 * Score d'adoption — **réservé à l'administration**.
 *
 * Mesure à quel point chaque personne utilise réellement l'OS comme outil
 * quotidien, de façon **robuste au gaming** :
 *  - On compte des **jours actifs distincts** (pas le volume d'un seul jour) → un
 *    burst d'actions sur une journée ne gonfle pas le score.
 *  - On ne compte que le **travail durable** : tâches RÉELLEMENT terminées
 *    (`completedAt`), validations décidées, directives accusées. Créer puis
 *    supprimer des tâches ne laisse aucune ligne survivante → contribution nulle.
 *  - L'**interaction** est en partie bilatérale (mentions reçues, fils distincts)
 *    → difficile à simuler seul.
 *  - On récompense la **diversité** (modules touchés, types d'actions) plutôt que
 *    la répétition d'une action bon marché.
 *  - **Récence** + **régularité** dominent, pour valoriser l'usage continu.
 *
 * Tout est calculé en temps réel à partir des données réelles (aucune simulation).
 */
import { prisma } from "./prisma";
import { PERMISSIONS } from "./rbac";
import type { UserRole } from "@prisma/client";

const WINDOW_DAYS = 30;

export interface AdoptionComponent {
  key: string;
  label: string;
  /** 0–100 (sous-score normalisé de la dimension). */
  score: number;
  /** Poids de la dimension dans le score global. */
  weight: number;
  detail: string;
}

export interface AdoptionScore {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** 0–100. */
  score: number;
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
  activeDays: number;
  lastSeen: Date | null;
  /** Évolution des jours actifs vs la période précédente (+/–). */
  trend: number;
  components: AdoptionComponent[];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

/** Nombre de modules par défaut du rôle (pour normaliser l'étendue équitablement). */
function roleModuleTarget(role: UserRole): number {
  const count = Object.keys(PERMISSIONS[role] ?? {}).length;
  return Math.max(3, Math.min(7, count || 3));
}

function labelFor(score: number): { label: string; tone: AdoptionScore["tone"] } {
  if (score >= 80) return { label: "Champion", tone: "success" };
  if (score >= 60) return { label: "Actif", tone: "info" };
  if (score >= 40) return { label: "Modéré", tone: "warning" };
  if (score >= 20) return { label: "Faible", tone: "danger" };
  return { label: "À risque", tone: "danger" };
}

interface RawRow {
  uid: string;
  [k: string]: unknown;
}

export interface AdoptionResult {
  scores: AdoptionScore[];
  average: number;
  windowDays: number;
}

/** Calcule le score d'adoption de tous les utilisateurs (batch d'agrégats). */
export async function getAdoptionScores(): Promise<AdoptionResult> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const prevSince = new Date(Date.now() - 2 * WINDOW_DAYS * 86400000);

  const [
    users,
    activityAgg,
    moduleRows,
    auditAgg,
    convAgg,
    prevDaysAgg,
    tasksDone,
    validations,
    directivesAck,
    messagesSent,
    mentions,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "SUPER_ADMIN" } }, // l'admin ne se mesure pas lui-même
      select: { id: true, name: true, email: true, role: true, isActive: true, lastSeenAt: true, lastLoginAt: true },
    }),
    prisma.$queryRaw<RawRow[]>`
      SELECT "userId" AS uid,
             COUNT(DISTINCT DATE("createdAt")) AS days,
             COALESCE(SUM(LEAST(COALESCE("durationMs",0), 1800000)),0) AS durms
      FROM "ActivityLog"
      WHERE "userId" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY "userId"`,
    prisma.$queryRaw<RawRow[]>`
      SELECT uid, "module" AS m FROM (
        SELECT "userId" AS uid, "module" FROM "ActivityLog"
          WHERE "userId" IS NOT NULL AND "module" IS NOT NULL AND "createdAt" >= ${since}
        UNION
        SELECT "actorId" AS uid, "module" FROM "AuditLog"
          WHERE "actorId" IS NOT NULL AND "createdAt" >= ${since}
      ) u`,
    prisma.$queryRaw<RawRow[]>`
      SELECT "actorId" AS uid,
             COUNT(DISTINCT (("action")::text || COALESCE(("entityType")::text,''))) AS combos
      FROM "AuditLog"
      WHERE "actorId" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY "actorId"`,
    prisma.$queryRaw<RawRow[]>`
      SELECT "senderId" AS uid, COUNT(DISTINCT "conversationId") AS convos
      FROM "Message"
      WHERE "senderId" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY "senderId"`,
    prisma.$queryRaw<RawRow[]>`
      SELECT "userId" AS uid, COUNT(DISTINCT DATE("createdAt")) AS days
      FROM "ActivityLog"
      WHERE "userId" IS NOT NULL AND "createdAt" >= ${prevSince} AND "createdAt" < ${since}
      GROUP BY "userId"`,
    prisma.task.groupBy({ by: ["assignedToId"], where: { status: "DONE", completedAt: { gte: since } }, _count: { _all: true } }),
    prisma.validationStep.groupBy({ by: ["validatorId"], where: { decidedAt: { gte: since }, status: { in: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] } }, _count: { _all: true } }),
    prisma.directive.groupBy({ by: ["acknowledgedById"], where: { acknowledgedAt: { gte: since } }, _count: { _all: true } }),
    prisma.message.groupBy({ by: ["senderId"], where: { kind: "TEXT", createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.messageMention.groupBy({ by: ["userId"], where: { message: { createdAt: { gte: since } } }, _count: { _all: true } }),
  ]);

  // Indexation par utilisateur.
  const days = new Map<string, number>();
  const durMs = new Map<string, number>();
  for (const r of activityAgg) { days.set(r.uid, num(r.days)); durMs.set(r.uid, num(r.durms)); }
  const modules = new Map<string, Set<string>>();
  for (const r of moduleRows) {
    const m = String((r as { m?: unknown }).m ?? "");
    if (!m) continue;
    let set = modules.get(r.uid);
    if (!set) { set = new Set(); modules.set(r.uid, set); }
    set.add(m);
  }
  const combos = new Map(auditAgg.map((r) => [r.uid, num(r.combos)]));
  const convos = new Map(convAgg.map((r) => [r.uid, num(r.convos)]));
  const prevDays = new Map(prevDaysAgg.map((r) => [r.uid, num(r.days)]));
  const tasksDoneM = new Map(tasksDone.map((r) => [r.assignedToId ?? "", r._count._all]));
  const validM = new Map(validations.map((r) => [r.validatorId, r._count._all]));
  const directiveM = new Map(directivesAck.map((r) => [r.acknowledgedById ?? "", r._count._all]));
  const msgM = new Map(messagesSent.map((r) => [r.senderId ?? "", r._count._all]));
  const mentionM = new Map(mentions.map((r) => [r.userId, r._count._all]));

  const now = Date.now();
  const scores: AdoptionScore[] = users.map((u) => {
    const d = days.get(u.id) ?? 0;
    const engagedMin = (durMs.get(u.id) ?? 0) / 60000;
    const modBreadth = modules.get(u.id)?.size ?? 0;
    const diversity = combos.get(u.id) ?? 0;
    const durable = (tasksDoneM.get(u.id) ?? 0) + (validM.get(u.id) ?? 0) + (directiveM.get(u.id) ?? 0);
    const msg = msgM.get(u.id) ?? 0;
    const conv = convos.get(u.id) ?? 0;
    const ment = mentionM.get(u.id) ?? 0;
    // Interaction : volume plafonné (anti-spam) + signaux bilatéraux mieux pondérés.
    const interaction = Math.min(msg, 60) * 0.5 + conv * 3 + ment * 4;

    const lastSeen = u.lastSeenAt ?? u.lastLoginAt ?? null;
    const sinceSeenDays = lastSeen ? (now - lastSeen.getTime()) / 86400000 : 999;
    const recency = clamp01(1 - (sinceSeenDays - 1) / 20); // 1 si ≤1j, 0 à ≥21j

    const targetModules = roleModuleTarget(u.role);

    const comps: AdoptionComponent[] = [
      { key: "regularity", label: "Régularité", weight: 22, score: Math.round(clamp01(d / 18) * 100), detail: `${d} jour·s actif·s / 30` },
      { key: "time", label: "Temps d'activité", weight: 10, score: Math.round(clamp01(engagedMin / 600) * 100), detail: `${Math.round(engagedMin / 60)} h cumulée·s` },
      { key: "breadth", label: "Étendue (modules)", weight: 15, score: Math.round(clamp01(modBreadth / targetModules) * 100), detail: `${modBreadth} module·s utilisé·s` },
      { key: "diversity", label: "Diversité d'actions", weight: 12, score: Math.round(clamp01(diversity / 8) * 100), detail: `${diversity} type·s d'action` },
      { key: "durable", label: "Travail durable", weight: 15, score: Math.round(clamp01(durable / 12) * 100), detail: `${durable} contribution·s abouties` },
      { key: "interaction", label: "Interaction", weight: 18, score: Math.round(clamp01(interaction / 40) * 100), detail: `${conv} fil·s · ${ment} mention·s · ${msg} msg` },
      { key: "recency", label: "Récence", weight: 8, score: Math.round(recency * 100), detail: lastSeen ? `vu il y a ${Math.max(0, Math.round(sinceSeenDays))} j` : "jamais vu" },
    ];

    const score = Math.round(comps.reduce((s, c) => s + (c.score / 100) * c.weight, 0));
    const { label, tone } = u.isActive ? labelFor(score) : { label: "Compte inactif", tone: "neutral" as const };

    return {
      userId: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive,
      score, label, tone, activeDays: d, lastSeen,
      trend: d - (prevDays.get(u.id) ?? 0),
      components: comps,
    };
  });

  scores.sort((a, b) => b.score - a.score);
  const active = scores.filter((s) => s.isActive);
  const average = active.length ? Math.round(active.reduce((s, x) => s + x.score, 0) / active.length) : 0;
  return { scores, average, windowDays: WINDOW_DAYS };
}

/** Score d'un seul utilisateur (réutilise le batch ; base interne réduite). */
export async function getAdoptionScore(userId: string): Promise<AdoptionScore | null> {
  const { scores } = await getAdoptionScores();
  return scores.find((s) => s.userId === userId) ?? null;
}
