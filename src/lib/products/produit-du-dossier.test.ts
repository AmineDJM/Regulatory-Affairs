import { describe, expect, it } from "vitest";
import { identityKey, nomCanonique } from "./identity";
import {
  PREFIXE_CLE_DOSSIER, cleProduitDuDossier, identiteFusionnee, phraseProduitDuDossier, planProduitDuDossier, titreACompleter,
  type ProduitActuel,
} from "./produit-du-dossier";

/**
 * PRODUIT = DOSSIER (Direction, 08/10 : « on a dit : un seul catalogue de produits ! ») — la règle pure de
 * `ensureProduitDuDossier`. Les portes réelles (création, modification, démarrage) sont éprouvées en base dans
 * `canonique-flow.test.ts`.
 */

const COMPLET = { dci: "RALTEGRAVIR", dosage: "400", dosageUnit: "MG", form: "COMPRIME_PELLICULE", packaging: "B/60" };
const SANS_CONDITIONNEMENT = { ...COMPLET, packaging: null };

function produit(extra: Partial<ProduitActuel> = {}): ProduitActuel {
  return {
    id: "p1", canonicalName: nomCanonique(SANS_CONDITIONNEMENT), identityKey: `${PREFIXE_CLE_DOSSIER}d1`,
    dci: "RALTEGRAVIR", dosage: "400", dosageUnit: "MG", form: "COMPRIME_PELLICULE", packaging: null,
    autresDossiers: 0, ...extra,
  };
}

describe("la clé du produit d'un dossier", () => {
  it("identité INCOMPLÈTE : une clé dérivée du seul dossier — deux dossiers incomplets ne se confondent jamais", () => {
    const a = cleProduitDuDossier("d1", SANS_CONDITIONNEMENT, null);
    const b = cleProduitDuDossier("d2", SANS_CONDITIONNEMENT, null);
    expect(a).toBe(`${PREFIXE_CLE_DOSSIER}d1`);
    expect(b).toBe(`${PREFIXE_CLE_DOSSIER}d2`);
    expect(a).not.toBe(b);
    // Même sans DCI, le dossier a sa clé.
    expect(cleProduitDuDossier("d3", { dci: "" }, null)).toBe(`${PREFIXE_CLE_DOSSIER}d3`);
  });

  it("identité COMPLÈTE et libre : la clé d'identité", () => {
    expect(cleProduitDuDossier("d1", COMPLET, null)).toBe(identityKey(COMPLET));
  });

  it("identité COMPLÈTE déjà portée par le produit d'un AUTRE dossier : suffixée — pas de fusion", () => {
    expect(cleProduitDuDossier("d2", COMPLET, "pAutre")).toBe(`${identityKey(COMPLET)}#d2`);
  });

  it("le produit du dossier garde la clé qu'il porte déjà", () => {
    expect(cleProduitDuDossier("d1", COMPLET, "p1", "p1")).toBe(identityKey(COMPLET));
  });
});

describe("le plan : un dossier, un produit", () => {
  it("un dossier sans produit en reçoit UN, même incomplet — jamais celui d'un autre", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: SANS_CONDITIONNEMENT },
      produit: null, porteurDeLaCle: null,
    });
    expect(plan.action).toBe("CREER");
    if (plan.action !== "CREER") return;
    expect(plan.cle).toBe(`${PREFIXE_CLE_DOSSIER}d1`);
    expect(plan.nom).toBe(nomCanonique(SANS_CONDITIONNEMENT));
  });

  it("deux dossiers COMPLETS de même identité : le second crée le sien (clé suffixée), il ne rejoint pas le premier", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d2", reference: "REG-2026-002", identite: COMPLET },
      produit: null, porteurDeLaCle: "p1",
    });
    expect(plan.action).toBe("CREER");
    if (plan.action !== "CREER") return;
    expect(plan.cle).toBe(`${identityKey(COMPLET)}#d2`);
  });

  it("l'identité qui se COMPLÈTE met à jour le MÊME produit — identité, clé et nom automatique", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: COMPLET },
      produit: produit(), porteurDeLaCle: null,
    });
    expect(plan.action).toBe("METTRE_A_JOUR");
    if (plan.action !== "METTRE_A_JOUR") return;
    expect(plan.produitId).toBe("p1");
    expect(plan.changements.packaging).toBe("B/60");
    expect(plan.changements.identityKey).toBe(identityKey(COMPLET));
    expect(plan.changements.canonicalName).toContain("B/60");
  });

  it("un nom choisi par une personne n'est pas écrasé", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: COMPLET },
      produit: produit({ canonicalName: "Isentress" }), porteurDeLaCle: null,
    });
    expect(plan.action).toBe("METTRE_A_JOUR");
    if (plan.action !== "METTRE_A_JOUR") return;
    expect(plan.changements.canonicalName).toBeUndefined();
  });

  it("un champ VIDÉ sur le dossier ne vide pas le produit", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: SANS_CONDITIONNEMENT },
      produit: produit({ packaging: "B/60", identityKey: identityKey(COMPLET), canonicalName: nomCanonique(COMPLET) }),
      porteurDeLaCle: "p1",
    });
    expect(plan).toEqual({ action: "DEJA", produitId: "p1" });
  });

  it("rien n'a changé : DEJA, rien à écrire", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: SANS_CONDITIONNEMENT },
      produit: produit(), porteurDeLaCle: null,
    });
    expect(plan).toEqual({ action: "DEJA", produitId: "p1" });
  });

  it("identité complétée mais déjà portée par un autre produit : MÊME produit, clé suffixée", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: COMPLET },
      produit: produit(), porteurDeLaCle: "pAutre",
    });
    expect(plan.action).toBe("METTRE_A_JOUR");
    if (plan.action !== "METTRE_A_JOUR") return;
    expect(plan.produitId).toBe("p1");
    expect(plan.changements.identityKey).toBe(`${identityKey(COMPLET)}#d1`);
  });

  it("produit PARTAGÉ par plusieurs dossiers (ancien catalogue), même identité : on ne scinde rien d'office", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: COMPLET },
      produit: produit({ packaging: "B/60", identityKey: identityKey(COMPLET), autresDossiers: 1 }), porteurDeLaCle: "p1",
    });
    expect(plan).toEqual({ action: "PARTAGE", produitId: "p1", autresDossiers: 1 });
  });

  it("produit PARTAGÉ, et CE dossier s'en écarte : il reçoit son propre produit, l'autre garde le sien", () => {
    const plan = planProduitDuDossier({
      dossier: { id: "d1", reference: "REG-2026-001", identite: { ...COMPLET, packaging: "B/30" } },
      produit: produit({ packaging: "B/60", identityKey: identityKey(COMPLET), autresDossiers: 1 }), porteurDeLaCle: null,
    });
    expect(plan.action).toBe("SEPARER");
    if (plan.action !== "SEPARER") return;
    expect(plan.ancienProduitId).toBe("p1");
    expect(plan.identite.packaging).toBe("B/30");
  });
});

describe("l'identité retenue et l'indication de la fiche", () => {
  it("le dossier l'emporte ; là où il se tait, le produit garde ce qu'il savait", () => {
    expect(identiteFusionnee({ dci: "X", dosage: "", packaging: "B/10" }, { dci: "X", dosage: "5", dosageUnit: "MG", form: null, packaging: "B/20" }))
      .toEqual({ dci: "X", dosage: "5", dosageUnit: "MG", form: null, packaging: "B/10" });
  });

  it("« Conditionnement à compléter » — et rien quand l'identité est complète", () => {
    expect(titreACompleter(["CONDITIONNEMENT"])).toBe("Conditionnement à compléter");
    expect(titreACompleter(["DOSAGE", "FORME", "CONDITIONNEMENT"])).toBe("Dosage, forme et conditionnement à compléter");
    expect(titreACompleter([])).toBeNull();
  });

  it("la phrase de création ne parle jamais de « produit canonique »", () => {
    const p = phraseProduitDuDossier({ etat: "CREE", code: "PRD-2026-070", manques: ["CONDITIONNEMENT"] });
    expect(p).toBe("Produit PRD-2026-070 créé. Conditionnement à compléter sur le dossier.");
    expect(phraseProduitDuDossier({ etat: "DEJA", code: "PRD-2026-070", manques: [] })).toBeNull();
  });
});
