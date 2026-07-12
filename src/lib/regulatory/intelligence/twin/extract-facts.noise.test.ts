import { describe, it, expect } from "vitest";
import { extractFactsFromText } from "./extract-facts";

/**
 * NON-RÉGRESSION du BRUIT d'extraction — cas RÉELS observés sur un dossier CTD consolidé :
 *  - « gel » ne doit plus matcher au milieu d'« angel » (frontières de mot) ;
 *  - une « Intravenous » venant d'une CANULE d'étude PK ne doit plus écraser la vraie voie (orale) ;
 *  - un « ≤ –70 °C » de stockage d'ÉCHANTILLONS ne doit plus passer pour la conservation du produit ;
 *  - une ASSOCIATION « 50 mg / 300 mg » doit être captée, mais pas une posologie « 50 mg … 300 mg ».
 */

const facts = (text: string) => extractFactsFromText(text, null);
const keys = (text: string) => new Set(facts(text).map((h) => h.factKey));
const of = (text: string, key: string) => facts(text).filter((h) => h.factKey === key);

describe("bruit — formes pharmaceutiques (frontières de mot + contexte)", () => {
  it("« gel » ne matche PAS à l'intérieur d'« angel » (ni d'autres mots)", () => {
    expect(keys("The angel investor reviewed the dangerous evangelist's angle.").has("DOSAGE_FORM")).toBe(false);
  });

  it("un vrai « gel » (produit) reste bien détecté", () => {
    expect(keys("Forme pharmaceutique : gel dermique.").has("DOSAGE_FORM")).toBe(true);
  });

  it("« gélatine » (excipient/capsule d'origine) ne crée pas une fausse forme", () => {
    // La gélatine est un excipient — contexte négatif (formNeg) → pas de forme retenue à tort.
    expect(keys("Enveloppe de gélatine bovine décrite dans la section excipients.").has("DOSAGE_FORM")).toBe(false);
  });
});

describe("bruit — voie d'administration (canule PK vs voie réelle)", () => {
  it("« Intravenous » issu d'une canule / prélèvement PK est écarté", () => {
    expect(keys("An intravenous cannula was inserted for PK blood sampling.").has("ROUTE")).toBe(false);
  });

  it("la vraie voie ORALE l'emporte, même si une canule IV est mentionnée ailleurs", () => {
    const r = of(
      "Une canule intraveineuse a servi au prélèvement PK. Le comprimé est à prendre par voie orale.",
      "ROUTE",
    );
    expect(r.length).toBe(1);
    expect(r[0].rawValue.toLowerCase()).toContain("orale");
  });
});

describe("bruit — conditions de conservation (échantillon –70 °C vs produit)", () => {
  it("un stockage d'échantillons à –70 °C n'est PAS retenu comme conservation produit", () => {
    expect(keys("Stocker les échantillons de plasma à -70 °C avant analyse bioanalytique.").has("STORAGE")).toBe(false);
  });

  it("la vraie conservation produit est retenue même après une ligne d'échantillons", () => {
    const s = of(
      "Stocker les échantillons à -70 °C. Conserver le produit fini à 25 °C maximum.",
      "STORAGE",
    );
    expect(s.length).toBe(1);
    expect(s[0].rawValue).toContain("25");
  });
});

describe("bruit — teneur d'ASSOCIATION vs posologie", () => {
  it("détecte une association « 50 mg / 300 mg » (valeur normalisée)", () => {
    const combo = of("Comprimé pelliculé 50 mg / 300 mg (ténofovir/lamivudine).", "STRENGTH").find(
      (h) => h.normalizedValue?.includes(" / "),
    );
    expect(combo).toBeTruthy();
    expect(combo!.normalizedValue).toBe("50 mg / 300 mg");
    expect(combo!.confidence).toBeGreaterThan(0.8);
  });

  it("détecte une association rédigée en toutes lettres, INN accentués compris", () => {
    const combo = of(
      "Chaque comprimé contient 50 mg de dolutégravir et 300 mg de lamivudine.",
      "STRENGTH",
    ).find((h) => h.normalizedValue?.includes(" / "));
    expect(combo).toBeTruthy();
    expect(combo!.normalizedValue).toBe("50 mg / 300 mg");
  });

  it("une posologie « 50 mg … max 300 mg » (sans lien) n'est PAS fusionnée en association", () => {
    const merged = of("Prendre 50 mg, sans dépasser 300 mg par jour.", "STRENGTH").find(
      (h) => h.normalizedValue?.includes(" / "),
    );
    expect(merged).toBeFalsy();
  });
});
