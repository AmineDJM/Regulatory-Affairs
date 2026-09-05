import { describe, it, expect } from "vitest";
import { composerContexteTour, questionSansContexte, MARQUE_CONTEXTE_TOUR } from "./tour";

describe("le contexte du tour voyage avec le message", () => {
  it("assemble les blocs présents sous une marque unique, et rien quand il n'y a rien", () => {
    expect(composerContexteTour([null, "", undefined])).toBe("");
    const bloc = composerContexteTour(["ENTITÉS ACTIVES : Nivolumab", null, "PLAN : ÉTAT_DOSSIER"]);
    expect(bloc.startsWith(`\n\n${MARQUE_CONTEXTE_TOUR}\n`)).toBe(true);
    expect(bloc).toContain("ENTITÉS ACTIVES : Nivolumab\n\nPLAN : ÉTAT_DOSSIER");
  });

  it("la question nue se retrouve, avec ou sans contexte accolé", () => {
    const q = "Où en est le dossier Nivolumab ?";
    expect(questionSansContexte(q + composerContexteTour(["x"]))).toBe(q);
    expect(questionSansContexte(q)).toBe(q);
  });
});
