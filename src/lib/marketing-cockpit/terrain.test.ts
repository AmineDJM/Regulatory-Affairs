import { describe, it, expect } from "vitest";
import {
  affiniteMoyenneAu, conversions, decideursEngages, normaliserLot, repartitionParLots, segmentsDesDecideurs, tendanceAffinite,
  type LigneDistribution, type ObservationDatee,
} from "./terrain";
import type { EtatProduit } from "@/lib/segmentation/regles";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("décideurs engagés", () => {
  it("les H vus au moins deux fois ce cycle, sur tous les H — les autres lettres ne comptent pas", () => {
    const p = [
      { lettre: "H" as const, faitesCycle: 2 }, { lettre: "H" as const, faitesCycle: 3 }, { lettre: "H" as const, faitesCycle: 1 },
      { lettre: "A" as const, faitesCycle: 5 }, { lettre: "H" as const, faitesCycle: 0 },
    ];
    expect(decideursEngages(p)).toEqual({ engages: 2, total: 4 });
    expect(decideursEngages([])).toEqual({ engages: 0, total: 0 });
  });
});

describe("conversions de lettres depuis le cycle figé", () => {
  it("B → A et A → B ; un nouveau venu ou une donnée manquante n'est pas une conversion", () => {
    const avant = new Map<string, EtatProduit | null>([["a", "B"], ["b", "B"], ["c", "A"], ["d", "EN_ATTENTE"], ["e", "C"]]);
    const apres = new Map<string, EtatProduit | null>([["a", "A"], ["b", "B"], ["c", "B"], ["d", "A"], ["e", "A"], ["nouveau", "A"]]);
    expect(conversions(avant, apres)).toEqual({ bVersA: 1, aVersB: 1, compares: 5 });
  });
});

describe("affinité moyenne (Q2/Q1) et sa tendance", () => {
  const P = "ral";
  const obs: ObservationDatee[] = [
    // Dr 1 : 20 patients, 2/10 en janvier, puis 4/10 en avril.
    { doctorId: "1", productId: null, potentiel: 20, prescriptionsSur10: null, observeLe: d("2026-01-10") },
    { doctorId: "1", productId: P, potentiel: null, prescriptionsSur10: 2, observeLe: d("2026-01-10") },
    { doctorId: "1", productId: P, potentiel: null, prescriptionsSur10: 4, observeLe: d("2026-04-10") },
    // Dr 2 : 10 patients, 3/10 — l'affinité d'un AUTRE produit ne compte pas.
    { doctorId: "2", productId: P, potentiel: 10, prescriptionsSur10: 3, observeLe: d("2026-02-01") },
    { doctorId: "2", productId: "autre", potentiel: null, prescriptionsSur10: 9, observeLe: d("2026-02-02") },
    // Dr 3 : potentiel nul → le ratio ne se calcule pas (jamais un zéro).
    { doctorId: "3", productId: P, potentiel: 0, prescriptionsSur10: 1, observeLe: d("2026-02-01") },
    // Hors panel.
    { doctorId: "x", productId: P, potentiel: 1, prescriptionsSur10: 1, observeLe: d("2026-02-01") },
  ];
  const panel = ["1", "2", "3"];

  it("RATIO_FICHIER : Q2 ÷ Q1, réponses en vigueur à la date, sans les praticiens non mesurables", () => {
    const fevrier = affiniteMoyenneAu(obs, panel, P, "RATIO_FICHIER", d("2026-03-01"));
    expect(fevrier.mesures).toBe(2);
    expect(fevrier.moyenne).toBeCloseTo((2 / 20 + 3 / 10) / 2);
    const mai = affiniteMoyenneAu(obs, panel, P, "RATIO_FICHIER", d("2026-05-01"));
    expect(mai.moyenne).toBeCloseTo((4 / 20 + 3 / 10) / 2);
  });

  it("SUR_10 : Q2 ÷ 10 ; avant toute réponse, null", () => {
    expect(affiniteMoyenneAu(obs, panel, P, "SUR_10", d("2026-03-01")).moyenne).toBeCloseTo((0.2 + 0.3 + 0.1) / 3);
    expect(affiniteMoyenneAu(obs, panel, P, "SUR_10", d("2025-12-01"))).toEqual({ moyenne: null, mesures: 0 });
  });

  it("la tendance sur trois cycles et l'écart en points (premier → dernier point mesuré)", () => {
    const t = tendanceAffinite(obs, panel, P, "RATIO_FICHIER", [
      { libelle: "C1", le: d("2025-12-31") }, { libelle: "C2", le: d("2026-03-01") }, { libelle: "C3", le: d("2026-05-01") },
    ]);
    expect(t.serie.map((s) => s.moyenne === null)).toEqual([true, false, false]);
    expect(t.ecartPts).toBeCloseTo(((4 / 20 + 0.3) / 2 - (2 / 20 + 0.3) / 2) * 100);
  });
});

describe("nos lots chez les hôpitaux", () => {
  it("normalise les n° de lot (casse, séparateurs, préfixe « LOT ») ; trop court = illisible", () => {
    expect(normaliserLot("lot 24-A17")).toBe("24A17");
    expect(normaliserLot("N° 24A17")).toBe("24A17");
    expect(normaliserLot(" 24a17 ")).toBe("24A17");
    expect(normaliserLot("A1")).toBeNull();
    expect(normaliserLot(null)).toBeNull();
  });

  it("servi avec nos lots, uniquement par le concurrent, ou sans lot connu — un hôpital ne compte qu'une fois", () => {
    const l: LigneDistribution[] = [
      { cle: "chu-oran", institutionId: "i1", nom: "CHU Oran", lot: "LOT 24A17", quantite: 100 },
      { cle: "chu-oran", institutionId: "i1", nom: "CHU Oran", lot: "ZX991", quantite: 50 },
      { cle: "chu-setif", institutionId: "i2", nom: "CHU Sétif", lot: "ZX991", quantite: 80 },
      { cle: "ehs", institutionId: null, nom: "EHS El Kettar", lot: null, quantite: 40 },
      { cle: "vide", institutionId: null, nom: "Retour", lot: "24A17", quantite: 0 },
    ];
    const r = repartitionParLots(["24-a17", null, "B55"], l);
    expect(r.nosLotsConnus).toBe(true);
    expect(r.consommateurs).toBe(3);
    expect(r.avecNosLots.map((h) => [h.nom, h.quantiteNous])).toEqual([["CHU Oran", 100]]);
    expect(r.concurrentSeul.map((h) => h.nom)).toEqual(["CHU Sétif"]);
    expect(r.sansLot.map((h) => h.nom)).toEqual(["EHS El Kettar"]);
  });

  it("sans aucun lot sur nos BL, rien ne se compare (nosLotsConnus = false)", () => {
    const r = repartitionParLots([null, "  "], [{ cle: "a", institutionId: null, nom: "A", lot: "ZX991", quantite: 5 }]);
    expect(r.nosLotsConnus).toBe(false);
    expect(r.avecNosLots).toEqual([]);
  });

  it("les segments des décideurs de chaque établissement", () => {
    const seg = new Map<string, EtatProduit | null>([["d1", "A"], ["d2", "B"], ["d3", "A"]]);
    const m = segmentsDesDecideurs([
      { doctorId: "d1", institutionId: "i1", statut: "DECIDEUR" },
      { doctorId: "d2", institutionId: "i1", statut: "DECIDEUR" },
      { doctorId: "d3", institutionId: "i2", statut: "PRESCRIPTEUR" },
      { doctorId: "d4", institutionId: null, statut: "DECIDEUR" },
    ], seg);
    expect(m.get("i1")).toEqual(["A", "B"]);
    expect(m.has("i2")).toBe(false);
  });
});
