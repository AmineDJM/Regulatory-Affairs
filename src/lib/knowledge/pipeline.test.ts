import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { contentHash } from "./text";
import { ingestFast, ingestRecord, setStage, replaceChunks, FREE_TEXT_WORTH_EMBEDDING } from "./ingest";
import { search, getDocument, getHistory, getRelated, getCurrentState, excerpt, type AccessFilter } from "./retrieval";
import { enqueue, claimNext, completeJob, failJob, queueHealth, requeueStale } from "./queue";
import { chunkText } from "./chunk";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PIPELINE, SUR BASE RÉELLE — ce que les tests purs ne peuvent pas prouver.
 *
 * Quatre promesses, et elles ne tiennent qu'en base :
 *   • IDEMPOTENCE — réingérer le même contenu ne coûte RIEN et ne double RIEN ;
 *   • VERSIONS — un contenu qui change ouvre une version, il n'écrase pas l'histoire ;
 *   • PERMISSIONS — aucun extrait ne sort sans être passé par le filtre ;
 *   • FILE — un travail n'est pris qu'une fois, et un échec répété finit en boîte morte.
 *
 * Toutes les données créées ici portent le préfixe `KTEST-` et sont retirées à la fin : ce banc
 * ne laisse rien derrière lui dans une base partagée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TAG = "KTEST-";
const src = (name: string) => `${TAG}${name}`;

/** Filtre d'accès PERMISSIF — pour les tests qui ne portent pas sur les droits. */
const seeAll: AccessFilter = async (items) => new Set(items.map((i) => i.itemId));
/** Filtre qui refuse tout — la position par défaut quand on ne sait pas. */
const seeNone: AccessFilter = async () => new Set<string>();

async function cleanup() {
  const items = await prisma.knowledgeItem.findMany({
    where: { OR: [{ sourceId: { startsWith: TAG } }, { sourceId: { contains: `${TAG}` } }] },
    select: { id: true },
  });
  const ids = items.map((i) => i.id);
  if (ids.length) {
    await prisma.knowledgeLink.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.knowledgeChunk.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.knowledgeJob.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.knowledgeItem.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.knowledgeJob.deleteMany({ where: { dedupeKey: { startsWith: TAG } } });
}

beforeAll(cleanup);
afterAll(cleanup);

// ─────────────────────────────── Idempotence ───────────────────────────────

describe("§20 — réingérer ne double rien et ne coûte rien", () => {
  it("le même contenu, deux fois : la seconde ne retraite RIEN", async () => {
    const hash = contentHash("contenu stable du document");
    const input = {
      sourceType: "drive_file" as const,
      sourceId: src("idem-1"),
      contentHash: hash,
      title: "Contrat de fourniture",
      text: "Le présent contrat définit les conditions de fourniture entre les parties signataires.",
      deepJobs: ["embed" as const],
    };

    const first = await ingestFast(input);
    expect(first?.outcome).toBe("created");
    expect(first?.jobsQueued).toBe(1);

    const second = await ingestFast(input);
    expect(second?.outcome).toBe("unchanged");
    // AUCUN travail relancé : c'est là que se joue le coût d'un balayage rejoué.
    expect(second?.jobsQueued).toBe(0);
    expect(second?.itemId).toBe(first?.itemId);

    const count = await prisma.knowledgeItem.count({ where: { sourceId: src("idem-1") } });
    expect(count).toBe(1);
  });

  it("rejouer le découpage ne double pas les morceaux", async () => {
    const r = await ingestFast({
      sourceType: "drive_file", sourceId: src("chunks-1"), contentHash: contentHash("c1"),
      text: "x".repeat(300), chunks: chunkText("x".repeat(300)),
    });
    const n1 = await prisma.knowledgeChunk.count({ where: { itemId: r!.itemId } });
    await replaceChunks(r!.itemId, chunkText("x".repeat(300)));
    const n2 = await prisma.knowledgeChunk.count({ where: { itemId: r!.itemId } });
    expect(n2).toBe(n1);
    expect(n2).toBeGreaterThan(0);
  });
});

// ─────────────────────────────── Versions et temps ───────────────────────────────

describe("§5 et §16 — une nouvelle version ferme la précédente, elle ne l'écrase pas", () => {
  it("V1 → V2 : l'histoire reste lisible", async () => {
    const sid = src("ver-1");
    const v1 = await ingestFast({ sourceType: "legal", sourceId: sid, contentHash: contentHash("texte v1"), title: "Contrat V1", text: "Durée : deux ans." });
    expect(v1?.version).toBe(1);

    const v2 = await ingestFast({ sourceType: "legal", sourceId: sid, contentHash: contentHash("texte v2"), title: "Contrat V2", text: "Durée : trois ans." });
    expect(v2?.outcome).toBe("versioned");
    expect(v2?.version).toBe(2);
    expect(v2?.itemId).not.toBe(v1?.itemId);

    // La V1 existe toujours, close dans le temps.
    const old = await prisma.knowledgeItem.findUnique({ where: { id: v1!.itemId }, select: { isCurrent: true, validTo: true } });
    expect(old?.isCurrent).toBe(false);
    expect(old?.validTo).not.toBeNull();

    // …et la chaîne est reconstituable.
    const chain = await getHistory("legal", sid, seeAll);
    expect(chain.map((c) => c.version)).toEqual([1, 2]);
  });

  it("la recherche ne rend QUE la version courante — mélanger V1 et V2 serait pire que rien", async () => {
    const sid = src("ver-2");
    await ingestFast({ sourceType: "legal", sourceId: sid, contentHash: contentHash("a"), title: "Bail ancien", text: "Loyer de 100000 dinars par mois." });
    await ingestFast({ sourceType: "legal", sourceId: sid, contentHash: contentHash("b"), title: "Bail actuel", text: "Loyer de 150000 dinars par mois." });

    const hits = await search({ text: "Bail", sourceTypes: ["legal"] }, seeAll);
    const mine = hits.filter((h) => h.sourceId === sid);
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe("Bail actuel");
  });

  it("« quelle était la situation avant ? » retrouve la version close", async () => {
    const sid = src("ver-3");
    const v1 = await ingestFast({ sourceType: "legal", sourceId: sid, contentHash: contentHash("x"), title: "Avenant initial", text: "Montant initial." });
    await new Promise((r) => setTimeout(r, 20));
    const cut = new Date();
    await new Promise((r) => setTimeout(r, 20));
    await ingestFast({ sourceType: "legal", sourceId: sid, contentHash: contentHash("y"), title: "Avenant révisé", text: "Montant révisé." });

    const past = await search({ text: "Avenant", sourceTypes: ["legal"], asOf: cut }, seeAll);
    const ids = past.map((h) => h.itemId);
    expect(ids).toContain(v1!.itemId); // la V1 valait à cette date
  });
});

// ─────────────────────────────── Étapes ───────────────────────────────

describe("les étapes n'effacent jamais un acquis", () => {
  it("un job rejoué ne fait pas disparaître une donnée de la recherche", async () => {
    const r = await ingestFast({ sourceType: "drive_file", sourceId: src("stage-1"), contentHash: contentHash("s"), text: "Un texte suffisant pour être indexé correctement." });
    expect(r?.stage).toBe("INDEXED");

    await setStage(r!.itemId, "READY");
    await setStage(r!.itemId, "PARSED"); // un job en retard tente de reculer
    const after = await prisma.knowledgeItem.findUnique({ where: { id: r!.itemId }, select: { stage: true } });
    expect(after?.stage).toBe("READY");
  });

  it("sans texte, l'élément reste RECEIVED — on ne prétend pas l'avoir indexé", async () => {
    const r = await ingestFast({ sourceType: "drive_file", sourceId: src("stage-2"), contentHash: contentHash("vide") });
    expect(r?.stage).toBe("RECEIVED");
  });
});

// ─────────────────────────────── Permissions ───────────────────────────────

describe("§24 — rien ne sort sans passer la garde", () => {
  it("un compte sans droit ne voit AUCUN extrait, même si le contenu correspond", async () => {
    await ingestFast({
      sourceType: "drive_file", sourceId: src("perm-1"), contentHash: contentHash("secret"),
      title: "Grille salariale confidentielle", confidentiality: "restricted",
      text: "Grille salariale confidentielle de la direction générale pour l'exercice en cours.",
    });

    const permitted = await search({ text: "salariale" }, seeAll);
    expect(permitted.some((h) => h.sourceId === src("perm-1"))).toBe(true);

    const refused = await search({ text: "salariale" }, seeNone);
    expect(refused).toEqual([]);
  });

  it("le document entier est refusé de la même façon", async () => {
    const r = await ingestFast({ sourceType: "drive_file", sourceId: src("perm-2"), contentHash: contentHash("p2"), text: "Contenu réservé." });
    expect(await getDocument(r!.itemId, seeAll)).not.toBeNull();
    expect(await getDocument(r!.itemId, seeNone)).toBeNull();
  });

  it("l'état courant d'une source est gardé comme le reste", async () => {
    const sid = src("perm-3");
    await ingestFast({ sourceType: "task", sourceId: sid, contentHash: contentHash("t"), text: "Tâche interne." });
    expect(await getCurrentState("task", sid, seeAll)).not.toBeNull();
    expect(await getCurrentState("task", sid, seeNone)).toBeNull();
  });

  it("le graphe aussi : connaître une entité n'autorise pas à lire ce qui la cite", async () => {
    const r = await ingestFast({ sourceType: "legal", sourceId: src("perm-4"), contentHash: contentHash("g"), text: "Contrat citant le produit." });
    await prisma.knowledgeLink.create({
      data: { itemId: r!.itemId, predicate: "mentions", toType: "product", toId: `${TAG}prod-1`, confidence: 0.9 },
    });

    const open = await getRelated({ toType: "product", toId: `${TAG}prod-1` }, seeAll);
    expect(open).toHaveLength(1);
    const closed = await getRelated({ toType: "product", toId: `${TAG}prod-1` }, seeNone);
    expect(closed).toEqual([]);
  });
});

// ─────────────────────────────── Recherche ───────────────────────────────

describe("la recherche rend des extraits CITABLES", () => {
  it("une référence exacte bat une correspondance lexicale", async () => {
    await ingestFast({ sourceType: "regulatory", sourceId: src("REG-EXACT"), contentHash: contentHash("e1"), title: src("REG-EXACT"), text: "Dossier de référence." });
    await ingestFast({
      sourceType: "regulatory", sourceId: src("REG-MENTION"), contentHash: contentHash("e2"), title: "Autre dossier",
      text: `Ce document parle du dossier ${src("REG-EXACT")} sans en être un.`,
      chunks: [{ kind: "section", ord: 0, text: `Ce document parle du dossier ${src("REG-EXACT")} sans en être un.` }],
    });

    const hits = await search({ text: src("REG-EXACT"), sourceTypes: ["regulatory"] }, seeAll);
    expect(hits[0].sourceId).toBe(src("REG-EXACT"));
    expect(hits[0].matchedBy).toBe("exact");
  });

  it("l'extrait entoure le terme trouvé, il ne rend pas le début du document", () => {
    // Rendre les 300 premiers caractères quand le terme est page 12 donne un extrait qui ne
    // contient pas ce qu'on cherchait — et fait passer un bon résultat pour un mauvais.
    const long = `${"préambule sans intérêt. ".repeat(40)}la clause de résiliation anticipée${" suite du texte.".repeat(40)}`;
    const out = excerpt(long, "resiliation");
    expect(out).toContain("résiliation");
    expect(out.startsWith("…")).toBe(true);
  });

  it("la recherche par métadonnées seules fonctionne sans texte", async () => {
    await ingestFast({ sourceType: "courrier", sourceId: src("meta-1"), contentHash: contentHash("m"), docType: `${TAG}accuse`, text: "Accusé de réception." });
    const hits = await search({ docType: `${TAG}accuse` }, seeAll);
    expect(hits).toHaveLength(1);
    expect(hits[0].matchedBy).toBe("metadata");
  });

  it("le repli trouve malgré les accents", async () => {
    await ingestFast({
      sourceType: "drive_file", sourceId: src("fold-1"), contentHash: contentHash("f"),
      title: "Note", text: "Le Règlement intérieur a été révisé.",
      chunks: [{ kind: "section", ord: 0, text: "Le Règlement intérieur a été révisé." }],
    });
    const hits = await search({ text: "reglement" }, seeAll);
    expect(hits.some((h) => h.sourceId === src("fold-1"))).toBe(true);
  });
});

// ─────────────────────────────── Objets structurés ───────────────────────────────

describe("§18 — un objet structuré n'est pas « RAGifié » sans raison", () => {
  it("une tâche triviale ne demande PAS de vecteur", async () => {
    const r = await ingestRecord({
      sourceType: "task", sourceId: src("task-1"), contentHash: contentHash("t1"),
      title: "Relancer Nadia", text: "Relancer Nadia", freeText: "ok",
    });
    const jobs = await prisma.knowledgeJob.findMany({ where: { itemId: r!.itemId }, select: { kind: true } });
    // Vectoriser « ok » coûterait un appel pour ce qu'un WHERE trouve mieux.
    expect(jobs.map((j) => j.kind).sort()).toEqual(["entities"]);
  });

  it("…mais un texte libre consistant en demande un", async () => {
    const r = await ingestRecord({
      sourceType: "decision", sourceId: src("dec-1"), contentHash: contentHash("d1"),
      title: "Décision", text: "x", freeText: "z".repeat(FREE_TEXT_WORTH_EMBEDDING + 10),
    });
    const jobs = await prisma.knowledgeJob.findMany({ where: { itemId: r!.itemId }, select: { kind: true } });
    expect(jobs.map((j) => j.kind).sort()).toEqual(["embed", "entities"]);
  });
});

// ─────────────────────────────── La file ───────────────────────────────

describe("§21 — la file ne fait jamais le même travail deux fois", () => {
  it("deux mises en file identiques n'en créent qu'une", async () => {
    const key = `${TAG}dedupe-1`;
    const a = await enqueue({ kind: "embed", dedupeKey: key });
    const b = await enqueue({ kind: "embed", dedupeKey: key });
    expect(a).not.toBeNull();
    expect(b).toBeNull(); // déjà prévu — ce n'est pas une erreur
  });

  it("un travail réclamé n'est plus disponible", async () => {
    await prisma.knowledgeJob.deleteMany({ where: { dedupeKey: `${TAG}claim-1` } });
    await enqueue({ kind: "enrich", dedupeKey: `${TAG}claim-1`, priority: 1 });

    const first = await claimNext(["enrich"]);
    expect(first).not.toBeNull();
    expect(first!.attempts).toBe(1);

    const row = await prisma.knowledgeJob.findUnique({ where: { id: first!.id }, select: { status: true } });
    expect(row?.status).toBe("RUNNING");

    await completeJob(first!.id);
    const done = await prisma.knowledgeJob.findUnique({ where: { id: first!.id }, select: { status: true, finishedAt: true } });
    expect(done?.status).toBe("DONE");
    expect(done?.finishedAt).not.toBeNull();
  });

  it("un échec repasse en file avec une attente — puis finit en BOÎTE MORTE", async () => {
    await prisma.knowledgeJob.deleteMany({ where: { dedupeKey: `${TAG}dead-1` } });
    const id = await enqueue({ kind: "vision", dedupeKey: `${TAG}dead-1` });

    // Premier échec : on réessaiera.
    await prisma.knowledgeJob.update({ where: { id: id! }, data: { attempts: 1, status: "RUNNING" } });
    expect(await failJob(id!, "service indisponible")).toBe("retry");
    const retried = await prisma.knowledgeJob.findUnique({ where: { id: id! }, select: { status: true, runAfter: true } });
    expect(retried?.status).toBe("QUEUED");
    expect(retried!.runAfter.getTime()).toBeGreaterThan(Date.now()); // il attend

    // Budget épuisé : on arrête d'y revenir, et on garde le motif.
    await prisma.knowledgeJob.update({ where: { id: id! }, data: { attempts: 4 } });
    expect(await failJob(id!, "toujours indisponible")).toBe("dead");
    const dead = await prisma.knowledgeJob.findUnique({ where: { id: id! }, select: { status: true, lastError: true } });
    expect(dead?.status).toBe("DEAD");
    expect(dead?.lastError).toContain("toujours indisponible");
  });

  it("un worker tué laisse un travail récupérable — pas perdu pour toujours", async () => {
    await prisma.knowledgeJob.deleteMany({ where: { dedupeKey: `${TAG}stale-1` } });
    const id = await enqueue({ kind: "classify", dedupeKey: `${TAG}stale-1` });
    await prisma.knowledgeJob.update({
      where: { id: id! },
      data: { status: "RUNNING", claimedAt: new Date(Date.now() - 60 * 60_000) },
    });

    expect(await requeueStale()).toBeGreaterThanOrEqual(1);
    const back = await prisma.knowledgeJob.findUnique({ where: { id: id! }, select: { status: true } });
    expect(back?.status).toBe("QUEUED");
    await prisma.knowledgeJob.delete({ where: { id: id! } }).catch(() => undefined);
  });

  it("l'état de la file est lisible — l'engorgement se voit", async () => {
    const h = await queueHealth();
    expect(h.queued).toBeGreaterThanOrEqual(0);
    expect(h.running).toBeGreaterThanOrEqual(0);
    expect(h.dead).toBeGreaterThanOrEqual(0);
  });
});
