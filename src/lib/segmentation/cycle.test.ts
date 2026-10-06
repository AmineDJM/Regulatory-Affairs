import { describe, it, expect } from "vitest";
import { finDuCycle, joursOuvres, joursAbsence, capaciteKam, avancement, type PraticienFige } from "./cycle";

/**
 * CYCLES — durées réglables, capacité qui se dit (et qu'une absence réduit), avancement par KAM (§49-55, §84).
 */

const D = (s: string) => new Date(`${s}T00:00:00Z`);

describe("durée d'un cycle — réglable, jamais imposée", () => {
  it("mois, 4 et 6 semaines, trimestre, personnalisée", () => {
    expect(finDuCycle(D("2026-10-01"), "MOIS")?.toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(finDuCycle(D("2026-10-01"), "QUATRE_SEMAINES")?.toISOString().slice(0, 10)).toBe("2026-10-28");
    expect(finDuCycle(D("2026-10-01"), "SIX_SEMAINES")?.toISOString().slice(0, 10)).toBe("2026-11-11");
    expect(finDuCycle(D("2026-10-01"), "TRIMESTRE")?.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(finDuCycle(D("2026-10-01"), "PERSONNALISE", D("2026-10-20"))?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(finDuCycle(D("2026-10-01"), "PERSONNALISE", D("2026-09-20"))).toBeNull();
  });
});

describe("§54-55 — capacité KAM", () => {
  it("jours ouvrés (vendredi et samedi chômés)", () => {
    expect(joursOuvres(D("2026-10-01"), D("2026-10-31"))).toBe(21); // 1er octobre 2026 = jeudi ; 5 vendredis + 5 samedis
  });
  it("7 visites/jour × 20 jours terrain = 140 ; une absence approuvée la réduit, et l'explication le dit", () => {
    // 21 jours ouvrés en octobre 2026 ; 20/21 de terrain.
    const sans = capaciteKam("k", { debut: D("2026-10-01"), fin: D("2026-10-31") }, { visitesParJour: 7, partTerrainPct: (20 / 21) * 100, absences: [] });
    expect(sans.theorique).toBe(140);
    const avec = capaciteKam("k", { debut: D("2026-10-01"), fin: D("2026-10-31") }, { visitesParJour: 7, partTerrainPct: (20 / 21) * 100, absences: [{ debut: D("2026-10-11"), fin: D("2026-10-22") }] });
    expect(avec.joursAbsence).toBe(10);
    expect(avec.reelle).toBe(73); // (21 − 10) × 20/21 × 7
    expect(avec.explication).toMatch(/absence approuvée/);
  });
  it("une absence hors du cycle ne compte pas", () => {
    expect(joursAbsence({ debut: D("2026-10-01"), fin: D("2026-10-31") }, [{ debut: D("2026-09-01"), fin: D("2026-09-30") }])).toBe(0);
  });
});

describe("avancement — requis, réalisé, restant, utilisation", () => {
  const P = (doctorId: string, visites: number, kamIds: string[], o: Partial<PraticienFige> = {}): PraticienFige =>
    ({ doctorId, nom: doctorId, h: false, cible: true, affichage: "A", priorite: "P1", visites, pourquoiVisites: "", kamIds, ...o });
  it("par KAM, avec un plafond par praticien : 5 visites au même médecin ne comblent pas un autre trou", () => {
    const r = avancement([P("a", 2, ["k1"]), P("b", 2, ["k1"]), P("h", 2, ["k1"], { h: true, priorite: null })], { a: 5, b: 0, h: 1 }, { k1: 10 });
    const k = r.parKam[0];
    expect(k).toMatchObject({ requis: 6, realise: 3, restant: 3, capacite: 10, hSousVisites: 1, p1: 2 });
    expect(k.utilisation).toBeCloseTo(0.6);
  });
  it("§84 — l'avancement se lit sur l'INSTANTANÉ : une règle changée après l'ouverture ne le touche pas", () => {
    const fige = [P("a", 2, ["k1"])];
    const avant = avancement(fige, { a: 1 }, {});
    // Une nouvelle version demanderait 3 visites : le cycle ouvert garde ses 2.
    expect(avancement(fige, { a: 1 }, {}).total).toEqual(avant.total);
    expect(avant.total).toEqual({ requis: 2, realise: 1, restant: 1 });
  });
});
