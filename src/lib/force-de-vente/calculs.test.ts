import { describe, expect, it } from "vitest";
import {
  jourDuCycle, attenduAuJour, realiseRequis, couvertureAFrequence, trierParRetard, cyclesSansVisite, aVoirEnPriorite,
  libelleRetardCible, etatPlan, coachingEnRetard, horsPanelParSecteur, pointsSparkline, sensTendance, libelleCycle, uneDecimale,
  type PraticienSuivi,
} from "./calculs";
import { estLecteurDePilotage } from "@/lib/sfe";

const p = (doctorId: string, lettre: PraticienSuivi["lettre"], requis: number, faites: number): PraticienSuivi => ({ doctorId, lettre, requis, faites });

describe("Force de vente — le cycle en jours ouvrés", () => {
  it("octobre 2026 : 21 jours ouvrés (vendredi et samedi chômés) ; le 7 est le 5e", () => {
    expect(jourDuCycle(2026, 10, new Date(2026, 9, 7))).toEqual({ jour: 5, total: 21 });
  });
  it("avant le cycle : jour 0 ; après : le total", () => {
    expect(jourDuCycle(2026, 11, new Date(2026, 9, 7)).jour).toBe(0);
    expect(jourDuCycle(2026, 9, new Date(2026, 9, 7))).toEqual({ jour: 22, total: 22 });
  });
  it("l'attendu à J<n> est le requis au prorata des jours ouvrés", () => {
    expect(attenduAuJour(1040, 5, 20)).toBe(260);
    expect(attenduAuJour(100, 25, 20)).toBe(100);
    expect(attenduAuJour(0, 5, 20)).toBe(0);
  });
  it("libellés : élision et année hors de l'année en cours", () => {
    const auj = new Date(2026, 9, 7);
    expect(libelleCycle(2026, 10, auj)).toBe("Cycle d'octobre");
    expect(libelleCycle(2026, 11, auj)).toBe("Cycle de novembre");
    expect(libelleCycle(2025, 4, auj)).toBe("Cycle d'avril 2025");
    expect(uneDecimale(6.94)).toBe("6,9");
  });
});

describe("Force de vente — réalisé, requis, couverture", () => {
  it("le réalisé est plafonné au requis de chaque praticien ; un requis nul ne compte pas", () => {
    const r = realiseRequis([p("a", "H", 2, 5), p("b", "A", 2, 1), p("c", "D", 0, 3), p("d", null, 0.5, 1)]);
    expect(r).toEqual({ realise: 2 + 1 + 1, requis: 4.5 });
  });
  it("couverture à fréquence des H · A · B : au moins le requis ; C, D et hors segmentation n'y entrent pas", () => {
    const c = couvertureAFrequence([p("a", "H", 2, 2), p("b", "A", 2, 1), p("c", "B", 1, 0), p("d", "C", 1, 1), p("e", null, 2, 2), p("f", "B", 0, 0)]);
    expect(c).toEqual({ cibles: 3, vues: 1, pct: 33 });
    expect(couvertureAFrequence([]).pct).toBeNull();
  });
  it("tri par retard : le plus faible réalisé ÷ requis d'abord, sans requis à la fin", () => {
    const t = trierParRetard([
      { nom: "Yacine", realise: 24, requis: 88 },
      { nom: "Leila", realise: 9, requis: 108 },
      { nom: "Zed", realise: 0, requis: 0 },
      { nom: "Amel", realise: 31, requis: 138 },
    ]);
    expect(t.map((x) => x.nom)).toEqual(["Leila", "Amel", "Yacine", "Zed"]);
  });
});

describe("Force de vente — cibles à voir, plans, coaching, hors panel", () => {
  it("cycles sans visite : 0 ce mois, 2 il y a deux mois, null jamais", () => {
    expect(cyclesSansVisite(new Date(2026, 9, 2), 2026, 10)).toBe(0);
    expect(cyclesSansVisite(new Date(2026, 7, 30), 2026, 10)).toBe(2);
    expect(cyclesSansVisite(new Date(2025, 11, 30), 2026, 1)).toBe(1);
    expect(cyclesSansVisite(null, 2026, 10)).toBeNull();
  });
  it("à voir en priorité : H d'abord, jamais vu en tête, seuil d'un cycle, cinq au plus", () => {
    const c = (doctorId: string, lettre: "H" | "A" | "B", cycles: number | null) => ({ doctorId, nom: doctorId, lieu: null, lettre, statut: null, cycles });
    const liste = aVoirEnPriorite([c("a1", "A", 3), c("h1", "H", 1), c("h0", "H", 0), c("hj", "H", null), c("b", "B", 5), c("a2", "A", null)]);
    expect(liste.map((x) => x.doctorId)).toEqual(["hj", "h1", "a2", "a1"]);
    expect(libelleRetardCible({ lettre: "H", cycles: 2 })).toBe("H · 2 cycles");
    expect(libelleRetardCible({ lettre: "A", cycles: null })).toBe("A · jamais vu");
  });
  it("l'état d'un plan : validé, à valider (soumis ou escaladé), brouillon, absent", () => {
    expect(etatPlan("APPROVED")).toBe("VALIDE");
    expect(etatPlan("SUBMITTED")).toBe("A_VALIDER");
    expect(etatPlan("ESCALATED")).toBe("A_VALIDER");
    expect(etatPlan("REJECTED")).toBe("BROUILLON");
    expect(etatPlan(null)).toBe("ABSENT");
  });
  it("coaching en retard au-delà de 60 jours, ou jamais", () => {
    const auj = new Date(2026, 9, 7);
    expect(coachingEnRetard(new Date(2026, 7, 1), auj)).toBe(true);
    expect(coachingEnRetard(new Date(2026, 8, 20), auj)).toBe(false);
    expect(coachingEnRetard(null, auj)).toBe(true);
  });
  it("hors panel : les H et A d'un secteur qu'aucun panel ne contient", () => {
    const m = horsPanelParSecteur([
      { doctorId: "h", lettre: "H", secteurId: "s1" },
      { doctorId: "a", lettre: "A", secteurId: "s1" },
      { doctorId: "b", lettre: "B", secteurId: "s1" },
      { doctorId: "suivi", lettre: "H", secteurId: "s1" },
      { doctorId: "sans", lettre: "A", secteurId: null },
    ], new Set(["suivi"]));
    expect(m.get("s1")).toEqual(["h", "a"]);
    expect(m.size).toBe(1);
  });
});

describe("Force de vente — la tendance sur 6 cycles", () => {
  it("les points sautent les cycles sans donnée ; moins de deux points : pas de courbe", () => {
    expect(pointsSparkline([null, null, 0.5])).toBeNull();
    const pts = pointsSparkline([0, null, 1], 70, 20, 2)!;
    expect(pts.split(" ")).toEqual(["0,18", "70,2"]);
  });
  it("le sens : le dernier point face à la moyenne des précédents", () => {
    expect(sensTendance([0.2, 0.2, 0.5])).toBe("hausse");
    expect(sensTendance([0.6, 0.6, 0.3])).toBe("baisse");
    expect(sensTendance([0.5, 0.52])).toBe("stable");
  });
});

describe("Portée de la Force de vente — le lecteur de pilotage", () => {
  it("un Product Manager ou un directeur des opérations en lecture lit tout ; un KAM reste lui-même", () => {
    expect(estLecteurDePilotage({ role: "PRODUCT_MANAGER" }, false, true)).toBe(true);
    expect(estLecteurDePilotage({ role: "OPERATIONS_DIRECTOR" }, false, true)).toBe(true);
    expect(estLecteurDePilotage({ role: "MEDICAL_DELEGATE" }, false, true)).toBe(false);
    expect(estLecteurDePilotage({ role: "NATIONAL_SALES" }, false, true)).toBe(false);
    expect(estLecteurDePilotage({ role: "PRODUCT_MANAGER", secondaryRole: "MEDICAL_DELEGATE" }, false, true)).toBe(false);
    expect(estLecteurDePilotage({ role: "PRODUCT_MANAGER" }, true, true), "un profil de KAM fait un KAM").toBe(false);
    expect(estLecteurDePilotage({ role: "PRODUCT_MANAGER" }, false, false), "sans le module, rien").toBe(false);
  });
});
