import { describe, it, expect } from "vitest";
import { cleanAnswer } from "./dossier-chat";

describe("cleanAnswer — sortie chatbot en texte brut propre", () => {
  it("retire titres, gras, citations, règles, emojis et codes [P] — mais garde les sources [n]", () => {
    const raw = [
      "## Durée de conservation",
      "",
      "La durée de conservation retenue est de **24 mois** — valeur **proposée automatiquement [P]**.",
      "",
      "> ⚠️ **Limites à signaler :**",
      "> - La section **3.2.P.8** est référencée [1][2][6].",
      "",
      "---",
    ].join("\n");
    const out = cleanAnswer(raw);
    expect(out).not.toContain("##");
    expect(out).not.toContain("**");
    expect(out).not.toContain(">");
    expect(out).not.toContain("---");
    expect(out).not.toContain("⚠");
    expect(out).not.toContain("[P]");
    expect(out).toContain("(proposé, à confirmer)");
    // Les renvois de source numériques restent (mécanisme de citation).
    expect(out).toContain("[1]");
    expect(out).toContain("24 mois");
    expect(out).toContain("• "); // la puce markdown est convertie en puce simple
  });

  it("n'altère pas la ponctuation française légitime (tirets cadratins, points de suspension)", () => {
    const out = cleanAnswer("La valeur est de 24 mois — voir la section… [3].");
    expect(out).toContain("—");
    expect(out).toContain("…");
    expect(out).toContain("[3]");
  });

  it("supprime les blocs de code en gardant leur contenu", () => {
    const out = cleanAnswer("Exemple :\n```\n3.2.P.8\n```\nFin.");
    expect(out).not.toContain("```");
    expect(out).toContain("3.2.P.8");
  });
});
