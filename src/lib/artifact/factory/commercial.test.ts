import { describe, expect, it } from "vitest";
import {
  arrondirCentimes, calculerTotaux, formaterDzd, formaterMontant, formaterNumero, formaterQuantite,
  titreDocument, validerMotifNumero, verifierSpecCommerciale, type SpecDocumentCommercial,
} from "@/lib/artifact/factory/commercial";
import { empreinteDocument } from "@/lib/artifact/factory/empreinte";

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


describe("les pièces de référence de la société — sections, taxes additionnelles, motif de numérotation (§118.135)", () => {
  const bc = (): SpecDocumentCommercial => ({
    type: "BON_DE_COMMANDE", numero: "012/DG/2026", date: "2026-08-06", emetteur, tiers: { nom: "INSIGNE CONSEIL" },
    taxes: [{ libelle: "Taxe Pub", taux: 0.02 }],
    lignes: [
      { designation: "Conception ADV", quantite: 1, prixUnitaire: 145_000 },
      { designation: "Adaptation format papier", quantite: 1, prixUnitaire: 0 },
      { designation: "Impression ADV", quantite: 1, prixUnitaire: 15_000 },
      { designation: "Campagne Raltégravir", section: true, quantite: 0, prixUnitaire: 0 },
      { designation: "Fiche posologique", quantite: 500, prixUnitaire: 225 },
      { designation: "Banner", quantite: 3, prixUnitaire: 33_000 },
      { designation: "Campagne Dolutégravir", section: true, quantite: 0, prixUnitaire: 0 },
      { designation: "Fiche posologique", quantite: 500, prixUnitaire: 225 },
      { designation: "Banner", quantite: 3, prixUnitaire: 33_000 },
      { designation: "Campagne Darunavir", section: true, quantite: 0, prixUnitaire: 0 },
      { designation: "Fiche posologique", quantite: 500, prixUnitaire: 225 },
      { designation: "Banner", quantite: 3, prixUnitaire: 33_000 },
    ],
  });

  it("UNE TAXE ADDITIONNELLE se calcule sur le HT et HORS base de TVA — les chiffres du bon de commande 012/DG/2026", () => {
    const t = calculerTotaux(bc());
    expect(t.totalHt).toBe(794_500);
    expect(t.taxes).toEqual([{ libelle: "Taxe Pub", taux: 0.02, base: 794_500, montant: 15_890 }]);
    expect(t.totalTaxes).toBe(15_890);
    // La TVA porte sur 794 500, pas sur 810 390 : 150 955 et non 153 974,10.
    expect(t.totalTva).toBe(150_955);
    expect(t.totalTtc).toBe(961_345);
  });

  it("UNE SECTION ne compte ni dans les totaux ni dans la numérotation des lignes", () => {
    const t = calculerTotaux(bc());
    expect(t.lignes.filter((l) => l.section).every((l) => l.ht === 0 && l.n === 0)).toBe(true);
    expect(t.lignes.filter((l) => !l.section).map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(verifierSpecCommerciale(bc()).bloquants).toEqual([]);
    // Rien que des sections : ce n'est pas une pièce.
    const vide = verifierSpecCommerciale({ ...bc(), lignes: [{ designation: "Campagne", section: true, quantite: 0, prixUnitaire: 0 }] });
    expect(vide.bloquants.some((b) => /titres de section/.test(b))).toBe(true);
  });

  it("refuse une taxe additionnelle hors de ]0 ; 1[ ou sans libellé, et une date amont illisible", () => {
    const r = verifierSpecCommerciale({ ...bc(), taxes: [{ libelle: "", taux: 2 }], referenceAmontDate: "20/07/2026" });
    expect(r.bloquants.some((b) => /libellé vide/.test(b))).toBe(true);
    expect(r.bloquants.some((b) => /taux 2 hors/.test(b))).toBe(true);
    expect(r.bloquants.some((b) => /pièce amont/.test(b))).toBe(true);
  });

  it("LE MOTIF DE NUMÉROTATION rend les numéros réels de la société — et refuse ce qu'il ne sait pas lire", () => {
    expect(formaterNumero("FA", 2026, 7)).toBe("FA-2026-0007");
    expect(formaterNumero("FS", 2026, 1, "{n:3}/FS/{aa}")).toBe("001/FS/26");
    expect(formaterNumero("BC", 2026, 12, "{n:3}/DG/{aaaa}")).toBe("012/DG/2026");
    expect(formaterNumero("BC", 2026, 1234, "{n:3}/DG/{aaaa}")).toBe("1234/DG/2026");
    expect(formaterNumero("BC", 2026, 12, "{prefixe}{n}")).toBe("BC12");
    // Un motif invalide ne casse pas la numérotation : le défaut reprend.
    expect(formaterNumero("FA", 2026, 7, "FS/{aa}")).toBe("FA-2026-0007");
    expect(validerMotifNumero("{n:3}/FS/{aa}")).toBeNull();
    expect(validerMotifNumero("FS/{aa}")).toMatch(/séquence/);
    expect(validerMotifNumero("{n}/{mois}")).toMatch(/Jeton inconnu/);
    expect(validerMotifNumero("{n}?")).toMatch(/interdit/);
    expect(validerMotifNumero("")).toMatch(/vide/);
  });

  it("l'empreinte distingue une taxe, un détail de ligne, une section — et ignore la casse du tiers", () => {
    const { numero: _n, ...sans } = bc();
    const a = empreinteDocument(sans, "soc");
    expect(empreinteDocument({ ...sans, tiers: { nom: "insigne conseil" } }, "soc")).toBe(a);
    expect(empreinteDocument({ ...sans, taxes: null }, "soc")).not.toBe(a);
    expect(empreinteDocument({ ...sans, lignes: sans.lignes.map((l, i) => (i === 0 ? { ...l, details: ["Nombre de page: 25"] } : l)) }, "soc")).not.toBe(a);
    expect(empreinteDocument({ ...sans, lignes: sans.lignes.filter((l) => !l.section) }, "soc")).not.toBe(a);
  });
});
