import { describe, it, expect } from "vitest";
import {
  aTraiterPlansAValider, aTraiterRupturesSignalees, chevauche, relevesHopitaux, scoreEquipe, septJours, signaleUneRupture, statutDuJour,
  villeDuJour, visitesDuJour,
} from "./terrain";

const T = new Date(2026, 9, 9, 10, 0, 0);

describe("l'équipe aujourd'hui", () => {
  it("congé, puis mission, puis terrain (ville la plus fréquente), sinon rien de prévu", () => {
    const base = { conge: null, mission: null, visitesPrevues: 0, ville: null };
    expect(statutDuJour({ ...base, conge: { libelle: "congé" }, mission: { libelle: "congrès SFLS", ville: "Paris" }, visitesPrevues: 4 })).toEqual({ genre: "CONGE", libelle: "congé" });
    expect(statutDuJour({ ...base, mission: { libelle: "congrès SFLS", ville: "Paris" }, visitesPrevues: 4 })).toEqual({ genre: "MISSION", libelle: "congrès SFLS · Paris" });
    expect(statutDuJour({ ...base, visitesPrevues: 5, ville: "Oran" })).toEqual({ genre: "TERRAIN", libelle: "terrain · Oran" });
    expect(statutDuJour(base).genre).toBe("AUCUN");
    expect(villeDuJour(["Sétif", "Oran", " Oran ", null, "Sétif", "Oran"])).toBe("Oran");
    expect(villeDuJour([null, ""])).toBeNull();
  });

  it("visites du jour selon le plan : reportées et annulées sortent ; une visite hors plan ne compte pas", () => {
    expect(visitesDuJour([
      { statut: "COMPLETED", planifiee: true }, { statut: "PLANNED", planifiee: true }, { statut: "POSTPONED", planifiee: true },
      { statut: "CANCELLED", planifiee: true }, { statut: "COMPLETED", planifiee: false },
    ])).toEqual({ prevues: 2, realisees: 1 });
  });

  it("le score KPI de l'équipe : la moyenne des scores connus, null sans aucun", () => {
    expect(scoreEquipe([88, 74, null, 49])).toEqual({ score: 70, notes: 3 });
    expect(scoreEquipe([null, undefined])).toEqual({ score: null, notes: 0 });
  });
});

describe("à traiter : ruptures signalées et plans à valider", () => {
  it("détecte une rupture dans un compte rendu (accents, casse)", () => {
    expect(signaleUneRupture("RUPTURE de darunavir au CHU depuis 10 jours")).toBe(true);
    expect(signaleUneRupture("Le service est en manque de produit")).toBe(true);
    expect(signaleUneRupture("Le stock est épuisé")).toBe(true);
    expect(signaleUneRupture("Bonne visite, intérêt pour l'étude")).toBe(false);
    expect(signaleUneRupture(null)).toBe(false);
  });

  it("un élément par hôpital × produit, seulement si la PCH centrale a du stock", () => {
    const s = (etab: string, productId: string, jour: number, delegue = "Leila Sahridj") => ({
      etablissementCle: etab, etablissement: etab, productId, produit: productId === "dar" ? "Darunavir" : "Raltégravir", delegue, date: new Date(2026, 9, jour),
    });
    const items = aTraiterRupturesSignalees(
      [s("CHU Sétif", "dar", 5), s("CHU Sétif", "dar", 7, "Yacine Habes"), s("CHU Oran", "ral", 6), s("CHU Annaba", "dar", 6)],
      new Map<string, number | null>([["dar", 1200], ["ral", 0]]),
      "/stocks",
    );
    expect(items.map((x) => x.titre)).toEqual([
      "CHU Sétif signale une rupture de Darunavir (rapport de Yacine)",
      "CHU Annaba signale une rupture de Darunavir (rapport de Leila)",
    ]);
    expect(items[0].ton).toBe("ko");
    expect(items[0].detail).toContain("1");
  });

  it("plans à valider : un élément, le lien direct quand il n'y en a qu'un", () => {
    expect(aTraiterPlansAValider([])).toEqual([]);
    expect(aTraiterPlansAValider([{ nom: "Amel Amarni", planId: "p1" }])[0].href).toBe("/medical/plan-de-tournee?plan=p1");
    const trois = aTraiterPlansAValider([{ nom: "A x", planId: "1" }, { nom: "B y", planId: "2" }, { nom: "C z", planId: null }]);
    expect(trois[0].titre).toBe("3 plans de tournée à valider");
    expect(trois[0].href).toBe("/medical/plan-de-tournee");
  });
});

describe("stocks relevés et semaine", () => {
  it("mois de couverture au rythme de l'hôpital ; un stock à zéro est 0 mois ; relevé périmé au-delà de 30 j ; les plus courts d'abord", () => {
    const l = relevesHopitaux([
      { cle: "a", hopital: "EHU Oran", produit: "Raltégravir", quantite: 320, date: new Date(2026, 9, 5), conso: 100 },
      { cle: "b", hopital: "CHU Sétif", produit: "Darunavir", quantite: 0, date: new Date(2026, 9, 8), conso: null },
      { cle: "c", hopital: "CHU Annaba", produit: "Dolutégravir", quantite: 40, date: new Date(2026, 8, 5), conso: 50 },
      { cle: "d", hopital: "CHU Blida", produit: "Raltégravir", quantite: 40, date: new Date(2026, 9, 1), conso: null },
    ], T);
    expect(l.map((x) => [x.cle, x.mois])).toEqual([["b", 0], ["c", 0.8], ["a", 3.2], ["d", null]]);
    expect(l.find((x) => x.cle === "c")!.perime).toBe(true);
    expect(l.find((x) => x.cle === "a")!.perime).toBe(false);
  });

  it("les 7 prochains jours et le chevauchement d'une mission", () => {
    const s = septJours(T);
    expect(s.debut).toEqual(new Date(2026, 9, 9));
    expect(s.fin).toEqual(new Date(2026, 9, 16));
    expect(chevauche(new Date(2026, 9, 7), new Date(2026, 9, 10), s)).toBe(true);
    expect(chevauche(new Date(2026, 9, 20), new Date(2026, 9, 22), s)).toBe(false);
    expect(chevauche(new Date(2026, 9, 1), new Date(2026, 9, 8), s)).toBe(false);
    expect(chevauche(null, null, s)).toBe(false);
  });
});
