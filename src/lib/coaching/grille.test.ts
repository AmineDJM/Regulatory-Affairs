import { describe, expect, it } from "vitest";
import {
  bilanDesNotes, cleLibre, cleProvisoire, GRILLE_PAR_DEFAUT, grillesIdentiques, LIMITES_GRILLE, lireNotes, ligneEchelle, notesRefusees,
  refusFinalisation, validerGrille, type GrilleCoaching,
} from "./grille";
import { formaterJour, jourAlger, lireJour } from "./dates";

/**
 * LA GRILLE DE COACHING — le module pur (§118.157).
 *
 * L'ancre de ce banc est le CLASSEUR fourni par la Direction (« Fiche_Coaching.xlsx ») : ses cinq
 * axes, ses quatre niveaux, et l'exemple qu'il porte — MA, MA, MA, MP, MP — dont la cellule D16
 * (`=D18+D22+D26+D30+D34`) vaut 13. Si la grille d'origine ou le calcul du total s'écartent du
 * classeur, c'est ici qu'on l'apprend.
 */

const EXEMPLE_DU_CLASSEUR = { A: 3, B: 3, C: 3, D: 2, E: 2 } as const;

describe("la grille d'origine est celle du classeur de la Direction", () => {
  it("se valide, et porte les cinq axes, les quatre niveaux et le bilan du classeur", () => {
    const r = validerGrille(GRILLE_PAR_DEFAUT);
    expect(r.ok, r.ok ? "" : r.erreurs.join(" | ")).toBe(true);
    expect(GRILLE_PAR_DEFAUT.titre).toBe("FICHE DE COACHING – TOURNÉE EN DOUBLE");
    expect(GRILLE_PAR_DEFAUT.niveaux.map((n) => n.code)).toEqual(["MB", "MP", "MA", "PM"]);
    expect(GRILLE_PAR_DEFAUT.axes.map((a) => a.titre)).toEqual([
      "A. Préparation de la visite",
      "B. Conduite de la visite",
      "C. Écoute Active & Temps de Parole (70/30)",
      "D. Gestion des Objections",
      "E. Conclusion & Engagement",
    ]);
    for (const axe of GRILLE_PAR_DEFAUT.axes) expect(axe.criteres).toHaveLength(4);
    // Le classeur rangeait la ligne MB de l'axe C APRÈS ses voisines dans ses chaînes partagées ;
    // à l'écran elle est bien la première — c'est l'ordre des NIVEAUX qui compte, pas l'ordre de saisie.
    expect(GRILLE_PAR_DEFAUT.axes[2]!.criteres[0]).toBe("Écoute passive/interruption, n'écoute que pour répondre");
    expect(GRILLE_PAR_DEFAUT.bilan).toEqual({
      titre: "Bilan & Plan d'Action",
      pointsForts: "1. Points Forts Observés :",
      // Le classeur écrivait « Points à Améliorer : : » — la seule retouche, et elle est voulue.
      pointsAAmeliorer: "2. Points à Améliorer :",
    });
  });

  it("l'exemple du classeur fait 13 / 20 — la valeur de sa cellule D16", () => {
    const b = bilanDesNotes(GRILLE_PAR_DEFAUT, { ...EXEMPLE_DU_CLASSEUR });
    expect(b.total).toBe(13);
    expect(b.max).toBe(20);
    expect(b.complet).toBe(true);
    expect(b.notes.map((n) => n.niveau.code)).toEqual(["MA", "MA", "MA", "MP", "MP"]);
  });

  it("la légende de l'échelle se lit comme dans le classeur", () => {
    expect(ligneEchelle(GRILLE_PAR_DEFAUT.niveaux[0]!, 1)).toBe("MB = Maîtrise Basique (Insuffisant / À développer) : 1");
    expect(ligneEchelle(GRILLE_PAR_DEFAUT.niveaux[3]!, 4)).toBe("PM = Parfaite Maîtrise (Exemplaire / Stratégique) : 4");
  });
});

describe("la validation rend TOUTES les erreurs en une fois (§118.18)", () => {
  const copie = (): GrilleCoaching => structuredClone(GRILLE_PAR_DEFAUT);

  it("trois fautes, trois erreurs — pas une par aller-retour", () => {
    const g = copie();
    g.titre = " ";
    g.axes[1]!.criteres[2] = "";
    g.niveaux[1]!.code = "MB"; // doublon du niveau 1
    const r = validerGrille(g);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.some((e) => /titre de la fiche est vide/.test(e))).toBe(true);
    expect(r.erreurs.some((e) => /« B\. Conduite de la visite ».*niveau MA est vide/.test(e))).toBe(true);
    expect(r.erreurs.some((e) => /code « MB » est déjà pris/.test(e))).toBe(true);
  });

  it("le barème reste de quatre niveaux, et chaque axe porte un critère par niveau", () => {
    const g = copie();
    g.niveaux.push({ code: "EX", libelle: "Excellence", qualification: "" });
    g.axes[0]!.criteres.pop();
    const r = validerGrille(g);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.some((e) => /4 niveaux/.test(e))).toBe(true);
    expect(r.erreurs.some((e) => /4 critères attendus/.test(e))).toBe(true);
  });

  it("douze axes au plus, des clés uniques et lisibles, aucun axe = refus", () => {
    const g = copie();
    g.axes = Array.from({ length: LIMITES_GRILLE.axesMax + 1 }, (_, i) => ({ ...g.axes[0]!, cle: `K${i}` }));
    expect(validerGrille(g).ok).toBe(false);
    const doublon = copie();
    doublon.axes[1]!.cle = "A";
    const r = validerGrille(doublon);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.some((e) => /clé technique en double/.test(e))).toBe(true);
    const illisible = copie();
    illisible.axes[0]!.cle = "a b";
    expect(validerGrille(illisible).ok).toBe(false);
    const vide = copie();
    vide.axes = [];
    expect(validerGrille(vide).ok).toBe(false);
  });

  it("normalise les espaces : deux grilles qui ne diffèrent que d'une espace ne font pas deux versions", () => {
    const g = copie();
    g.axes[0]!.titre = "  A.   Préparation de la visite ";
    const r = validerGrille(g);
    expect(r.ok).toBe(true);
    if (r.ok) expect(grillesIdentiques(r.grille, GRILLE_PAR_DEFAUT)).toBe(true);
    const autre = copie();
    autre.axes[0]!.titre = "A. Préparation";
    const r2 = validerGrille(autre);
    if (r2.ok) expect(grillesIdentiques(r2.grille, GRILLE_PAR_DEFAUT)).toBe(false);
  });
});

describe("les notes se lisent contre LA grille de la fiche", () => {
  it("un axe inconnu ou une note hors barème est écarté, jamais arrondi ; un axe absent n'est pas zéro", () => {
    const notes = lireNotes({ A: 3, B: "2", C: 5, D: 0, Z: 4, E: null }, GRILLE_PAR_DEFAUT);
    expect(notes).toEqual({ A: 3, B: 2 });
    const b = bilanDesNotes(GRILLE_PAR_DEFAUT, notes);
    expect(b.total).toBe(5);
    expect(b.complet).toBe(false);
    expect(b.manquants.map((a) => a.cle)).toEqual(["C", "D", "E"]);
  });

  it("l'action REFUSE ce que la lecture écarterait — une saisie faussée se voit, elle ne se perd pas", () => {
    expect(notesRefusees({ A: 3, E: null, D: "" }, GRILLE_PAR_DEFAUT)).toEqual([]);
    const refus = notesRefusees({ A: 7, Z: 2 }, GRILLE_PAR_DEFAUT);
    expect(refus).toHaveLength(2);
    expect(refus.join(" ")).toMatch(/hors barème.*Préparation/);
    expect(refus.join(" ")).toMatch(/axe inconnu.*« Z »/);
    expect(notesRefusees([3, 3], GRILLE_PAR_DEFAUT)).toHaveLength(1);
  });

  it("le maximum se lit sur la grille : six axes se notent sur 24", () => {
    const g = structuredClone(GRILLE_PAR_DEFAUT);
    g.axes.push({ ...g.axes[0]!, cle: "F", titre: "F. Suivi" });
    expect(bilanDesNotes(g, {}).max).toBe(24);
  });

  it("le refus de finalisation NOMME les axes manquants", () => {
    const b = bilanDesNotes(GRILLE_PAR_DEFAUT, { A: 3, B: 3, C: 3 });
    const refus = refusFinalisation(b);
    expect(refus).toMatch(/« D\. Gestion des Objections », « E\. Conclusion & Engagement »/);
    expect(refusFinalisation(bilanDesNotes(GRILLE_PAR_DEFAUT, { ...EXEMPLE_DU_CLASSEUR }))).toBeNull();
  });
});

describe("clés d'axe et dates", () => {
  it("une clé neuve est la première lettre libre, puis AX1, AX2…", () => {
    expect(cleLibre(["A", "B", "C", "D", "E"])).toBe("F");
    expect(cleLibre(["A", "C"])).toBe("B");
    const toutes = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    expect(cleLibre(toutes)).toBe("AX1");
    expect(cleLibre([...toutes, "AX1"])).toBe("AX2");
  });

  it("la clé PROVISOIRE d'un axe ajouté ne coïncide jamais avec un axe de la grille — même après en avoir retiré un", () => {
    // Le défaut trouvé par le banc : retirer E puis ajouter un axe rendait « E », lu comme une
    // modification de l'axe E par le serveur.
    const apresRetrait = GRILLE_PAR_DEFAUT.axes.slice(0, 4).map((a) => a.cle);
    const provisoire = cleProvisoire(apresRetrait);
    expect(provisoire).toBe("nouveau_1");
    expect(GRILLE_PAR_DEFAUT.axes.map((a) => a.cle)).not.toContain(provisoire);
    expect(cleProvisoire([...apresRetrait, "nouveau_1"])).toBe("nouveau_2");
    expect(validerGrille({ ...GRILLE_PAR_DEFAUT, axes: [...GRILLE_PAR_DEFAUT.axes.slice(0, 4), { ...GRILLE_PAR_DEFAUT.axes[4]!, cle: provisoire }] }).ok,
      "la clé provisoire est une clé lisible — l'action la reçoit sans la refuser").toBe(true);
  });

  it("un jour se lit strictement, et s'affiche sans décalage de fuseau", () => {
    expect(lireJour("2026-02-31")).toBeNull();
    expect(lireJour("12/09/2026")).toBeNull();
    const d = lireJour("2026-09-12")!;
    expect(d.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(formaterJour(d)).toBe("12/09/2026");
    // Minuit et une à Alger, c'est encore la veille à UTC : « aujourd'hui » se lit à Alger.
    expect(jourAlger(new Date("2026-09-11T23:30:00Z"))).toBe("2026-09-12");
  });
});
