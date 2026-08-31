import { describe, it, expect } from "vitest";
import { entryCost, entryBasis, payrollMass, basisLabel, defaultEmployerCost, massCoverage, coverageLabel } from "./payroll-cost";

describe("entryCost — le coût employeur est un TOTAL, pas une base", () => {
  it("le coût employeur se suffit : primes et retenues sont déjà dedans", () => {
    // 120 000, et non 120 000 + 10 000 − 5 000 : les compter deux fois gonflerait la masse.
    expect(entryCost({ employerCost: 120_000, gross: 100_000, bonuses: 10_000, deductions: 5_000 })).toBe(120_000);
  });

  it("sans coût employeur : brut + primes − retenues", () => {
    expect(entryCost({ gross: 100_000, bonuses: 10_000, deductions: 5_000 })).toBe(105_000);
  });

  it("un coût employeur à zéro est une VALEUR, pas une absence", () => {
    expect(entryCost({ employerCost: 0, gross: 100_000 })).toBe(0);
  });

  it("les champs manquants valent zéro, sans faire NaN", () => {
    expect(entryCost({})).toBe(0);
    expect(entryCost({ gross: null, bonuses: undefined })).toBe(0);
  });
});

describe("entryBasis", () => {
  it("dit « coût employeur » quand il est saisi", () => {
    expect(entryBasis({ employerCost: 120_000 })).toBe("EMPLOYER_COST");
  });

  it("dit « brut » quand on retombe dessus", () => {
    expect(entryBasis({ gross: 100_000 })).toBe("GROSS");
  });

  it("dit « aucune donnée » quand il n'y a rien", () => {
    expect(entryBasis({})).toBe("NONE");
  });
});

describe("payrollMass — la base est celle du LOT", () => {
  it("additionne les coûts employeur et l'annonce", () => {
    const r = payrollMass([{ employerCost: 120_000 }, { employerCost: 80_000 }]);
    expect(r).toEqual({ total: 200_000, basis: "EMPLOYER_COST" });
  });

  // Le cas normal d'un mois de transition : on le DIT, on ne le lisse pas.
  it("une seule ligne sans coût employeur rend le total mixte", () => {
    const r = payrollMass([{ employerCost: 120_000 }, { gross: 80_000, bonuses: 5_000 }]);
    expect(r.total).toBe(205_000);
    expect(r.basis).toBe("GROSS");
  });

  it("un lot vide ne vaut pas zéro « coût employeur »", () => {
    expect(payrollMass([])).toEqual({ total: 0, basis: "NONE" });
  });
});

describe("basisLabel", () => {
  it("nomme chaque base en clair", () => {
    expect(basisLabel("EMPLOYER_COST")).toBe("coût employeur");
    expect(basisLabel("GROSS")).toContain("brut");
    expect(basisLabel("BASE_SALARY")).toContain("salaires de base");
    expect(basisLabel("NONE")).toBe("aucune donnée");
  });
});

describe("defaultEmployerCost — jamais un zéro préinscrit", () => {
  it("préfère le coût employeur de la fiche", () => {
    expect(defaultEmployerCost({ employerCost: 150_000, grossSalary: 120_000, baseSalary: 100_000 })).toBe(150_000);
  });

  it("retombe sur le brut, puis sur le salaire de base", () => {
    expect(defaultEmployerCost({ grossSalary: 120_000, baseSalary: 100_000 })).toBe(120_000);
    expect(defaultEmployerCost({ baseSalary: 100_000 })).toBe(100_000);
  });

  // Un zéro préinscrit dans un champ obligatoire se valide sans qu'on le relise.
  it("rend `null` plutôt que 0 quand rien n'est renseigné", () => {
    expect(defaultEmployerCost({})).toBeNull();
    expect(defaultEmployerCost({ employerCost: 0, grossSalary: 0, baseSalary: 0 })).toBeNull();
  });
});

describe("la COUVERTURE — combien de salariés le chiffre couvre vraiment", () => {
  it("un mois à moitié saisi est PARTIEL, et le dit", () => {
    // « Comment ça se fait que la masse salariale mensuelle c'est environ 400 000 DZD ? » —
    // parce qu'on lisait la paie de quatre personnes sous un libellé qui promettait celle de
    // la société. Le total était juste ; la phrase était fausse.
    const c = massCoverage(4, 31);
    expect(c.partial).toBe(true);
    expect(coverageLabel(c)).toBe("4 salaires sur 31 actifs");
  });

  it("un mois complet n'alerte pas", () => {
    expect(massCoverage(31, 31).partial).toBe(false);
    expect(coverageLabel(massCoverage(31, 31))).toBe("31 salaires sur 31 actifs");
  });

  it("PLUS de lignes que d'actifs n'est pas une alerte", () => {
    // Un salarié parti en cours de mois est payé puis désactivé : c'est le cas normal.
    // Crier au loup là rendrait l'alerte inutile partout ailleurs.
    expect(massCoverage(32, 31).partial).toBe(false);
  });

  it("aucune ligne : rien à dire — l'écran affiche déjà « aucune paie saisie »", () => {
    expect(massCoverage(0, 31).partial).toBe(false);
    expect(coverageLabel(massCoverage(0, 31))).toBeNull();
    expect(coverageLabel(massCoverage(4, 0))).toBeNull();
  });

  it("le singulier se dit au singulier", () => {
    expect(coverageLabel(massCoverage(1, 12))).toBe("1 salaire sur 12 actifs");
  });
});
