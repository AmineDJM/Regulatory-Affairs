import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { ingestReserveLetter } from "./ingest";

/**
 * Intégration G9 : ingestion d'une lettre de réserves (couche texte → décomposition en points
 * catégorisés, verbatim préservé, cycle ouvert). Nettoyage complet. (L'OCR réel est couvert
 * par ocr-engine.test ; ici on valide le pipeline réserves de bout en bout.)
 */
const TAG = `test-reserve-${Date.now()}`;
let companyId = "", dossierId = "", blobId = "";

describe("ingestReserveLetter — pipeline réserves", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-D`, title: "Réserves", createdById: "u" }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    if (blobId) await releaseBlob(blobId).catch(() => undefined);
  });

  it("décompose la lettre en points catégorisés, verbatim préservé, cycle 1", async () => {
    const letter = [
      "Objet : Réserves sur le dossier d'enregistrement.",
      "1. Fournir les données de stabilité en zone climatique IVb.",
      "2. Préciser la méthode de dosage validée par HPLC.",
      "3. Compléter le certificat GMP du fabricant.",
    ].join("\n");
    const r = await ingestReserveLetter({ companyId, dossierId, actorId: "u", filename: "reserves.txt", ext: "txt", buffer: Buffer.from(letter, "utf-8") });
    expect(r.ok).toBe(true);
    expect(r.cycle).toBe(1);
    expect(r.points).toBeGreaterThanOrEqual(3);

    const cycle = await prisma.regulatoryReserveCycle.findUnique({ where: { id: r.cycleId! }, select: { letterBlobId: true, ocrText: true, points: { orderBy: { ordinal: "asc" }, select: { category: true, verbatim: true, status: true } } } });
    blobId = cycle!.letterBlobId!;
    expect(cycle!.ocrText).toContain("zone climatique IVb"); // texte verbatim conservé
    const cats = cycle!.points.map((p) => p.category);
    expect(cats).toContain("STABILITÉ");
    expect(cats).toContain("ANALYTIQUE");
    expect(cats).toContain("ADMINISTRATIF");
    expect(cycle!.points.every((p) => p.status === "OPEN")).toBe(true);
    // Verbatim EXACT (aucune reformulation).
    expect(cycle!.points.some((p) => p.verbatim.includes("HPLC"))).toBe(true);
  });

  it("un second dépôt ouvre le cycle 2 (multi-cycles)", async () => {
    const r = await ingestReserveLetter({ companyId, dossierId, actorId: "u", filename: "reserves2.txt", ext: "txt", buffer: Buffer.from("1. Point complémentaire de qualité sur les impuretés.", "utf-8") });
    expect(r.ok).toBe(true);
    expect(r.cycle).toBe(2);
  });
});
