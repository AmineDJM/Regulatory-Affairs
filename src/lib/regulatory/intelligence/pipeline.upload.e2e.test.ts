import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { startUploadSession, putUploadPart, finalizeUploadSession, DEFAULT_PART_SIZE } from "./upload/session";
import { runRegulatoryJob } from "./jobs/runner";

/**
 * TEST END-TO-END du VRAI CHEMIN D'UPLOAD (le parcours exact que vit l'utilisateur) sur un dossier
 * VOLUMINEUX et « SALE » (fichiers valides + entrées hostiles/illisibles) — base + OCR + moteur RÉELS.
 *
 *   session d'upload → parties MULTIPLES → finalisation (spool disque + inspection EN FLUX yauzl +
 *   archive best-effort + insertion PAR LOTS) → chaîne de jobs (EXTRACT → OCR → FACTS → RULES).
 *
 * GARANTIES vérifiées « 0 souci » :
 *  - un exécutable, un chemin absolu, une archive imbriquée → MARQUÉS (jamais fatals) ;
 *  - les fichiers sains (txt/docx/xlsx + scan PNG) → conservés, lus, océrisés, classés ;
 *  - le jumeau numérique et les règles s'exécutent ; le dossier atteint IN_REVIEW ;
 *  - AUCUN job en échec. La finalisation est idempotente (rejeu = succès).
 */

const TAG = `test-upload-e2e-${Date.now()}`;
let companyId = "";
let dossierId = "";

async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const z = new JSZip();
  z.file("[Content_Types].xml", contentTypes);
  z.file("_rels/.rels", rels);
  z.file("word/document.xml", documentXml);
  return z.generateAsync({ type: "nodebuffer" });
}

function makeXlsx(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stabilite");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function makePng(lines: string[]): Promise<Buffer> {
  const lh = 62, pad = 26, w = 940, h = pad * 2 + lh * lines.length;
  const texts = lines.map((l, i) => `<text x="${pad}" y="${pad + lh * (i + 1) - 16}" font-family="DejaVu Sans" font-size="42" fill="black">${l}</text>`).join("");
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${texts}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Dossier CTD « réaliste et sale » : fichiers valides + entrées hostiles/illisibles. */
async function buildMessyDossierZip(): Promise<Buffer> {
  const cover = [
    "ADVENTUM PHARMA — LETTRE D'ACCOMPAGNEMENT",
    "DCI : Amoxicilline",
    "Nom commercial : Amoxival 500 mg",
    "Titulaire : Adventum Pharma SARL",
    "Forme pharmaceutique : comprimé pelliculé",
    "Dosage : 500 mg",
  ].join("\n");
  const form = await makeDocx(["FORMULAIRE DE DEMANDE", "Demandeur : Adventum Pharma SARL", "Fabricant : Site Adventum, Alger", "Voie d'administration : voie orale"]);
  const stability = makeXlsx([["Parametre", "Valeur"], ["Duree de conservation", "24 mois"], ["Conditions", "Conserver à 25 °C"]]);
  const cpp = await makePng(["CERTIFICAT DE PRODUIT PHARMACEUTIQUE", "SUBSTANCE ACTIVE : AMOXICILLINE", "BATCH SIZE 100000"]);
  const nested = await new JSZip().file("interne.txt", "archive imbriquée").generateAsync({ type: "nodebuffer" });

  const z = new JSZip();
  z.file("m1/1.0-lettre-accompagnement.txt", cover);
  z.file("m1/1.2-formulaire-demande.docx", form);
  z.file("m3/3.2.p.8-etude-stabilite.xlsx", stability);
  z.file("m1/1.4-certificat-cpp.png", cpp);
  z.file("outils/installateur.exe", Buffer.from("MZ\x90\x00 fake exe")); // → BLOCKED_EXECUTABLE
  z.file("/etc/passwd", "root:x:0:0");                                   // → BLOCKED_PATH (absolu)
  z.file("archives/nested.zip", nested);                                 // → SUSPICIOUS (imbriquée)
  // Quelques fichiers de remplissage réalistes (module 5, etc.).
  for (let i = 0; i < 6; i++) z.file(`m5/5.3-rapport-etude-${i}.txt`, `Rapport clinique n°${i} — efficacité et tolérance.`);
  return z.generateAsync({ type: "nodebuffer" });
}

async function drainJobs(id: string, max = 200): Promise<void> {
  for (let i = 0; i < max; i++) {
    const next = await prisma.regulatoryJob.findFirst({ where: { dossierId: id, status: "QUEUED" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!next) return;
    await runRegulatoryJob(next.id);
  }
}

/** Envoie un buffer via le VRAI chemin d'upload résumable (session → parties → finalisation). */
async function uploadViaSession(buffer: Buffer): Promise<Awaited<ReturnType<typeof finalizeUploadSession>>> {
  const start = await startUploadSession({ companyId, dossierId, createdById: "test-user", filename: "dossier-sale.zip", totalBytes: buffer.length, partSize: 16 * 1024 });
  expect(start.ok).toBe(true);
  const sessionId = start.sessionId!;
  const partSize = start.partSize!;
  const parts = start.expectedParts!;
  expect(parts).toBeGreaterThan(1); // multi-parties réellement exercé
  for (let i = 0; i < parts; i++) {
    const data = Buffer.from(buffer.subarray(i * partSize, Math.min((i + 1) * partSize, buffer.length)));
    const r = await putUploadPart({ sessionId, companyId, index: i, data });
    expect(r.ok).toBe(true);
  }
  return finalizeUploadSession(sessionId, companyId, "test-user");
}

async function releaseDossierBlobs(id: string) {
  const [docs, vers] = await Promise.all([
    prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId: id } }, select: { blobId: true } }),
    prisma.regulatoryDossierVersion.findMany({ where: { dossierId: id }, select: { originalZipBlobId: true } }),
  ]);
  for (const b of [...docs.map((d) => d.blobId), ...vers.map((v) => v.originalZipBlobId)]) if (b) await releaseBlob(b).catch(() => undefined);
}

describe("E2E — VRAI chemin d'upload sur dossier volumineux & sale (0 souci de bout en bout)", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (
      await prisma.regulatoryDossier.create({
        data: { companyId, reference: `${TAG}-ref`, title: "Amoxival — upload e2e", procedureType: "GENERIC", createdById: "test-user" },
        select: { id: true },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await releaseDossierBlobs(dossierId).catch(() => undefined);
    await prisma.regulatoryUploadSession.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("upload multi-parties → finalisation → analyse complète, entrées hostiles marquées, AUCUN échec", async () => {
    const zip = await buildMessyDossierZip();

    // ── VRAIE finalisation (spool disque + inspection flux + best-effort + insertion par lots) ──
    const fin = await uploadViaSession(zip);
    expect(fin.ok).toBe(true);
    const versionId = fin.ingest!.versionId!;
    expect(versionId).toBeTruthy();
    // Décomposition : sains conservés, exe + chemin absolu bloqués, archive imbriquée suspecte.
    expect(fin.ingest!.summary!.stored).toBeGreaterThanOrEqual(4); // txt(1+6) + docx + xlsx + png
    expect(fin.ingest!.summary!.blocked).toBeGreaterThanOrEqual(2); // exe + /etc/passwd
    expect(fin.ingest!.summary!.suspicious).toBeGreaterThanOrEqual(1); // nested.zip

    // IDEMPOTENCE : rejeu de la finalisation = succès, même version (pas de doublon).
    const replay = await finalizeUploadSession((await prisma.regulatoryUploadSession.findFirst({ where: { companyId }, select: { id: true } }))!.id, companyId, "test-user");
    expect(replay.ok).toBe(true);
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId } })).toBe(1);

    // ── Chaîne complète de jobs ──
    await drainJobs(dossierId);

    const docs = await prisma.regulatoryDocument.findMany({ where: { dossierVersionId: versionId }, include: { extraction: true } });
    const byExt = (e: string) => docs.find((x) => x.ext === e)!;

    // Sécurité : entrées hostiles marquées, jamais matérialisées.
    expect(byExt("exe").securityStatus).toBe("BLOCKED_EXECUTABLE");
    expect(byExt("exe").blobId).toBeNull();
    expect(docs.find((d) => d.originalPath.includes("passwd"))?.securityStatus).toBe("BLOCKED_PATH");
    expect(byExt("zip").securityStatus).toBe("SUSPICIOUS");

    // Lecture RÉELLE : texte natif (txt/docx/xlsx) + OCR RÉEL du scan.
    expect(byExt("txt").extractionStatus).toBe("TEXT_EXTRACTED");
    expect(byExt("docx").extraction?.content).toMatch(/FORMULAIRE|Fabricant/i);
    expect(byExt("xlsx").extraction?.content).toMatch(/conservation|24/i);
    const png = byExt("png");
    expect(["OCR_COMPLETED", "LOW_CONFIDENCE"]).toContain(png.extractionStatus);
    expect((png.extraction?.content ?? "").toUpperCase()).toContain("AMOXICILLINE");

    // Jumeau numérique : faits sourcés.
    const facts = await prisma.regulatoryFact.findMany({ where: { dossierVersionId: versionId }, select: { factKey: true } });
    const keys = new Set(facts.map((f) => f.factKey));
    expect(keys.has("INN")).toBe(true);
    expect(keys.has("PRODUCT_NAME")).toBe(true);

    // Règles : bilan de conformité produit.
    const assessment = await prisma.regulatoryAssessment.findUnique({ where: { dossierVersionId: versionId } });
    expect(assessment).not.toBeNull();
    expect(assessment!.requiredTotal).toBeGreaterThan(0);

    // Statut final + AUCUN job en échec (garantie « 0 souci »).
    const dossier = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { status: true } });
    expect(dossier?.status).toBe("IN_REVIEW");
    const jobs = await prisma.regulatoryJob.findMany({ where: { dossierId }, select: { type: true, status: true } });
    for (const t of ["EXTRACT", "OCR", "FACTS", "RULES"]) expect(jobs.some((j) => j.type === t && j.status === "DONE")).toBe(true);
    expect(jobs.some((j) => j.status === "FAILED")).toBe(false);
  }, 240_000);

  it("PROFIL VOLUMÉTRIQUE réel : ~60 fichiers × ~1 Mo INCOMPRESSIBLE, parties de PRODUCTION — passe de bout en bout", async () => {
    // Même forme que le dossier cible (dizaines de fichiers de plusieurs Mo, archive multi-parties
    // découpée avec la TAILLE DE PARTIE RÉELLE de production). Charge aléatoire → aucun gain de compression : chaque
    // étage (parties bytea, spool disque, inspection flux, blobs chiffrés, insertion par lots)
    // traite les VRAIS octets. Le chemin est LINÉAIRE en octets → même code à 459 Mo, en plus long.
    const volDossierId = (
      await prisma.regulatoryDossier.create({
        data: { companyId, reference: `${TAG}-vol`, title: "Profil volumétrique", procedureType: "GENERIC", createdById: "test-user" },
        select: { id: true },
      })
    ).id;
    const z = new JSZip();
    z.file("m1/1.0-lettre.txt", "DCI : Amoxicilline\nNom commercial : Amoxival 500 mg");
    for (let i = 0; i < 60; i++) z.file(`m3/annexe-${i}.pdf`, randomBytes(1024 * 1024)); // ~1 Mo/fichier, incompressible
    const zip = await z.generateAsync({ type: "nodebuffer" });
    expect(zip.length).toBeGreaterThan(55 * 1024 * 1024); // archive réellement volumineuse (~60 Mo)

    const start = await startUploadSession({ companyId, dossierId: volDossierId, createdById: "test-user", filename: "gros-dossier.zip", totalBytes: zip.length });
    expect(start.ok).toBe(true);
    // On lit la taille de partie de PRODUCTION plutôt que d'en figer une : ce réglage est un
    // levier de performance qui bouge, et le test doit valider le CHEMIN, pas la valeur du jour.
    expect(start.partSize).toBe(DEFAULT_PART_SIZE);
    const parts = start.expectedParts!;
    expect(parts).toBeGreaterThanOrEqual(2); // vraie session multi-parties
    for (let i = 0; i < parts; i++) {
      const data = Buffer.from(zip.subarray(i * start.partSize!, Math.min((i + 1) * start.partSize!, zip.length)));
      const r = await putUploadPart({ sessionId: start.sessionId!, companyId, index: i, data });
      expect(r.ok).toBe(true);
    }
    const fin = await finalizeUploadSession(start.sessionId!, companyId, "test-user");
    expect(fin.ok).toBe(true);
    expect(fin.ingest?.summary?.total).toBe(61);
    expect(fin.ingest?.summary?.stored).toBe(61); // TOUS les fichiers conservés
    // Parties nettoyées, session COMPLETED, version en base.
    expect(await prisma.regulatoryUploadPart.count({ where: { sessionId: start.sessionId! } })).toBe(0);
    expect(await prisma.regulatoryDossierVersion.count({ where: { dossierId: volDossierId } })).toBe(1);
    await releaseDossierBlobs(volDossierId).catch(() => undefined);
  }, 300_000);
});
