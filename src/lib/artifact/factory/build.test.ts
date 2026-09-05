import { describe, expect, it } from "vitest";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { construireDocumentCommercial } from "@/lib/artifact/factory/build";
import { papierEnTeteDeDemonstration } from "@/lib/artifact/factory/word";
import type { SpecDocumentCommercial } from "@/lib/artifact/factory/commercial";
import type { DocxModel } from "@/lib/artifact/object-model/model";

const emetteur = {
  nom: "Adventum Pharma", formeJuridique: "SARL", capital: "10 000 000 DZD", adresse: "12 rue des Frères Bouadou, Bir Mourad Raïs, Alger",
  rc: "16/00-1234567B21", nif: "001916012345678", ai: "16012345678", nis: "001916012345690", telephone: "+213 21 00 00 00", email: "contact@adventum.dz",
  banque: "BNA — Agence Hydra", rib: "001 00123 0123456789 45",
};
const tiers = { nom: "Pharmacie Centrale d'Alger", adresse: "5 boulevard Zighoud Youcef, Alger", nif: "000016098765432", rc: "16/00-7654321A20" };

const spec = (extra: Partial<SpecDocumentCommercial> = {}): SpecDocumentCommercial => ({
  type: "FACTURE", numero: "FA-2026-0007", date: "2026-09-05", echeance: "2026-10-05", emetteur, tiers,
  lignes: [
    { designation: "Amoxicilline 1 g — boîte de 12", quantite: 100, prixUnitaire: 250 },
    { designation: "Paracétamol 500 mg — boîte de 20", quantite: 40, prixUnitaire: 85.5 },
  ],
  modePaiement: "VIREMENT", conditionsPaiement: "30 jours date de facture", signataire: { nom: "Amine Djouamai", qualite: "Gérant" },
  ...extra,
});

async function modele(octets: Buffer): Promise<DocxModel> {
  return (await adaptateurDocx.ouvrir(octets)).modele() as DocxModel;
}
const texteDe = (m: DocxModel) => [...m.paragraphs.map((p) => p.text), ...m.tables.flatMap((t) => t.cells.map((c) => c.text))].join("\n");

describe("le constructeur de pièces commerciales", () => {
  it("compose une facture complète, la relit et retrouve numéro, tiers, TTC et lettres", async () => {
    const r = await construireDocumentCommercial(spec());
    expect(r.verification.bloquants).toEqual([]);
    expect(r.verification.ok).toBe(true);
    expect(r.verification.relu).toMatchObject({ numero: true, tiers: true, ttc: true, lettres: true });
    expect(r.totaux?.totalTtc).toBe(33_819.8); // 28 420 HT + 5 399,80 de TVA
    expect(r.surPapierEnTete).toBe(false);
    const m = await modele(r.octets);
    expect(m.paragraphs[0].text).toBe("FACTURE N° FA-2026-0007");
    const texte = texteDe(m);
    // Le tableau des lignes n'a ni colonne Remise ni colonne TVA : rien à y montrer.
    const lignes = m.tables.find((t) => t.header[0] === "N°")!;
    expect(lignes.header).toEqual(["N°", "Désignation", "Qté", "P.U. HT", "Total HT"]);
    expect(lignes.rows).toBe(3);
    expect(texte).toContain("TVA 19\u00a0%");
    expect(texte).toContain("33\u00a0819,80\u00a0DZD");
    expect(texte).toContain("Trente-trois mille huit cent dix-neuf dinars algériens et quatre-vingts centimes.");
    expect(texte).toContain("Échéance de règlement");
    expect(texte).toContain("Banque : BNA — Agence Hydra");
    expect(texte).toContain("NIF 001916012345678");
    expect(m.hasHeader).toBe(false);
  });

  it("montre Remise, Unité et TVA seulement quand les lignes en portent", async () => {
    const r = await construireDocumentCommercial(spec({
      type: "DEVIS", numero: "DEV-2026-0001", echeance: null, validiteJours: 15,
      lignes: [
        { designation: "Formation", quantite: 2, unite: "jour", prixUnitaire: 60_000, tva: 0.09, remise: 0.1 },
        { designation: "Support", quantite: 1, prixUnitaire: 10_000 },
      ],
    }));
    expect(r.verification.ok).toBe(true);
    const m = await modele(r.octets);
    const lignes = m.tables.find((t) => t.header[0] === "N°")!;
    expect(lignes.header).toEqual(["N°", "Désignation", "Qté", "Unité", "P.U. HT", "Remise", "TVA", "Total HT"]);
    const texte = texteDe(m);
    expect(texte).toContain("Validité");
    expect(texte).toContain("15 jours — jusqu'au 20/09/2026");
    expect(texte).toContain("Bon pour accord");
    expect(texte).toContain("Arrêté le présent devis à la somme de");
  });

  it("pose la pièce sur le papier en-tête : en-tête et pied conservés, identité compactée mais identifiants présents", async () => {
    const r = await construireDocumentCommercial(spec({ type: "BON_DE_COMMANDE", numero: "BC-2026-0042", echeance: null, livraison: { adresse: "Dépôt de Oued Smar", delai: "sous 10 jours" } }), { base: papierEnTeteDeDemonstration() });
    expect(r.verification.ok).toBe(true);
    expect(r.surPapierEnTete).toBe(true);
    const m = await modele(r.octets);
    expect(m.hasHeader).toBe(true);
    expect(m.hasFooter).toBe(true);
    const texte = texteDe(m);
    expect(texte).toContain("FOURNISSEUR");
    expect(texte).toContain("Adresse de livraison");
    expect(texte).toContain("Dépôt de Oued Smar");
    expect(texte).toContain("NIF 001916012345678");
    // L'adresse du siège n'est pas répétée dans le bloc émetteur : le papier la porte déjà.
    expect(texte.split("Bir Mourad Raïs").length - 1).toBe(0);
  });

  it("refuse une facture dont l'émetteur n'a pas ses mentions — rien n'est composé", async () => {
    const r = await construireDocumentCommercial(spec({ emetteur: { ...emetteur, nif: null, nis: null } }));
    expect(r.verification.ok).toBe(false);
    expect(r.octets.length).toBe(0);
    expect(r.totaux).toBeNull();
    expect(r.verification.bloquants[0]).toMatch(/NIF/);
  });

  it("refuse de livrer une pièce où traîne un reste de brouillon, même si tout le reste est juste", async () => {
    const r = await construireDocumentCommercial(spec({ lignes: [{ designation: "Prestation TODO préciser", quantite: 1, prixUnitaire: 100 }] }));
    expect(r.verification.ok).toBe(false);
    expect(r.verification.bloquants.some((b) => /TODO/.test(b))).toBe(true);
  });
});
