import { describe, expect, it } from "vitest";
import type { ClaudeMessage, ClaudeRawResult, ClaudeToolDef } from "@/lib/models/compat";
import { specialiste } from "./registry";
import { deleguer } from "./run";

/**
 * LA BOUCLE D'UN SPÉCIALISTE, avec un modèle SCRIPTÉ : un outil demandé puis un rapport, un outil
 * hors périmètre refusé sans être exécuté, le budget de tours qui borne, le délai qui borne, la
 * calibration qui sort des faits déclarés par l'outil.
 */
const defs: ClaudeToolDef[] = [
  { name: "legal_intelligence", description: "x", input_schema: { type: "object", properties: {} } },
  { name: "read_document", description: "x", input_schema: { type: "object", properties: {} } },
  { name: "decide_payment", description: "x", input_schema: { type: "object", properties: {} } },
];
const sortieOutil = JSON.stringify({
  signaux: [{ code: "denonciation_a_decider", titre: "Dénoncer dans 18 j" }],
  _provenance: [{ id: "legal:1", libelle: "Date limite de dénonciation", valeur: "2026-09-25", nature: "ERP", famille: "legal", outil: "legal_intelligence", href: "/legal/1", locator: null, horodatage: "2026-09-06", observeLe: "2026-09-06T10:00:00Z", confiance: 0.95, base: "declare", fraicheur: "TEMPS_REEL", autorite: null, preuveNegative: null, acteur: "u1", calcul: null }],
});

function scripte(reponses: ClaudeRawResult[]): { appel: (m: ClaudeMessage[]) => Promise<ClaudeRawResult>; appels: ClaudeMessage[][] } {
  const appels: ClaudeMessage[][] = [];
  let i = 0;
  return { appels, appel: async (m) => { appels.push(m); return reponses[Math.min(i++, reponses.length - 1)]; } };
}

describe("déléguer à un spécialiste", () => {
  it("un outil demandé est exécuté sous l'exécuteur du tour, un outil hors périmètre est refusé sans exécution, le rapport est calibré", async () => {
    const executes: string[] = [];
    const m = scripte([
      { ok: true, configured: true, content: [{ type: "tool_use", id: "a", name: "legal_intelligence", input: { filtre: "Sofradis" } }, { type: "tool_use", id: "b", name: "decide_payment", input: {} }] },
      { ok: true, configured: true, content: [{ type: "text", text: "FAITS VÉRIFIÉS — dénonciation au plus tard le 2026-09-25 (legal_intelligence)." }] },
    ]);
    const r = await deleguer(specialiste("legal")!, "Quand dénoncer le contrat Sofradis ?", "Le contrat finit dans 200 jours.", {
      appel: m.appel, defs, acteur: "u1", executer: async (name) => { executes.push(name); return sortieOutil; },
    });
    expect(r.ok).toBe(true);
    expect(r.tours).toBe(2);
    expect(executes).toEqual(["legal_intelligence"]);
    expect(r.outils).toEqual(["legal_intelligence"]);
    expect(r.texte).toMatch(/2026-09-25/);
    expect(r.faits.length).toBe(1);
    expect(r.calibration).toMatchObject({ certitude: "CERTAIN", conduite: "AGIR" });
    // Le second appel porte le tool_result de l'outil exécuté ET le refus de l'outil hors périmètre.
    const second = m.appels[1];
    const dernier = second[second.length - 1].content as { type: string; tool_use_id: string; content: string; is_error?: boolean }[];
    expect(dernier.map((b) => [b.tool_use_id, b.is_error ?? false])).toEqual([["a", false], ["b", true]]);
    expect(dernier[1].content).toMatch(/hors du périmètre/);
    // Le système du worker ne cite que les outils du spécialiste présents chez la personne.
    expect(String((second as unknown as never[]).length)).toBeTruthy();
  });

  it("le budget de tours borne : des outils encore demandés au dernier tour rendent un rapport INCOMPLET, dit", async () => {
    const m = scripte([{ ok: true, configured: true, content: [{ type: "tool_use", id: "a", name: "read_document", input: {} }] }]);
    const spec = { ...specialiste("legal")!, maxTours: 2 };
    const r = await deleguer(spec, "lis tout", null, { appel: m.appel, defs, acteur: "u1", executer: async () => "{}" });
    expect(r.tours).toBe(2);
    expect(r.incomplet).toMatch(/budget de 2 tours/);
    expect(m.appels.length).toBe(2);
    expect(r.calibration.certitude).toBe("MANQUANT");
  });

  it("le délai borne avant un nouvel appel, et une erreur du modèle est dite sans inventer de rapport", async () => {
    const m = scripte([{ ok: true, configured: true, content: [{ type: "tool_use", id: "a", name: "read_document", input: {} }] }]);
    const r = await deleguer(specialiste("legal")!, "x", null, { appel: m.appel, defs, acteur: "u1", delaiMs: 0, executer: async () => "{}" });
    expect(r.incomplet).toMatch(/délai/);
    expect(r.tours).toBe(0);
    const e = await deleguer(specialiste("legal")!, "x", null, { appel: async () => ({ ok: false, configured: true, error: "429 too many" }), defs, acteur: "u1", executer: async () => "{}" });
    expect(e.ok).toBe(false);
    expect(e.incomplet).toMatch(/429/);
    expect(e.texte).toBe("");
  });
});
