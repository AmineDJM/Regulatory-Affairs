import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingestCorpusFile } from "./ingest-file";
import { CORPUS_IMPORT_EXTS, libelleFormats } from "./import-formats";
import { lireTexteOuOcr } from "../extract/texte-ou-ocr";
import { buildSimplePdf, parsePdfBody } from "@/lib/pdf/simple-pdf";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN SCAN ENTRE DANS LE CORPUS — le « je ne peux pas » artificiel qu'on vient de retirer (#63).
 *
 * ── CE QUI ÉTAIT MESURÉ ─────────────────────────────────────────────────────────────────
 *
 * L'ingestion du corpus répondait : « Document image (scanné) : le corpus attend un texte
 * sélectionnable. Océrisez-le d'abord. » Le moteur OCR vit dans le répertoire VOISIN, il tourne
 * en production sur les documents de dossier, et l'ingestion d'ENTRAÎNEMENT — le fichier d'à
 * côté — l'appelait déjà. On renvoyait une personne faire à la main ce que le logiciel savait
 * faire, à un mètre de là.
 *
 * ── POURQUOI LE MOTEUR EST INJECTÉ ICI ──────────────────────────────────────────────────
 *
 * L'OCR réel télécharge ses données de langue et, en mode « auto », appelle un service. Un test
 * qui en dépendrait mesurerait le réseau du jour. On injecte donc le geste — et ce que le test
 * vérifie reste ce qui compte : que l'ingestion l'APPELLE, qu'elle garde son texte, et qu'elle
 * en consigne la provenance. Le moteur lui-même a ses propres tests.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const PREFIXE = "__ocrcorpus__";
const TEXTE_OCR = `ARRÊTÉ ${PREFIXE} du 8 septembre 2026 portant conditions d'enregistrement. `
  + "Article 1er. Le présent arrêté fixe les modalités applicables aux demandes déposées auprès de "
  + "l'agence. Article 2. Le dossier comprend les pièces administratives, la documentation qualité, "
  + "les données précliniques et cliniques, ainsi que le projet de notice. Article 3. Toute demande "
  + "incomplète fait l'objet d'une notification de réserves dans un délai de trente jours. Article 4. "
  + "Le silence de l'administration au terme du délai ne vaut pas acceptation. Article 5. Les "
  + "dispositions contraires sont abrogées à compter de la publication du présent arrêté au Journal "
  + "officiel de la République. Article 6. Le directeur général est chargé de l'exécution.";

/** Un PDF sans couche de texte : c'est ce que rend un scan. */
const scanSansTexte = (): Buffer => buildSimplePdf("", [], {});

const balayer = async () => {
  const sources = await prisma.regulatorySource.findMany({
    where: { title: { contains: PREFIXE } }, select: { id: true },
  });
  if (sources.length === 0) return;
  const ids = sources.map((s) => s.id);
  const versions = await prisma.regulatorySourceVersion.findMany({ where: { sourceId: { in: ids } }, select: { id: true } });
  await prisma.regulatorySourceSection.deleteMany({ where: { sourceVersionId: { in: versions.map((v) => v.id) } } });
  await prisma.regulatorySourceVersion.deleteMany({ where: { sourceId: { in: ids } } });
  await prisma.regulatorySource.deleteMany({ where: { id: { in: ids } } });
};

beforeAll(balayer);
afterAll(balayer);

describe("un scan entre dans le corpus au lieu d'être renvoyé à un humain", () => {
  it("le PDF sans texte est OCÉRISÉ, ingéré, et sa provenance est écrite en base", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : revenir au refus (« Océrisez-le d'abord »), ou océriser
     * sans dire que le texte vient d'un OCR — auquel cas Adam citerait une reconnaissance à
     * 71 % comme un arrêté copié du Journal officiel.
     */
    const res = await ingestCorpusFile({
      filename: `${PREFIXE}arrete-scanne.pdf`,
      buffer: scanSansTexte(),
      title: `${PREFIXE} Arrêté scanné`,
      ocr: async () => ({ text: TEXTE_OCR, meanConfidence: 71.4, needsReview: true, pageCount: 3 }),
    });

    expect(res.error ?? "", "le corpus refuse encore les scans").toBe("");
    expect(res.status).toBe("INGESTED");
    expect(res.methode).toBe("ocr");
    expect(res.confiance).toBe(71);
    expect(res.aRelire).toBe(true);
    expect(res.sections ?? 0).toBeGreaterThan(0);

    const version = await prisma.regulatorySourceVersion.findUnique({
      where: { id: res.sourceVersionId! },
      select: { extractionMethod: true, extractionConfidence: true, originalText: true },
    });
    expect(version?.extractionMethod, "la provenance n'est pas persistée : l'écran ne peut rien dire").toBe("ocr");
    expect(version?.extractionConfidence).toBe(71);
    expect(version?.originalText ?? "").toContain("Article 3");
  });

  it("un OCR qui ne rend rien REFUSE — et sans renvoyer la personne l'océriser elle-même", async () => {
    const res = await ingestCorpusFile({
      filename: `${PREFIXE}illisible.pdf`,
      buffer: scanSansTexte(),
      title: `${PREFIXE} Illisible`,
      ocr: async () => ({ text: "   ", meanConfidence: 4, needsReview: true, pageCount: 2 }),
    });
    expect(res.status).toBe("FAILED");
    expect(res.error ?? "", "le refus dit encore à la personne de faire le travail").not.toMatch(/océrisez/i);
    expect(res.error ?? "").toMatch(/OCR n'a rien pu en tirer|n'a lu que/i);
  });

  it("les images sont des sources : la porte s'ouvre à leur extension", () => {
    for (const ext of ["png", "jpg", "jpeg", "tiff"]) {
      expect(CORPUS_IMPORT_EXTS as readonly string[], `« ${ext} » est refusé alors que l'OCR sait le lire`).toContain(ext);
    }
    // Le motif de refus se construit depuis la liste : écrit à la main, il avait DÉJÀ menti
    // (« PDF, DOCX, TXT, MD, HTML, XLSX » alors que CSV et XLS passaient).
    expect(libelleFormats()).toContain("CSV");
    expect(libelleFormats()).toContain("PNG");
  });
});

describe("le lecteur unique — texte natif, OCR seulement quand il le faut", () => {
  it("n'océrise PAS un document qui porte déjà son texte", async () => {
    let appels = 0;
    const pdf = buildSimplePdf("Arrêté", parsePdfBody(TEXTE_OCR), {});
    const lu = await lireTexteOuOcr("pdf", pdf, {
      seuilOcr: 300,
      ocr: async () => { appels += 1; return { text: "AUTRE", meanConfidence: 99, needsReview: false, pageCount: 1 }; },
    });
    expect(appels, "on paie un OCR sur un texte déjà lisible, et on rend un texte différent").toBe(0);
    expect(lu.methode).toBe("texte");
  });

  it("un OCR qui apporte MOINS que le texte natif est écarté", async () => {
    const pdf = buildSimplePdf("Arrêté", parsePdfBody(TEXTE_OCR), {});
    const lu = await lireTexteOuOcr("pdf", pdf, {
      seuilOcr: 100_000, // on force le passage par l'OCR
      ocr: async () => ({ text: "trois mots seulement", meanConfidence: 99, needsReview: false, pageCount: 1 }),
    });
    expect(lu.methode, "une reconnaissance approximative remplace un texte propre").toBe("texte");
  });

  it("un moteur OCR indisponible ne fabrique pas de succès", async () => {
    const lu = await lireTexteOuOcr("pdf", scanSansTexte(), {
      ocr: async () => { throw new Error("tesseract absent"); },
    });
    expect(lu.methode).toBe("texte");
    expect(lu.texte.length).toBeLessThan(300);
  });
});
