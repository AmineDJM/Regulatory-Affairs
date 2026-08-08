import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { releaseBlob, getBlob } from "@/lib/drive-storage";
import { flushOriginalArchives, ingestDossierZip } from "./ingest-dossier";

/**
 * Test d'INTÉGRATION du pipeline d'ingestion (base réelle). Vérifie : conservation des
 * fichiers sûrs (blob + SHA-256), refus des exécutables (jamais matérialisés), archive
 * originale figée, mise en file du job EXTRACT, incrément de version, rejet des archives
 * invalides, et purge en CASCADE à la suppression du dossier. Nettoyage complet en fin.
 */

const TAG = `test-ingest-${Date.now()}`;
let companyId = "";
let dossierId = "";

async function makeZip(files: Record<string, Buffer | string>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: "nodebuffer" });
}

async function releaseDossierBlobs(id: string) {
  await flushOriginalArchives(); // l'archive originale est écrite EN FOND : ne rien laisser en vol
  const [docs, vers] = await Promise.all([
    prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId: id } }, select: { blobId: true } }),
    prisma.regulatoryDossierVersion.findMany({ where: { dossierId: id }, select: { originalZipBlobId: true } }),
  ]);
  for (const b of [...docs.map((d) => d.blobId), ...vers.map((v) => v.originalZipBlobId)]) {
    if (b) await releaseBlob(b).catch(() => undefined);
  }
}

describe("ingestDossierZip — pipeline d'ingestion CTD (intégration)", () => {
  beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } });
    companyId = company.id;
    const dossier = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-ref`, title: "Dossier de test", createdById: "test-user" },
      select: { id: true },
    });
    dossierId = dossier.id;
  });

  afterAll(async () => {
    await releaseDossierBlobs(dossierId).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("conserve les fichiers sûrs, bloque les exécutables, fige l'archive originale", async () => {
    const pdf = Buffer.from("Rapport de stabilité — donnees CTD");
    const buf = await makeZip({
      "m3/3.2.p.8-stabilite.pdf": pdf,
      "m1/1.2-formulaire.docx": Buffer.from("formulaire"),
      "outils/setup.exe": Buffer.from("MZ programme"),
    });
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "dossier.zip", buffer: buf });

    expect(res.ok).toBe(true);
    expect(res.versionNo).toBe(1);
    expect(res.summary?.stored).toBe(2);
    expect(res.summary?.blocked).toBe(1);

    const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId } } });
    const exe = docs.find((d) => d.ext === "exe")!;
    expect(exe.securityStatus).toBe("BLOCKED_EXECUTABLE");
    expect(exe.blobId).toBeNull(); // jamais matérialisé

    const stab = docs.find((d) => d.originalFilename === "3.2.p.8-stabilite.pdf")!;
    expect(stab.securityStatus).toBe("SAFE");
    expect(stab.blobId).toBeTruthy();
    expect(stab.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    // INTÉGRITÉ DU STOCKAGE : le fichier restitué est octet pour octet identique à l'original.
    const restored = await getBlob(stab.blobId!);
    expect(restored).not.toBeNull();
    expect(Buffer.compare(restored!, pdf)).toBe(0);

    // L'archive originale est conservée EN FOND (hors du chemin critique) : on attend sa fin.
    await flushOriginalArchives();
    const version = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId }, orderBy: { versionNo: "desc" } });
    expect(version?.originalZipBlobId).toBeTruthy();
    expect(version?.originalSha256).toBe(createHash("sha256").update(buf).digest("hex"));

    const job = await prisma.regulatoryJob.findFirst({ where: { dossierId, type: "EXTRACT" } });
    expect(job?.status).toBe("QUEUED");

    const d = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { status: true } });
    expect(d?.status).toBe("INGESTED");
  });

  it("incrémente le numéro de version à la 2ᵉ archive", async () => {
    const buf = await makeZip({ "m2/2.3-qualite.pdf": Buffer.from("resume qualite") });
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "v2.zip", buffer: buf });
    expect(res.ok).toBe(true);
    expect(res.versionNo).toBe(2);
  });

  it("l'archive originale est conservée EN FOND : l'ingestion rend la main sans l'attendre", async () => {
    // C'est le poste de temps qui dominait la finalisation d'un téléversement (~10 s par 60 Mo, et
    // proportionnel à la taille). L'ingestion doit donc revenir AVANT que l'archive soit écrite,
    // en garantissant tout de suite ce dont dépend la traçabilité : l'empreinte SHA-256.
    const tmp = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-async`, title: "Archive différée", createdById: "test-user" },
      select: { id: true },
    });
    const buf = await makeZip({ "m1/1.0-lettre.txt": "Demande d'enregistrement", "m3/3.2.s-substance.pdf": Buffer.from("substance active") });
    try {
      const res = await ingestDossierZip({ companyId, dossierId: tmp.id, actorId: "test-user", filename: "differe.zip", buffer: buf });
      expect(res.ok).toBe(true);

      // AU RETOUR : version, manifeste et empreinte sont déjà là — l'archive, elle, est encore en vol.
      const before = await prisma.regulatoryDossierVersion.findFirstOrThrow({ where: { dossierId: tmp.id } });
      expect(before.originalSha256).toBe(createHash("sha256").update(buf).digest("hex"));
      expect(await prisma.regulatoryDocument.count({ where: { dossierVersionId: before.id } })).toBe(2);

      // UNE FOIS LE FOND TERMINÉ : l'archive est raccrochée à sa version, intacte octet pour octet.
      await flushOriginalArchives();
      const after = await prisma.regulatoryDossierVersion.findFirstOrThrow({ where: { dossierId: tmp.id } });
      expect(after.originalZipBlobId).toBeTruthy();
      expect(Buffer.compare((await getBlob(after.originalZipBlobId!))!, buf)).toBe(0);
    } finally {
      await releaseDossierBlobs(tmp.id).catch(() => undefined);
      await prisma.regulatoryDossier.delete({ where: { id: tmp.id } }).catch(() => undefined);
    }
  });

  it("archive originale trop volumineuse pour la base → dossier ANALYSÉ quand même (best-effort)", async () => {
    // Simule le cas « Échec du stockage de l'archive » : plafond base à 0 → l'archive originale ne
    // peut PAS être stockée en un blob. L'ingestion ne doit PAS échouer : les fichiers sont conservés,
    // l'empreinte SHA-256 de l'archive est gardée, seule l'archive complète n'est pas retenue.
    const tmp = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-bigorig`, title: "Big original", createdById: "test-user" },
      select: { id: true },
    });
    const pdf = Buffer.from("Rapport CTD — contenu conservé");
    const buf = await makeZip({ "m3/3.2.p.8-stab.pdf": pdf, "m1/1.2-form.docx": Buffer.from("form") });
    process.env.REG_MAX_PG_BLOB_MB = "0"; // force le dépassement du plafond base pour l'archive
    try {
      const res = await ingestDossierZip({ companyId, dossierId: tmp.id, actorId: "test-user", filename: "big.zip", buffer: buf });
      expect(res.ok).toBe(true); // le dossier est bien analysé
      expect(res.summary?.stored).toBe(2); // les fichiers sains sont conservés (blobs individuels)
      await flushOriginalArchives();
      const v = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId: tmp.id } });
      expect(v?.originalZipBlobId).toBeNull(); // archive complète NON retenue (best-effort)
      expect(v?.originalSha256).toBe(createHash("sha256").update(buf).digest("hex")); // empreinte conservée
      const safeDocs = await prisma.regulatoryDocument.count({ where: { dossierVersion: { dossierId: tmp.id }, securityStatus: "SAFE" } });
      expect(safeDocs).toBe(2);
    } finally {
      delete process.env.REG_MAX_PG_BLOB_MB;
      await releaseDossierBlobs(tmp.id).catch(() => undefined);
      await prisma.regulatoryDossier.delete({ where: { id: tmp.id } }).catch(() => undefined);
    }
  });

  it("un FICHIER individuel au-delà du plafond base → MARQUÉ (jamais un crash), les autres continuent", async () => {
    // Garde anti-OOM par fichier (mode Postgres) : plafond forcé à 0 → tout fichier « dépasse ».
    // L'ingestion NE crashe PAS et NE rejette PAS l'archive : chaque fichier est marqué CORRUPTED
    // (raison affichée en UI), la version est créée. Indépendant du plafond de l'archive originale.
    const tmp = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-bigfile`, title: "Big file", createdById: "test-user" },
      select: { id: true },
    });
    const buf = await makeZip({ "m1/gros.pdf": Buffer.from("contenu"), "m1/autre.pdf": Buffer.from("autre") });
    process.env.REG_MAX_PG_FILE_MB = "0";
    try {
      const res = await ingestDossierZip({ companyId, dossierId: tmp.id, actorId: "test-user", filename: "bigfile.zip", buffer: buf });
      expect(res.ok).toBe(true); // l'archive passe, version créée
      expect(res.summary?.stored).toBe(0); // aucun conservé (plafond 0)
      const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId: tmp.id } }, select: { securityStatus: true, blobId: true } });
      expect(docs.length).toBe(2);
      for (const d of docs) { expect(d.securityStatus).toBe("CORRUPTED"); expect(d.blobId).toBeNull(); }
    } finally {
      delete process.env.REG_MAX_PG_FILE_MB;
      await releaseDossierBlobs(tmp.id).catch(() => undefined);
      await prisma.regulatoryDossier.delete({ where: { id: tmp.id } }).catch(() => undefined);
    }
  });

  it("ingère un dossier de PLUS de 1000 fichiers (insertion par lots — pas de dépassement de paramètres)", async () => {
    // Un gros dossier CTD peut avoir des milliers de fichiers : le createMany en une requête
    // dépasserait la limite Postgres de 65 535 paramètres → « enregistrement annulé ». On vérifie
    // que l'insertion par lots crée bien TOUTES les lignes. Contenu identique → blob dédupliqué (rapide).
    const tmp = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-many`, title: "Many files", createdById: "test-user" },
      select: { id: true },
    });
    const content = Buffer.from("contenu CTD identique (dédupliqué au stockage)");
    const files: Record<string, Buffer> = {};
    for (let i = 0; i < 1100; i++) files[`m1/section-${i}/doc-${i}.pdf`] = content;
    try {
      const res = await ingestDossierZip({ companyId, dossierId: tmp.id, actorId: "test-user", filename: "many.zip", buffer: await makeZip(files) });
      expect(res.ok).toBe(true);
      expect(res.summary?.total).toBe(1100);
      const count = await prisma.regulatoryDocument.count({ where: { dossierVersion: { dossierId: tmp.id } } });
      expect(count).toBe(1100); // TOUTES les lignes créées, malgré le seuil de paramètres d'une requête unique
      const v = await prisma.regulatoryDossierVersion.findFirst({ where: { dossierId: tmp.id }, select: { fileCount: true } });
      expect(v?.fileCount).toBe(1100);
    } finally {
      await releaseDossierBlobs(tmp.id).catch(() => undefined);
      await prisma.regulatoryDossier.delete({ where: { id: tmp.id } }).catch(() => undefined);
    }
  }, 60_000);

  it("rejette une archive vide sans rien persister", async () => {
    const before = await prisma.regulatoryDossierVersion.count({ where: { dossierId } });
    const buf = await makeZip({});
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "empty.zip", buffer: buf });
    expect(res.ok).toBe(false);
    expect(res.rejectionCode).toBe("EMPTY");
    const after = await prisma.regulatoryDossierVersion.count({ where: { dossierId } });
    expect(after).toBe(before); // aucune version créée
  });

  it("supprime en CASCADE versions → documents → jobs à la suppression du dossier", async () => {
    const tmp = await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-cascade`, title: "Cascade", createdById: "test-user" },
      select: { id: true },
    });
    const buf = await makeZip({ "m1/lettre.pdf": Buffer.from("lettre de demande") });
    await ingestDossierZip({ companyId, dossierId: tmp.id, actorId: "test-user", filename: "c.zip", buffer: buf });

    expect(await prisma.regulatoryDocument.count({ where: { dossierVersion: { dossierId: tmp.id } } })).toBeGreaterThan(0);

    await releaseDossierBlobs(tmp.id);
    await prisma.regulatoryDossier.delete({ where: { id: tmp.id } });

    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId: tmp.id } })).toBe(0);
    expect(await prisma.regulatoryDocument.count({ where: { dossierVersion: { dossierId: tmp.id } } })).toBe(0);
    expect(await prisma.regulatoryJob.count({ where: { dossierId: tmp.id } })).toBe(0);
  });
});
