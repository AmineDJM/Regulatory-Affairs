import { describe, it, expect } from "vitest";
import { pagesDuPlan, resumeDuPlan, nomDuPdf, type VisitePdf } from "./plan-pdf";

const v = (jour: string, nom: string, potentiel: string | null = "MEDIUM", etat: VisitePdf["etat"] = "PREVUE"): VisitePdf =>
  ({ jour, nom, detail: "Infectiologie · EHU Oran", potentiel, etat });

// Novembre 2026 : dimanche 1er → jeudi 5, puis dimanche 8 → jeudi 12.
const jours = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-08", "2026-11-09"];

describe("le plan de tournée en PDF — une semaine par page, une ligne par visite", () => {
  it("une page par semaine, les jours en colonnes, les visites rangées par nom", () => {
    const pages = pagesDuPlan(jours, [v("2026-11-01", "Belkhouche Rayane"), v("2026-11-01", "Belabes Fatima Zohra"), v("2026-11-02", "Abidi Saliha")]);
    expect(pages).toHaveLength(2);
    expect(pages[0].semaine.jours).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(pages[0].lignes).toHaveLength(2);
    expect(pages[0].lignes[0].map((c) => c?.nom ?? null)).toEqual(["Belabes Fatima Zohra", "Abidi Saliha", null, null, null]);
    expect(pages[0].lignes[1][0]?.nom).toBe("Belkhouche Rayane");
    // Une semaine sans visite garde sa page, avec une ligne vide : le plan se lit en entier.
    expect(pages[1].lignes).toEqual([[null, null]]);
  });

  it("une semaine chargée continue sur la page suivante, avec ses rangs", () => {
    const beaucoup = Array.from({ length: 14 }, (_, i) => v("2026-11-01", `Praticien ${String(i).padStart(2, "0")}`));
    const pages = pagesDuPlan(jours.slice(0, 5), beaucoup, 11);
    expect(pages.map((p) => [p.premierRang, p.lignes.length, p.suite])).toEqual([[1, 11, false], [12, 3, true]]);
  });

  it("le résumé compte les visites, les faites, les non tenues et le potentiel", () => {
    const r = resumeDuPlan([v("2026-11-01", "A", "HIGH", "FAITE"), v("2026-11-02", "B", "MEDIUM", "NON_TENUE"), v("2026-11-02", "C", null)]);
    expect([r.total, r.faites, r.nonTenues]).toEqual([3, 1, 1]);
    expect(r.parPotentiel.get("HIGH")).toBe(1);
    expect(r.parPotentiel.get("INCONNU")).toBe(1);
    expect(nomDuPdf("Yacine Habes", "novembre 2026")).toBe("Plan de tournée — Yacine Habes — novembre 2026.pdf");
  });
});
