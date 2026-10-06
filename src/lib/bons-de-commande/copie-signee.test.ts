import { describe, expect, it } from "vitest";
import {
  controlerFacture, controleFactureDe, refusCopieSignee, refusDemandePaiementBC, verdictSignatureDe, type ControleFacture, type FactureLue,
} from "./copie-signee";

const lu = (p: Partial<FactureLue>): FactureLue => ({ montantLu: null, montantSaisi: null, bcCites: [], fournisseurLu: null, methode: "test", ...p });
const BC1 = { id: "bc1", reference: "BC-2026-0012", montantTtc: 119_000, fournisseur: "SARL Imprimerie El Djazair" };
const BC2 = { id: "bc2", reference: "BC-2026-0013", montantTtc: 50_000, fournisseur: "SARL Imprimerie El Djazair" };

describe("le BC signé sur papier — ce que Luna a vu", () => {
  it("aucune signature repérée : refusé, avec ce qu'il faut téléverser", () => {
    expect(refusCopieSignee({ statut: "ABSENTE", signature: false, cachet: true, numeroLu: null, note: "cadre de signature vide" }, "BC-1"))
      .toMatch(/aucune signature.*cadre de signature vide.*SIGNÉE/);
  });
  it("signature repérée sur le bon BC : accepté ; sur un autre numéro : refusé", () => {
    const v = { statut: "REPEREE" as const, signature: true, cachet: false, numeroLu: "N° BC-2026-0012", note: "" };
    expect(refusCopieSignee(v, "BC-2026-0012")).toBeNull();
    expect(refusCopieSignee({ ...v, numeroLu: "BC-2026-0099" }, "BC-2026-0012")).toMatch(/pas BC-2026-0012/);
  });
  it("Luna indisponible : la signature n'est pas bloquée", () => {
    expect(refusCopieSignee({ statut: "NON_VERIFIEE", signature: false, cachet: false, numeroLu: null, note: "IA coupée" }, "BC-1")).toBeNull();
  });
  it("un verdict mal formé ne se relit pas", () => {
    expect(verdictSignatureDe({ statut: "PEUT-ÊTRE" })).toBeNull();
    expect(verdictSignatureDe({ statut: "REPEREE", signature: true })?.signature).toBe(true);
  });
});

describe("la facture contre le(s) BC — « uniquement la cohérence avec le bon de commande »", () => {
  it("même total (à un dinar), même fournisseur, BC cité : cohérente", () => {
    const c = controlerFacture(lu({ montantLu: 119_000.4, bcCites: ["BC-2026-0012"], fournisseurLu: "IMPRIMERIE EL DJAZAIR" }), [BC1]);
    expect(c.coherente).toBe(true);
    expect(c.montant).toBe(119_000.4);
  });
  it("plusieurs BC : la facture se compare à leur SOMME", () => {
    expect(controlerFacture(lu({ montantLu: 169_000 }), [BC1, BC2]).coherente).toBe(true);
    const c = controlerFacture(lu({ montantLu: 160_000 }), [BC1, BC2]);
    expect(c.coherente).toBe(false);
    expect(c.ecarts[0]).toMatch(/Montant total.*BC-2026-0012, BC-2026-0013/);
  });
  it("montant illisible et non saisi : incohérence (on ne paie pas un montant inconnu) ; saisi : il prend le relais", () => {
    expect(controlerFacture(lu({}), [BC1]).ecarts[0]).toMatch(/ne se lit pas/);
    expect(controlerFacture(lu({ montantSaisi: 119_000 }), [BC1]).coherente).toBe(true);
  });
  it("le lu et le saisi se contredisent : dit", () => {
    expect(controlerFacture(lu({ montantLu: 119_000, montantSaisi: 120_000 }), [BC1]).ecarts.join(" ")).toMatch(/Luna lit/);
  });
  it("un autre BC cité, un autre fournisseur : dits", () => {
    const c = controlerFacture(lu({ montantLu: 119_000, bcCites: ["BC-2026-0777"], fournisseurLu: "EURL Traiteur Benali" }), [BC1]);
    expect(c.ecarts).toHaveLength(2);
  });
  it("le contrôle gardé en base se relit", () => {
    const c = controlerFacture(lu({ montantLu: 1 }), [BC1]);
    expect(controleFactureDe(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
});

describe("la demande de paiement d'un poste à BC", () => {
  const ok = (bcIds: string[]): { controle: ControleFacture } => ({ controle: { bcIds, montant: 1, montantBcs: 1, coherente: true, ecarts: [], methode: "" } });
  const ko = (bcIds: string[]): { controle: ControleFacture } => ({ controle: { bcIds, montant: 1, montantBcs: 2, coherente: false, ecarts: ["Montant total : écart."], methode: "" } });
  const bcs = [{ id: "bc1", reference: "BC-1", signe: true }, { id: "bc2", reference: "BC-2", signe: true }];
  it("un BC non signé, ou sans facture, la retient", () => {
    expect(refusDemandePaiementBC({ bcs: [bcs[0], { ...bcs[1], signe: false }], factures: [ok(["bc1"])], argumentation: null, confirme: false })).toMatch(/BC-2 n'est pas encore signé/);
    expect(refusDemandePaiementBC({ bcs, factures: [ok(["bc1"])], argumentation: null, confirme: false })).toMatch(/facture du bon de commande BC-2/);
  });
  it("tout cohérent : elle part ; une facture pour deux BC suffit", () => {
    expect(refusDemandePaiementBC({ bcs, factures: [ok(["bc1", "bc2"])], argumentation: null, confirme: false })).toBeNull();
  });
  it("incohérente : argumentation ET « oui » exigés", () => {
    expect(refusDemandePaiementBC({ bcs, factures: [ok(["bc1"]), ko(["bc2"])], argumentation: "", confirme: true })).toMatch(/expliquez/);
    expect(refusDemandePaiementBC({ bcs, factures: [ok(["bc1"]), ko(["bc2"])], argumentation: "remise négociée", confirme: false })).toMatch(/Cochez/);
    expect(refusDemandePaiementBC({ bcs, factures: [ok(["bc1"]), ko(["bc2"])], argumentation: "remise négociée", confirme: true })).toBeNull();
  });
});
