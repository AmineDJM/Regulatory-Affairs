import { describe, it, expect } from "vitest";
import { extractFactsFromText } from "./extract-facts";

const keys = (text: string) => new Set(extractFactsFromText(text, null).map((h) => h.factKey));
const hit = (text: string, key: string) => extractFactsFromText(text, null).find((h) => h.factKey === key);

describe("extractFactsFromText — extraction déterministe de faits sourcés", () => {
  it("DCI par libellé (haute confiance, preuve)", () => {
    const h = hit("Informations produit. DCI : Amoxicilline trihydratée. Autres mentions.", "INN");
    expect(h).toBeTruthy();
    expect(h!.rawValue.toLowerCase()).toContain("amoxicilline");
    expect(h!.method).toBe("label");
    expect(h!.confidence).toBeGreaterThan(0.8);
    expect(h!.extract).toContain("Amoxicilline");
  });

  it("forme pharmaceutique + dosage", () => {
    const set = keys("Comprimé pelliculé dosé à 500 mg d'amoxicilline.");
    expect(set.has("DOSAGE_FORM")).toBe(true);
    expect(set.has("STRENGTH")).toBe(true);
    const s = hit("teneur : 500 mg", "STRENGTH")!;
    expect(s.normalizedValue).toBe("500 mg");
  });

  it("voie d'administration", () => {
    expect(keys("Médicament à administrer par voie orale.").has("ROUTE")).toBe(true);
  });

  it("durée de conservation (contexte requis)", () => {
    const h = hit("Durée de conservation : 24 mois à température ambiante.", "SHELF_LIFE");
    expect(h).toBeTruthy();
    expect(h!.rawValue).toContain("24");
    // « 24 » sans contexte de conservation ne doit PAS déclencher SHELF_LIFE.
    expect(hit("le lot comporte 24 unités", "SHELF_LIFE")).toBeFalsy();
  });

  it("conditions de conservation (température)", () => {
    expect(keys("Conserver à une température ne dépassant pas 25 °C.").has("STORAGE")).toBe(true);
  });

  it("CPP avec numéro", () => {
    const h = hit("Certificat de produit pharmaceutique (CPP) N° 2025/123 délivré.", "CPP");
    expect(h).toBeTruthy();
    expect(h!.rawValue).toMatch(/123/);
  });

  it("texte sans indice → aucun fait", () => {
    expect(extractFactsFromText("Ceci est un paragraphe générique sans donnée réglementaire.", null).length).toBe(0);
  });
});
