import { prisma } from "@/lib/prisma";
import type { JobKind, KnowledgeSourceType } from "./contract";
import { claimNext, completeJob, failJob, requeueStale, queueHealth } from "./queue";
import { ingestFast, setStage } from "./ingest";
import { draftFromDriveNode } from "./sources/drive";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE WORKER — il avance doucement, en arrière-plan, et personne ne l'attend.
 *
 * ── LE RÉGIME ────────────────────────────────────────────────────────────────────────────
 *
 * Un PASSAGE traite un petit nombre de travaux, puis rend la main. Il est appelé par le
 * planificateur déjà en place (`lib/scheduled.ts`), au même titre que les autres balayages.
 * C'est délibérément modeste : une couche de connaissance qui monopolise le serveur pour
 * indexer plus vite a échoué — l'ERP sert d'abord ceux qui l'utilisent.
 *
 * ── CE QUI SE PASSE QUAND UN TRAVAIL ÉCHOUE ──────────────────────────────────────────────
 *
 * Rien de visible. Le travail retourne en file avec une attente croissante, et au bout de
 * quelques essais il finit en boîte morte, avec son motif. Pendant tout ce temps, le document
 * reste RETROUVABLE par son texte : l'ingestion rapide a déjà fait le service attendu, et
 * l'enrichissement n'était qu'un bonus. C'est la promesse de la dernière consigne — « si ça
 * finit tant mieux, sinon l'ingestion continue sans que l'utilisateur le sache ».
 *
 * ── CE QUI N'EST PAS ENCORE BRANCHÉ, ET POURQUOI C'EST DIT ───────────────────────────────
 *
 * `vision`, `classify`, `entities`, `embed` et `enrich` ont leur place dans la file, leur
 * priorité, leurs réessais et leur boîte morte — mais leurs traitements ne sont pas encore
 * écrits. Ils sont donc marqués TERMINÉS SANS TRAVAIL plutôt que laissés à échouer en boucle :
 * une file qui accumule des morts sur des étages non construits masquerait les VRAIES pannes.
 * Le jour où un étage est écrit, il se branche ici et rien d'autre ne bouge.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Travaux par passage. Petit par principe : l'indexation ne prend jamais le pas sur le service. */
const BATCH = 6;

export function knowledgeWorkerEnabled(): boolean {
  return process.env.KNOWLEDGE_INGESTION !== "off";
}

export interface SweepResult {
  processed: number;
  failed: number;
  skipped: number;
  requeued: number;
}

/**
 * UN PASSAGE. Ne lève jamais : le planificateur enchaîne d'autres balayages derrière, et une
 * exception ici les priverait tous de leur tour.
 */
export async function runKnowledgeSweep(batch = BATCH): Promise<SweepResult> {
  const out: SweepResult = { processed: 0, failed: 0, skipped: 0, requeued: 0 };
  if (!knowledgeWorkerEnabled()) return out;

  try {
    // Les travaux abandonnés par un processus tué reviennent en file — sinon ils resteraient
    // « en cours » pour toujours, ce qui est la panne silencieuse classique d'une file.
    out.requeued = await requeueStale();

    for (let i = 0; i < batch; i += 1) {
      const job = await claimNext();
      if (!job) break;

      try {
        const done = await handle(job.kind, job.itemId, job.payload);
        await completeJob(job.id);
        if (done) out.processed += 1;
        else out.skipped += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const verdict = await failJob(job.id, msg);
        out.failed += 1;
        if (verdict === "dead") {
          console.error("[knowledge] job_dead", { kind: job.kind, itemId: job.itemId, error: msg.slice(0, 200) });
          if (job.itemId) await setStage(job.itemId, "FAILED", msg.slice(0, 300));
        }
      }
    }

    if (out.processed || out.failed || out.requeued) {
      console.info("[knowledge] sweep", JSON.stringify(out));
    }
  } catch (err) {
    console.error("[knowledge] sweep failed", err);
  }
  return out;
}

/**
 * L'AIGUILLAGE. Rend `true` si un vrai travail a eu lieu, `false` si l'étage n'est pas encore
 * construit — la distinction compte pour l'observabilité : « rien à faire » n'est pas « fait ».
 */
async function handle(kind: JobKind, itemId: string | null, payload: Record<string, unknown> | null): Promise<boolean> {
  switch (kind) {
    case "parse":
      return handleParse(payload);

    // ── Étages prévus, pas encore écrits. Voir l'en-tête : on ne les laisse pas mourir en
    //    boucle, ce qui remplirait la boîte morte de faux problèmes.
    case "vision":
    case "classify":
    case "entities":
    case "embed":
    case "enrich":
      return false;

    default:
      return false;
  }
}

/**
 * PARSE — le seul étage complet aujourd'hui, et le seul qui compte pour la promesse « la donnée
 * est retrouvable ». Il résout la source, extrait, et confie le reste à l'ingestion rapide.
 */
async function handleParse(payload: Record<string, unknown> | null): Promise<boolean> {
  const sourceType = typeof payload?.sourceType === "string" ? (payload.sourceType as KnowledgeSourceType) : null;
  const sourceId = typeof payload?.sourceId === "string" ? payload.sourceId : null;
  if (!sourceType || !sourceId) return false;

  if (sourceType === "drive_file") {
    const draft = await draftFromDriveNode(sourceId);
    // Pas de brouillon = rien à faire (nœud supprimé, trop gros, illisible). Ce n'est pas une
    // erreur : la relancer indéfiniment coûterait sans jamais aboutir.
    if (!draft) return false;
    const r = await ingestFast(draft.input);
    if (r && r.outcome !== "unchanged") {
      console.info("[knowledge] ingested", {
        sourceType, sourceId, outcome: r.outcome, version: r.version,
        by: draft.input.extractedBy, why: draft.route.why,
      });
    }
    return r !== null;
  }

  // Les autres sources se brancheront ici, une par une, sans rien changer au reste.
  return false;
}

/**
 * LE RATTRAPAGE — les fichiers du Drive jamais vus par la couche.
 *
 * Les plus récemment modifiés d'abord : c'est là que vivent les questions du jour. Un fichier de
 * 2019 finira par passer, mais il n'y a aucune raison de le faire avant celui de ce matin.
 */
export async function enqueueDriveBacklog(limit = 20): Promise<number> {
  if (!knowledgeWorkerEnabled()) return 0;
  try {
    const known = await prisma.knowledgeItem.findMany({
      where: { sourceType: "drive_file" },
      select: { sourceId: true },
      take: 5_000,
    });
    const seen = new Set(known.map((k) => k.sourceId));

    const nodes = await prisma.driveNode.findMany({
      where: { type: "FILE", isTrashed: false },
      orderBy: { updatedAt: "desc" },
      take: limit * 5,
      select: { id: true },
    });

    const { enqueue } = await import("./queue");
    let queued = 0;
    for (const n of nodes) {
      if (seen.has(n.id)) continue;
      const id = await enqueue({
        kind: "parse",
        payload: { sourceType: "drive_file", sourceId: n.id },
        dedupeKey: `parse:drive_file:${n.id}`,
      });
      if (id) queued += 1;
      if (queued >= limit) break;
    }
    return queued;
  } catch (err) {
    console.error("[knowledge] backlog failed", err);
    return 0;
  }
}

/** L'état de la couche, pour l'écran d'observabilité (§26). */
export async function knowledgeHealth() {
  const [queue, byStage, total] = await Promise.all([
    queueHealth(),
    prisma.knowledgeItem.groupBy({ by: ["stage"], _count: { _all: true } }).catch(() => []),
    prisma.knowledgeItem.count().catch(() => 0),
  ]);
  return {
    queue,
    total,
    byStage: Object.fromEntries(byStage.map((r) => [r.stage, r._count._all])),
  };
}
