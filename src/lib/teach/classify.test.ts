import { describe, expect, it } from "vitest";
import { classerEnseignement, extraireParametres } from "@/lib/teach/classify";

describe("le classement d'un enseignement — la case, jamais le texte", () => {
  it.each([
    ["Désormais les devis sont valables 45 jours", "DOCUMENT_STANDARD"],
    ["Toute facture au-dessus de 500 000 DZD doit être validée par le PDG", "VALIDATION_RULE"],
    ["Quand je dis la DT, c'est la Direction technique", "MAPPING"],
    ["Je préfère les synthèses en trois points", "PREFERENCE"],
    ["Sauf pour Pharmagène, les devis partent sans validation", "EXCEPTION"],
    ["D'abord le devis, puis le bon de commande, ensuite la facture", "WORKFLOW"],
    ["Un grossiste désigne un répartiteur agréé par le ministère", "BUSINESS_DEFINITION"],
    ["On écrit les dates en dd/mm/aaaa dans tous les documents", "CONVENTION"],
    ["Chez nous, toutes les factures passent par la comptabilité avant paiement", "COMPANY_RULE"],
    ["Nos factures commencent par FAC", "DOCUMENT_STANDARD"],
  ])("« %s » → %s", (texte, kind) => {
    const c = classerEnseignement(texte);
    expect(c.kind).toBe(kind);
    expect(c.confiance).toBeGreaterThanOrEqual(0.5);
    expect(c.indices.length).toBeGreaterThan(0);
  });

  it("sans indice : préférence, confiance basse — jamais une règle de société par défaut", () => {
    const c = classerEnseignement("Zorglub tralala");
    expect(c.kind).toBe("PREFERENCE");
    expect(c.confiance).toBeLessThan(0.5);
    expect(c.indices).toEqual([]);
  });
});

describe("les paramètres extraits — seulement ce qui est écrit noir sur blanc", () => {
  it("lit la validité d'un devis, un préfixe, une TVA, des conditions de paiement", () => {
    expect(extraireParametres("Désormais les devis sont valables 45 jours", "DOCUMENT_STANDARD")).toEqual({ cle: "validiteDevis", valeur: 45, unite: "jours" });
    expect(extraireParametres("Nos factures commencent par FAC", "DOCUMENT_STANDARD")).toEqual({ cle: "prefixeFacture", valeur: "FAC" });
    expect(extraireParametres("Les bons de commande sont numérotés en PO", "DOCUMENT_STANDARD")).toEqual({ cle: "prefixeBonDeCommande", valeur: "PO" });
    expect(extraireParametres("La TVA par défaut est de 9 %", "DOCUMENT_STANDARD")).toEqual({ cle: "tvaDefaut", valeur: 0.09 });
    expect(extraireParametres("Paiement à 45 jours fin de mois", "DOCUMENT_STANDARD")).toEqual({ cle: "conditionsPaiement", valeur: "45 jours fin de mois" });
  });
  it("lit une correspondance et un seuil", () => {
    expect(extraireParametres("Quand je dis la DT, c'est la Direction technique", "MAPPING")).toEqual({ de: "la dt", vers: "la direction technique" });
    expect(extraireParametres("BC = bon de commande", "MAPPING")).toEqual({ de: "bc", vers: "bon de commande" });
    expect(extraireParametres("Toute facture au-dessus de 500 000 DZD doit être validée par le PDG", "VALIDATION_RULE")).toEqual({ seuil: 500_000, devise: "DZD" });
    expect(extraireParametres("Au-delà de 2 M DZD, le conseil décide", "VALIDATION_RULE")).toEqual({ seuil: 2_000_000, devise: "DZD" });
  });
  it("ne devine rien quand rien n'est écrit", () => {
    expect(extraireParametres("Les devis doivent être soignés", "DOCUMENT_STANDARD")).toBeNull();
    expect(extraireParametres("Je préfère les synthèses courtes", "PREFERENCE")).toBeNull();
  });
});
