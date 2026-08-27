import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JobKind, KnowledgeSourceType } from "./contract";
import { claimNext, completeJob, failJob, requeueStale, queueHealth } from "./queue";
import { ingestFast, setStage } from "./ingest";
import { draftFromDriveNode } from "./sources/drive";
import { draftFromEmail, enqueueEmailBacklog } from "./sources/email";
import { stageClassify, stageEntities, stageEmbed, stageEnrich, stageVision } from "./stages";

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
 * ── CE QUI EST BRANCHÉ, ET CE QUI NE L'EST PAS ───────────────────────────────────────────
 *
 * `parse`, `classify`, `entities`, `embed` et `enrich` font un vrai travail (voir `stages.ts`).
 * `vision` reste marqué TERMINÉ SANS TRAVAIL : la rastérisation des pages n'existe pas encore
 * dans cette couche, et un étage qui échouerait en boucle remplirait la boîte morte de faux
 * problèmes — ce qui masquerait les VRAIES pannes. La distinction « rien à faire » / « fait »
 * est justement là pour que cet écart se voie dans l'observabilité au lieu de se deviner.
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

    // Les étages d'enrichissement travaillent tous sur un élément DÉJÀ ingéré : sans `itemId`,
    // il n'y a rien à enrichir, et c'est une absence, pas une erreur.
    case "classify":
      return itemId ? stageClassify(itemId) : false;
    case "entities":
      return itemId ? stageEntities(itemId) : false;
    case "embed":
      return itemId ? stageEmbed(itemId) : false;
    case "enrich":
      return itemId ? stageEnrich(itemId) : false;

    // Pas encore branché — voir l'en-tête et `stageVision`.
    case "vision":
      return itemId ? stageVision(itemId) : false;

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

  if (sourceType === "email") {
    const input = await draftFromEmail(sourceId);
    if (!input) return false; // message vide ou supprimé : une absence, pas une erreur
    const r = await ingestFast(input);
    if (r && r.outcome !== "unchanged") {
      console.info("[knowledge] ingested", { sourceType, sourceId, outcome: r.outcome, version: r.version, by: "metadata" });
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

/**
 * LES DOCUMENTS RESTÉS MUETS — ceux dont on n'a jamais tiré une ligne de texte.
 *
 * Le rattrapage normal ne les voit pas : ils EXISTENT déjà dans la couche, donc `enqueueDriveBacklog`
 * les considère traités. Et leur empreinte n'ayant pas changé, un `parse` rejoué concluait
 * « inchangé » — ce qui les enfermait dans leur échec, y compris après la correction du défaut qui
 * l'avait causé. (`ingestFast` sait désormais reconnaître ce cas : même contenu, meilleure lecture.)
 *
 * On les repasse donc doucement, par petits paquets. Un document qui reste muet après ce
 * traitement l'est pour une vraie raison — un scan sans couche texte — et c'est à la vision d'en
 * décider, pas à ce rattrapage.
 */
export async function enqueueBacklogs(limit = 20): Promise<{ drive: number; email: number }> {
  const [drive, email] = await Promise.all([
    enqueueDriveBacklog(limit).catch(() => 0),
    knowledgeWorkerEnabled() ? enqueueEmailBacklog(limit).catch(() => 0) : Promise.resolve(0),
  ]);
  return { drive, email };
}

export async function enqueueStalled(limit = 20): Promise<number> {
  if (!knowledgeWorkerEnabled()) return 0;
  try {
    const stalled = await prisma.knowledgeItem.findMany({
      where: { text: null, isCurrent: true, stage: { in: ["RECEIVED", "FAILED"] } },
      orderBy: { updatedAt: "asc" }, // les plus anciennement touchés d'abord : personne ne les repasse
      take: limit,
      select: { sourceType: true, sourceId: true, updatedAt: true },
    });
    if (!stalled.length) return 0;

    const { enqueue } = await import("./queue");
    let queued = 0;
    for (const s of stalled) {
      const id = await enqueue({
        kind: "parse",
        payload: { sourceType: s.sourceType, sourceId: s.sourceId },
        // La clé de dédoublonnage porte l'HORODATAGE : sans lui, un document repassé une fois ne
        // pourrait plus jamais l'être, la clé restant à vie dans la file.
        dedupeKey: `reparse:${s.sourceType}:${s.sourceId}:${s.updatedAt.getTime()}`,
      });
      if (id) queued += 1;
    }
    return queued;
  } catch (err) {
    console.error("[knowledge] stalled requeue failed", err);
    return 0;
  }
}

/**
 * LE RÉFÉRENTIEL D'ENTITÉS, RAFRAÎCHI — mais pas à chaque minute.
 *
 * La projection relit toutes les fiches de l'ERP (produits, sociétés, fournisseurs, personnes).
 * C'est peu coûteux à l'échelle d'Adventum, mais assez pour ne pas mériter de tourner soixante
 * fois par heure alors qu'un nom de société change trois fois par an. Un intervalle explicite
 * vaut mieux qu'un balayage discret qui consomme sans qu'on sache pourquoi.
 *
 * Le repère de temps vit en MÉMOIRE, ce qui est assumé : un redémarrage refait une projection de
 * plus, et une projection de plus est idempotente et sans effet visible. Persister ce repère
 * coûterait une table pour éviter une dépense qui n'est pas un problème.
 */
const ENTITY_REFRESH_MS = 6 * 60 * 60 * 1000; // 6 h
let lastEntityRefresh = 0;

export async function refreshEntityIndex(force = false): Promise<boolean> {
  if (!knowledgeWorkerEnabled()) return false;
  const now = Date.now();
  if (!force && now - lastEntityRefresh < ENTITY_REFRESH_MS) return false;
  lastEntityRefresh = now;
  try {
    const { projectEntities } = await import("./entities/project");
    await projectEntities();
    return true;
  } catch (err) {
    console.error("[knowledge] entity projection failed", err);
    return false;
  }
}

/** L'état de la couche, pour l'écran d'observabilité (§26). */
export async function knowledgeHealth() {
  const [queue, byStage, byExtraction, total, entities, aliases, links, chunks, embedded] = await Promise.all([
    queueHealth(),
    prisma.knowledgeItem.groupBy({ by: ["stage"], _count: { _all: true } }).catch(() => []),
    // La RÉPARTITION PAR MOYEN est le tableau de bord de la doctrine §2 : une dérive vers le haut
    // de l'échelle (moins de `native`, plus de `luna`) se voit ici, avant d'apparaître sur une
    // facture — et c'est la seule façon de vérifier que « le code d'abord » tient dans le temps.
    prisma.knowledgeItem.groupBy({ by: ["extractedBy"], _count: { _all: true } }).catch(() => []),
    prisma.knowledgeItem.count().catch(() => 0),
    prisma.knowledgeEntity.count().catch(() => 0),
    prisma.knowledgeAlias.count().catch(() => 0),
    prisma.knowledgeLink.count().catch(() => 0),
    prisma.knowledgeChunk.count().catch(() => 0),
    prisma.knowledgeChunk.count({ where: { NOT: { embedding: { equals: Prisma.DbNull } } } }).catch(() => 0),
  ]);
  return {
    queue,
    total,
    byStage: Object.fromEntries(byStage.map((r) => [r.stage, r._count._all])),
    byExtraction: Object.fromEntries(byExtraction.map((r) => [r.extractedBy ?? "inconnu", r._count._all])),
    entities: { entities, aliases, links },
    chunks: { total: chunks, embedded },
  };
}
