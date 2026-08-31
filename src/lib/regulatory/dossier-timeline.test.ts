import { describe, it, expect } from "vitest";
import {
  planInsertion, validateStep, canRemove, defaultLabel, nextReservesLabel, describeStep, summarize, orderSteps,
  ADDABLE_KINDS, KIND_LABELS, type TimelineStep,
} from "./dossier-timeline";

const step = (id: string, order: number, over: Partial<TimelineStep> = {}): TimelineStep => ({
  id, order, kind: "ANPP_RESERVES", label: id, version: null, ...over,
});

const frise = (): TimelineStep[] => [
  step("initial", 0, { kind: "CTD_INITIAL", label: "CTD initial" }),
  step("res1", 1, { kind: "ANPP_RESERVES", label: "Réserves du 12/03" }),
  step("v2", 2, { kind: "CTD_VERSION", label: "CTD v2", version: 2 }),
];

describe("insertion — le « + » dit exactement OÙ l'on ajoute", () => {
  it("juste après une étape : elle prend le rang suivant, les autres se décalent", () => {
    const { order, shift } = planInsertion(frise(), "res1");
    expect(order).toBe(2);
    expect(shift).toEqual([{ id: "v2", order: 3 }]);
  });

  it("après la DERNIÈRE : rien à décaler", () => {
    const { order, shift } = planInsertion(frise(), "v2");
    expect(order).toBe(3);
    expect(shift).toEqual([]);
  });

  it("après l'origine : tout le reste recule d'un cran", () => {
    const { order, shift } = planInsertion(frise(), "initial");
    expect(order).toBe(1);
    expect(shift).toEqual([{ id: "res1", order: 2 }, { id: "v2", order: 3 }]);
  });

  it("sans référence : on ajoute à la FIN — le cas courant", () => {
    expect(planInsertion(frise(), null)).toEqual({ order: 3, shift: [] });
  });

  it("sur une frise vide, la première étape prend le rang 0", () => {
    expect(planInsertion([], null)).toEqual({ order: 0, shift: [] });
  });

  it("référence DISPARUE (supprimée dans un autre onglet) : on ajoute à la fin, on ne perd pas la saisie", () => {
    expect(planInsertion(frise(), "fantome")).toEqual({ order: 3, shift: [] });
  });

  it("l'ordre stocké fait foi, même si la liste arrive mélangée", () => {
    const melange = [step("c", 2), step("a", 0), step("b", 1)];
    expect(orderSteps(melange).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(planInsertion(melange, "a").order).toBe(1);
  });
});

describe("ce qui manque est DIT, en nommant la case", () => {
  it("une version du CTD sans numéro est refusée", () => {
    expect(validateStep({ kind: "CTD_VERSION", label: "CTD v2" })).toMatch(/numéro de version/i);
    expect(validateStep({ kind: "CTD_VERSION", label: "CTD v2", version: 0 })).toMatch(/entier positif/i);
    expect(validateStep({ kind: "CTD_VERSION", label: "CTD v2", version: 2 })).toBeNull();
  });

  it("une étape sans nom est refusée — c'est le nom qu'on relira dans un an", () => {
    expect(validateStep({ kind: "ANPP_RESERVES", label: "   " })).toMatch(/nom/i);
    expect(validateStep({ kind: "OTHER", label: "" })).toMatch(/nom/i);
    expect(validateStep({ kind: "OTHER", label: "Audit GMP du site" })).toBeNull();
  });

  it("le CTD initial ne s'AJOUTE pas : sa place est l'étape 1 du processus, pas la frise", () => {
    expect(validateStep({ kind: "CTD_INITIAL", label: "CTD initial" })).toMatch(/étape 1/i);
    expect(ADDABLE_KINDS).not.toContain("CTD_INITIAL");
  });

  it("les cinq types ajoutables ont tous un libellé", () => {
    for (const k of ADDABLE_KINDS) expect(KIND_LABELS[k]).toBeTruthy();
    expect(ADDABLE_KINDS).toHaveLength(5);
  });
});

describe("suppression — ni l'origine, ni des documents en silence", () => {
  it("le CTD initial ne se supprime pas", () => {
    const r = canRemove({ kind: "CTD_INITIAL" }, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/origine/i);
  });

  it("une étape qui PORTE des pièces se refuse, et dit combien", () => {
    const r = canRemove({ kind: "ANPP_RESERVES" }, 3);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/3 pièces/);
    expect(r.reason).toMatch(/en silence/);
  });

  it("une étape vide créée par erreur s'efface librement", () => {
    expect(canRemove({ kind: "ANPP_RESERVES" }, 0)).toEqual({ ok: true });
  });
});

describe("libellés", () => {
  it("le libellé proposé porte le numéro de version quand il est connu", () => {
    expect(defaultLabel("CTD_VERSION", 3)).toBe("CTD version 3");
    expect(defaultLabel("CTD_VERSION")).toBe("Nouvelle version du CTD");
    expect(defaultLabel("ANPP_RESERVES")).toBe("Réserves ANPP");
  });

  it("les cycles de réserves se NUMÉROTENT : la frise s'ouvre sur « Réserves ANPP 1 »", () => {
    expect(nextReservesLabel([])).toBe("Réserves ANPP 1");
    expect(nextReservesLabel(frise())).toBe("Réserves ANPP 2"); // un cycle déjà présent
    expect(nextReservesLabel([step("a", 0), step("b", 1)])).toBe("Réserves ANPP 3"); // deux cycles
  });

  it("le résumé d'audit se lit SEUL, sans rouvrir le dossier", () => {
    expect(describeStep({ kind: "CTD_VERSION", label: "Module 3 revu", version: 2 }))
      .toBe("Version du CTD v2 — Module 3 revu");
    expect(describeStep({ kind: "ANPP_RESERVES", label: "Réserves du 12/03" }))
      .toBe("Réserves ANPP — Réserves du 12/03");
  });

  it("l'avancement compte les cycles et les versions, pas seulement les lignes", () => {
    expect(summarize([])).toMatch(/vide/i);
    expect(summarize(frise())).toBe("3 étapes · 1 cycle de réserves · 1 version redéposée");
    expect(summarize([step("initial", 0, { kind: "CTD_INITIAL" })])).toBe("1 étape");
  });
});
