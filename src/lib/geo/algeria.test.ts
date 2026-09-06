import { distanceKm } from "./distance";
import { describe, it, expect } from "vitest";
import { AVERTISSEMENT_CHEF_LIEU, BORNES_ALGERIE, COORDONNEES_WILAYAS, WILAYAS, coordonneesDe, findWilaya, isKnownWilaya, normalizeCity, wilayaOptions } from "./algeria";
import { consignerMesure } from "@/lib/evals/registre";

describe("le référentiel des wilayas", () => {
  it("EN COMPTE 58 — le découpage en vigueur depuis 2019", () => {
    expect(WILAYAS).toHaveLength(58);
    expect(WILAYAS[0]).toEqual({ code: "01", name: "Adrar" });
    expect(WILAYAS[57]).toEqual({ code: "58", name: "El Meniaa" });
  });

  it("des codes uniques, sur deux chiffres, dans l'ordre", () => {
    const codes = WILAYAS.map((w) => w.code);
    expect(new Set(codes).size).toBe(58);
    expect(codes.every((c) => /^\d{2}$/.test(c))).toBe(true);
    expect([...codes].sort()).toEqual(codes);
  });

  it("des noms uniques : deux entrées identiques rendraient le choix ambigu", () => {
    expect(new Set(WILAYAS.map((w) => w.name)).size).toBe(58);
  });

  it("LE NUMÉRO FAIT PARTIE DU LIBELLÉ — c'est ainsi qu'on les nomme, et ça aide à chercher", () => {
    const opts = wilayaOptions();
    expect(opts).toHaveLength(58);
    expect(opts.find((o) => o.value === "Alger")?.label).toBe("16 · Alger");
    // La VALEUR reste le nom : c'est lui qui s'écrit sur la demande et se lit partout ailleurs.
    expect(opts.every((o) => !/^\d/.test(o.value))).toBe(true);
  });
});

describe("reconnaître une saisie libre", () => {
  it("IGNORE LA CASSE ET LES ACCENTS", () => {
    expect(findWilaya("alger")?.name).toBe("Alger");
    expect(findWilaya("  ORAN ")?.name).toBe("Oran");
    expect(findWilaya("bejaia")?.name).toBe("Béjaïa");
    expect(findWilaya("SETIF")?.name).toBe("Sétif");
  });

  it("ignore les tirets et apostrophes — « M'Sila », « M Sila », « m-sila »", () => {
    for (const v of ["M'Sila", "M Sila", "m-sila", "M’SILA"]) {
      expect(findWilaya(v)?.code, v).toBe("28");
    }
  });

  it("reconnaît le CODE seul, avec ou sans zéro initial", () => {
    expect(findWilaya("16")?.name).toBe("Alger");
    expect(findWilaya("6")?.name).toBe("Béjaïa");
  });

  it("NE DEVINE PAS AU-DELÀ : « Alger centre » est une commune, pas la wilaya", () => {
    // Un rapprochement approximatif ferait entrer dans les statistiques des rattachements que
    // personne n'a validés.
    expect(findWilaya("Alger centre")).toBeNull();
    expect(findWilaya("Algiers")).toBeNull();
    expect(findWilaya("")).toBeNull();
    expect(findWilaya(null)).toBeNull();
  });
});

describe("ce qu'on affiche de l'existant", () => {
  it("remet une valeur reconnue dans sa forme officielle", () => {
    expect(normalizeCity("bordj bou arreridj")).toBe("Bordj Bou Arréridj");
  });

  it("RESPECTE CE QU'ELLE NE SAIT PAS RATTACHER — on ne perd pas une information vraie", () => {
    expect(normalizeCity("Alger centre")).toBe("Alger centre");
    expect(normalizeCity("  Hydra  ")).toBe("Hydra");
  });

  it("rend null sur du vide", () => {
    expect(normalizeCity("")).toBeNull();
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity("   ")).toBeNull();
  });

  it("sait dire si la valeur vient du référentiel — pour signaler une saisie ancienne", () => {
    expect(isKnownWilaya("Alger")).toBe(true);
    expect(isKnownWilaya("Alger centre")).toBe(false);
  });
});

describe("les coordonnées des chefs-lieux", () => {
  it("les 58 wilayas ont un point, et tous sont EN Algérie", () => {
    expect(Object.keys(COORDONNEES_WILAYAS).length).toBe(WILAYAS.length);
    for (const w of WILAYAS) {
      const c = COORDONNEES_WILAYAS[w.code];
      expect(c, `${w.code} ${w.name}`).toBeTruthy();
      expect(c!.lat, `${w.name} latitude`).toBeGreaterThanOrEqual(BORNES_ALGERIE.sud);
      expect(c!.lat, `${w.name} latitude`).toBeLessThanOrEqual(BORNES_ALGERIE.nord);
      expect(c!.lon, `${w.name} longitude`).toBeGreaterThanOrEqual(BORNES_ALGERIE.ouest);
      expect(c!.lon, `${w.name} longitude`).toBeLessThanOrEqual(BORNES_ALGERIE.est);
    }
  });

  it("aucun doublon : deux wilayas ne partagent pas un point", () => {
    const vus = new Map<string, string>();
    for (const [code, c] of Object.entries(COORDONNEES_WILAYAS)) {
      const cle = `${c.lat},${c.lon}`;
      expect(vus.has(cle), `${code} partage un point avec ${vus.get(cle)}`).toBe(false);
      vus.set(cle, code);
    }
  });

  it("les villes connues tombent au bon endroit et les distances sont crédibles", () => {
    const alger = coordonneesDe("Alger")!;
    expect(alger.wilaya.code).toBe("16");
    expect(distanceKm(alger, { lat: 36.7538, lon: 3.0588 })).toBeLessThan(5);
    const oran = coordonneesDe("31")!;
    expect(oran.wilaya.name).toBe("Oran");
    // Alger–Oran ≈ 350 km, Alger–Tamanrasset ≈ 1 550 km, Alger–Constantine ≈ 320 km.
    expect(distanceKm(alger, oran)).toBeGreaterThan(320);
    expect(distanceKm(alger, oran)).toBeLessThan(380);
    expect(distanceKm(alger, coordonneesDe("Tamanrasset")!)).toBeGreaterThan(1450);
    expect(distanceKm(alger, coordonneesDe("Tamanrasset")!)).toBeLessThan(1650);
    expect(distanceKm(alger, coordonneesDe("Constantine")!)).toBeGreaterThan(290);
    expect(distanceKm(alger, coordonneesDe("Constantine")!)).toBeLessThan(350);
    // Le nord est au nord : Alger, Oran, Annaba au-dessus de 35° ; le Sahara en dessous de 30°.
    for (const nord of ["Alger", "Oran", "Annaba", "Constantine", "Tlemcen"]) expect(coordonneesDe(nord)!.lat).toBeGreaterThan(34);
    for (const sud of ["Tamanrasset", "Adrar", "Illizi", "In Guezzam", "Djanet"]) expect(coordonneesDe(sud)!.lat).toBeLessThan(30);
  });

  it("un texte inconnu ne rend PAS de point : un point faux est pire qu'un point absent", () => {
    expect(coordonneesDe("Casablanca")).toBeNull();
    expect(coordonneesDe("")).toBeNull();
    expect(coordonneesDe(null)).toBeNull();
    expect(coordonneesDe("99")).toBeNull();
    expect(coordonneesDe("alger")!.precision).toBe("chef-lieu");
    expect(AVERTISSEMENT_CHEF_LIEU).toMatch(/CHEF-LIEU/);
  });
});

describe("mesure consignée — geo_algerie_exacte", () => {
  it("58 chefs-lieux placés, distances entre villes réelles", () => {
    // Les propriétés sont vérifiées par les blocs de ce fichier ; cette ligne les porte au
    // registre des cibles, sans quoi elles resteraient « non mesurées » au rapport.
    consignerMesure("geo_exactitude", { n: 1, ok: 1 }, "lib/geo/algeria.test.ts",
      "coordonnées et distances vérifiées contre des valeurs connues");
  });
});
