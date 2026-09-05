import { describe, expect, it } from "vitest";
import type { Regle } from "@/lib/teach/model";
import { composerBlocRegles, filtrerParDomaine, ligneRegle, lignesPourPlanificateur } from "@/lib/teach/compose";

const regle = (id: string, extra: Partial<Regle> = {}): Regle => ({
  id, kind: "COMPANY_RULE", scope: "COMPANY", ownerId: "amine", subjectUserId: null, companyId: "adventum", departmentId: null,
  domain: "general", title: id, statement: `Énoncé de ${id}`, params: null, priority: 0, effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
  status: "ACTIVE", version: 2, supersedesId: null, provenance: null, createdAt: new Date("2026-01-01"), ...extra,
});

describe("le bloc de règles — composé sous budget", () => {
  it("rend vide sans règle, et un bloc identifiable avec", () => {
    expect(composerBlocRegles([])).toBe("");
    const bloc = composerBlocRegles([regle("r1", { kind: "DOCUMENT_STANDARD" })], { nomSociete: () => "Adventum" });
    expect(bloc).toContain("RÈGLES ENSEIGNÉES À ADAM");
    expect(bloc).toContain("- [Société Adventum · Standard documentaire · v2 · r1] Énoncé de r1");
    expect(bloc).toMatch(/COMMENT agir/);
  });

  it("filtre par domaine en gardant `general`", () => {
    const rs = [regle("f", { domain: "finance" }), regle("g"), regle("l", { domain: "legal" })];
    expect(filtrerParDomaine(rs, "finance").map((r) => r.id)).toEqual(["f", "g"]);
    expect(filtrerParDomaine(rs, null).map((r) => r.id)).toEqual(["f", "g", "l"]);
    expect(composerBlocRegles(rs, { domaine: "legal" })).not.toContain("Énoncé de f");
  });

  it("compte ce qui ne rentre pas dans le budget au lieu de le taire", () => {
    const rs = Array.from({ length: 40 }, (_, i) => regle(`r${i}`, { statement: `Une règle assez longue pour peser dans le budget, numéro ${i}, avec des précisions.` }));
    const bloc = composerBlocRegles(rs, { budgetJetons: 300 });
    expect(bloc).toMatch(/\(\d+ autre\(s\) règle\(s\) en vigueur non affichée\(s\)/);
    expect(bloc.split("\n").filter((l) => l.startsWith("- [")).length).toBeLessThan(40);
  });

  it("une ligne dit le périmètre, la nature, la version, l'identifiant et la fin de validité", () => {
    const l = ligneRegle(regle("r9", { scope: "PERSON", kind: "PREFERENCE", effectiveTo: new Date("2026-12-31T00:00:00Z") }));
    expect(l).toBe("- [Personnel · Préférence · v2 · r9] Énoncé de r9 (jusqu'au 2026-12-31)");
    expect(lignesPourPlanificateur([regle("r1")])).toEqual(["Règle de société (Société, r1) : Énoncé de r1"]);
  });
});
