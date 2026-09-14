import { describe, it, expect } from "vitest";
import {
  modeDepuisFaits, composerPortee, porteeGlobale, etablissementDansPortee, produitDansPortee,
  releveDansPortee, filtrerReleves, explicationPortee, porteeVide, refusHorsPortee,
} from "./portee";

/**
 * LA PORTÉE DE STOCK — décidée sur des faits, jamais sur un rôle (§118.134).
 *
 * Chaque cas nomme ce qui le ferait tomber : un mode mal ordonné, un secteur étranger compté, un
 * relevé de PCH qui passerait chez un KAM, une phrase d'écran vide qui ne dirait pas quoi réparer.
 */

const secteurEst = { id: "s-est", nom: "Est", businessUnitId: "bu-onco", institutionIds: ["h-setif", "h-constantine"] };
const secteurOuest = { id: "s-ouest", nom: "Ouest", businessUnitId: "bu-onco", institutionIds: ["h-oran"] };
const secteurCardio = { id: "s-alger", nom: "Alger", businessUnitId: "bu-cardio", institutionIds: ["h-mustapha"] };
const produits = { "bu-onco": ["p-nivolex", "p-trastuzex"], "bu-cardio": ["p-cardiomax"] };

describe("le mode — qui voit tout, qui voit sa BU, qui voit son secteur", () => {
  it("la chaîne d'approvisionnement, la vue globale ou le Super Admin voient TOUT, quels que soient leurs rattachements", () => {
    expect(modeDepuisFaits({ voitTout: true, buSupervisees: ["bu-onco"], buDuKam: "bu-onco", secteurs: [secteurEst] })).toEqual({ mode: "GLOBALE" });
  });

  it("superviser une BU l'emporte sur être affecté à un secteur : le National Sales voit sa BU entière", () => {
    const m = modeDepuisFaits({ voitTout: false, buSupervisees: ["bu-onco", "bu-onco"], buDuKam: "bu-onco", secteurs: [secteurEst] });
    expect(m).toEqual({ mode: "BU", buIds: ["bu-onco"] });
  });

  it("un KAM voit par SECTEUR, dans la BU de sa fiche", () => {
    expect(modeDepuisFaits({ voitTout: false, buSupervisees: [], buDuKam: "bu-onco", secteurs: [secteurEst] }))
      .toEqual({ mode: "SECTEUR", buIds: ["bu-onco"] });
  });

  it("sans fiche, la BU d'un KAM est celle de ses secteurs — une page vide « parce que la fiche n'est pas remplie » serait un refus à tort", () => {
    expect(modeDepuisFaits({ voitTout: false, buSupervisees: [], buDuKam: null, secteurs: [secteurEst, secteurOuest] }))
      .toEqual({ mode: "SECTEUR", buIds: ["bu-onco"] });
    expect(modeDepuisFaits({ voitTout: false, buSupervisees: [], buDuKam: null, secteurs: [] })).toEqual({ mode: "SECTEUR", buIds: [] });
  });
});

describe("la portée composée — établissements des secteurs retenus, produits des BU", () => {
  it("SECTEUR : les établissements de SES secteurs, les produits de SA BU", () => {
    const p = composerPortee({ mode: "SECTEUR", buIds: ["bu-onco"], secteurs: [secteurEst], produitsParBu: produits });
    expect(p.institutionIds).toEqual(["h-constantine", "h-setif"]);
    expect(p.productIds).toEqual(["p-nivolex", "p-trastuzex"]);
    expect(p.secteurs).toEqual([{ id: "s-est", nom: "Est" }]);
    expect(p.raisons).toEqual([]);
  });

  it("un secteur d'une AUTRE BU que la sienne est ÉCARTÉ et compté — « dans sa BU », a dit la Direction", () => {
    // Sans ce point, un KAM d'oncologie affecté par erreur à un secteur de cardiologie verrait
    // les stocks d'une gamme qu'il ne porte pas.
    const p = composerPortee({ mode: "SECTEUR", buIds: ["bu-onco"], secteurs: [secteurEst, secteurCardio], produitsParBu: produits });
    expect(p.institutionIds).toEqual(["h-constantine", "h-setif"]);
    expect(p.productIds).not.toContain("p-cardiomax");
    expect(p.raisons).toContain("SECTEURS_HORS_BU");
    expect(porteeVide(p)).toBe(false);
  });

  it("BU : tous les secteurs de la BU, tous ses produits", () => {
    const p = composerPortee({ mode: "BU", buIds: ["bu-onco"], secteurs: [secteurEst, secteurOuest], produitsParBu: produits });
    expect(p.institutionIds).toEqual(["h-constantine", "h-oran", "h-setif"]);
    expect(p.productIds).toEqual(["p-nivolex", "p-trastuzex"]);
    expect(p.secteurs.map((s) => s.nom)).toEqual(["Est", "Ouest"]);
  });

  it("un KAM sans secteur a une portée VIDE qui le DIT — pas une page qui montre tout", () => {
    const p = composerPortee({ mode: "SECTEUR", buIds: ["bu-onco"], secteurs: [], produitsParBu: produits });
    expect(porteeVide(p)).toBe(true);
    expect(p.raisons).toEqual(["SANS_SECTEUR"]);
    expect(explicationPortee(p)).toMatch(/Aucun secteur de votre BU/);
  });

  it("sans BU du tout, la première chose à réparer est nommée en premier", () => {
    const p = composerPortee({ mode: "SECTEUR", buIds: [], secteurs: [], produitsParBu: produits });
    expect(p.raisons).toEqual(["SANS_BU"]);
    expect(explicationPortee(p)).toMatch(/^Aucune Business Unit/);
  });

  it("des secteurs sans établissement, et une BU sans produit, sont deux manques distincts", () => {
    const vide = { id: "s-vide", nom: "Vide", businessUnitId: "bu-x", institutionIds: [] as string[] };
    const p = composerPortee({ mode: "SECTEUR", buIds: ["bu-x"], secteurs: [vide], produitsParBu: {} });
    expect(p.raisons).toEqual(["SECTEURS_SANS_ETABLISSEMENT", "BU_SANS_PRODUIT"]);
    expect(explicationPortee(p)).toMatch(/aucun établissement/);
    expect(explicationPortee(p)).toMatch(/aucun produit promu/);
  });

  it("la vue globale n'a ni explication ni vide", () => {
    expect(explicationPortee(porteeGlobale())).toBeNull();
    expect(porteeVide(porteeGlobale())).toBe(false);
  });
});

describe("ce que la portée laisse passer", () => {
  const kam = composerPortee({ mode: "SECTEUR", buIds: ["bu-onco"], secteurs: [secteurEst], produitsParBu: produits });

  it("un établissement hors secteur, un produit hors BU, un lieu HÉRITÉ sans établissement : refusés", () => {
    expect(etablissementDansPortee(kam, "h-setif")).toBe(true);
    expect(etablissementDansPortee(kam, "h-oran")).toBe(false);
    expect(etablissementDansPortee(kam, null)).toBe(false);
    expect(produitDansPortee(kam, "p-nivolex")).toBe(true);
    expect(produitDansPortee(kam, "p-cardiomax")).toBe(false);
  });

  it("un relevé de PCH ou d'annexe ne passe JAMAIS une portée restreinte, même sur un produit de la BU", () => {
    expect(releveDansPortee(kam, { scope: "PCH", institutionId: null, productId: "p-nivolex" })).toBe(false);
    expect(releveDansPortee(kam, { scope: "ANNEX", institutionId: null, productId: "p-nivolex" })).toBe(false);
    expect(releveDansPortee(kam, { scope: "HOSPITAL", institutionId: "h-setif", productId: "p-nivolex" })).toBe(true);
    expect(releveDansPortee(kam, { scope: "HOSPITAL", institutionId: "h-setif", productId: "p-cardiomax" })).toBe(false);
    expect(releveDansPortee(kam, { scope: "HOSPITAL", institutionId: "h-oran", productId: "p-nivolex" })).toBe(false);
  });

  it("la vue globale laisse tout passer, et le filtre ne modifie pas le tableau reçu", () => {
    const rows = [
      { id: "a", scope: "PCH", institutionId: null, productId: "p-nivolex" },
      { id: "b", scope: "HOSPITAL", institutionId: "h-setif", productId: "p-nivolex" },
      { id: "c", scope: "HOSPITAL", institutionId: "h-oran", productId: "p-nivolex" },
    ];
    expect(filtrerReleves(porteeGlobale(), rows)).toHaveLength(3);
    expect(filtrerReleves(kam, rows).map((r) => r.id)).toEqual(["b"]);
    expect(rows).toHaveLength(3);
  });

  it("le refus nomme le remède, et distingue le secteur de la BU", () => {
    expect(refusHorsPortee(kam, "etablissement")).toMatch(/de votre secteur/);
    expect(refusHorsPortee(kam, "produit")).toMatch(/gamme de votre secteur/);
    expect(refusHorsPortee(kam, "lieu-herite")).toMatch(/rattaché à aucun établissement/);
    const ns = composerPortee({ mode: "BU", buIds: ["bu-onco"], secteurs: [secteurEst], produitsParBu: produits });
    expect(refusHorsPortee(ns, "etablissement")).toMatch(/de votre BU/);
  });
});
