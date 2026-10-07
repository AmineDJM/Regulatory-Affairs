import { describe, expect, it } from "vitest";
import { choisirEntree, requisDuPraticien, requisDuPanel, panelParLettre, type EntreeLettre } from "./lettre-requise";

const FREQ = { VERY_HIGH: 3, HIGH: 2, MEDIUM: 1, LOW: 1, VERY_LOW: 0 };
const e = (buId: string, lettre: EntreeLettre["lettre"], visites: number): EntreeLettre => ({ buId, strategieId: `s-${buId}`, lettre, visites, statut: null, secteurId: null, secteurNom: null });

describe("La lettre partout — le requis d'un praticien", () => {
  it("la stratégie de la BU demandée d'abord, sinon la première où il est classé", () => {
    const entrees = [e("onco", "C", 1), e("infectio", "H", 2)];
    expect(choisirEntree(entrees, "infectio")?.lettre).toBe("H");
    expect(choisirEntree(entrees, "cardio")?.lettre).toBe("C");
    expect(choisirEntree(entrees, null)?.lettre).toBe("C");
    expect(choisirEntree([], "onco")).toBeNull();
  });
  it("segmenté : la lettre et ses visites, même quand elles sont nulles (NA, non ciblé) — le palier ne revient pas", () => {
    expect(requisDuPraticien([e("onco", "A", 2)], "onco", "VERY_LOW", FREQ)).toMatchObject({ lettre: "A", visites: 2, source: "SEGMENTATION" });
    expect(requisDuPraticien([e("onco", "NA", 0)], "onco", "VERY_HIGH", FREQ)).toMatchObject({ lettre: "NA", visites: 0, source: "SEGMENTATION" });
  });
  it("hors de toute stratégie : repli sur le palier de potentiel, sans lettre", () => {
    expect(requisDuPraticien(undefined, "onco", "HIGH", FREQ)).toEqual({ lettre: null, visites: 2, source: "POTENTIEL", buId: null, statut: null });
    expect(requisDuPraticien(undefined, "onco", null, FREQ).visites).toBe(0);
  });
  it("le requis d'un panel additionne les deux sources", () => {
    const lettres = new Map([["d1", [e("onco", "H", 2)]], ["d2", [e("onco", "D", 1)]]]);
    expect(requisDuPanel([{ id: "d1", potential: "LOW" }, { id: "d2", potential: "HIGH" }, { id: "d3", potential: "VERY_HIGH" }], lettres, "onco", FREQ)).toBe(2 + 1 + 3);
  });
  it("le panel par lettre ne compte que H, A, B, C, D", () => {
    expect(panelParLettre(["H", "A", "A", "NA", "NC", null, "D"])).toEqual({ H: 1, A: 2, B: 0, C: 0, D: 1 });
  });
});
