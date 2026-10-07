import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Risk } from "./risks";
import { DUREE_GRACE_RESOLUTION_MS, reconcile, type BrainStatus, type ExistingRisk, type HistoryEntry } from "./lifecycle-rules";

export * from "./lifecycle-rules";

/**
 * LA VIE DES RISQUES — l'écriture. Les règles (pures, testées) sont dans `lifecycle-rules.ts` ; ici, la passe
 * horaire les applique à la table `BrainRisk` : création, rafraîchissement, résolution automatique, réouverture.
 */

const CHUNK = 40;

function donneesDe(r: Risk) {
  return {
    category: r.category, module: r.module, level: r.level, title: r.title, object: r.object, owner: r.owner,
    href: r.href, recommendation: r.recommendation,
    detail: {
      impact: r.impact, probableCause: r.probableCause, evidence: r.evidence, actions: r.actions,
      deadline: r.deadline, ageDays: r.ageDays, at: r.at,
    } as unknown as Prisma.InputJsonValue,
  };
}

const histoire = (h: unknown): HistoryEntry[] => (Array.isArray(h) ? (h as HistoryEntry[]) : []);

export interface SyncResult { created: Risk[]; reopened: number; resolved: number; total: number }

/**
 * Réconcilie les risques détectés avec la table. Ne lève pas : une panne renvoie un bilan vide (la passe horaire
 * continue, l'écran garde l'état de l'heure d'avant).
 */
export async function syncBrainRisks(risks: readonly Risk[], now: Date = new Date()): Promise<SyncResult> {
  const vide: SyncResult = { created: [], reopened: 0, resolved: 0, total: risks.length };
  try {
    const parCle = new Map(risks.map((r) => [r.id, r]));
    const existants = await prisma.brainRisk.findMany({
      where: { OR: [{ key: { in: [...parCle.keys()] } }, { status: { in: ["NOUVEAU", "PRIS_EN_CHARGE", "IGNORE"] } }] },
      select: { key: true, status: true, snoozedUntil: true, resolvedAt: true, resolvedAuto: true, history: true },
    });
    const hist = new Map(existants.map((e) => [e.key, histoire(e.history)]));
    const ops = reconcile(
      existants.map((e): ExistingRisk => ({ key: e.key, status: e.status as BrainStatus, snoozedUntil: e.snoozedUntil, resolvedAt: e.resolvedAt, resolvedAuto: e.resolvedAuto })),
      [...parCle.keys()],
      now,
      { graceMs: DUREE_GRACE_RESOLUTION_MS },
    );

    const ecritures: Prisma.PrismaPromise<unknown>[] = [];
    const out: SyncResult = { ...vide };
    for (const op of ops) {
      if (op.op === "create") {
        const r = parCle.get(op.key)!;
        out.created.push(r);
        ecritures.push(prisma.brainRisk.create({
          data: { key: op.key, ...donneesDe(r), status: "NOUVEAU", firstSeenAt: now, lastSeenAt: now, history: [op.history] as unknown as Prisma.InputJsonValue },
        }));
      } else if (op.op === "refresh") {
        const r = parCle.get(op.key)!;
        if (op.reopen) out.reopened++;
        const h = op.history ? [...(hist.get(op.key) ?? []), op.history] : undefined;
        ecritures.push(prisma.brainRisk.update({
          where: { key: op.key },
          data: {
            ...donneesDe(r), lastSeenAt: now, status: op.status,
            ...(op.reopen ? { resolvedAt: null, resolvedAuto: false, snoozedUntil: null, assigneeId: null, taskId: null, firstSeenAt: now } : {}),
            ...(op.clearSnooze ? { snoozedUntil: null } : {}),
            ...(h ? { history: h as unknown as Prisma.InputJsonValue } : {}),
          },
        }));
      } else {
        out.resolved++;
        ecritures.push(prisma.brainRisk.update({
          where: { key: op.key },
          data: {
            status: "RESOLU", resolvedAt: now, resolvedAuto: true, snoozedUntil: null,
            history: [...(hist.get(op.key) ?? []), op.history] as unknown as Prisma.InputJsonValue,
          },
        }));
      }
    }
    for (let i = 0; i < ecritures.length; i += CHUNK) await prisma.$transaction(ecritures.slice(i, i + CHUNK));
    return out;
  } catch (err) {
    console.error("[brain] synchronisation des risques impossible", err);
    return vide;
  }
}
