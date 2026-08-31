import { describe, it, expect } from "vitest";
import { effortSummary, effortVsSales } from "./sfe-performance";

describe("effort × effet — la mise en regard révèle DEUX anomalies, et ne conclut rien", () => {
  const rows = effortVsSales([
    { productId: "a", name: "Atorvastatine", visits: 60, revenue: 3_000_000 },
    { productId: "b", name: "Bisoprolol", visits: 40, revenue: 0 }, // effort sans vente
    { productId: "c", name: "Cétuximab", visits: 0, revenue: 5_000_000 }, // vente sans effort
    { productId: "d", name: "Dormant", visits: 0, revenue: 0 }, // rien du tout
  ]);

  it("le produit SANS AUCUNE activité ne s'affiche pas — il prendrait la place des anomalies", () => {
    expect(rows.map((r) => r.productId)).not.toContain("d");
    expect(rows).toHaveLength(3);
  });

  it("EFFORT SANS VENTE est signalé, et la phrase pose la QUESTION au lieu de conclure", () => {
    const b = rows.find((r) => r.productId === "b")!;
    expect(b.verdict).toBe("EFFORT_SANS_VENTE");
    expect(b.note).toMatch(/40 visites/);
    expect(b.note).toMatch(/cible, rupture ou prix/i);
    // Aucune accusation, aucune conclusion de rendement.
    expect(b.note).not.toMatch(/mauvais|inefficace|échec/i);
  });

  it("VENTE SANS EFFORT est signalé — c'est un arbitrage d'affectation, pas un reproche", () => {
    const c = rows.find((r) => r.productId === "c")!;
    expect(c.verdict).toBe("VENTE_SANS_EFFORT");
    expect(c.perVisit).toBeNull(); // aucune visite : pas de ratio inventé
    expect(c.note).toMatch(/sans aucune visite/i);
  });

  it("les parts disent OÙ VA LE TEMPS et D'OÙ VIENT L'ARGENT — les deux ne coïncident pas", () => {
    const a = rows.find((r) => r.productId === "a")!;
    expect(a.effortShare).toBe(60); // 60 visites sur 100
    expect(a.revenueShare).toBe(38); // 3 M sur 8 M
    expect(a.perVisit).toBe(50_000);
  });

  it("le tri suit l'EFFORT : c'est là que part le temps, donc c'est par là qu'on regarde", () => {
    expect(rows.map((r) => r.productId)).toEqual(["a", "b", "c"]);
  });

  it("aucune division par zéro quand la période est vide", () => {
    const vide = effortVsSales([{ productId: "x", name: "X", visits: 0, revenue: 0 }]);
    expect(vide).toEqual([]);
    expect(effortSummary(vide)).toMatch(/aucune visite ni vente/i);
  });

  it("le résumé tient en une ligne et nomme les deux anomalies", () => {
    const s = effortSummary(rows);
    expect(s).toMatch(/3 produits en activité/);
    expect(s).toMatch(/1 détaillé sans vente/);
    expect(s).toMatch(/1 vendu sans visite/);
  });
});
