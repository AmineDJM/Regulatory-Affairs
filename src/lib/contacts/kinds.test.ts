import { describe, it, expect } from "vitest";
import { normalizeKind, groupContactsByKind, matchesContact, NO_KIND_LABEL } from "./kinds";

const contact = (over: Partial<Parameters<typeof matchesContact>[0]> = {}) => ({
  name: "Sarl El Bahia", kind: "Imprimeur", contactName: "M. Saïd",
  phone: "0550 12 34 56", email: "contact@elbahia.dz", city: "Alger", ...over,
});

describe("Regrouper les contacts par nature", () => {
  it("réunit les écritures d'un même métier — sinon le regroupement ne sert à rien", () => {
    // Trois rubriques d'un contact chacune, c'est exactement ce qu'on voulait éviter.
    expect(normalizeKind("Imprimeur")).toBe(normalizeKind("imprimeur"));
    expect(normalizeKind("  IMPRIMEUR  ")).toBe("imprimeur");
    expect(normalizeKind("Agence   de voyage")).toBe("agence de voyage");
  });

  it("garde la première écriture rencontrée comme libellé — on n'impose pas une casse", () => {
    const groups = groupContactsByKind([
      { kind: "Imprimeur" }, { kind: "imprimeur" }, { kind: "IMPRIMEUR" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Imprimeur");
    expect(groups[0].items).toHaveLength(3);
  });

  it("classe les rubriques par ordre alphabétique français", () => {
    const groups = groupContactsByKind([{ kind: "Traiteur" }, { kind: "Avocat" }, { kind: "Hôtel" }]);
    expect(groups.map((g) => g.label)).toEqual(["Avocat", "Hôtel", "Traiteur"]);
  });

  it("met les contacts SANS catégorie en dernier — ce sont les non rangés, pas les prioritaires", () => {
    const groups = groupContactsByKind([{ kind: null }, { kind: "Imprimeur" }, { kind: "  " }]);
    expect(groups[groups.length - 1].label).toBe(NO_KIND_LABEL);
    expect(groups[groups.length - 1].items).toHaveLength(2);
  });
});

describe("Chercher un contact", () => {
  it("trouve par le métier, par la raison sociale ET par le numéro", () => {
    // Les trois arrivent vraiment : on cherche « un imprimeur », on se souvient du nom, ou l'on a
    // le numéro sous les yeux sur une facture.
    expect(matchesContact(contact(), "imprim")).toBe(true);
    expect(matchesContact(contact(), "bahia")).toBe(true);
    expect(matchesContact(contact(), "34 56")).toBe(true);
  });

  it("trouve par la personne qu'on demande et par la ville", () => {
    expect(matchesContact(contact(), "saïd")).toBe(true);
    expect(matchesContact(contact(), "alger")).toBe(true);
  });

  it("ignore la casse et rend tout sur une recherche vide", () => {
    expect(matchesContact(contact(), "SARL")).toBe(true);
    expect(matchesContact(contact(), "   ")).toBe(true);
  });

  it("ne rend pas un contact qui ne correspond à rien", () => {
    expect(matchesContact(contact(), "traiteur")).toBe(false);
  });

  it("ne tombe pas sur un champ absent", () => {
    const bare = contact({ kind: null, contactName: null, phone: null, email: null, city: null });
    expect(matchesContact(bare, "bahia")).toBe(true);
    expect(matchesContact(bare, "imprimeur")).toBe(false);
  });
});
