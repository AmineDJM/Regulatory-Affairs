import { describe, it, expect } from "vitest";
import {
  buDepartmentName, buDepartmentCode, canAttachBuDepartment, buBudgetView, consumptionPct,
  buBudgetNotice, type BuBudgetLine,
} from "./bu-department";

const line = (o: Partial<BuBudgetLine> & { businessUnitId: string; label: string }): BuBudgetLine => ({
  allocated: o.allocated ?? 0,
  spent: o.spent ?? 0,
  attached: o.attached ?? true,
  ...o,
});

describe("le département d'une Business Unit", () => {
  it("EST PRÉFIXÉ — sinon « Oncologie » se lit comme un département de plein exercice", () => {
    expect(buDepartmentName("Oncologie")).toBe("BU Oncologie");
    // Un nom qui porte déjà le préfixe ne le reçoit pas deux fois.
    expect(buDepartmentName("BU Oncologie")).toBe("BU Oncologie");
    expect(buDepartmentName("   ")).toBe("BU Business Unit");
  });

  it("ET SON CODE EST UNIQUE SANS COMPTEUR — un identifiant de BU ne se réutilise pas", () => {
    const c = buDepartmentCode({ id: "clx0000000k3f9", code: "ONCO", name: "Oncologie" });
    expect(c).toBe("BU-ONCO-K3F9");
    // Sans code, le nom sert de base : accents retirés, lisible dans un export.
    expect(buDepartmentCode({ id: "abcd1234", name: "Anti-infectieux" })).toBe("BU-ANTI-INFECTI-1234");
    // Un nom sans aucune lettre exploitable retombe sur un code neutre plutôt que sur du vide.
    expect(buDepartmentCode({ id: "zzzz9999", name: "///" })).toBe("BU-BU-9999");
  });
});

describe("peut-on ouvrir le budget d'une gamme", () => {
  it("IL FAUT UN PARENT — une gamme se range SOUS la Direction commerciale, pas à côté des Finances", () => {
    const r = canAttachBuDepartment({ businessUnitName: "Oncologie", parentDepartmentId: null, alreadyAttached: false });
    expect(r.ok).toBe(false);
    // Le refus NOMME le geste qui débloque : « impossible » seul fait ouvrir un ticket.
    expect(r.reason).toMatch(/Direction commerciale/);
    expect(r.reason).toMatch(/Administration/);
  });

  it("une gamme DÉJÀ rattachée ne l'est pas deux fois", () => {
    const r = canAttachBuDepartment({ businessUnitName: "Oncologie", parentDepartmentId: "dep-1", alreadyAttached: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/déjà/);
  });

  it("et il faut un nom", () => {
    expect(canAttachBuDepartment({ businessUnitName: "  ", parentDepartmentId: "dep-1", alreadyAttached: false }).ok).toBe(false);
  });

  it("tout est là : on rattache", () => {
    expect(canAttachBuDepartment({ businessUnitName: "Oncologie", parentDepartmentId: "dep-1", alreadyAttached: false }).ok).toBe(true);
  });
});

describe("le budget par gamme, et son consolidé", () => {
  const lignes = [
    line({ businessUnitId: "a", label: "Oncologie", allocated: 5_000_000, spent: 3_200_000 }),
    line({ businessUnitId: "b", label: "Anti-infectieux", allocated: 2_000_000, spent: 2_400_000 }),
    line({ businessUnitId: "c", label: "Cardiologie", attached: false }),
  ];

  it("LE CONSOLIDÉ EST LA SOMME DES GAMMES — jamais un chiffre lu ailleurs", () => {
    // Deux sources pour un total et son détail divergent au premier écart de périmètre.
    const v = buBudgetView(lignes);
    expect(v.totalAllocated).toBe(7_000_000);
    expect(v.totalSpent).toBe(5_600_000);
  });

  it("UNE GAMME SANS SOUS-DÉPARTEMENT APPARAÎT QUAND MÊME, et se signale", () => {
    // La masquer ferait croire que toutes les gammes sont budgétées — et c'est justement
    // celle-là qu'il faut rattacher.
    const v = buBudgetView(lignes);
    expect(v.lines.map((l) => l.label)).toContain("Cardiologie");
    expect(v.unattached).toBe(1);
    expect(buBudgetNotice(v)).toMatch(/ne sont comptés nulle part/);
  });

  it("les gammes se lisent par enveloppe DÉCROISSANTE — la plus lourde d'abord", () => {
    expect(buBudgetView(lignes).lines.map((l) => l.label)).toEqual(["Oncologie", "Anti-infectieux", "Cardiologie"]);
  });

  it("rien à signaler quand tout est rattaché", () => {
    const v = buBudgetView(lignes.filter((l) => l.attached));
    expect(v.unattached).toBe(0);
    expect(buBudgetNotice(v)).toBeNull();
    expect(buBudgetNotice(buBudgetView([]))).toBeNull();
  });

  it("le taux de consommation dit le DÉPASSEMENT, et ne divise jamais par zéro", () => {
    expect(consumptionPct(lignes[0])).toBe(64);
    expect(consumptionPct(lignes[1])).toBe(120);
    expect(consumptionPct(lignes[2])).toBeNull();
    expect(consumptionPct(line({ businessUnitId: "d", label: "X", allocated: 0, spent: 100 }))).toBeNull();
  });
});
