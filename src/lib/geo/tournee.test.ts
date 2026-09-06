import { describe, expect, it } from "vitest";
import { type Lieu, distanceKm } from "./distance";
import { choisirSites, implantationOptimale, territoires, tournee } from "./tournee";

const L = (id: string, lat: number, lon: number, poids?: number): Lieu => ({ id, libelle: id, lat, lon, ...(poids === undefined ? {} : { poids }) });

const VILLES: Lieu[] = [
  L("Alger", 36.7538, 3.0588, 100),
  L("Blida", 36.4703, 2.8277, 30),
  L("Oran", 35.6969, -0.6331, 60),
  L("Constantine", 36.365, 6.6147, 40),
  L("Annaba", 36.9, 7.7667, 25),
  L("Sétif", 36.19, 5.41, 20),
];

describe("geo — tournées, territoires, implantation", () => {
  it("la tournée réordonne et gagne des kilomètres sur l'ordre fourni", () => {
    // Ordre fourni en zigzag : Alger → Annaba → Oran → Constantine → Blida → Sétif.
    const zigzag = [VILLES[0]!, VILLES[4]!, VILLES[2]!, VILLES[3]!, VILLES[1]!, VILLES[5]!];
    const t = tournee(zigzag, { depart: "Alger" });
    expect("erreur" in t).toBe(false);
    if ("erreur" in t) return;
    expect(t.ordre[0]!.id).toBe("Alger");
    expect(t.ordre.length).toBe(6);
    expect(new Set(t.ordre.map((l) => l.id)).size).toBe(6);
    expect(t.distanceKm).toBeLessThan(t.distanceNaiveKm);
    expect(t.gainPourcent).toBeGreaterThan(10);
    expect(t.limites.some((l) => /VOL D'OISEAU/.test(l))).toBe(true);
    expect(t.limites.some((l) => /pas prouvée optimale/.test(l))).toBe(true);
    // Aucun croisement ne subsiste : la tournée est 2-optimale.
    const o = t.ordre;
    for (let i = 1; i < o.length - 1; i += 1) {
      for (let j = i + 1; j < o.length; j += 1) {
        const a = o[i - 1]!, b = o[i]!, c = o[j]!, d = j + 1 < o.length ? o[j + 1]! : o[0]!;
        expect(distanceKm(a, c) + distanceKm(b, d)).toBeGreaterThanOrEqual(distanceKm(a, b) + distanceKm(c, d) - 1e-6);
      }
    }
  });

  it("sur des points alignés, la tournée retrouve l'ordre géographique", () => {
    const alignes = [L("e", 36, 4), L("a", 36, 0), L("c", 36, 2), L("b", 36, 1), L("d", 36, 3)];
    const t = tournee(alignes, { depart: "a", boucle: false });
    if ("erreur" in t) throw new Error(t.erreur);
    expect(t.ordre.map((l) => l.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("refuse ce qu'elle ne peut pas faire, en nommant la ressource manquante", () => {
    const seul = tournee([VILLES[0]!]);
    expect("erreur" in seul).toBe(true);
    if ("erreur" in seul) expect(seul.erreur).toMatch(/géocodage/);
    const sansCoord = tournee([L("x", 0, 0), L("y", 0, 0)]);
    expect("erreur" in sansCoord).toBe(true);
  });

  it("les territoires équilibrent la CHARGE, pas la surface", () => {
    const r = territoires(VILLES, 3);
    expect("erreur" in r).toBe(false);
    if ("erreur" in r) return;
    expect(r.territoires.length).toBe(3);
    // Chaque ville dans exactement un territoire.
    const toutes = r.territoires.flatMap((t) => t.lieux.map((l) => l.id)).sort();
    expect(toutes).toEqual(VILLES.map((v) => v.id).sort());
    expect(r.territoires.every((t) => t.lieux.length > 0)).toBe(true);
    expect(r.territoires[0]!.libelle).toMatch(/^autour de /);
    expect(r.equilibre).toBeGreaterThan(0);
    expect(r.equilibre).toBeLessThanOrEqual(1);
    expect(r.limites.some((l) => /wilayas réelles/.test(l))).toBe(true);
    // Le rayon d'un territoire est cohérent avec ses membres.
    for (const t of r.territoires) for (const l of t.lieux) expect(distanceKm(t.centre, l)).toBeLessThanOrEqual(t.rayonKm + 1e-6);
  });

  it("deux grappes éloignées donnent deux territoires nets", () => {
    const grappes = [
      L("n1", 36.7, 3.0), L("n2", 36.8, 3.1), L("n3", 36.75, 3.05),
      L("s1", 22.7, 5.5), L("s2", 22.8, 5.6), L("s3", 22.75, 5.55),
    ];
    const r = territoires(grappes, 2, { equilibrer: false });
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.territoires.length).toBe(2);
    for (const t of r.territoires) {
      const prefixes = new Set(t.lieux.map((l) => l.id[0]));
      expect(prefixes.size).toBe(1);
    }
  });

  it("l'implantation optimale suit la MASSE, pas le milieu géométrique", () => {
    // Trois clients au nord (poids lourd), un très loin au sud (poids léger).
    const clients = [L("a", 36.75, 3.05, 100), L("b", 36.8, 3.1, 100), L("c", 36.7, 3.0, 100), L("loin", 22.78, 5.52, 1)];
    const r = implantationOptimale(clients);
    expect("erreur" in r).toBe(false);
    if ("erreur" in r) return;
    expect(r.point.lat).toBeGreaterThan(36);
    expect(r.villeLaPlusProche!.lieu.id).toMatch(/^[abc]$/);
    expect(r.villeLaPlusProche!.distanceKm).toBeLessThan(30);
    expect(r.limites.some((l) => /Point théorique/.test(l))).toBe(true);
    expect(r.limites.some((l) => /sites RÉELS/.test(l))).toBe(true);
    // Weber bat le barycentre sur la distance pondérée totale — c'est sa définition.
    const bary = { lat: (36.75 + 36.8 + 36.7 + 22.78) / 4, lon: (3.05 + 3.1 + 3.0 + 5.52) / 4 };
    const coutBary = clients.reduce((s, l) => s + distanceKm(bary, l) * (l.poids ?? 1), 0);
    expect(r.distanceTotaleKm).toBeLessThan(coutBary);
  });

  it("choisir parmi des sites RÉELS : exact, avec l'affectation de chaque client", () => {
    const clients = [L("c1", 36.75, 3.05, 10), L("c2", 36.8, 3.1, 10), L("c3", 35.7, -0.63, 10)];
    const candidats = [L("Alger", 36.7538, 3.0588), L("Oran", 35.6969, -0.6331), L("Tamanrasset", 22.785, 5.5228)];
    const un = choisirSites(clients, candidats, 1);
    if ("erreur" in un) throw new Error(un.erreur);
    expect(un.sites.map((s) => s.id)).toEqual(["Alger"]);
    const deux = choisirSites(clients, candidats, 2);
    if ("erreur" in deux) throw new Error(deux.erreur);
    expect(deux.sites.map((s) => s.id).sort()).toEqual(["Alger", "Oran"]);
    expect(deux.distanceTotaleKm).toBeLessThan(un.distanceTotaleKm);
    expect(deux.affectation.length).toBe(3);
    expect(deux.affectation.find((a) => a.client.id === "c3")!.site.id).toBe("Oran");
    expect(deux.affectation.find((a) => a.client.id === "c3")!.distanceKm).toBeLessThan(5);
    expect(deux.limites.some((l) => /nombres entiers/.test(l))).toBe(true);
    // Combinatoire hors de portée : refusée en le disant, avec l'alternative.
    const trop = choisirSites(clients, Array.from({ length: 60 }, (_, i) => L(`s${i}`, 30 + i * 0.1, 3)), 10);
    expect("erreur" in trop).toBe(true);
    if ("erreur" in trop) expect(trop.erreur).toMatch(/nombres entiers/);
  });

  it("tient l'échelle : 120 étapes en moins de cinq secondes", () => {
    const beaucoup = Array.from({ length: 120 }, (_, i) => L(`p${i}`, 35 + Math.sin(i) * 1.5, 2 + Math.cos(i * 1.7) * 3));
    const t0 = Date.now();
    const t = tournee(beaucoup);
    if ("erreur" in t) throw new Error(t.erreur);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(t.ordre.length).toBe(120);
    expect(t.distanceKm).toBeLessThan(t.distanceNaiveKm);
  });
});
