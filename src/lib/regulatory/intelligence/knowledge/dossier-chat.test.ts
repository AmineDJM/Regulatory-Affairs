import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { askDossier } from "./dossier-chat";
import type { AiTextResult } from "@/lib/ai";

/**
 * Chatbot de dossier (intégration base) : vérifie que la réponse est ANCRÉE dans les documents lus
 * (le prompt ne contient QUE les extraits récupérés), que la citation porte la PAGE EXACTE (via le
 * texte par page océrisé), et que l'assistant S'ABSTIENT (sans appeler l'IA) quand rien ne correspond.
 */

const TAG = `test-chat-${Date.now()}`;
let companyId = "";
let versionId = "";
let docId = "";
/**
 * AUCUNE CLE N\'EST POSEE ICI, ET C\'EST LE SUJET.
 *
 * La version precedente ecrivait `ANTHROPIC_API_KEY = "sk-test"` en `beforeAll`, avec en
 * commentaire « rend aiConfigured() vrai -> l\'aiFn injectee est appelee ». Devoir poser une cle
 * pour qu\'un moteur INJECTE soit appele disait le defaut a voix haute : le code de production
 * bloquait sur la cle du moteur PAR DEFAUT alors qu\'on lui en fournissait un autre. Les quatre
 * autres appelants injectables du module (`arbitrate-facts`, `ai-facts`, `draft`,
 * `simulator/run`) tenaient deja la bonne garde ; celui-ci ne la tenait pas.
 *
 * Le test tourne donc SANS cle. S\'il repasse au rouge, c\'est que la garde est revenue.
 */

describe("askDossier — Q&R sourcée, page exacte, abstention", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    const dossierId = (await prisma.regulatoryDossier.create({ data: { companyId, reference: `${TAG}-ref`, title: "DTF+3TC", createdById: "u" }, select: { id: true } })).id;
    versionId = (await prisma.regulatoryDossierVersion.create({ data: { dossierId, versionNo: 1, createdById: "u", fileCount: 1 }, select: { id: true } })).id;
    docId = (await prisma.regulatoryDocument.create({
      data: { dossierVersionId: versionId, originalPath: "m3/stab.pdf", originalFilename: "3.2.p.8-stab.pdf", ext: "pdf", sha256: `${TAG}-a`, ctdModule: "3", ctdSection: "3.2.P.8", securityStatus: "SAFE", extractionStatus: "OCR_COMPLETED" },
      select: { id: true },
    })).id;
    // Contenu = concaténation RÉELLE des pages OCR (« \n\n » entre pages) ; ocrPages ne porte QUE des
    // métadonnées (page, chars) — comme le vrai pipeline. La page exacte se retrouve par le DÉCALAGE.
    const p1 = "Page de garde du rapport de stabilité.";
    const p2 = "La durée de conservation est de 24 mois à 25°C/60%HR pour le produit fini.";
    const content = `${p1}\n\n${p2}`;
    await prisma.regulatoryExtraction.create({
      data: {
        documentId: docId, method: "ocr", charCount: content.length, content,
        ocrPages: [
          { page: 1, chars: p1.length, confidence: 96, lowConfidence: false },
          { page: 12, chars: p2.length, confidence: 95, lowConfidence: false },
        ] as unknown as object,
      },
    });
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("récupère le passage, cite la PAGE exacte, et n'ancre la réponse que sur les extraits fournis", async () => {
    let seenPrompt = "";
    const aiFn = vi.fn(async (prompt: string): Promise<AiTextResult> => {
      seenPrompt = prompt;
      return { ok: true, configured: true, text: "La durée de conservation est de 24 mois [1]." };
    });

    const r = await askDossier(versionId, "durée de conservation", aiFn);
    expect(r.ok).toBe(true);
    expect(aiFn).toHaveBeenCalledTimes(1);
    // Le prompt donné au modèle contient l'extrait réel (base autorisée) + la question.
    expect(seenPrompt).toContain("durée de conservation");
    expect(seenPrompt).toContain("3.2.p.8-stab.pdf");
    // Citation avec PAGE EXACTE résolue depuis le texte océrisé par page.
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0].documentId).toBe(docId);
    expect(r.citations[0].page).toBe(12);
    expect(r.answer).toContain("[1]");
  });

  it("s'abstient (sans appeler l'IA) quand aucun passage ne correspond et aucun fait", async () => {
    const aiFn = vi.fn(async (): Promise<AiTextResult> => ({ ok: true, configured: true, text: "ne devrait pas être appelé" }));
    const r = await askDossier(versionId, "chromatographie ionique du palladium", aiFn);
    expect(aiFn).not.toHaveBeenCalled(); // rien de sourcé → pas d'appel IA, pas d'invention
    expect(r.citations).toHaveLength(0);
    expect(r.answer.toLowerCase()).toContain("aucun passage");
  });

  it("« aucun passage » passe AVANT « il manque une cle » — l'ordre inverse envoyait corriger la mauvaise chose", async () => {
    /**
     * Le defaut mesure : la garde de configuration etait testee la PREMIERE. Quelqu'un dont le
     * dossier ne contient simplement rien sur le sujet recevait « l'assistant necessite une cle
     * IA » et serait alle poser une cle pour rien. Sans passage, aucun appel n'aurait lieu de
     * toute facon : la cle n'est pas la raison, et le dire est faux.
     *
     * On force ici le moteur PAR DEFAUT (pas d'`aiFn`), le seul cas ou la garde s'applique.
     */
    const avant = { o: process.env.OPENAI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const r = await askDossier(versionId, "chromatographie ionique du palladium");
      expect(r.answer.toLowerCase(), "la reponse parle de la cle au lieu de l'absence de passage").toContain("aucun passage");
      expect(r.answer.toLowerCase()).not.toContain("api_key");
    } finally {
      if (avant.o === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = avant.o;
      if (avant.a === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = avant.a;
    }
  });
});
