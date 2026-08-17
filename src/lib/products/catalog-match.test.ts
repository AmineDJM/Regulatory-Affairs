import { describe, it, expect } from "vitest";
import { productKey, matchScore, bestMatches, isConfident, STRONG_MATCH } from "./catalog-match";

const REG = [
  { id: "r1", dci: "AMOXICILLINE", dosage: "500 mg", form: "Comprimé pelliculé" },
  { id: "r2", dci: "AMOXICILLINE", dosage: "1 g", form: "Comprimé pelliculé" },
  { id: "r3", dci: "PARACETAMOL", dosage: "1 g", form: "Comprimé" },
  { id: "r4", dci: "AMOXICILLINE", dosage: "500 mg", form: "Poudre pour suspension buvable" },
];

describe("productKey — deux produits de même clé SONT le même produit", () => {
  it("rapproche deux écritures de la même chose", () => {
    expect(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" }))
      .toBe(productKey({ dci: "AMOXICILLINE", dosage: "500MG", form: "CP pelliculé" }));
  });

  it("l'anglais et le français d'une même MOLÉCULE se rejoignent", () => {
    // « AMOXICILLIN » (IQVIA) et « AMOXICILLINE » (nomenclature) : même principe actif, et le
    // radical les rapproche. La FORME, elle, reste comprise en français seulement — « tablet »
    // retombe sur « AUTRE ». C'est sans conséquence ici : les trois catalogues internes sont
    // saisis en français. On vérifie donc ce qui est vrai, à forme égale.
    expect(productKey({ dci: "Amoxicillin", dosage: "500 mg", form: "comprimé" }))
      .toBe(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" }));
  });

  it("un DOSAGE différent donne une clé différente — 500 mg et 1 g ne sont pas le même produit", () => {
    expect(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "cp" }))
      .not.toBe(productKey({ dci: "Amoxicilline", dosage: "1 g", form: "cp" }));
  });

  it("une FORME différente donne une clé différente", () => {
    expect(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" }))
      .not.toBe(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "sirop" }));
  });

  it("le NOM COMMERCIAL n'entre pas dans la clé — deux marques ne sont pas deux produits", () => {
    expect(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "cp", brandName: "Clamoxyl" }))
      .toBe(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "cp", brandName: "Amoxil" }));
  });

  it("retrouve le dosage NOYÉ DANS LE LIBELLÉ quand il n'a pas de colonne à lui", () => {
    expect(productKey({ dci: "AMOXICILLINE 500 MG", form: "comprimé" }))
      .toBe(productKey({ dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" }));
  });
});

describe("matchScore — un dosage différent DOIT faire chuter la confiance", () => {
  it("identité complète → score élevé, présentable d'emblée", () => {
    const m = matchScore({ dci: "Amoxicilline", dosage: "500 mg", form: "cp" }, REG[0]);
    expect(m.score).toBeGreaterThanOrEqual(STRONG_MATCH);
    expect(isConfident(m.score)).toBe(true);
    expect(m.reason).toContain("même dosage");
  });

  it("MÊME molécule mais dosage différent → sous le seuil, et la raison le DIT", () => {
    // C'est le cas dangereux : tout se ressemble sauf ce qui compte. La proposition doit rester
    // visible (une saisie peut être fautive) mais ne jamais s'imposer seule.
    const m = matchScore({ dci: "Amoxicilline", dosage: "1 g", form: "cp" }, REG[0]);
    expect(isConfident(m.score)).toBe(false);
    expect(m.reason).toContain("DOSAGES DIFFÉRENTS");
  });

  it("molécules différentes → zéro, sans discussion", () => {
    expect(matchScore({ dci: "Paracetamol", dosage: "500 mg" }, REG[0]).score).toBe(0);
  });

  it("une molécule absente ne se rapproche de rien", () => {
    expect(matchScore({ dci: "" }, REG[0]).score).toBe(0);
    expect(matchScore({ dci: null }, REG[0]).score).toBe(0);
  });

  it("dosage inconnu d'un côté : on rapproche sans le prétendre certain", () => {
    const m = matchScore({ dci: "Amoxicilline", form: "comprimé" }, REG[0]);
    expect(m.score).toBeGreaterThan(0);
    expect(m.reason).toContain("dosage inconnu");
  });
});

describe("bestMatches — la bonne proposition en tête, et rien d'inutile derrière", () => {
  it("classe la correspondance exacte avant celle qui ne partage que la molécule", () => {
    const props = bestMatches({ dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" }, REG);
    expect(props[0].candidate.id).toBe("r1");
    expect(isConfident(props[0].score)).toBe(true);
    // Le paracétamol n'a rien à faire là : score nul, donc écarté.
    expect(props.map((p) => p.candidate.id)).not.toContain("r3");
  });

  it("le même dosage sous une AUTRE FORME reste proposé, mais derrière", () => {
    const props = bestMatches({ dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" }, REG);
    const ids = props.map((p) => p.candidate.id);
    expect(ids.indexOf("r4")).toBeGreaterThan(ids.indexOf("r1"));
  });

  it("aucune correspondance → liste vide, pas une liste de bruit", () => {
    expect(bestMatches({ dci: "Insuline glargine", dosage: "100 UI" }, REG)).toEqual([]);
  });

  it("respecte la limite demandée", () => {
    expect(bestMatches({ dci: "Amoxicilline" }, REG, 2)).toHaveLength(2);
  });

  it("à score égal, garde l'ordre du catalogue — les propositions ne dansent pas", () => {
    const twins = [
      { id: "a", dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" },
      { id: "b", dci: "Amoxicilline", dosage: "500 mg", form: "comprimé" },
    ];
    expect(bestMatches({ dci: "Amoxicilline", dosage: "500 mg", form: "cp" }, twins).map((p) => p.candidate.id))
      .toEqual(["a", "b"]);
  });
});
