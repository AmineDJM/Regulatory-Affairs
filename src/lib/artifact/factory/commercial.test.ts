import { describe, expect, it } from "vitest";
import {
  arrondirCentimes, calculerTotaux, empreinteDocument, formaterDzd, formaterMontant, formaterNumero, formaterQuantite,
  titreDocument, verifierSpecCommerciale, type SpecDocumentCommercial,
} from "@/lib/artifact/factory/commercial";

const emetteur = { nom: "Adventum Pharma", formeJuridique: "SARL", adresse: "12 rue des Frères Bouadou, Alger", rc: "16/00-1234567B21", nif: "001916012345678", ai: "16012345678", nis: "001916012345690" };
const tiers = { nom: "Pharmacie Centrale d'Alger", adresse: "Alger", nif: "000016098765432" };

const facture = (extra: Partial<SpecDocumentCommercial> = {}): SpecDocumentCommercial => ({
  type: "FACTURE", numero: "FA-2026-0001", date: "2026-09-05", emetteur, tiers,
  lignes: [
    { designation: "Amoxicilline 1 g — boîte de 12", quantite: 100, prixUnitaire: 250 },
    { designation: "Paracétamol 500 mg — boîte de 20", quantite: 40, prixUnitaire: 85.5, remise: 0.1 },
    { designation: "Prestation de formation", quantite: 1, prixUnitaire: 30_000, tva: 0.09 },
  ],
  modePaiement: "VIREMENT",
  ...extra,
});

describe("l'arithmétique commerciale — calculée par le code, au centime", () => {
  it("arrondit au centime, demi-centime vers le haut, sans erreur flottante", () => {
    expect(arrondirCentimes(2.675)).toBe(2.68);
    expect(arrondirCentimes(1.005)).toBe(1.01);
    expect(arrondirCentimes(-1.005)).toBe(-1.01);
    expect(arrondirCentimes(0.1 + 0.2)).toBe(0.3);
  });

  it("calcule les lignes, les remises, la TVA par taux, le TTC et les lettres", () => {
    const t = calculerTotaux(facture());
    expect(t.lignes.map((l) => l.ht)).toEqual([25_000, 3_078, 30_000]);
    expect(t.totalHtBrut).toBe(58_420);
    expect(t.remisesLignes).toBe(342);
    expect(t.totalHt).toBe(58_078);
    expect(t.tva).toEqual([
      { taux: 0.09, base: 30_000, montant: 2_700 },
      { taux: 0.19, base: 28_078, montant: 5_334.82 },
    ]);
    expect(t.totalTva).toBe(8_034.82);
    expect(t.timbre).toBe(0);
    expect(t.totalTtc).toBe(66_112.82);
    expect(t.enLettres).toBe("soixante-six mille cent douze dinars algériens et quatre-vingt-deux centimes");
  });

  it("répartit une remise globale au prorata des bases de TVA", () => {
    const t = calculerTotaux(facture({ remiseGlobale: 0.05 }));
    expect(t.remiseGlobale).toBe(2_903.9);
    expect(t.totalHt).toBe(55_174.1);
    expect(t.tva.map((x) => x.base)).toEqual([28_500, 26_674.1]);
    expect(arrondirCentimes(t.tva.reduce((s, x) => s + x.base, 0))).toBe(t.totalHt);
  });

  it("applique le droit de timbre sur un règlement en espèces, borné à 2 500 DZD", () => {
    const petit = calculerTotaux(facture({ modePaiement: "ESPECES", lignes: [{ designation: "x", quantite: 1, prixUnitaire: 100 }] }));
    expect(petit.timbre).toBe(5); // 1 % de 119 = 1,19 → plancher 5
    const moyen = calculerTotaux(facture({ modePaiement: "ESPECES" }));
    expect(moyen.timbre).toBe(661.13);
    expect(moyen.totalTtc).toBe(66_773.95);
    const gros = calculerTotaux(facture({ modePaiement: "ESPECES", lignes: [{ designation: "x", quantite: 1, prixUnitaire: 1_000_000 }] }));
    expect(gros.timbre).toBe(2_500);
  });

  it("formate à la française, avec une espace insécable ordinaire", () => {
    expect(formaterMontant(41_300.5)).toBe("41 300,50");
    expect(formaterMontant(-1_234_567.891)).toBe("-1 234 567,89");
    expect(formaterDzd(0)).toBe("0,00 DZD");
    expect(formaterQuantite(12)).toBe("12");
    expect(formaterQuantite(2.5)).toBe("2,5");
    expect(formaterNumero("fa", 2026, 7)).toBe("FA-2026-0007");
    expect(formaterNumero("BC", 2026, 12_345)).toBe("BC-2026-12345");
    expect(titreDocument({ type: "FACTURE", numero: "FA-2026-0007", tiers })).toBe("Facture n° FA-2026-0007 — Pharmacie Centrale d'Alger");
  });
});

describe("la validité d'une pièce — bloquants et avertissements", () => {
  it("accepte une facture complète", () => {
    const v = verifierSpecCommerciale(facture());
    expect(v.bloquants).toEqual([]);
  });

  it("refuse une facture dont l'émetteur n'a pas ses mentions légales — et laisse passer un devis, avec avertissement", () => {
    const sansNif = { ...emetteur, nif: null, ai: "" };
    const f = verifierSpecCommerciale(facture({ emetteur: sansNif }));
    expect(f.bloquants.some((b) => /NIF/.test(b) && /article d'imposition/.test(b))).toBe(true);
    const d = verifierSpecCommerciale(facture({ type: "DEVIS", emetteur: sansNif, validiteJours: 30 }));
    expect(d.bloquants).toEqual([]);
    expect(d.avertissements.some((a) => /NIF/.test(a))).toBe(true);
  });

  it("refuse quantité nulle, prix négatif, TVA inconnue, remise hors bornes, date illisible, tiers sans nom", () => {
    const v = verifierSpecCommerciale(facture({
      date: "05/09/2026", tiers: { nom: " " },
      lignes: [
        { designation: "a", quantite: 0, prixUnitaire: 10 },
        { designation: "b", quantite: 1, prixUnitaire: -1 },
        { designation: "c", quantite: 1, prixUnitaire: 1, tva: 0.2 },
        { designation: "d", quantite: 1, prixUnitaire: 1, remise: 1.5 },
        { designation: "", quantite: 1, prixUnitaire: 1 },
      ],
    }));
    expect(v.bloquants.filter((b) => /^Ligne/.test(b))).toHaveLength(5);
    expect(v.bloquants.some((b) => /date d'émission/.test(b))).toBe(true);
    expect(v.bloquants.some((b) => /client manque/.test(b))).toBe(true);
  });

  it("refuse une pièce sans ligne et une échéance antérieure à l'émission", () => {
    expect(verifierSpecCommerciale(facture({ lignes: [] })).bloquants.some((b) => /sans aucune ligne/.test(b))).toBe(true);
    expect(verifierSpecCommerciale(facture({ echeance: "2026-09-01" })).bloquants.some((b) => /précède/.test(b))).toBe(true);
  });

  it("l'empreinte ignore le numéro et la casse du tiers, mais pas les lignes", () => {
    const { numero: _n, ...sans } = facture();
    void _n;
    const a = empreinteDocument(sans, "soc");
    expect(empreinteDocument({ ...sans, tiers: { nom: "PHARMACIE CENTRALE D'ALGER" } }, "soc")).toBe(a);
    expect(empreinteDocument({ ...sans, lignes: [...sans.lignes, { designation: "z", quantite: 1, prixUnitaire: 1 }] }, "soc")).not.toBe(a);
    expect(empreinteDocument(sans, "autre")).not.toBe(a);
  });
});
