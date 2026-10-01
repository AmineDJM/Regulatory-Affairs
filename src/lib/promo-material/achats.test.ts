import { describe, expect, it } from "vitest";
import { PromoAction as PromoActionPrisma } from "@prisma/client";
import { ACTIONS, actionProduit, designationAvecAction } from "./actions-fournisseur";
import { lignesDuBonDeCommande, totauxTaxes, type DevisLu } from "./devis";
import {
  ecartTotalImprime, ecartsAuBC, etatReception, lignesAReceptionner, lignesDuBC, lignesProposees, montantPayable,
  natureDeReception, peutReceptionner, quantitePayable, rapprocher, resteAFacturer, totauxFacture, validerArticleDemande,
  validerLignesFacture, validerReception, verdictPaiementDetaille,
  type ArticleDemandeLu, type LigneFactureLue,
} from "./achats";

/**
 * LES ACHATS DU MATÉRIEL PROMOTIONNEL ENTRENT AU STOCK (§118.165) — la règle pure.
 * Les flux par les vraies actions sont dans `actions/promo-achats-flow.test.ts`.
 */

const devis = (over: Partial<DevisLu> = {}): DevisLu => ({
  id: "q1", supplierId: "s1", supplierName: "Imprimerie Atlas", reference: "26/0576", tvaRate: 19,
  extraTaxLabel: null, extraTaxRate: null, announcedTotal: null, documentId: "doc",
  lines: [
    { id: "l1", position: 0, reference: "Fiche posologique Nivolex", unit: "pièce", quantity: 5000, unitPrice: 45, selected: true, action: "IMPRESSION", requestItemId: "a1" },
    { id: "l2", position: 1, reference: "Maquette fiche", unit: null, quantity: 1, unitPrice: 80000, selected: true, action: "CONCEPTION", requestItemId: "a1" },
    { id: "l3", position: 2, reference: "Stylos logotés", unit: "pièce", quantity: 500, unitPrice: 120, selected: false, action: "ACHAT", requestItemId: null },
  ],
  ...over,
});

const article = (over: Partial<ArticleDemandeLu> = {}): ArticleDemandeLu => ({
  id: "a1", position: 0, catalogueId: "c1", reference: "CAT-0042", nom: "Fiche posologique", famille: "CONSOMMABLE",
  unite: "pièce", produits: [{ id: "p1", nom: "Nivolex" }], quantite: 5000, actions: ["CONCEPTION", "IMPRESSION"], commentaire: null,
  ...over,
});

const ligneFacture = (over: Partial<LigneFactureLue> = {}): LigneFactureLue => ({
  id: "f1", position: 0, designation: "Fiche posologique Nivolex", action: "IMPRESSION", unite: "pièce",
  quantite: 5000, prixUnitaire: 45, quoteLineId: "l1", requestItemId: "a1", quantiteRecue: null, renonce: false,
  stockItemId: null, stockLotId: null, ...over,
});

describe("le vocabulaire des actions", () => {
  it("est EXACTEMENT celui du schéma — deux vocabulaires finissent par diverger", () => {
    expect([...ACTIONS].sort()).toEqual(Object.values(PromoActionPrisma).sort());
  });

  it("une impression, une fabrication, un achat produisent des unités ; une conception, non ; une ligne d'avant ne dit rien", () => {
    expect(actionProduit("IMPRESSION")).toBe(true);
    expect(actionProduit("FABRICATION")).toBe(true);
    expect(actionProduit("ACHAT")).toBe(true);
    for (const a of ["CONCEPTION", "LOCATION", "LIVRAISON", "INSTALLATION", "AUTRE"] as const) expect(actionProduit(a)).toBe(false);
    expect(actionProduit(null)).toBeNull();
  });

  it("le BC nomme l'action devant la désignation, sans la répéter", () => {
    expect(designationAvecAction("Fiche posologique", "IMPRESSION")).toBe("Impression — Fiche posologique");
    expect(designationAvecAction("impression fiche posologique", "IMPRESSION")).toBe("impression fiche posologique");
    expect(designationAvecAction("Fiche", null)).toBe("Fiche");
    expect(lignesDuBonDeCommande(devis()).map((l) => l.designation)).toEqual([
      "Impression — Fiche posologique Nivolex", "Conception — Maquette fiche",
    ]);
  });
});

describe("l'article demandé", () => {
  const cat = { reference: "CAT-0042", nom: "Fiche posologique", famille: "CONSOMMABLE" as const, exigeProduit: true, actif: true };
  const base = { catalogue: cat, produitIds: ["p1"], quantite: 5000, quantiteIllisible: false, actions: ["IMPRESSION"], commentaire: " recto-verso " };

  it("se pioche dans le catalogue, avec au moins une action", () => {
    const r = validerArticleDemande({ ...base, actions: ["IMPRESSION", "CONCEPTION", "IMPRESSION"], produitIds: ["p1", "p1"] });
    expect(r).toEqual({ ok: true, article: { produitIds: ["p1"], quantite: 5000, actions: ["IMPRESSION", "CONCEPTION"], commentaire: "recto-verso" } });
  });

  it("dit tout ce qui manque en UNE fois (§118.18)", () => {
    const r = validerArticleDemande({ ...base, produitIds: [], actions: [] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/produits concernés.*au moins une action/);
  });

  it("refuse un article absent, archivé, une action inconnue", () => {
    expect(validerArticleDemande({ ...base, catalogue: null }).ok).toBe(false);
    expect(validerArticleDemande({ ...base, catalogue: { ...cat, actif: false } })).toMatchObject({ ok: false, error: expect.stringMatching(/archivé/) });
    expect(validerArticleDemande({ ...base, actions: ["PEINDRE"] })).toMatchObject({ ok: false, error: expect.stringMatching(/inconnue/) });
  });

  it("un support numérique n'a pas de quantité ; ailleurs elle est facultative mais positive", () => {
    expect(validerArticleDemande({ ...base, catalogue: { ...cat, famille: "NUMERIQUE" } })).toMatchObject({ ok: false, error: expect.stringMatching(/NUMÉRIQUE/) });
    expect(validerArticleDemande({ ...base, catalogue: { ...cat, famille: "NUMERIQUE" }, quantite: null }).ok).toBe(true);
    expect(validerArticleDemande({ ...base, quantite: null }).ok).toBe(true);
    expect(validerArticleDemande({ ...base, quantite: 0 }).ok).toBe(false);
    expect(validerArticleDemande({ ...base, quantite: null, quantiteIllisible: true })).toMatchObject({ ok: false, error: expect.stringMatching(/lisible/) });
  });
});

describe("le rapprochement des devis avec la demande", () => {
  it("range chaque ligne sous son article, les autres « en plus », et nomme ce qui n'est pas chiffré", () => {
    const a2 = article({ id: "a2", position: 1, reference: "CAT-0007", nom: "Banner roll-up", famille: "DURABLE", actions: ["FABRICATION"] });
    const r = rapprocher([article({ actions: ["CONCEPTION", "IMPRESSION", "LIVRAISON"] }), a2], [devis()]);
    expect(r.articles[0].lignes.map((l) => l.ligneId)).toEqual(["l1", "l2"]);
    expect(r.articles[0].actionsSansDevis).toEqual(["LIVRAISON"]);
    expect(r.enPlus.map((l) => l.ligneId)).toEqual(["l3"]);
    expect(r.sansDevis.map((a) => a.id)).toEqual(["a2"]);
  });

  it("une ligne rattachée à un article qui n'existe plus n'est pas perdue : elle passe « en plus »", () => {
    const r = rapprocher([], [devis()]);
    expect(r.enPlus).toHaveLength(3);
  });
});

describe("la facture d'un BC", () => {
  it("ne propose que les lignes RETENUES, et seulement ce qui reste à facturer", () => {
    const lignes = lignesDuBC(devis(), [{ quoteLineId: "l1", quantite: 3000 }, { quoteLineId: "l1", quantite: 1000 }, { quoteLineId: null, quantite: 9 }]);
    expect(lignes.map((l) => l.quoteLineId)).toEqual(["l1", "l2"]);
    expect(resteAFacturer(lignes[0])).toBe(1000);
    expect(lignesProposees(lignes)).toEqual([
      { quoteLineId: "l1", quantite: 1000, prixUnitaire: 45 },
      { quoteLineId: "l2", quantite: 1, prixUnitaire: 80000 },
    ]);
    expect(resteAFacturer({ quantite: 10, dejaFacture: 12 })).toBe(0);
  });

  it("refuse ce qui n'est pas commandé, nomme chaque faute, et ignore une ligne à zéro", () => {
    const lignesBC = lignesDuBC(devis(), []);
    const r = validerLignesFacture([
      { quoteLineId: "l1", quantite: 6000, prixUnitaire: 45 },
      { quoteLineId: "zz", quantite: 1, prixUnitaire: 1 },
      { quoteLineId: "l2", quantite: 0, prixUnitaire: 80000 },
    ], lignesBC);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/6\s000 facturées pour 5\s000/);
    expect(!r.ok && r.error).toMatch(/n'appartient pas/);

    const ok = validerLignesFacture([{ quoteLineId: "l1", quantite: 4800, prixUnitaire: 45 }, { quoteLineId: "l2", quantite: 0, prixUnitaire: 1 }], lignesBC);
    expect(ok.ok && ok.lignes.map((l) => [l.quoteLineId, l.quantite, l.requestItemId, l.action])).toEqual([["l1", 4800, "a1", "IMPRESSION"]]);
    expect(validerLignesFacture([{ quoteLineId: "l1", quantite: 0, prixUnitaire: 45 }], lignesBC)).toMatchObject({ ok: false, error: expect.stringMatching(/Aucune ligne/) });
    expect(validerLignesFacture([{ quoteLineId: "l1", quantite: 1, prixUnitaire: 45 }, { quoteLineId: "l1", quantite: 1, prixUnitaire: 45 }], lignesBC))
      .toMatchObject({ ok: false, error: expect.stringMatching(/deux fois/) });
  });

  it("met en évidence les écarts de quantité et de prix avec le BC, sans les refuser", () => {
    const lignesBC = lignesDuBC(devis(), []);
    const v = validerLignesFacture([{ quoteLineId: "l1", quantite: 4800, prixUnitaire: 46 }, { quoteLineId: "l2", quantite: 1, prixUnitaire: 80000 }], lignesBC);
    if (!v.ok) throw new Error(v.error);
    expect(ecartsAuBC(v.lignes, lignesBC)).toEqual([
      { designation: "Fiche posologique Nivolex", nature: "QUANTITE", facture: 4800, bc: 5000 },
      { designation: "Fiche posologique Nivolex", nature: "PRIX", facture: 46, bc: 45 },
    ]);
  });

  it("calcule son TTC par la MÊME arithmétique que le devis — taxe additionnelle hors base de TVA (§118.135)", () => {
    const taxes = { tvaRate: 19, extraTaxRate: 2 };
    const t = totauxFacture(taxes, [{ quantite: 1, prixUnitaire: 794500 }]);
    expect(t).toMatchObject({ ht: 794500, tva: 150955, taxe: 15890, ttc: 961345 });
    expect(t).toEqual(totauxTaxes(taxes, [{ quantity: 1, unitPrice: 794500 }]));
  });

  it("contrôle le total imprimé à un dinar près", () => {
    expect(ecartTotalImprime(1000, 1000.9)).toBeNull();
    expect(ecartTotalImprime(1000, 1012)).toEqual({ calcule: 1000, imprime: 1012, ecart: 12 });
  });
});

describe("la réception", () => {
  it("cinq états, et une ligne non cochée n'est jamais « reçue »", () => {
    expect(etatReception({ quantite: 10, quantiteRecue: null, renonce: false })).toBe("EN_ATTENTE");
    expect(etatReception({ quantite: 10, quantiteRecue: null, renonce: true })).toBe("NON_LIVREE");
    expect(etatReception({ quantite: 10, quantiteRecue: 10, renonce: false })).toBe("RECUE");
    expect(etatReception({ quantite: 10, quantiteRecue: 4, renonce: false })).toBe("PARTIELLE");
    expect(etatReception({ quantite: 10, quantiteRecue: 4, renonce: true })).toBe("RELIQUAT_RENONCE");
    expect(quantitePayable({ quantite: 10, quantiteRecue: 4 })).toBe(4);
    expect(quantitePayable({ quantite: 10, quantiteRecue: null })).toBe(0);
  });

  it("on ne coche ni « rien » ni plus que facturé, ni deux fois", () => {
    expect(validerReception(ligneFacture(), null)).toEqual({ ok: true, quantite: 5000 });
    expect(validerReception(ligneFacture(), 4800)).toEqual({ ok: true, quantite: 4800 });
    expect(validerReception(ligneFacture(), 0)).toMatchObject({ ok: false, error: expect.stringMatching(/renoncer/) });
    expect(validerReception(ligneFacture(), 5001)).toMatchObject({ ok: false, error: expect.stringMatching(/plus que la facture/) });
    expect(validerReception(ligneFacture({ quantiteRecue: 10 }), 1)).toMatchObject({ ok: false, error: expect.stringMatching(/déjà réceptionnée/) });
    expect(validerReception(ligneFacture({ renonce: true }), 1)).toMatchObject({ ok: false, error: expect.stringMatching(/renoncé/) });
  });

  it("l'action décide du stock ; une ligne d'avant laisse la réception choisir", () => {
    expect(natureDeReception({ action: "CONCEPTION", requestItemId: "a1" }, article())).toEqual({ type: "PRESTATION" });
    expect(natureDeReception({ action: "IMPRESSION", requestItemId: "a1" }, article())).toEqual({ type: "STOCK", catalogueId: "c1", produitIds: ["p1"], famille: "CONSOMMABLE" });
    expect(natureDeReception({ action: "ACHAT", requestItemId: null }, null)).toEqual({ type: "A_CHOISIR", obligatoire: true });
    expect(natureDeReception({ action: null, requestItemId: null }, null)).toEqual({ type: "A_CHOISIR", obligatoire: false });
  });

  it("un support NUMÉRIQUE sort de sa conception : reçue, elle pose le support au stock — sa livraison reste une prestation", () => {
    const numerique = { ...article(), famille: "NUMERIQUE" as const, produits: [] };
    expect(natureDeReception({ action: "CONCEPTION", requestItemId: "a1" }, numerique)).toEqual({ type: "STOCK", catalogueId: "c1", produitIds: [], famille: "NUMERIQUE" });
    expect(natureDeReception({ action: "LIVRAISON", requestItemId: "a1" }, numerique)).toEqual({ type: "PRESTATION" });
    expect(natureDeReception({ action: "LOCATION", requestItemId: "a1" }, numerique)).toEqual({ type: "PRESTATION" });
    // Sans article demandé, une conception reste une prestation : rien ne dit qu'elle livre un support.
    expect(natureDeReception({ action: "CONCEPTION", requestItemId: null }, null)).toEqual({ type: "PRESTATION" });
  });

  it("le demandeur coche ; le Super Admin en suppléance ; personne d'autre", () => {
    expect(peutReceptionner({ id: "u1", role: "MEDICAL_DELEGATE" }, { requesterId: "u1" })).toBe(true);
    expect(peutReceptionner({ id: "sa", role: "SUPER_ADMIN" }, { requesterId: "u1" })).toBe(true);
    expect(peutReceptionner({ id: "u2", role: "DIRECTION_ASSISTANT" }, { requesterId: "u1" })).toBe(false);
    expect(peutReceptionner({ id: "u2", role: "PRODUCT_MANAGER" }, { requesterId: null })).toBe(false);
  });
});

describe("le paiement", () => {
  const f = { tvaRate: 19, extraTaxRate: null, totalImprime: 357001 };

  it("tout reçu : on paie le total IMPRIMÉ, au centime que le fournisseur attend", () => {
    const lignes = [ligneFacture({ quantiteRecue: 5000 }), ligneFacture({ id: "f2", quantite: 1, prixUnitaire: 75000, action: "CONCEPTION", quantiteRecue: 1 })];
    expect(montantPayable(f, lignes)).toMatchObject({ complet: true, montant: 357001 });
  });

  it("refuse tant qu'une ligne attend, en la nommant ; avec le renoncement, ne paie que le reçu", () => {
    const lignes = [ligneFacture({ quantiteRecue: 4000 }), ligneFacture({ id: "f2", quantite: 1, prixUnitaire: 75000, action: "CONCEPTION" })];
    const refus = verdictPaiementDetaille(f, lignes, false);
    expect(refus.ok).toBe(false);
    expect(!refus.ok && refus.error).toMatch(/4\s000 reçues sur 5\s000.*rien de reçu.*ne pourra pas être fait ultérieurement/);
    expect(!refus.ok && refus.aRenoncer).toEqual(["f1", "f2"]);
    const ok = verdictPaiementDetaille(f, lignes, true);
    expect(ok).toMatchObject({ ok: true, complet: false, renoncer: ["f1", "f2"], montant: 214200 }); // 4 000 × 45 × 1,19
  });

  it("rien de reçu : rien à payer — la facture s'annule", () => {
    expect(verdictPaiementDetaille(f, [ligneFacture()], true)).toMatchObject({ ok: false, error: expect.stringMatching(/rien à payer/) });
  });

  it("les lignes à réceptionner sont exactement celles qui attendent encore", () => {
    const lignes = [ligneFacture(), ligneFacture({ id: "b", quantiteRecue: 1 }), ligneFacture({ id: "c", renonce: true }), ligneFacture({ id: "d", quantiteRecue: 5000 })];
    expect(lignesAReceptionner(lignes).map((l) => l.id)).toEqual(["f1", "b"]);
  });
});
