import { describe, it, expect } from "vitest";
import {
  dciKey, sameDci, hasDuplicate, needsAccessRequest, dossierLabel, duplicateNotice,
  type DciDuplicate, type ExistingDossier,
} from "./dci-duplicate";

const doss = (o: Partial<ExistingDossier> & { reference: string }): ExistingDossier => ({
  id: o.reference, brandName: null, dosage: null, pharmaceuticalForm: null, ...o,
});

describe("la clé de comparaison d'une DCI", () => {
  it("ignore la casse, les espaces et les accents — le référentiel se saisit à la main", () => {
    expect(dciKey("  paracétamol ")).toBe("PARACETAMOL");
    expect(sameDci("PARACÉTAMOL", "paracetamol")).toBe(true);
  });

  // Les traiter comme deux DCI différentes laisserait passer exactement le doublon cherché.
  it("UNE ASSOCIATION EST LA MÊME DANS LES DEUX SENS", () => {
    expect(sameDci("AMOXICILLINE + ACIDE CLAVULANIQUE", "ACIDE CLAVULANIQUE + AMOXICILLINE")).toBe(true);
    expect(dciKey("B+A")).toBe("A + B");
  });

  it("mais deux molécules différentes restent différentes", () => {
    expect(sameDci("AMOXICILLINE", "AMPICILLINE")).toBe(false);
    expect(sameDci("A + B", "A + C")).toBe(false);
  });
});

describe("ce qu'on dit à celui qui saisit", () => {
  it("RIEN quand la DCI est neuve — un avertissement sur tout ne se lit plus", () => {
    const vide: DciDuplicate = { visible: [], hidden: 0 };
    expect(hasDuplicate(vide)).toBe(false);
    expect(duplicateNotice("AMOXICILLINE", vide)).toBeNull();
  });

  it("LE DOSSIER EXISTANT EST NOMMÉ — on ne demande pas de vérifier l'invérifiable", () => {
    const d: DciDuplicate = {
      visible: [doss({ reference: "REG-2026-014", brandName: "Amoxil", dosage: "500 mg", pharmaceuticalForm: "Gélule" })],
      hidden: 0,
    };
    const msg = duplicateNotice("AMOXICILLINE", d)!;
    expect(msg).toContain("Un dossier porte déjà");
    expect(msg).toContain("REG-2026-014");
    expect(msg).toContain("500 mg");
    // C'est la consigne exacte : on avertit, on ne refuse pas.
    expect(msg).toMatch(/dosage.+forme.+différent/);
    expect(needsAccessRequest(d)).toBe(false);
  });

  it("CE QU'ON NE VOIT PAS SE COMPTE, ET LE GESTE QUI DÉBLOQUE EST NOMMÉ", () => {
    // Dire « cette DCI existe » sans rien montrer serait une énigme : on chercherait à l'écran
    // un dossier invisible, et l'on conclurait à une panne.
    const d: DciDuplicate = { visible: [], hidden: 1 };
    const msg = duplicateNotice("METFORMINE", d)!;
    expect(msg).toContain("ne vous est pas visible");
    expect(msg).toMatch(/demandez l'accès/);
    expect(needsAccessRequest(d)).toBe(true);
  });

  it("visible ET invisible : le compte total est juste, et les deux se disent", () => {
    const d: DciDuplicate = { visible: [doss({ reference: "REG-2026-001" })], hidden: 2 };
    const msg = duplicateNotice("IBUPROFÈNE", d)!;
    expect(msg).toContain("3 dossiers portent déjà");
    expect(msg).toContain("REG-2026-001");
    expect(msg).toContain("2 de ces dossiers ne vous sont pas visibles");
  });

  it("le nom d'un dossier se réduit à sa référence quand il n'a rien d'autre", () => {
    expect(dossierLabel(doss({ reference: "REG-2026-009" }))).toBe("REG-2026-009");
  });
});
