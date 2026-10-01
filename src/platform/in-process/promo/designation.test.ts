import { describe, expect, it } from "vitest";
import { designerDevis, designerFacture, lignesDesignees, totauxSiRetenues, type DevisLu } from "./index";
import type { ExecutionDevis } from "@/lib/queries/promo-execution";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DÉSIGNATION DANS UN DOSSIER — ce qu'une phrase retient, et ce qu'elle ne tranche jamais.
 *
 * « Retiens tout le devis Atlas et la ligne Kakémono de Stands Sahel » : un fournisseur retient
 * son devis entier, une ligne se désigne par sa référence, « Fournisseur : ligne » lève
 * l'homonymie. Une ligne ambiguë est un REFUS qui liste — jamais « la première des deux » :
 * retenir la mauvaise, c'est la commander (§104.7).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ligne = (id: string, reference: string, quantity: number, unitPrice: number, selected = false) =>
  ({ id, position: 0, reference, unit: "pièce", quantity, unitPrice, selected });

const DEVIS: DevisLu[] = [
  {
    id: "q-atlas", supplierId: "s-atlas", supplierName: "Imprimerie Atlas", reference: "A-26/057", tvaRate: 19,
    extraTaxLabel: null, extraTaxRate: null, announcedTotal: null, documentId: "doc1",
    lines: [ligne("l1", "Présentoir PLV sol", 100, 10_000), ligne("l2", "Kakémono 80×200", 40, 5_000)],
  },
  {
    id: "q-sahel", supplierId: "s-sahel", supplierName: "Stands Sahel", reference: "S-114", tvaRate: 19,
    extraTaxLabel: "Taxe Pub", extraTaxRate: 2, announcedTotal: null, documentId: "doc2",
    lines: [ligne("l3", "Stand modulaire 3×3", 1, 300_000), ligne("l4", "Kakémono 80×200", 10, 6_000)],
  },
];

describe("les lignes qu'une phrase retient", () => {
  it("un FOURNISSEUR retient tout son devis ; une ligne s'ajoute par sa référence", () => {
    const r = lignesDesignees(DEVIS, ["Atlas"], ["Stand modulaire"]);
    expect(r).toEqual({ ids: ["l1", "l2", "l3"] });
  });

  it("une ligne HOMONYME entre deux devis est refusée en listant les deux — jamais la première", () => {
    const r = lignesDesignees(DEVIS, [], ["Kakémono 80×200"]);
    expect("error" in r && r.error).toMatch(/Imprimerie Atlas : Kakémono 80×200.*Stands Sahel : Kakémono 80×200/);
    expect("error" in r && r.error).toMatch(/Fournisseur : ligne/);
  });

  it("« Fournisseur : ligne » lève l'homonymie", () => {
    expect(lignesDesignees(DEVIS, [], ["Sahel : Kakémono"])).toEqual({ ids: ["l4"] });
  });

  it("un fournisseur inconnu du dossier est un refus qui NOMME les devis présents", () => {
    const r = lignesDesignees(DEVIS, ["Imprimerie du Port"], []);
    expect("error" in r && r.error).toMatch(/Imprimerie Atlas, Stands Sahel/);
  });

  it("une ligne introuvable ne retient rien d'autre", () => {
    const r = lignesDesignees(DEVIS, ["Atlas"], ["Stylos"]);
    expect("error" in r).toBe(true);
  });

  it("la carte montre ce que le clic FIXERA : taxe additionnelle hors base de TVA, par devis", () => {
    // Stand Sahel : 300 000 HT, TVA 19 % = 57 000, Taxe Pub 2 % = 6 000 → 363 000 TTC.
    expect(totauxSiRetenues(DEVIS, ["l3"]).ttc).toBe(363_000);
    // La sélection simulée REMPLACE : les lignes cochées ailleurs n'y entrent pas.
    const coche = DEVIS.map((d) => ({ ...d, lines: d.lines.map((l) => ({ ...l, selected: true })) }));
    expect(totauxSiRetenues(coche, ["l3"]).lignes).toBe(1);
  });
});

describe("le devis et la facture d'un dossier", () => {
  it("un devis se désigne par son fournisseur OU sa référence ; ambigu = refus qui liste", () => {
    expect(designerDevis(DEVIS, "S-114")).toMatchObject({ id: "q-sahel" });
    expect(designerDevis(DEVIS, "atlas")).toMatchObject({ id: "q-atlas" });
    const r = designerDevis(DEVIS, "a");
    expect("error" in r && r.error).toMatch(/Plusieurs devis/);
  });

  const execution = (factures: { id: string; reference: string | null; fournisseur: string }[]): ExecutionDevis[] =>
    ["Imprimerie Atlas", "Stands Sahel"].map((f, i) => ({
      quoteId: `q${i}`, supplierId: null, fournisseur: f, reference: null, lignesRetenues: 1,
      retenu: { ht: 0, tva: 0, taxe: 0, ttc: 0, lignes: 1 }, envoyeLe: null, bc: null, bcDetail: null, lignesBC: [], taxes: { tvaRate: 19, extraTaxLabel: null, extraTaxRate: null },
      factures: factures.filter((x) => x.fournisseur === f).map((x) => ({
        id: x.id, reference: x.reference, montant: 1000, date: null, expenseOrderId: null, etat: "NON_ENVOYE" as const,
        reglee: false, etatReglement: "", paiementDemande: false, demandeInfoMedicale: null, detail: null,
      })),
    }));

  it("par référence, ou par fournisseur quand son BC n'en porte qu'une", () => {
    const ex = execution([{ id: "f1", reference: "F-118", fournisseur: "Imprimerie Atlas" }, { id: "f2", reference: "F-9", fournisseur: "Stands Sahel" }]);
    expect(designerFacture(ex, "F-118")).toMatchObject({ facture: { id: "f1" } });
    expect(designerFacture(ex, "Sahel")).toMatchObject({ facture: { id: "f2" } });
  });

  it("deux factures du même fournisseur ne se départagent pas à sa place", () => {
    const ex = execution([{ id: "f1", reference: "F-1", fournisseur: "Imprimerie Atlas" }, { id: "f2", reference: "F-2", fournisseur: "Imprimerie Atlas" }]);
    const r = designerFacture(ex, "Atlas");
    expect("error" in r && r.error).toMatch(/F-1.*F-2/);
  });

  it("sans facture déposée, le refus le DIT au lieu de désigner rien", () => {
    const r = designerFacture(execution([]), "F-1");
    expect("error" in r && r.error).toMatch(/Aucune facture n'est encore déposée/);
  });
});
