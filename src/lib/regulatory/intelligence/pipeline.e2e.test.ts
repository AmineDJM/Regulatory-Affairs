import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { releaseBlob } from "@/lib/drive-storage";
import { ingestDossierZip } from "./ingest/ingest-dossier";
import { runRegulatoryJob } from "./jobs/runner";

/**
 * TEST END-TO-END du PIPELINE COMPLET (base + OCR + moteur réels, aucune simulation).
 *
 * Reproduit exactement le parcours demandé : « je télécharge un dossier, ça décompose les
 * fichiers, les lit TOUS en détail, les classe, etc. jusqu'à la fin des étapes ».
 *
 *   1. INGESTION    — un ZIP CTD multi-formats (txt, docx, xlsx, scan PNG, exe bloqué).
 *   2. DÉCOMPOSITION — chaque fichier tracé, l'exécutable refusé (jamais matérialisé).
 *   3. LECTURE       — texte NATIF (txt/docx/xlsx) + OCR RÉEL du scan (tesseract.js).
 *   4. CLASSIFICATION— CTD déterministe (code de chemin) par fichier.
 *   5. JUMEAU        — faits sourcés depuis TOUS les documents lus, y compris le scan océrisé.
 *   6. CONFLITS      — comparaison des occurrences.
 *   7. RÈGLES        — bilan de conformité déterministe + constats.
 *
 * On pilote la chaîne de jobs en conditions réelles (EXTRACT → OCR → FACTS → RULES) et on
 * observe la sortie de CHAQUE étape. Nettoyage complet en fin.
 */

const TAG = `test-e2e-pipe-${Date.now()}`;
let companyId = "";
let dossierId = "";

// ── Fabriques de fichiers RÉELS (formats authentiques, pas des stubs) ──────────────────────

/** DOCX minimal mais valide (OOXML) — lisible par mammoth. */
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

/** XLSX réel via la lib `xlsx`. */
function makeXlsx(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stabilite");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** PNG « scanné » : texte rendu sur fond blanc (OCR-friendly, plusieurs lignes). */
async function makePng(lines: string[]): Promise<Buffer> {
  const lh = 62, pad = 26, w = 940, h = pad * 2 + lh * lines.length;
  const texts = lines
    .map((l, i) => `<text x="${pad}" y="${pad + lh * (i + 1) - 16}" font-family="DejaVu Sans" font-size="42" fill="black">${l}</text>`)
    .join("");
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${texts}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildDossierZip(): Promise<Buffer> {
  // 1.0 — Lettre d'accompagnement (texte natif) : DCI + dénomination + titulaire + forme + dosage.
  const cover = [
    "ADVENTUM PHARMA — LETTRE D'ACCOMPAGNEMENT",
    "Objet : demande d'enregistrement d'une specialite pharmaceutique",
    "DCI : Amoxicilline",
    "Nom commercial : Amoxival 500 mg",
    "Titulaire : Adventum Pharma SARL",
    "Forme pharmaceutique : comprimé pelliculé",
    "Dosage : 500 mg",
  ].join("\n");

  // 1.2 — Formulaire de demande (DOCX) : demandeur + fabricant + voie + conditionnement.
  const form = await makeDocx([
    "FORMULAIRE DE DEMANDE D'ENREGISTREMENT",
    "Demandeur : Adventum Pharma SARL",
    "Fabricant : Site de fabrication Adventum, Alger",
    "Voie d'administration : voie orale",
    "Conditionnement : plaquette PVC/Aluminium, boîte de 30 comprimés",
  ]);

  // 3.2.P.8 — Étude de stabilité (XLSX) : durée de conservation + conditions.
  const stability = makeXlsx([
    ["Parametre", "Valeur"],
    ["Etude de stabilite", "Amoxival 500 mg comprimé pelliculé"],
    ["Duree de conservation", "24 mois"],
    ["Conditions de conservation", "Conserver à 25 °C"],
    ["Zone climatique", "IVb"],
  ]);

  // 1.4 — Certificat CPP (SCAN → OCR obligatoire) : substance active + taille de lot.
  const cpp = await makePng([
    "CERTIFICAT DE PRODUIT PHARMACEUTIQUE",
    "SUBSTANCE ACTIVE : AMOXICILLINE",
    "BATCH SIZE 100000",
  ]);

  // Exécutable — DOIT être bloqué (jamais matérialisé).
  const exe = Buffer.from("MZ\x90\x00\x03 fake installer program");

  const z = new JSZip();
  z.file("m1/1.0-lettre-accompagnement.txt", cover);
  z.file("m1/1.2-formulaire-demande.docx", form);
  z.file("m3/3.2.p.8-etude-stabilite.xlsx", stability);
  z.file("m1/1.4-certificat-cpp.png", cpp);
  z.file("outils/installateur.exe", exe);
  return z.generateAsync({ type: "nodebuffer" });
}

/** Pilote la file de jobs du dossier jusqu'à épuisement (EXTRACT → OCR → FACTS → RULES). */
async function drainJobs(id: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    const next = await prisma.regulatoryJob.findFirst({
      where: { dossierId: id, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!next) return;
    await runRegulatoryJob(next.id);
  }
}

async function releaseDossierBlobs(id: string) {
  const [docs, vers] = await Promise.all([
    prisma.regulatoryDocument.findMany({ where: { dossierVersion: { dossierId: id } }, select: { blobId: true } }),
    prisma.regulatoryDossierVersion.findMany({ where: { dossierId: id }, select: { originalZipBlobId: true } }),
  ]);
  for (const b of [...docs.map((d) => d.blobId), ...vers.map((v) => v.originalZipBlobId)]) {
    if (b) await releaseBlob(b).catch(() => undefined);
  }
}

describe("Pipeline Regulatory Intelligence — bout en bout (ingestion → décomposition → lecture → classification → jumeau → règles)", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (
      await prisma.regulatoryDossier.create({
        data: { companyId, reference: `${TAG}-ref`, title: "Amoxival 500 mg — enregistrement", procedureType: "GENERIC", createdById: "test-user" },
        select: { id: true },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await releaseDossierBlobs(dossierId).catch(() => undefined);
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("décompose, LIT TOUS les fichiers (natif + OCR), les classe, bâtit le jumeau et évalue — jusqu'au bout", async () => {
    // ── 1) INGESTION ──────────────────────────────────────────────────────────────────────
    const zip = await buildDossierZip();
    const res = await ingestDossierZip({ companyId, dossierId, actorId: "test-user", filename: "dossier-amoxival.zip", buffer: zip });
    expect(res.ok).toBe(true);
    expect(res.versionId).toBeTruthy();
    const versionId = res.versionId!;
    // Décomposition : 5 entrées, 4 conservées (txt/docx/xlsx/png), 1 bloquée (exe).
    expect(res.summary?.total).toBe(5);
    expect(res.summary?.stored).toBe(4);
    expect(res.summary?.blocked).toBe(1);

    // ── Pilotage de la chaîne complète de jobs ──────────────────────────────────────────────
    await drainJobs(dossierId);

    const docs = await prisma.regulatoryDocument.findMany({
      where: { dossierVersionId: versionId },
      include: { extraction: true },
    });
    expect(docs.length).toBe(5);
    const byExt = (e: string) => {
      const d = docs.find((x) => x.ext === e);
      if (!d) throw new Error(`document .${e} introuvable`);
      return d;
    };

    // ── 2) DÉCOMPOSITION / SÉCURITÉ ─────────────────────────────────────────────────────────
    const exe = byExt("exe");
    expect(exe.securityStatus).toBe("BLOCKED_EXECUTABLE");
    expect(exe.blobId).toBeNull(); // jamais matérialisé
    for (const e of ["txt", "docx", "xlsx", "png"]) {
      const d = byExt(e);
      expect(d.securityStatus).toBe("SAFE");
      expect(d.blobId).toBeTruthy();
    }

    // ── 3) LECTURE EN DÉTAIL — texte NATIF ──────────────────────────────────────────────────
    const txt = byExt("txt");
    expect(txt.extractionStatus).toBe("TEXT_EXTRACTED");
    expect(txt.extraction?.method).toBe("plain");
    expect(txt.extraction?.content).toMatch(/Amoxival/i);
    expect(txt.extraction?.content).toMatch(/DCI/i);

    const docx = byExt("docx");
    expect(docx.extractionStatus).toBe("TEXT_EXTRACTED");
    expect(docx.extraction?.method).toBe("docx");
    expect(docx.extraction?.content).toMatch(/FORMULAIRE DE DEMANDE/i);
    expect(docx.extraction?.content).toMatch(/Fabricant/i);

    const xlsx = byExt("xlsx");
    expect(xlsx.extractionStatus).toBe("TEXT_EXTRACTED");
    expect(xlsx.extraction?.method).toBe("xlsx");
    expect(xlsx.extraction?.content).toMatch(/conservation/i);
    expect(xlsx.extraction?.content).toMatch(/24/);

    // ── 3bis) LECTURE EN DÉTAIL — OCR RÉEL du scan ──────────────────────────────────────────
    const png = byExt("png");
    expect(["OCR_COMPLETED", "LOW_CONFIDENCE"]).toContain(png.extractionStatus);
    expect(png.extraction?.method).toBe("ocr");
    expect(Number(png.extraction?.ocrConfidence)).toBeGreaterThan(0);
    expect(Array.isArray(png.extraction?.ocrPages)).toBe(true);
    expect((png.extraction?.content ?? "").toUpperCase()).toContain("AMOXICILLINE");

    // ── 4) CLASSIFICATION CTD (déterministe, par fichier) ───────────────────────────────────
    expect({ module: txt.ctdModule, section: txt.ctdSection }).toEqual({ module: "M1", section: "1.0" });
    expect({ module: docx.ctdModule, section: docx.ctdSection }).toEqual({ module: "M1", section: "1.2" });
    expect({ module: xlsx.ctdModule, section: xlsx.ctdSection }).toEqual({ module: "M3", section: "3.2.P.8" });
    expect({ module: png.ctdModule, section: png.ctdSection }).toEqual({ module: "M1", section: "1.4" });
    for (const d of [txt, docx, xlsx, png]) expect(d.classificationMethod).toBe("code-path");

    // ── 5) JUMEAU NUMÉRIQUE — faits sourcés (dont ceux issus du SCAN océrisé) ────────────────
    const facts = await prisma.regulatoryFact.findMany({
      where: { dossierVersionId: versionId },
      include: { occurrences: true },
    });
    const keys = new Set(facts.map((f) => f.factKey));
    // Faits du texte natif.
    expect(keys.has("INN")).toBe(true);
    expect(keys.has("PRODUCT_NAME")).toBe(true);
    const inn = facts.find((f) => f.factKey === "INN")!;
    expect((inn.value ?? "").toLowerCase()).toContain("amoxicilline");
    const productName = facts.find((f) => f.factKey === "PRODUCT_NAME")!;
    expect((productName.value ?? "").toLowerCase()).toContain("amoxival");

    // CŒUR DE LA GARANTIE : le contenu OCR du SCAN alimente réellement le jumeau — au moins
    // une occurrence sourcée pointe vers le document scanné (sinon les scans seraient lus mais
    // silencieusement ignorés en aval).
    const allOccurrences = facts.flatMap((f) => f.occurrences);
    const scanOccurrences = allOccurrences.filter((o) => o.documentId === png.id);
    expect(scanOccurrences.length).toBeGreaterThan(0);
    // Chaque occurrence porte sa preuve exacte + confiance + méthode.
    for (const o of scanOccurrences) {
      expect(o.extract.length).toBeGreaterThan(0);
      expect(o.confidence).toBeGreaterThan(0);
      expect(["regex", "keyword", "label"]).toContain(o.method);
    }

    // ── 6) RÈGLES — bilan de conformité + constats ──────────────────────────────────────────
    const assessment = await prisma.regulatoryAssessment.findUnique({ where: { dossierVersionId: versionId } });
    expect(assessment).not.toBeNull();
    expect(assessment!.requiredTotal).toBeGreaterThan(0);
    expect(assessment!.completeness).toBeGreaterThanOrEqual(0);

    const ruleFindings = await prisma.regulatoryFinding.count({ where: { dossierVersionId: versionId, source: "RULE" } });
    expect(ruleFindings).toBeGreaterThan(0);

    // ── 7) FIN DES ÉTAPES — statut du dossier + jobs tous terminés ──────────────────────────
    const dossier = await prisma.regulatoryDossier.findUnique({ where: { id: dossierId }, select: { status: true } });
    expect(dossier?.status).toBe("IN_REVIEW");

    const jobs = await prisma.regulatoryJob.findMany({ where: { dossierId }, select: { type: true, status: true } });
    const done = (t: string) => jobs.some((j) => j.type === t && j.status === "DONE");
    expect(done("EXTRACT")).toBe(true);
    expect(done("OCR")).toBe(true);
    expect(done("FACTS")).toBe(true);
    expect(done("RULES")).toBe(true);
    // Aucun job resté en attente / en cours : la chaîne est allée jusqu'au bout.
    expect(jobs.every((j) => ["DONE", "CANCELLED", "FAILED"].includes(j.status))).toBe(true);
    expect(jobs.some((j) => j.status === "FAILED")).toBe(false);
  }, 180_000);
});
