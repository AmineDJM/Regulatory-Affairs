import { describe, expect, it } from "vitest";
import {
  aRegarder, descendance, empreinteDe, impactDuChangement, natureDe,
  type EntreeMission, type EtapeDuGraphe,
} from "@/lib/missions/horizon/fraicheur";

const H = 3_600_000;
const T0 = new Date("2026-09-01T08:00:00Z");

const entree = (p: Partial<EntreeMission> = {}): EntreeMission => ({
  cle: "forecast:NIVOLEX-2027",
  source: "FINANCE:Forecast:2027",
  version: null,
  empreinte: empreinteDe(41_300),
  confiance: "TROUVE",
  retrievedAt: T0,
  effectiveAt: null,
  supersededAt: null,
  stepKey: "lire-forecast",
  milestoneId: null,
  ...p,
});

describe("l'empreinte", () => {
  it("ne dépend pas de l'ordre des clés — deux lectures de la même fiche donnent la même", () => {
    expect(empreinteDe({ a: 1, b: 2 })).toBe(empreinteDe({ b: 2, a: 1 }));
  });

  it("va jusqu'au fond : un objet imbriqué désordonné reste le même", () => {
    expect(empreinteDe({ x: { p: 1, q: [1, { m: 1, n: 2 }] } }))
      .toBe(empreinteDe({ x: { q: [1, { n: 2, m: 1 }], p: 1 } }));
  });

  it("41300 et 41300.0 sont la même valeur — les distinguer crierait au changement pour rien", () => {
    expect(empreinteDe(41_300)).toBe(empreinteDe(41_300.0));
  });

  it("distingue ce qui est réellement différent", () => {
    expect(empreinteDe(41_300)).not.toBe(empreinteDe(46_800));
    expect(empreinteDe("41300")).not.toBe(empreinteDe(41_300));
    expect(empreinteDe(null)).not.toBe(empreinteDe(0));
  });
});

describe("la nature de la source décide du délai", () => {
  it("lit le préfixe", () => {
    expect(natureDe("FINANCE:Forecast:2027")).toBe("FINANCE");
    expect(natureDe("humain:Khaled Mansouri")).toBe("HUMAIN");
    expect(natureDe("ERP:RegulatoryDossier:REG-9011")).toBe("ERP");
    expect(natureDe("drive:node-88")).toBe("DOCUMENT");
  });

  it("ce qu'on ne sait pas classer se regarde VITE — l'ignorance n'est pas de la stabilité", () => {
    expect(natureDe("truc-inconnu:x")).toBe("AUTRE");
  });
});

describe("ce qu'il faut regarder avant d'agir", () => {
  it("un chiffre financier de 30 h est à revoir ; une fiche ERP du même âge, non", () => {
    const maintenant = new Date(T0.getTime() + 30 * H);
    const out = aRegarder([
      entree(),
      entree({ cle: "dossier", source: "ERP:RegulatoryDossier:REG-9011" }),
    ], maintenant);
    expect(out.map((v) => v.entree.cle)).toEqual(["forecast:NIVOLEX-2027"]);
    expect(out[0].phrase).toContain("FINANCE");
  });

  it("une entrée déjà remplacée n'est pas « à regarder » : la plus fraîche a pris sa place", () => {
    const maintenant = new Date(T0.getTime() + 400 * H);
    expect(aRegarder([entree({ supersededAt: maintenant })], maintenant)).toEqual([]);
  });

  it("`effectiveAt` l'emporte sur la date de lecture — un chiffre de mars lu hier date de mars", () => {
    const maintenant = new Date(T0.getTime() + H);
    const out = aRegarder([entree({
      retrievedAt: maintenant,
      effectiveAt: new Date(T0.getTime() - 200 * H),
      source: "FINANCE:Forecast:2027",
    })], maintenant);
    expect(out).toHaveLength(1);
  });

  it("les plus vieilles d'abord", () => {
    const maintenant = new Date(T0.getTime() + 1_000 * H);
    const out = aRegarder([
      entree({ cle: "recent", retrievedAt: new Date(maintenant.getTime() - 100 * H) }),
      entree({ cle: "vieux", retrievedAt: new Date(maintenant.getTime() - 900 * H) }),
    ], maintenant);
    expect(out.map((v) => v.entree.cle)).toEqual(["vieux", "recent"]);
  });
});

describe("l'impact d'un changement est LOCAL", () => {
  const steps: EtapeDuGraphe[] = [
    { key: "lire-forecast", dependsOn: [], status: "DONE" },
    { key: "lire-rh", dependsOn: [], status: "DONE" },
    { key: "consolider", dependsOn: ["lire-forecast", "lire-rh"], status: "DONE" },
    { key: "excel", dependsOn: ["consolider"], status: "DONE", aEuUnEffet: true },
    { key: "envoyer", dependsOn: ["excel"], status: "DONE", aEuUnEffet: true },
    { key: "autre-branche", dependsOn: ["lire-rh"], status: "DONE" },
  ];

  it("rend `null` quand rien n'a bougé — pas de replanification pour une relecture identique", () => {
    expect(impactDuChangement(entree(), empreinteDe(41_300), steps)).toBeNull();
  });

  it("nomme la branche qui descend de la lecture, et PAS le reste de la mission", () => {
    const i = impactDuChangement(entree(), empreinteDe(46_800), steps);
    expect(i).not.toBeNull();
    expect(i?.branche).toEqual(["lire-forecast", "consolider", "excel", "envoyer"]);
    expect(i?.branche).not.toContain("autre-branche");
    expect(i?.branche).not.toContain("lire-rh");
  });

  it("nomme ce qui est DÉJÀ parti — un envoi ne se dé-envoie pas, il se DIT", () => {
    const i = impactDuChangement(entree(), empreinteDe(46_800), steps);
    expect(i?.effetsDejaProduits).toEqual(["excel", "envoyer"]);
  });

  it("sans lien causal (`stepKey` nul), la branche est VIDE — on ne devine pas ce qui dépend", () => {
    const i = impactDuChangement(entree({ stepKey: null }), empreinteDe(46_800), steps);
    expect(i?.branche).toEqual([]);
  });

  it("la descendance est stable et sans doublon même sur un losange", () => {
    expect(descendance("lire-rh", steps)).toEqual(["lire-rh", "autre-branche", "consolider", "excel", "envoyer"]);
  });
});
