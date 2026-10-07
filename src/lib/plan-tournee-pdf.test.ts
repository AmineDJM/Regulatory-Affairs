import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
import { rendrePlanTourneePdf } from "./plan-tournee-pdf";

describe("le PDF du plan de tournée validé (Direction, 07/10)", () => {
  it("rend un PDF A4 paysage, une page par semaine", async () => {
    const visites = [
      { jour: "2026-10-04", nom: "Abidi Saliha", detail: "Infectiologie · EHU Oran", potentiel: "MEDIUM", etat: "FAITE" as const },
      { jour: "2026-10-04", nom: "Belabes Fatima Zohra", detail: "Infectiologie · EHU Oran", potentiel: "MEDIUM", etat: "NON_TENUE" as const },
      { jour: "2026-10-05", nom: "Belkadi Kouied Amina", detail: "Infectiologie · CHU Oran", potentiel: "HIGH", etat: "FAITE" as const },
      { jour: "2026-10-06", nom: "Belkhouche Rayane", detail: "Infectiologie · EHU Oran", potentiel: "LOW", etat: "PREVUE" as const },
      { jour: "2026-10-12", nom: "Abidi Saliha", detail: "Infectiologie · EHU Oran", potentiel: "MEDIUM", etat: "PREVUE" as const },
    ];
    const pdf = await rendrePlanTourneePdf({
      societe: "Adventum Pharma", kam: "Yacine Habes", periode: "octobre 2026",
      joursOuvres: ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-11", "2026-10-12"],
      visites, validation: { le: new Date("2026-09-30T10:00:00"), par: "Brahim Rahmoune" }, valideur: "Brahim Rahmoune",
      genereLe: new Date("2026-10-07T10:00:00"),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
    if (process.env.PLAN_PDF_ECHANTILLON) writeFileSync(process.env.PLAN_PDF_ECHANTILLON, pdf);
  });
});
