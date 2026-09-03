import { describe, it, expect } from "vitest";
import {
  portfolioName, allocationChange, allocationSummary, needsAllocation, allocationNotice,
} from "./bu-allocation";

describe("le nom du produit dans le portefeuille", () => {
  it("LA DÉSIGNATION DU MARCHÉ D'ABORD — c'est elle qui fait foi", () => {
    expect(portfolioName({ designation: "AMOXICILLINE", dosage: "500 mg", form: "Gélule" }))
      .toBe("AMOXICILLINE — 500 mg Gélule");
  });

  it("NE RÉPÈTE PAS CE QUE LA DÉSIGNATION PORTE DÉJÀ", () => {
    // « Amoxicilline 500 mg 500 mg » se lit comme une erreur de saisie.
    expect(portfolioName({ designation: "Amoxicilline 500 mg gélule", dosage: "500 mg", form: "gélule" }))
      .toBe("Amoxicilline 500 mg gélule");
  });

  it("retombe sur la DCI, puis sur un libellé neutre — jamais sur un identifiant", () => {
    expect(portfolioName({ designation: "  ", dci: "Fingolimod" })).toBe("Fingolimod");
    expect(portfolioName({ designation: "  " })).toBe("Produit du marché");
  });
});

describe("ce qu'il faut écrire pour changer une affectation", () => {
  it("SEULEMENT LA DIFFÉRENCE — effacer et tout réécrire perdrait la date de chaque affectation", () => {
    const c = allocationChange(["bu-a", "bu-b"], ["bu-b", "bu-c"]);
    expect(c.toAdd).toEqual(["bu-c"]);
    expect(c.toRemove).toEqual(["bu-a"]);
    expect(c.unchanged).toBe(false);
  });

  it("rien à faire se DIT — pas d'écriture, pas de ligne d'audit", () => {
    const c = allocationChange(["bu-a"], ["bu-a"]);
    expect(c).toMatchObject({ toAdd: [], toRemove: [], unchanged: true });
  });

  it("une valeur vide n'est pas une Business Unit", () => {
    expect(allocationChange([], ["", "  ", "bu-a"]).toAdd).toEqual(["bu-a"]);
  });

  it("tout retirer est un geste valide — un lot peut cesser d'être porté", () => {
    const c = allocationChange(["bu-a", "bu-b"], []);
    expect(c.toRemove).toEqual(["bu-a", "bu-b"]);
    expect(c.toAdd).toEqual([]);
  });
});

describe("ce que le journal retient", () => {
  it("des NOMS, pas des identifiants", () => {
    expect(allocationSummary("Amoxicilline", ["Anti-infectieux"], ["Oncologie"]))
      .toBe("« Amoxicilline » confié à Anti-infectieux · retiré à Oncologie");
    expect(allocationSummary("Amoxicilline", [], [])).toMatch(/inchangée/);
  });
});

describe("quand l'absence d'affectation est un problème", () => {
  it("SEULEMENT SUR UN LOT GAGNÉ — sinon l'alerte crie sur dix-neuf lignes qui vont bien", () => {
    expect(needsAllocation("WON", 0)).toBe(true);
    expect(needsAllocation("WON", 1)).toBe(false);
    for (const s of ["PENDING", "QUOTED", "SUBMITTED", "LOST", "UNSUCCESSFUL", "CANCELLED"]) {
      expect(needsAllocation(s, 0), s).toBe(false);
    }
  });

  it("et la phrase dit la CONSÉQUENCE, pas seulement le compte", () => {
    expect(allocationNotice(5, 2)).toMatch(/n'apparaîtront dans aucun portefeuille/);
    expect(allocationNotice(5, 0)).toMatch(/sont confiés/);
    // Aucun lot gagné : rien à dire, et l'on ne dit rien.
    expect(allocationNotice(0, 0)).toBeNull();
  });
});
