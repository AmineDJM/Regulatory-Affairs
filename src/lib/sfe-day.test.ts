import { describe, it, expect } from "vitest";
import { DEFAULT_CAPACITY, DEFAULT_POSITION_WEIGHTS, DEFAULT_FREQUENCY_BY_TIER, type SfeConfig } from "./sfe";
import {
  buildTournee, carriedProducts, daysSince, monthProgress, reasonFor, tierRank, workdaysLeft,
  type PanelDoctor,
} from "./sfe-day";

const CONFIG: SfeConfig = {
  positionWeights: DEFAULT_POSITION_WEIGHTS,
  capacity: DEFAULT_CAPACITY,
  frequencyByTier: DEFAULT_FREQUENCY_BY_TIER, // VERY_HIGH 3, HIGH 2, MEDIUM 1, LOW 1, VERY_LOW 0
};

const AUJOURDHUI = new Date(2026, 8, 10); // jeudi 10 septembre 2026
const ilYA = (jours: number) => new Date(AUJOURDHUI.getTime() - jours * 86_400_000);

const doc = (id: string, over: Partial<PanelDoctor> = {}): PanelDoctor => ({
  id, name: id, potential: "MEDIUM", specialty: null, institution: null, city: null,
  lastVisitAt: ilYA(40), visitsThisMonth: 0, ...over,
});

describe("la tournée proposée — le retard décide, pas le potentiel seul", () => {
  it("un praticien À JOUR ce mois ne figure pas dans la tournée", () => {
    // Le « très fort » vu ses 3 fois n'a plus rien à faire dans la liste du jour : y laisser
    // les mêmes noms enverrait le délégué toujours chez ceux qu'il voit déjà.
    const t = buildTournee([
      doc("ajour", { potential: "VERY_HIGH", visitsThisMonth: 3 }),
      doc("retard", { potential: "MEDIUM", visitsThisMonth: 0 }),
    ], CONFIG, AUJOURDHUI);
    expect(t.map((x) => x.doctorId)).toEqual(["retard"]);
  });

  it("LE RETARD PASSE AVANT LE POTENTIEL — un « moyen » jamais vu devance un « très fort » déjà vu deux fois", () => {
    const t = buildTournee([
      doc("fort", { potential: "VERY_HIGH", visitsThisMonth: 2 }), // 3 attendues → manque 1
      doc("moyen", { potential: "MEDIUM", visitsThisMonth: 0 }), // 1 attendue → manque 1
      doc("jamais", { potential: "HIGH", visitsThisMonth: 0 }), // 2 attendues → manque 2
    ], CONFIG, AUJOURDHUI);
    expect(t[0].doctorId).toBe("jamais"); // le plus en retard d'abord
  });

  it("à retard ÉGAL, le potentiel tranche ; à potentiel égal, le plus anciennement vu", () => {
    const t = buildTournee([
      doc("moyen_recent", { potential: "MEDIUM", lastVisitAt: ilYA(35) }),
      doc("fort", { potential: "VERY_HIGH", visitsThisMonth: 2 }), // manque 1, comme les moyens
      doc("moyen_ancien", { potential: "MEDIUM", lastVisitAt: ilYA(120) }),
    ], CONFIG, AUJOURDHUI);
    expect(t.map((x) => x.doctorId)).toEqual(["fort", "moyen_ancien", "moyen_recent"]);
  });

  it("un palier à fréquence NULLE n'est jamais proposé — le paramétrage dit qu'on ne l'attend pas", () => {
    const t = buildTournee([doc("tresfaible", { potential: "VERY_LOW", lastVisitAt: null })], CONFIG, AUJOURDHUI);
    expect(t).toEqual([]);
  });

  it("la liste est BORNÉE : proposer quarante noms revient à n'en proposer aucun", () => {
    const panel = Array.from({ length: 40 }, (_, i) => doc(`d${i}`, { potential: "HIGH" }));
    expect(buildTournee(panel, CONFIG, AUJOURDHUI)).toHaveLength(8);
    expect(buildTournee(panel, CONFIG, AUJOURDHUI, 3)).toHaveLength(3);
  });

  it("chaque ligne porte sa RAISON, chiffrée — un ordre sans justification se subit", () => {
    const [ligne] = buildTournee([doc("x", { potential: "VERY_HIGH", visitsThisMonth: 1, lastVisitAt: ilYA(12) })], CONFIG, AUJOURDHUI);
    expect(ligne.expected).toBe(3);
    expect(ligne.done).toBe(1);
    expect(ligne.missing).toBe(2);
    expect(ligne.reason).toContain("3 attendues");
    expect(ligne.reason).toContain("1 faite");
    expect(ligne.reason).toContain("12 j");
  });

  it("« jamais visité » se dit, et ne prétend pas à un délai", () => {
    expect(reasonFor(2, 0, null)).toMatch(/jamais visité/i);
    expect(reasonFor(2, 0, null)).not.toMatch(/il y a/);
    expect(reasonFor(1, 0, 45)).toMatch(/pas vu depuis un mois/);
    expect(reasonFor(1, 0, 75)).toMatch(/pas vu depuis 2 mois/);
  });

  it("daysSince et tierRank : les briques de tri", () => {
    expect(daysSince(null, AUJOURDHUI)).toBeNull();
    expect(daysSince(ilYA(7), AUJOURDHUI)).toBe(7);
    // Une date FUTURE (saisie de travers) ne rend jamais un négatif qui casserait le tri.
    expect(daysSince(new Date(AUJOURDHUI.getTime() + 86_400_000), AUJOURDHUI)).toBe(0);
    expect(tierRank("VERY_HIGH")).toBeLessThan(tierRank("MEDIUM"));
    expect(tierRank("inconnu")).toBeGreaterThan(tierRank("VERY_LOW"));
  });
});

describe("la ligne de chiffres du mois — quatre nombres, pas quarante", () => {
  it("la semaine ouvrée est ALGÉRIENNE : vendredi et samedi ne comptent pas", () => {
    // Du jeudi 10 au mercredi 30 septembre 2026 : on retire les vendredis et samedis.
    const jours = workdaysLeft(new Date(2026, 8, 10));
    let attendu = 0;
    for (let d = 10; d <= 30; d++) {
      const j = new Date(2026, 8, d).getDay();
      if (j !== 5 && j !== 6) attendu += 1;
    }
    expect(jours).toBe(attendu);
    // Le dimanche est OUVRÉ ici — compter à la française donnerait un rythme faux.
    expect(workdaysLeft(new Date(2026, 8, 30))).toBe(1); // mercredi 30 : lui seul
  });

  it("le rythme à tenir se déduit du reste et des jours ouvrés restants", () => {
    const p = monthProgress({ done: 20, target: 55, panelSize: 40, covered: 18, today: new Date(2026, 8, 10) });
    expect(p.donePct).toBe(36);
    expect(p.coveragePct).toBe(45);
    expect(p.perDay).toBe(Math.ceil(35 / p.workdaysLeft));
  });

  it("cible atteinte → plus de rythme à tenir, et le DÉPASSEMENT se dit (jamais caché)", () => {
    const p = monthProgress({ done: 60, target: 55, panelSize: 40, covered: 40, today: new Date(2026, 8, 10) });
    expect(p.perDay).toBe(0);
    expect(p.donePct).toBe(109); // 109 %, pas 100 % : masquer l'effort réel le décourage
    expect(p.coveragePct).toBe(100);
  });

  it("aucune cible posée : on ne divise pas par zéro, et rien n'est inventé", () => {
    const p = monthProgress({ done: 0, target: 0, panelSize: 0, covered: 0, today: AUJOURDHUI });
    expect(p.donePct).toBe(0);
    expect(p.coveragePct).toBe(0);
    expect(p.perDay).toBe(0);
  });
});

describe("la mallette — P1 d'abord, et rien de pré-coché qui n'ait eu lieu", () => {
  it("les produits sortent dans l'ordre de la position de détail", () => {
    const c = carriedProducts([
      { productId: "c", name: "Cétuximab", position: 3 },
      { productId: "a", name: "Atorvastatine", position: 1 },
      { productId: "b", name: "Bisoprolol", position: 2 },
    ], CONFIG);
    expect(c.map((x) => x.productId)).toEqual(["a", "b", "c"]);
  });

  it("SEULS les P1 se pré-cochent : un chiffre faux vaut moins qu'un chiffre absent", () => {
    const c = carriedProducts([
      { productId: "a", name: "Atorvastatine", position: 1 },
      { productId: "b", name: "Bisoprolol", position: 2 },
    ], CONFIG);
    expect(c.find((x) => x.productId === "a")?.preselected).toBe(true);
    expect(c.find((x) => x.productId === "b")?.preselected).toBe(false);
  });

  it("au-delà de deux P1, les suivants ne sont pas pré-cochés — la mallette a un ordre", () => {
    const c = carriedProducts([
      { productId: "a", name: "A", position: 1 },
      { productId: "b", name: "B", position: 1 },
      { productId: "c", name: "C", position: 1 },
    ], CONFIG);
    expect(c.filter((x) => x.preselected).map((x) => x.productId)).toEqual(["a", "b"]);
  });
});
