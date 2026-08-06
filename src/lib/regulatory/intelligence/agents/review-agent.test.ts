import { describe, it, expect } from "vitest";
import { reviewDocumentText, parseReviewOutput, type AiFn } from "./review-agent";

const LONG_TEXT = "Résumé global de la qualité du produit fini. ".repeat(4);
const baseInput = { filename: "2.3-qos.docx", ctdSection: "2.3", ctdTitle: "Résumé global de la qualité (QOS)", text: LONG_TEXT };

const respond = (text: string): AiFn => async () => ({ ok: true, configured: true, text });

describe("reviewDocumentText — agent IA encadré (DRAFT, anti-injection, Zod)", () => {
  it("parse une sortie JSON valide en constats structurés", async () => {
    const ai = respond('{"findings":[{"severity":"MAJOR","category":"content","title":"Section incomplète","detail":"Le QOS ne couvre pas la stabilité.","evidence":"aucune mention de stabilité","sectionCode":"2.3"}]}');
    const r = await reviewDocumentText(baseInput, ai);
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].severity).toBe("MAJOR");
    expect(r.findings[0].evidence).toContain("stabilité");
  });

  it("le prompt encadre le document comme DONNÉE NON FIABLE + système anti-injection", async () => {
    let seenPrompt = "";
    let seenSystem = "";
    const ai: AiFn = async (prompt, opts) => { seenPrompt = prompt; seenSystem = opts.system ?? ""; return { ok: true, configured: true, text: '{"findings":[]}' }; };
    await reviewDocumentText(baseInput, ai);
    expect(seenPrompt).toContain("DEBUT_DOCUMENT_NON_FIABLE");
    expect(seenPrompt).toContain("FIN_DOCUMENT_NON_FIABLE");
    expect(seenSystem).toContain("DONNÉE NON FIABLE");
    expect(seenSystem.toLowerCase()).toContain("json");
  });

  it("tolère les clôtures ```json et le texte parasite autour du JSON", async () => {
    const ai = respond('Voici mon analyse :\n```json\n{"findings":[{"severity":"MINOR","category":"form","title":"Lisibilité","detail":"Document scanné de faible qualité."}]}\n```\nFin.');
    const r = await reviewDocumentText(baseInput, ai);
    expect(r.ok).toBe(true);
    expect(r.findings[0].severity).toBe("MINOR");
  });

  it("JSON invalide → aucune sortie (jamais d'invention)", async () => {
    const r = await reviewDocumentText(baseInput, respond("désolé, je ne peux pas répondre en JSON"));
    expect(r.ok).toBe(false);
    expect(r.findings).toHaveLength(0);
  });

  it("schéma non respecté (findings absent) → rejet, aucune sortie", async () => {
    const r = await reviewDocumentText(baseInput, respond('{"resultat":"conforme"}'));
    expect(r.ok).toBe(false);
    expect(r.findings).toHaveLength(0);
  });

  it("texte trop court → pas d'appel IA, liste vide", async () => {
    let called = false;
    const ai: AiFn = async () => { called = true; return { ok: true, configured: true, text: "{}" }; };
    const r = await reviewDocumentText({ ...baseInput, text: "court" }, ai);
    expect(called).toBe(false);
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it("échec de l'appel IA → ok=false, propage l'erreur, aucune sortie", async () => {
    const ai: AiFn = async () => ({ ok: false, configured: true, error: "réseau" });
    const r = await reviewDocumentText(baseInput, ai);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("réseau");
  });
});

/**
 * LES CHAMPS QUI RENDENT UN CONSTAT DÉFENDABLE.
 *
 * Un constat sans page ni extrait ne se défend pas devant l'ANPP. Mais un constat avec une page
 * INVENTÉE se défend encore moins : on ouvre le document devant l'examinateur et il n'y a rien.
 * D'où la règle testée ici — ces champs sont facultatifs, jamais devinés, et une valeur
 * aberrante est neutralisée plutôt que de faire échouer toute la lecture.
 */
describe("parseReviewOutput — la preuve, ou rien", () => {
  const base = { severity: "MAJOR", category: "content", title: "T", detail: "D", evidence: "extrait" };

  it("retient page, recommandation, confiance et valeurs contradictoires", () => {
    const r = parseReviewOutput(JSON.stringify({
      findings: [{ ...base, page: 12, recommendation: "Joindre le CoA signé.", confidence: 0.8, conflictingValues: ["36 mois", "24 mois"] }],
    }));
    expect(r.ok).toBe(true);
    expect(r.findings[0]).toMatchObject({
      page: 12, recommendation: "Joindre le CoA signé.", confidence: 0.8, conflictingValues: ["36 mois", "24 mois"],
    });
  });

  it("un constat sans ces champs reste valide — on ne force pas le modèle à deviner", () => {
    const r = parseReviewOutput(JSON.stringify({ findings: [base] }));
    expect(r.ok).toBe(true);
    expect(r.findings[0]).toMatchObject({ page: null, recommendation: null, confidence: null, conflictingValues: [] });
  });

  it("une valeur aberrante est neutralisée, elle ne fait pas perdre tout le constat", () => {
    const r = parseReviewOutput(JSON.stringify({ findings: [{ ...base, page: "douze", confidence: 42 }] }));
    expect(r.ok).toBe(true);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].page).toBeNull();
    expect(r.findings[0].confidence).toBeNull();
    expect(r.findings[0].title).toBe("T"); // le constat lui-même survit
  });

  it("JSON invalide → aucune sortie", () => {
    expect(parseReviewOutput("pas du json").ok).toBe(false);
  });
});
