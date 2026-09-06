import { describe, expect, it } from "vitest";
import { type Lieu, aireKm2, autour, barycentre, cap, cardinal, coordonneesValides, dansLaZone, densites, distanceKm, distanceRoutiereEstimeeKm, enveloppe } from "./distance";

// Des villes réelles : les distances sont vérifiables ailleurs.
const ALGER: Lieu = { id: "alger", libelle: "Alger", lat: 36.7538, lon: 3.0588, poids: 100 };
const ORAN: Lieu = { id: "oran", libelle: "Oran", lat: 35.6969, lon: -0.6331, poids: 60 };
const CONSTANTINE: Lieu = { id: "constantine", libelle: "Constantine", lat: 36.365, lon: 6.6147, poids: 40 };
const TAMANRASSET: Lieu = { id: "tam", libelle: "Tamanrasset", lat: 22.785, lon: 5.5228, poids: 5 };

describe("geo — distances et zones", () => {
  it("les distances entre villes réelles tombent juste", () => {
    // Alger–Oran ≈ 350 km à vol d'oiseau, Alger–Constantine ≈ 320 km, Alger–Tamanrasset ≈ 1 550 km.
    expect(distanceKm(ALGER, ORAN)).toBeGreaterThan(330);
    expect(distanceKm(ALGER, ORAN)).toBeLessThan(365);
    expect(distanceKm(ALGER, CONSTANTINE)).toBeGreaterThan(300);
    expect(distanceKm(ALGER, CONSTANTINE)).toBeLessThan(340);
    expect(distanceKm(ALGER, TAMANRASSET)).toBeGreaterThan(1500);
    expect(distanceKm(ALGER, TAMANRASSET)).toBeLessThan(1600);
    expect(distanceKm(ALGER, ALGER)).toBeCloseTo(0, 9);
    // Symétrique.
    expect(distanceKm(ORAN, ALGER)).toBeCloseTo(distanceKm(ALGER, ORAN), 9);
    // Un degré de latitude vaut ≈ 111 km, partout.
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.19, 1);
    expect(distanceKm({ lat: 60, lon: 0 }, { lat: 61, lon: 0 })).toBeCloseTo(111.19, 1);
    // Un degré de LONGITUDE rétrécit avec la latitude — l'erreur du calcul « à plat ».
    expect(distanceKm({ lat: 60, lon: 0 }, { lat: 60, lon: 1 })).toBeCloseTo(55.6, 0);
  });

  it("la distance routière est une ESTIMATION majorée, jamais la distance elle-même", () => {
    const vol = distanceKm(ALGER, ORAN);
    const route = distanceRoutiereEstimeeKm(ALGER, ORAN);
    expect(route).toBeGreaterThan(vol);
    expect(route / vol).toBeCloseTo(1.3, 6);
  });

  it("le cap et le point cardinal", () => {
    expect(cap({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 3);
    expect(cap({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 3);
    expect(cap({ lat: 0, lon: 0 }, { lat: -1, lon: 0 })).toBeCloseTo(180, 3);
    expect(cardinal(0)).toBe("nord");
    expect(cardinal(90)).toBe("est");
    expect(cardinal(225)).toBe("sud-ouest");
    // Oran est à l'ouest d'Alger.
    expect(cardinal(cap(ALGER, ORAN))).toMatch(/ouest/);
  });

  it("l'enveloppe et le barycentre pondéré suivent la masse", () => {
    const env = enveloppe([ALGER, ORAN, TAMANRASSET])!;
    expect(env.sud).toBeCloseTo(22.785, 3);
    expect(env.nord).toBeCloseTo(36.7538, 3);
    expect(env.ouest).toBeCloseTo(-0.6331, 3);
    expect(env.diagonaleKm).toBeGreaterThan(1500);
    // Sans poids, le barycentre est tiré vers le sud par Tamanrasset ; pondéré, il reste au nord.
    const brut = barycentre([{ ...ALGER, poids: 1 }, { ...ORAN, poids: 1 }, { ...TAMANRASSET, poids: 1 }])!;
    const pondere = barycentre([ALGER, ORAN, TAMANRASSET])!;
    expect(pondere.lat).toBeGreaterThan(brut.lat);
    expect(pondere.lat).toBeGreaterThan(33);
    expect(barycentre([])).toBeNull();
  });

  it("une zone : dedans, dehors, et sur le bord", () => {
    const carre = [{ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, { lat: 10, lon: 10 }, { lat: 10, lon: 0 }];
    expect(dansLaZone({ lat: 5, lon: 5 }, carre)).toBe(true);
    expect(dansLaZone({ lat: 15, lon: 5 }, carre)).toBe(false);
    expect(dansLaZone({ lat: -1, lon: 5 }, carre)).toBe(false);
    expect(dansLaZone({ lat: 0, lon: 5 }, carre)).toBe(true); // le bord compte
    expect(dansLaZone({ lat: 5, lon: 5 }, [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }])).toBe(false); // pas un polygone
  });

  it("l'aire d'un carré d'un degré ≈ 12 300 km² près de l'équateur", () => {
    const carre = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 }];
    const aire = aireKm2(carre);
    expect(aire).toBeGreaterThan(12_000);
    expect(aire).toBeLessThan(12_500);
    expect(aireKm2([{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }])).toBe(0);
  });

  it("« qu'est-ce qu'on a autour d'Alger ? » — trié par distance, avec la direction", () => {
    const proches = autour(ALGER, [ORAN, CONSTANTINE, TAMANRASSET], 400);
    expect(proches.map((p) => p.lieu.id)).toEqual(["constantine", "oran"]);
    expect(proches[0]!.direction).toMatch(/est/);
    expect(autour(ALGER, [TAMANRASSET], 400)).toEqual([]);
  });

  it("les densités par maille repèrent la concentration", () => {
    const lieux: Lieu[] = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `alg${i}`, libelle: `Client Alger ${i}`, lat: 36.75 + i * 0.005, lon: 3.05 + i * 0.005, poids: 10 })),
      { id: "loin", libelle: "Client Tamanrasset", lat: 22.785, lon: 5.5228, poids: 10 },
    ];
    const d = densites(lieux, 4);
    expect(d.grille.length).toBeGreaterThanOrEqual(2);
    expect(d.grille[0]!.n).toBe(20);
    expect(d.grille[0]!.poids).toBe(200);
    expect(d.note).toMatch(/pas administratif/);
    expect(densites([ALGER], 4).grille).toEqual([]);
  });

  it("des coordonnées invalides sont écartées, jamais devinées", () => {
    expect(coordonneesValides({ lat: 36, lon: 3 })).toBe(true);
    expect(coordonneesValides({ lat: 0, lon: 0 })).toBe(false); // le point nul est une absence de donnée
    expect(coordonneesValides({ lat: 91, lon: 3 })).toBe(false);
    expect(coordonneesValides({ lat: NaN, lon: 3 })).toBe(false);
    expect(autour(ALGER, [{ id: "x", libelle: "sans coordonnées", lat: 0, lon: 0 }], 5000)).toEqual([]);
  });
});
