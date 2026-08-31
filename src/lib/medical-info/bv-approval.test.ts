import { describe, it, expect } from "vitest";
import { bvChain, bvChainNote, type BvSigners } from "./bv-approval";

const base: BvSigners = {
  managerUserId: "n1",
  productManagerUserId: "cp",
  centreUserId: "dg",
  requesterId: "prim",
};

describe("les trois signatures du bon de versement", () => {
  it("N+1, puis chef de produit, puis le centre — l'ORDRE est le contrôle", () => {
    // En parallèle, le Directeur Général signerait avant que quiconque ait vérifié le montant :
    // sa signature ne vaudrait plus rien, puisqu'elle ne s'appuierait sur aucune vérification.
    const c = bvChain(base);
    expect(c.validatorIds).toEqual(["n1", "cp", "dg"]);
    expect(c.missing).toEqual([]);
    expect(bvChainNote(c)).toBeNull();
  });

  it("une marche SANS signataire est sautée — et DITE, jamais tue", () => {
    const c = bvChain({ ...base, productManagerUserId: null });
    expect(c.validatorIds).toEqual(["n1", "dg"]);
    expect(c.missing).toEqual(["PRODUCT_MANAGER"]);
    expect(bvChainNote(c)).toContain("chef de produit");
  });

  it("le demandeur ne se valide JAMAIS lui-même", () => {
    // Un pharmacien qui serait aussi chef de produit du dossier s'auto-validerait, et la
    // marche perdrait son sens.
    const c = bvChain({ ...base, productManagerUserId: "prim" });
    expect(c.validatorIds).toEqual(["n1", "dg"]);
    expect(c.missing).toEqual(["PRODUCT_MANAGER"]);
  });

  it("la même personne ne signe pas deux fois", () => {
    // Le chef de produit EST parfois le N+1 : il recevrait deux fois la même demande et devrait
    // signer deux fois pour la faire avancer.
    const c = bvChain({ ...base, productManagerUserId: "n1" });
    expect(c.validatorIds).toEqual(["n1", "dg"]);
    expect(c.missing).toEqual([]);
  });

  it("sans le centre, il reste les deux premières marches", () => {
    const c = bvChain({ ...base, centreUserId: null });
    expect(c.validatorIds).toEqual(["n1", "cp"]);
    expect(bvChainNote(c)).toContain("Directeur Général");
  });

  it("personne pour signer : chaîne vide, et l'appelant devra refuser", () => {
    // Créer une demande que personne ne reçoit, c'est la laisser dormir en base pendant que le
    // pharmacien croit l'avoir envoyée.
    const c = bvChain({ managerUserId: null, productManagerUserId: null, centreUserId: null, requesterId: "prim" });
    expect(c.validatorIds).toEqual([]);
    expect(c.missing).toHaveLength(3);
  });
});
