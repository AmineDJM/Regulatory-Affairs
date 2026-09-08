import { describe, expect, it } from "vitest";
import { peutReplanifier, REPLANS_PAR_JALON, signatureRefus } from "@/lib/missions/horizon/budget";

describe("la signature d'un refus", () => {
  it("porte les CODES, jamais les clés d'étape — un renommage ne doit pas déguiser le même mur", () => {
    const a = signatureRefus([{ code: "CARDINALITY" }, { code: "CYCLE" }]);
    const b = signatureRefus([{ code: "CYCLE" }, { code: "CARDINALITY" }]);
    expect(a).toBe(b);
    expect(a).toBe("CARDINALITY|CYCLE");
  });

  it("dédoublonne : trois étapes refusées pour la même raison, c'est une raison", () => {
    expect(signatureRefus([{ code: "CARDINALITY" }, { code: "CARDINALITY" }])).toBe("CARDINALITY");
  });
});

describe("le budget est LOCAL et se juge au PROGRÈS", () => {
  it("laisse partir le premier sous-plan sans rien comparer", () => {
    const v = peutReplanifier({ replans: 0, dernierRefus: null }, null);
    expect(v.autorise).toBe(true);
    expect(v.motif).toBe("PREMIER");
  });

  it("autorise tant que le refus CHANGE — même au huitième tour", () => {
    const v = peutReplanifier({ replans: 8, dernierRefus: "CYCLE" }, "MISSING_PRIMITIVE");
    expect(v.autorise).toBe(true);
    expect(v.motif).toBe("PROGRES");
    expect(v.phrase).toContain("CYCLE → MISSING_PRIMITIVE");
  });

  it("refuse dès que le refus REVIENT IDENTIQUE — c'est le seul arrêt normal", () => {
    const v = peutReplanifier({ replans: 1, dernierRefus: "CARDINALITY" }, "CARDINALITY");
    expect(v.autorise).toBe(false);
    expect(v.motif).toBe("REPETITION");
  });

  it("le plafond est OPÉRATIONNEL : il borne la dépense, il ne dit pas que c'est insurmontable", () => {
    const v = peutReplanifier({ replans: REPLANS_PAR_JALON, dernierRefus: "A" }, "B");
    expect(v.autorise).toBe(false);
    expect(v.motif).toBe("PLAFOND");
    expect(v.phrase).toContain("opérationnel");
  });

  it("le plafond de CE jalon ne dit rien des autres — c'est la fin de PLANS_MAX global", () => {
    // Un jalon épuisé, un jalon neuf : le second part, alors qu'un plafond global l'aurait tué.
    expect(peutReplanifier({ replans: REPLANS_PAR_JALON, dernierRefus: "A" }, "B").autorise).toBe(false);
    expect(peutReplanifier({ replans: 0, dernierRefus: null }, null).autorise).toBe(true);
  });
});
