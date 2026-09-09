import { describe, expect, it } from "vitest";
import {
  COLONNES_REGULATORY, COLONNES_INAMOVIBLES, LIBELLES_COLONNES,
  resoudreColonne, enTeteColonne, lireColonnesMasquees, colonnesVisibles,
} from "./colonnes-regulatory";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE DES COLONNES REGULATORY — lu par l'écran ET par Adam.
 *
 * Ce qui ferait tomber ces essais, nommément : rapprocher deux libellés par ressemblance,
 * ignorer en silence un libellé inconnu, ou laisser masquer la référence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("Colonnes du tableau Regulatory", () => {
  it("les clés sont uniques, et chacune porte un en-tête", () => {
    const cles = COLONNES_REGULATORY.map((c) => c.key);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of COLONNES_REGULATORY) expect(c.header.trim().length).toBeGreaterThan(0);
  });

  it("porte les colonnes que le métier a énoncées, et le PROJET", () => {
    const cles = COLONNES_REGULATORY.map((c) => c.key);
    // La liste dictée par la direction, dans l'ordre du tableau.
    for (const k of [
      "reference", "dci", "dosage", "packaging", "therapeuticClass", "company", "segments",
      "category", "supplier", "manufacturingStatus", "priority", "status", "responsible",
      "dossierReceived", "targetSubmissionDate", "targetDate",
    ]) expect(cles).toContain(k);
    expect(cles).toContain("project");
  });

  it("résout un libellé français, sa clé, et ses alias — sans accent ni casse", () => {
    expect(resoudreColonne("Classe thérapeutique")).toBe("therapeuticClass");
    expect(resoudreColonne("classe therapeutique")).toBe("therapeuticClass");
    expect(resoudreColonne("therapeuticClass")).toBe("therapeuticClass");
    expect(resoudreColonne("segment thérapeutique")).toBe("segments");
    expect(resoudreColonne("Projet")).toBe("project");
  });

  /**
   * LA GARDE DU DÉCODEUR. « Statut » désigne le niveau industriel, « Statut réglementaire » le
   * niveau de process : les rapprocher par ressemblance masquerait un jour la mauvaise colonne
   * EN ANNONÇANT que c'est fait (§104.7). On ne devine pas.
   */
  it("ne devine JAMAIS : deux libellés voisins désignent deux colonnes différentes", () => {
    expect(resoudreColonne("Statut")).toBe("manufacturingStatus");
    expect(resoudreColonne("Statut réglementaire")).toBe("status");
    expect(resoudreColonne("Niveau de process")).toBe("status");
    expect(resoudreColonne("colonne du milieu")).toBeNull();
    expect(resoudreColonne("")).toBeNull();
  });

  it("un libellé inconnu FAIT ÉCHOUER la lecture — il ne s'ignore pas en silence", () => {
    const r = lireColonnesMasquees("Classe thérapeutique, Machin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Machin");
  });

  it("la RÉFÉRENCE ne se masque pas, et le refus dit pourquoi", () => {
    expect(COLONNES_INAMOVIBLES).toContain("reference");
    const r = lireColonnesMasquees("Référence");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("identifie la ligne");
    // Et même forcée dans la liste des masquées, elle reste affichée.
    expect(colonnesVisibles(["reference"]).map((c) => c.key)).toContain("reference");
  });

  it("« supprime la classe thérapeutique, garde le segment » : exactement ce qui est demandé", () => {
    const r = lireColonnesMasquees("Classe thérapeutique");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cles).toEqual(["therapeuticClass"]);
    const visibles = colonnesVisibles(r.cles).map((c) => c.key);
    expect(visibles).not.toContain("therapeuticClass");
    expect(visibles).toContain("segments");
  });

  it("une liste vide remet toutes les colonnes", () => {
    const r = lireColonnesMasquees("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cles).toEqual([]);
    expect(colonnesVisibles([]).length).toBe(COLONNES_REGULATORY.length);
  });

  it("dédoublonne : le même nom dit deux fois ne masque qu'une colonne", () => {
    const r = lireColonnesMasquees("Fournisseur, fournisseur, supplier");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cles).toEqual(["supplier"]);
  });

  /**
   * SANS CETTE TABLE, la carte de confirmation d'Adam annoncerait « therapeuticClass » à
   * quelqu'un qui vient de dire « supprime la classe thérapeutique » — une confirmation qu'on
   * donne sans avoir lu.
   */
  it("les libellés d'affichage couvrent toutes les clés", () => {
    for (const c of COLONNES_REGULATORY) {
      expect(LIBELLES_COLONNES[c.key]).toBe(c.header);
      expect(enTeteColonne(c.key)).toBe(c.header);
    }
    // Une clé inconnue retombe sur elle-même plutôt que sur « undefined » à l'écran.
    expect(enTeteColonne("inconnue")).toBe("inconnue");
  });
});
