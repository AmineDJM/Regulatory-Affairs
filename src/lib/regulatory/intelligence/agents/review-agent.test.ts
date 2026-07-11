import { describe, it, expect } from "vitest";
import { reviewDocumentText, type AiFn } from "./review-agent";

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
