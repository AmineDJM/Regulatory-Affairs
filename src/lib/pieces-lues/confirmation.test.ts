import { describe, expect, it } from "vitest";
import {
  phraseAuditConfirmation, refusDeConfirmation, verdictsDeConfirmation, type LigneProposee, type LigneSoumise,
} from "./confirmation";

/**
 * LA CONFIRMATION D'UNE PIÈCE LUE — le verdict de chaque ligne, et ce qu'elle exige (lot D2-D, P7).
 * Ce qui ferait tomber ces cas : une comparaison au flottant brut (0,1 + 0,2 « corrigé » en 0,30), une
 * ligne lue non cochée qui passe, une case de total ignorée, un rang forgé accepté, une ligne retirée
 * qui disparaît du verdict au lieu d'être ÉCARTÉE.
 */

const P = (rang: number, designation: string, quantite: number | null, prixUnitaire: number | null): LigneProposee =>
  ({ rang, designation, quantite, prixUnitaire });
const S = (lue: number | null, designation: string, quantite: number, prixUnitaire: number, verifiee = true): LigneSoumise =>
  ({ lue, verifiee, designation, quantite, prixUnitaire });

const PROPOSEES = [P(1, "Fiche posologique A4", 2000, 45), P(3, "Kakémono 80x200", 4, 12500), P(4, "Présentoir carton", 10, 2500)];

describe("Le verdict de chaque ligne", () => {
  it("confirmée, corrigée, ajoutée, écartée — et les champs corrigés sont nommés", () => {
    const v = verdictsDeConfirmation(PROPOSEES, [
      S(1, "Fiche posologique A4", 2000, 45),
      S(3, "Kakémono 80x200", 4, 11500),
      S(null, "Livraison", 1, 3000),
    ]);
    expect(v.map((x) => [x.verdict, x.rang, x.position])).toEqual([
      ["CONFIRMEE", 1, 1], ["CORRIGEE", 3, 2], ["AJOUTEE", null, 3], ["ECARTEE", 4, null],
    ]);
    expect(v[1]!.champs).toEqual(["prixUnitaire"]);
    expect(v[3]!.soumise).toBeNull();
  });

  it("les prix se comparent AU CENTIME : 0,1 + 0,2 lu contre 0,30 soumis est une ligne CONFIRMÉE, pas corrigée", () => {
    const lu = 0.1 + 0.2;
    expect(lu).not.toBe(0.3); // la prémisse : le flottant brut diffère
    const v = verdictsDeConfirmation([P(1, "Étiquette", 1000, lu)], [S(1, "Étiquette", 1000, 0.3)]);
    expect(v[0]!.verdict).toBe("CONFIRMEE");
    // Témoin : un vrai centime d'écart EST une correction.
    expect(verdictsDeConfirmation([P(1, "Étiquette", 1000, 0.3)], [S(1, "Étiquette", 1000, 0.31)])[0]!.verdict).toBe("CORRIGEE");
  });

  it("les quantités se comparent au millième (la précision de la colonne) : 0,1 + 0,2 contre 0,3 est confirmé, 2,5 contre 2,501 est corrigé", () => {
    const lu = 0.1 + 0.2;
    expect(lu).not.toBe(0.3); // la prémisse : le flottant brut diffère
    expect(verdictsDeConfirmation([P(1, "Rouleau", lu, 10)], [S(1, "Rouleau", 0.3, 10)])[0]!.verdict).toBe("CONFIRMEE");
    // Témoin : un millième d'écart EST une correction — `quantity` est un Decimal(14, 3).
    expect(verdictsDeConfirmation([P(1, "Rouleau", 2.5, 10)], [S(1, "Rouleau", 2.501, 10)])[0]).toMatchObject({ verdict: "CORRIGEE", champs: ["quantite"] });
  });

  it("une valeur NON PROPOSÉE (prix laissé à la personne) puis saisie est une correction, pas une confirmation", () => {
    const v = verdictsDeConfirmation([P(2, "Bâche remisée", 3, null)], [S(2, "Bâche remisée", 3, 900)]);
    expect(v[0]).toMatchObject({ verdict: "CORRIGEE", champs: ["prixUnitaire"] });
  });

  it("les espaces d'une désignation ne font pas une correction ; un mot changé, si", () => {
    expect(verdictsDeConfirmation([P(1, "Fiche  posologique", 1, 1)], [S(1, " Fiche posologique ", 1, 1)])[0]!.verdict).toBe("CONFIRMEE");
    expect(verdictsDeConfirmation([P(1, "Fiche posologique", 1, 1)], [S(1, "Fiche patient", 1, 1)])[0]).toMatchObject({ verdict: "CORRIGEE", champs: ["designation"] });
  });
});

describe("Ce que la confirmation exige", () => {
  it("une ligne GARDÉE et venue de la lecture non cochée : refus qui la nomme — par sa place et sa désignation", () => {
    const r = refusDeConfirmation(PROPOSEES, [S(1, "Fiche posologique A4", 2000, 45), S(3, "Kakémono 80x200", 4, 12500, false)], true);
    expect(r).toContain("cochez « vérifiée »");
    expect(r).toContain("ligne 2 (« Kakémono 80x200 »)");
    expect(r).not.toContain("ligne 1");
    expect(r).toContain("Rien n'a été enregistré");
  });

  it("le total non coché : refus — et dit en même temps qu'une ligne non cochée (§118.18)", () => {
    const r = refusDeConfirmation(PROPOSEES, [S(1, "Fiche posologique A4", 2000, 45, false)], false);
    expect(r).toContain("ligne 1");
    expect(r).toContain("« total vérifié »");
  });

  it("une ligne ÉCARTÉE (retirée du formulaire) et une ligne AJOUTÉE n'exigent aucune case", () => {
    expect(refusDeConfirmation(PROPOSEES, [S(null, "Saisie à la main", 1, 10, false)], true)).toBeNull();
  });

  it("un rang qui n'existe pas, ou désigné deux fois : refusé AVANT de parler de cases (un formulaire forgé ne choisit pas une ligne)", () => {
    const inconnu = refusDeConfirmation(PROPOSEES, [S(2, "Ligne forgée", 1, 1, false)], false);
    expect(inconnu).toContain("une ligne lue qui n'existe pas (rang 2)");
    expect(inconnu).not.toContain("cochez");
    const double = refusDeConfirmation(PROPOSEES, [S(1, "A", 1, 1), S(1, "A bis", 1, 1)], true);
    expect(double).toContain("la même ligne lue deux fois (rang 1)");
  });

  it("tout coché : aucun refus", () => {
    expect(refusDeConfirmation(PROPOSEES, PROPOSEES.map((p) => S(p.rang, p.designation, p.quantite as number, p.prixUnitaire as number)), true)).toBeNull();
  });
});

describe("La phrase d'audit", () => {
  it("dit comment la pièce a été lue, et ce que la personne a fait des lignes", () => {
    const v = verdictsDeConfirmation(PROPOSEES, [S(1, "Fiche posologique A4", 2000, 45), S(3, "Kakémono 80x200", 4, 11500)]);
    const p = phraseAuditConfirmation({ methode: "ocr", confiance: 71.4 }, v);
    expect(p).toContain("lues par OCR (71 %), confirmées une à une");
    expect(p).toContain("1 telle que lue, 1 corrigée, 0 ajoutée, 1 écartée");
    expect(phraseAuditConfirmation({ methode: "texte", confiance: null }, v)).toContain("lues dans le texte du fichier");
  });

  it("sans ligne lue (lecture des lignes coupée) : l'en-tête lu, et les lignes saisies à la main", () => {
    const v = verdictsDeConfirmation([], [S(null, "A", 1, 1), S(null, "B", 1, 1)]);
    expect(phraseAuditConfirmation({ methode: "ocr", confiance: 80 }, v)).toBe("en-tête et totaux lus par OCR (80 %) ; 2 lignes saisies à la main");
  });
});
