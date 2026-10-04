import { describe, expect, it } from "vitest";
import { lignesProposeesFacturePromo, preremplirFacturePromo } from "@/lib/pieces-lues/prerempli-facture-promo";
import type { PieceLue, LigneLue } from "@/lib/pieces-lues/structure";
import type { LigneBC } from "@/lib/promo-material/achats";

const ligne = (rang: number, designation: string, quantite: number | null, prixUnitaire: number | null, section = false): LigneLue => ({
  rang, designation, designationCoupee: false, reference: null, unite: null, quantite, prixUnitaire, remise: null, tva: null,
  montantHt: null, section, forfait: false, illisibles: [], suspecte: [],
} as unknown as LigneLue);
const piece = (lignes: LigneLue[]) => ({ lignes } as unknown as PieceLue);
const bc = (id: string, designation: string, quantite: number, prixUnitaire: number, dejaFacture = 0): LigneBC =>
  ({ quoteLineId: id, designation, action: null, unite: null, quantite, prixUnitaire, requestItemId: null, dejaFacture });
const entetes = { totalTtc: { valeur: 178_500, raison: null, extrait: "", ligne: 1 }, netAPayer: null, numero: { valeur: "IA-F1", raison: null, extrait: "", ligne: 1 } } as never;

describe("Facture promo préremplie depuis sa lecture, appariée aux lignes du BC (§118.200)", () => {
  it("une ligne lue rejoint SA ligne du BC ; le numéro et le total imprimé sont repris", () => {
    const p = preremplirFacturePromo(piece([ligne(1, "Fiche posologique Nivolex", 4000, 20)]), entetes, null,
      [bc("q1", "Fiche posologique Nivolex", 5000, 20), bc("q2", "Stylo logo", 1000, 50)]);
    expect(p.lignes[0]).toMatchObject({ quoteLineId: "q1", quantite: 4000, prixUnitaire: 20 });
    expect([p.reference, p.totalImprime, p.bcLibres]).toEqual(["IA-F1", 178_500, ["q2"]]);
  });
  it("une ligne hors BC est listée, jamais reportée sur une autre", () => {
    const p = preremplirFacturePromo(piece([ligne(1, "Frais de transport express", 1, 9000)]), entetes, null, [bc("q1", "Stylo logo", 1000, 50)]);
    expect(p.lignes[0].quoteLineId).toBeNull();
    expect(p.lignes[0].statut).toBe("HORS");
    expect(p.lignes[0].phrase).toMatch(/jamais reportée/);
  });
  it("deux lignes du BC identiques : rien n'est choisi, la paire est laissée à la personne", () => {
    const p = preremplirFacturePromo(piece([ligne(1, "Stylo logo", 500, 50)]), entetes, null, [bc("q1", "Stylo logo", 500, 50), bc("q2", "Stylo logo", 500, 50)]);
    expect(p.lignes[0].quoteLineId).toBeNull();
    expect(p.lignes[0].statut).toBe("AMBIGUE");
    expect(p.lignes[0].candidats.sort()).toEqual(["q1", "q2"]);
  });
  it("une ligne déjà entièrement facturée n'attend plus rien ; une section n'est pas une ligne", () => {
    const p = preremplirFacturePromo(piece([ligne(1, "Impression", null, null, true), ligne(2, "Stylo logo", 10, 50)]), entetes, null, [bc("q1", "Stylo logo", 1000, 50, 1000)]);
    expect(lignesProposeesFacturePromo(piece([ligne(1, "Impression", null, null, true)]))).toEqual([]);
    expect(p.lignes).toHaveLength(1);
    expect(p.lignes[0].quoteLineId).toBeNull();
  });
});
