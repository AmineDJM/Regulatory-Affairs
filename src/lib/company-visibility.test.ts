import { describe, it, expect } from "vitest";
import { hiddenByScopeMessage, hiddenCount } from "./company-visibility";

describe("ce que le filtre d'entité cache — dit, au lieu d'être subi", () => {
  it("rien de masqué : AUCUN message", () => {
    // Une bannière permanente devient un décor qu'on ne lit plus. Elle n'apparaît que le jour
    // où elle explique quelque chose.
    expect(hiddenByScopeMessage({ shown: 14, total: 14, companyLabel: "Adventum" })).toBeNull();
    expect(hiddenByScopeMessage({ shown: 0, total: 0, companyLabel: null })).toBeNull();
  });

  it("des lignes manquent : le message DIT combien, et comment les voir", () => {
    const m = hiddenByScopeMessage({ shown: 14, total: 19, companyLabel: "Adventum" });
    expect(m).toContain("5 lignes");
    expect(m).toContain("Adventum");
    expect(m).toMatch(/Toutes les entités/i);
  });

  it("une seule ligne se dit au singulier", () => {
    expect(hiddenByScopeMessage({ shown: 3, total: 4, companyLabel: "Pharmagène" })).toContain("1 ligne est masquée");
  });

  it("sans entité sélectionnée, c'est le PÉRIMÈTRE qui restreint — et on le dit autrement", () => {
    const m = hiddenByScopeMessage({ shown: 2, total: 7, companyLabel: null });
    expect(m).toContain("5 lignes");
    expect(m).toMatch(/périmètre/i);
    expect(m).not.toMatch(/Toutes les entités/i);
  });

  it("un total incohérent ne fabrique pas d'alerte", () => {
    // Deux comptages faits à deux instants peuvent se croiser ; un nombre négatif de lignes
    // masquées serait un message absurde.
    expect(hiddenCount({ shown: 20, total: 19, companyLabel: null })).toBe(0);
    expect(hiddenByScopeMessage({ shown: 20, total: 19, companyLabel: "X" })).toBeNull();
  });
});
