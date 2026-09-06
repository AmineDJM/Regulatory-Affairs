import { describe, expect, it } from "vitest";
import {
  cleProduit, clePersonne, cleSociete, emailNormalise, estAberrant, mediane, resolutionEffective, signatureDe, statistiques,
  trierConstats, verdictEmail, SEUIL_AUTO,
} from "./model";

describe("qualité des données — le vocabulaire pur", () => {
  it("la résolution effective : AUTO exige confiance ET correction ; sans correction, c'est une décision", () => {
    const c = { entite: "Employee", entiteId: "e1", champ: "email", avant: "A@X.DZ", apres: "a@x.dz", description: "plier" };
    expect(resolutionEffective("AUTO", 1, c)).toBe("AUTO");
    expect(resolutionEffective("AUTO", SEUIL_AUTO - 0.01, c)).toBe("PROPOSE");
    expect(resolutionEffective("AUTO", 1, null)).toBe("HUMAIN");
    expect(resolutionEffective("PROPOSE", 0.5, c)).toBe("PROPOSE");
    expect(resolutionEffective("HUMAIN", 1, c)).toBe("HUMAIN");
  });

  it("les clés de rapprochement ignorent casse, accents, ordre des mots et formes juridiques", () => {
    expect(cleSociete("Hetero Labs SARL")).toBe(cleSociete("HÉTÉRO LABS"));
    expect(cleSociete("Kwality Pharma SPA")).toBe("kwality");
    expect(cleSociete("Hetero")).not.toBe(cleSociete("Hikma"));
    expect(clePersonne("Cherif Raihana")).toBe(clePersonne("Raïhana CHERIF"));
    expect(cleProduit({ dci: "Sofosbuvir + Velpatasvir", dosage: "400", dosageUnit: "mg", pharmaceuticalForm: "Comprimé", packaging: "B/28" }))
      .toBe(cleProduit({ dci: "velpatasvir + SOFOSBUVIR", dosage: "400", dosageUnit: "MG", pharmaceuticalForm: "comprimé", packaging: "b/28" }));
    expect(cleProduit({ dci: "Sofosbuvir", dosage: "400" })).not.toBe(cleProduit({ dci: "Sofosbuvir", dosage: "200" }));
  });

  it("les e-mails : OK, normalisable (casse, espaces, mailto), invalide, vide", () => {
    expect(verdictEmail("raihana@adventum.dz")).toBe("OK");
    expect(verdictEmail("  Raihana@Adventum.DZ ")).toBe("NORMALISABLE");
    expect(verdictEmail("mailto:x@y.dz")).toBe("NORMALISABLE");
    expect(emailNormalise("  Raihana@Adventum.DZ ")).toBe("raihana@adventum.dz");
    expect(verdictEmail("raihana@adventum")).toBe("INVALIDE");
    expect(verdictEmail("pas un mail")).toBe("INVALIDE");
    expect(verdictEmail("")).toBe("VIDE");
    expect(verdictEmail(null)).toBe("VIDE");
  });

  it("aberrant : au moins 8× la médiane d'un échantillon d'au moins 8 valeurs — sinon rien", () => {
    const ech = [100, 120, 90, 110, 105, 95, 130, 100];
    expect(mediane(ech)).toBe(102.5);
    expect(estAberrant(900, ech)).toBe(true);
    expect(estAberrant(700, ech)).toBe(false);
    expect(estAberrant(900, ech.slice(0, 5))).toBe(false);
    expect(mediane([])).toBeNull();
  });

  it("signature stable et bornée ; tri par criticité puis confiance ; statistiques", () => {
    expect(signatureDe("r", "Employee", "e1", null)).toBe("r|Employee|e1|");
    expect(signatureDe("r", "x".repeat(500)).length).toBe(400);
    const cs = trierConstats([
      { criticite: "NORMALE" as const, confiance: 1 }, { criticite: "CRITIQUE" as const, confiance: 0.6 }, { criticite: "CRITIQUE" as const, confiance: 0.9 },
    ]);
    expect(cs.map((c) => `${c.criticite}:${c.confiance}`)).toEqual(["CRITIQUE:0.9", "CRITIQUE:0.6", "NORMALE:1"]);
    const st = statistiques([{ famille: "DOUBLON", criticite: "HAUTE", resolution: "HUMAIN" }, { famille: "EMAIL", criticite: "BASSE", resolution: "AUTO" }]);
    expect(st.total).toBe(2);
    expect(st.parFamille.DOUBLON).toBe(1);
    expect(st.parResolution.AUTO).toBe(1);
  });
});
