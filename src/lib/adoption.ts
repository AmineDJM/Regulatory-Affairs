/**
 * Score d'adoption — **réservé à l'administration** pour le classement, mais chaque
 * employé voit **son propre** score (pastille de la barre du haut).
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
 * Les **poids** de chaque dimension et les **seuils** de libellé sont définis par le
 * Super Admin (modèle `AdoptionSetting`) ; le calcul reste fait en temps réel sur les
 * **données réelles** (aucune simulation).
 */
import { prisma } from "./prisma";
import { PERMISSIONS } from "./rbac";
import type { UserRole } from "@prisma/client";

const WINDOW_DAYS = 30;
/** Durée de fraîcheur du score mis en cache (pastille de la barre du haut). */
const BADGE_TTL_MS = 12 * 3600 * 1000;

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

// ───────────────────────── Réglages (poids + seuils) ─────────────────────────

export interface AdoptionWeights {
  regularity: number; time: number; breadth: number; diversity: number;
  durable: number; interaction: number; recency: number;
}
export interface AdoptionThresholds {
  champion: number; active: number; moderate: number; weak: number;
}
export interface AdoptionSettings { weights: AdoptionWeights; thresholds: AdoptionThresholds }

/** Valeurs par défaut (somme des poids = 100) — utilisées si la ligne n'existe pas. */
export const DEFAULT_ADOPTION_SETTINGS: AdoptionSettings = {
  weights: { regularity: 22, time: 10, breadth: 15, diversity: 12, durable: 15, interaction: 18, recency: 8 },
  thresholds: { champion: 80, active: 60, moderate: 40, weak: 20 },
};

/** Métadonnées des dimensions, pour le formulaire de réglage (rendu générique). */
export const ADOPTION_WEIGHT_FIELDS: { key: keyof AdoptionWeights; label: string; help: string }[] = [
  { key: "regularity", label: "Régularité", help: "Jours distincts d'activité (anti-burst)." },
  { key: "interaction", label: "Interaction", help: "Fils, mentions reçues, messages (bilatéral)." },
  { key: "durable", label: "Travail durable", help: "Tâches terminées, validations, directives accusées." },
  { key: "breadth", label: "Étendue (modules)", help: "Modules réellement utilisés (vs droits du rôle)." },
  { key: "diversity", label: "Diversité d'actions", help: "Variété des actions concrètes." },
  { key: "time", label: "Temps d'activité", help: "Durée cumulée (plafonnée)." },
  { key: "recency", label: "Récence", help: "Dernière présence effective." },
];
export const ADOPTION_THRESHOLD_FIELDS: { key: keyof AdoptionThresholds; label: string }[] = [
  { key: "champion", label: "Champion ≥" },
  { key: "active", label: "Actif ≥" },
  { key: "moderate", label: "Modéré ≥" },
  { key: "weak", label: "Faible ≥" },
];

/** Lit les réglages (poids + seuils) ; valeurs par défaut si absent / souci BDD. */
export async function getAdoptionSettings(): Promise<AdoptionSettings> {
  try {
    const row = await prisma.adoptionSetting.findUnique({ where: { id: "global" } });
    if (!row) return DEFAULT_ADOPTION_SETTINGS;
    return {
      weights: { regularity: row.wRegularity, time: row.wTime, breadth: row.wBreadth, diversity: row.wDiversity, durable: row.wDurable, interaction: row.wInteraction, recency: row.wRecency },
      thresholds: { champion: row.tChampion, active: row.tActive, moderate: row.tModerate, weak: row.tWeak },
    };
  } catch {
    return DEFAULT_ADOPTION_SETTINGS;
  }
}

// ───────────────────────── Calcul ─────────────────────────

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

/** Nombre de modules par défaut du rôle (pour normaliser l'étendue équitablement). */
function roleModuleTarget(role: UserRole): number {
  const count = Object.keys(PERMISSIONS[role] ?? {}).length;
  return Math.max(3, Math.min(7, count || 3));
}

function labelFor(score: number, t: AdoptionThresholds): { label: string; tone: AdoptionScore["tone"] } {
  if (score >= t.champion) return { label: "Champion", tone: "success" };
  if (score >= t.active) return { label: "Actif", tone: "info" };
  if (score >= t.moderate) return { label: "Modéré", tone: "warning" };
  if (score >= t.weak) return { label: "Faible", tone: "danger" };
  return { label: "À risque", tone: "danger" };
}

interface RawRow {
  uid: string;
  [k: string]: unknown;
}

/** Métriques réelles d'un utilisateur sur la fenêtre, avant pondération. */
interface UserMetrics {
  activeDays: number; engagedMin: number; modBreadth: number; diversity: number;
  durable: number; msg: number; conv: number; ment: number; lastSeen: Date | null; prevDays: number;
}
type ScoredUser = { id: string; name: string; email: string; role: UserRole; isActive: boolean };

/** Construit un AdoptionScore à partir des métriques + des réglages (poids/seuils). */
function buildScore(u: ScoredUser, m: UserMetrics, settings: AdoptionSettings): AdoptionScore {
  const sinceSeenDays = m.lastSeen ? (Date.now() - m.lastSeen.getTime()) / 86400000 : 999;
  const recency = clamp01(1 - (sinceSeenDays - 1) / 20); // 1 si ≤1j, 0 à ≥21j
  // Interaction : volume plafonné (anti-spam) + signaux bilatéraux mieux pondérés.
  const interaction = Math.min(m.msg, 60) * 0.5 + m.conv * 3 + m.ment * 4;
  const targetModules = roleModuleTarget(u.role);
  const W = settings.weights;

  const comps: AdoptionComponent[] = [
    { key: "regularity", label: "Régularité", weight: W.regularity, score: Math.round(clamp01(m.activeDays / 18) * 100), detail: `${m.activeDays} jour·s actif·s / 30` },
    { key: "time", label: "Temps d'activité", weight: W.time, score: Math.round(clamp01(m.engagedMin / 600) * 100), detail: `${Math.round(m.engagedMin / 60)} h cumulée·s` },
    { key: "breadth", label: "Étendue (modules)", weight: W.breadth, score: Math.round(clamp01(m.modBreadth / targetModules) * 100), detail: `${m.modBreadth} module·s utilisé·s` },
    { key: "diversity", label: "Diversité d'actions", weight: W.diversity, score: Math.round(clamp01(m.diversity / 8) * 100), detail: `${m.diversity} type·s d'action` },
    { key: "durable", label: "Travail durable", weight: W.durable, score: Math.round(clamp01(m.durable / 12) * 100), detail: `${m.durable} contribution·s abouties` },
    { key: "interaction", label: "Interaction", weight: W.interaction, score: Math.round(clamp01(interaction / 40) * 100), detail: `${m.conv} fil·s · ${m.ment} mention·s · ${m.msg} msg` },
    { key: "recency", label: "Récence", weight: W.recency, score: Math.round(recency * 100), detail: m.lastSeen ? `vu il y a ${Math.max(0, Math.round(sinceSeenDays))} j` : "jamais vu" },
  ];

  // Normalisé par la somme des poids → toujours 0–100, quels que soient les poids.
  const totalW = comps.reduce((s, c) => s + c.weight, 0) || 1;
  const score = Math.round(comps.reduce((s, c) => s + c.score * c.weight, 0) / totalW);
  const { label, tone } = u.isActive ? labelFor(score, settings.thresholds) : { label: "Compte inactif", tone: "neutral" as const };

  return {
    userId: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive,
    score, label, tone, activeDays: m.activeDays, lastSeen: m.lastSeen, trend: m.activeDays - m.prevDays, components: comps,
  };
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
  const settings = await getAdoptionSettings();

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

  const scores: AdoptionScore[] = users.map((u) => buildScore(u, {
    activeDays: days.get(u.id) ?? 0,
    engagedMin: (durMs.get(u.id) ?? 0) / 60000,
    modBreadth: modules.get(u.id)?.size ?? 0,
    diversity: combos.get(u.id) ?? 0,
    durable: (tasksDoneM.get(u.id) ?? 0) + (validM.get(u.id) ?? 0) + (directiveM.get(u.id) ?? 0),
    msg: msgM.get(u.id) ?? 0,
    conv: convos.get(u.id) ?? 0,
    ment: mentionM.get(u.id) ?? 0,
    lastSeen: u.lastSeenAt ?? u.lastLoginAt ?? null,
    prevDays: prevDays.get(u.id) ?? 0,
  }, settings));

  scores.sort((a, b) => b.score - a.score);
  const active = scores.filter((s) => s.isActive);
  const average = active.length ? Math.round(active.reduce((s, x) => s + x.score, 0) / active.length) : 0;
  return { scores, average, windowDays: WINDOW_DAYS };
}

// ───────────────────────── Score d'un seul utilisateur (pastille) ─────────────────────────

/** Métriques réelles d'UN utilisateur (requêtes ciblées, peu coûteuses). */
async function gatherUserMetrics(userId: string): Promise<UserMetrics> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const prevSince = new Date(Date.now() - 2 * WINDOW_DAYS * 86400000);

  const [actAgg, modRows, comboAgg, convAgg, prevAgg, tasksDone, validations, directivesAck, messagesSent, mentions] = await Promise.all([
    prisma.$queryRaw<RawRow[]>`
      SELECT COUNT(DISTINCT DATE("createdAt")) AS days,
             COALESCE(SUM(LEAST(COALESCE("durationMs",0), 1800000)),0) AS durms
      FROM "ActivityLog" WHERE "userId" = ${userId} AND "createdAt" >= ${since}`,
    prisma.$queryRaw<RawRow[]>`
      SELECT DISTINCT m FROM (
        SELECT "module" AS m FROM "ActivityLog" WHERE "userId" = ${userId} AND "module" IS NOT NULL AND "createdAt" >= ${since}
        UNION
        SELECT "module" AS m FROM "AuditLog" WHERE "actorId" = ${userId} AND "createdAt" >= ${since}
      ) u`,
    prisma.$queryRaw<RawRow[]>`
      SELECT COUNT(DISTINCT (("action")::text || COALESCE(("entityType")::text,''))) AS combos
      FROM "AuditLog" WHERE "actorId" = ${userId} AND "createdAt" >= ${since}`,
    prisma.$queryRaw<RawRow[]>`
      SELECT COUNT(DISTINCT "conversationId") AS convos
      FROM "Message" WHERE "senderId" = ${userId} AND "createdAt" >= ${since}`,
    prisma.$queryRaw<RawRow[]>`
      SELECT COUNT(DISTINCT DATE("createdAt")) AS days
      FROM "ActivityLog" WHERE "userId" = ${userId} AND "createdAt" >= ${prevSince} AND "createdAt" < ${since}`,
    prisma.task.count({ where: { assignedToId: userId, status: "DONE", completedAt: { gte: since } } }),
    prisma.validationStep.count({ where: { validatorId: userId, decidedAt: { gte: since }, status: { in: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] } } }),
    prisma.directive.count({ where: { acknowledgedById: userId, acknowledgedAt: { gte: since } } }),
    prisma.message.count({ where: { senderId: userId, kind: "TEXT", createdAt: { gte: since } } }),
    prisma.messageMention.count({ where: { userId, message: { createdAt: { gte: since } } } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true, lastLoginAt: true } });

  return {
    activeDays: num(actAgg[0]?.days),
    engagedMin: num(actAgg[0]?.durms) / 60000,
    modBreadth: modRows.filter((r) => (r as { m?: unknown }).m).length,
    diversity: num(comboAgg[0]?.combos),
    durable: tasksDone + validations + directivesAck,
    msg: messagesSent,
    conv: num(convAgg[0]?.convos),
    ment: mentions,
    lastSeen: user?.lastSeenAt ?? user?.lastLoginAt ?? null,
    prevDays: num(prevAgg[0]?.days),
  };
}

/**
 * Score à afficher dans la pastille de la barre du haut, pour l'utilisateur courant.
 * Lit le **snapshot mis en cache** (rapide) ; le recalcule sur **données réelles** et
 * le persiste uniquement s'il est périmé (> 12 h) — pour ne pas alourdir chaque page.
 * Le Super Admin ne se mesure pas → `null` (pas de pastille).
 */
export interface AdoptionBadge { score: number; tone: AdoptionScore["tone"]; label: string }
export async function getAdoptionBadge(userId: string, role: UserRole): Promise<AdoptionBadge | null> {
  if (role === "SUPER_ADMIN") return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, isActive: true, adoptionScore: true, adoptionScoreAt: true },
  });
  if (!u) return null;

  const settings = await getAdoptionSettings();
  const fresh = u.adoptionScoreAt != null && Date.now() - u.adoptionScoreAt.getTime() < BADGE_TTL_MS;
  if (fresh && u.adoptionScore != null) {
    const { label, tone } = u.isActive ? labelFor(u.adoptionScore, settings.thresholds) : { label: "Compte inactif", tone: "neutral" as const };
    return { score: u.adoptionScore, tone, label };
  }

  try {
    const metrics = await gatherUserMetrics(userId);
    const s = buildScore({ id: userId, name: u.name, email: u.email, role, isActive: u.isActive }, metrics, settings);
    await prisma.user.update({ where: { id: userId }, data: { adoptionScore: s.score, adoptionScoreAt: new Date() } }).catch(() => {});
    return { score: s.score, tone: s.tone, label: s.label };
  } catch {
    return u.adoptionScore != null ? { score: u.adoptionScore, tone: "neutral", label: "" } : null;
  }
}
