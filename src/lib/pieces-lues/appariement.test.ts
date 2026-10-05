import { describe, expect, it } from "vitest";
import { apparierLignes, type LigneAttendue } from "@/lib/pieces-lues/appariement";

const lue = (designation: string, quantite: number | null, prixUnitaire: number | null) => ({ designation, quantite, prixUnitaire });
const att = (id: string, designation: string, quantite: number, prixUnitaire: number): LigneAttendue => ({ id, designation, quantite, prixUnitaire });

/** Les lignes du bon de commande de référence 012/DG/2026 (§118.135) : trois campagnes, les mêmes articles. */
const BC: LigneAttendue[] = [
  att("c1", "Conception ADV", 1, 145_000),
  att("f1", "Fiche posologique", 500, 225), att("b1", "Banner", 3, 33_000),
  att("f2", "Fiche posologique", 500, 225), att("b2", "Banner", 3, 33_000),
  att("f3", "Fiche posologique", 500, 225), att("b3", "Banner", 3, 33_000),
];

describe("apparierLignes — les lignes lues aux lignes attendues, sans jamais choisir à égalité", () => {
  it("la même désignation au même prix, sans rivale : CERTAINE", () => {
    const r = apparierLignes([lue("BANNER", 3, 33_000), lue("Conception ADV", 1, 145_000)], [att("x", "Banner", 3, 33_000), att("c", "Conception ADV", 1, 145_000), att("y", "Kakémono", 2, 9_000)]);
    expect(r.lignes.map((p) => [p.statut, p.attendueId])).toEqual([["CERTAINE", "x"], ["CERTAINE", "c"]]);
    expect(r.attenduesLibres).toEqual(["y"]);
  });

  it("une abréviation (« Fiche POSO ») au même prix : PROBABLE — elle ressemble, elle n'est pas identique", () => {
    const r = apparierLignes([lue("Fiche POSO Nivolex", 500, 225)], [att("f", "Fiche posologique Nivolex", 500, 225)]);
    expect(r.lignes[0]).toMatchObject({ statut: "PROBABLE", attendueId: "f" });
  });

  it("Homonymes à égalité : aucun choix — les trois « Fiche posologique » du BC de référence", () => {
    const r = apparierLignes([lue("Fiche posologique", 500, 225)], BC);
    expect(r.lignes[0]).toMatchObject({ statut: "AMBIGUE", attendueId: null, candidats: ["f1", "f2", "f3"] });
    expect(r.lignes[0].phrase).toMatch(/correspond à égalité à 3 lignes.*rien n'est choisi/);
    expect(r.attenduesLibres).toEqual(["c1", "f1", "b1", "f2", "b2", "f3", "b3"]);
    // La facture qui reprend les trois campagnes : rien n'est choisi, ligne par ligne.
    const toutes = apparierLignes([lue("Fiche posologique", 500, 225), lue("Banner", 3, 33_000), lue("Fiche posologique", 500, 225)], BC);
    expect(toutes.lignes.map((p) => p.statut)).toEqual(["AMBIGUE", "AMBIGUE", "AMBIGUE"]);
    expect(toutes.lignes.every((p) => p.attendueId === null)).toBe(true);
  });

  it("une ligne attendue disputée à égalité n'est donnée à PERSONNE ensuite — pas même à un candidat plus faible", () => {
    const r = apparierLignes([lue("Banner", 3, 33_000), lue("Banner", 3, 33_000), lue("Banner roll-up", 1, 12_000)], [att("x", "Banner", 3, 33_000)]);
    expect(r.lignes.map((p) => p.statut)).toEqual(["AMBIGUE", "AMBIGUE", "AMBIGUE"]);
    expect(r.lignes[2].candidats).toEqual(["x"]);
    expect(r.attenduesLibres).toEqual(["x"]);
  });

  it("une ligne sans correspondante est HORS — jamais reportée d'office sur une autre ; le prix seul ne suffit pas", () => {
    const r = apparierLignes([lue("Frais de livraison", 1, 5_000), lue("Transport", 500, 225)], BC);
    expect(r.lignes.map((p) => p.statut)).toEqual(["HORS", "HORS"]);
    expect(r.lignes[0].phrase).toMatch(/jamais reportée d'office/);
    expect(r.attenduesLibres).toHaveLength(BC.length);
  });

  it("à désignation et prix égaux, la quantité départage — mais la paire reste PROBABLE (une rivale porte la même évidence)", () => {
    const r = apparierLignes([lue("Banner", 5, 33_000)], [att("b3", "Banner", 3, 33_000), att("b5", "Banner", 5, 33_000)]);
    expect(r.lignes[0]).toMatchObject({ statut: "PROBABLE", attendueId: "b5" });
  });

  it("un à un : chaque ligne attendue ne sert qu'une fois, la plus sûre l'emporte et l'autre sort", () => {
    const r = apparierLignes(
      [lue("Fiche posologique A4", 500, 225), lue("Fiche posologique A5", 500, 180)],
      [att("p", "Fiche posologique A4", 500, 225), att("q", "Fiche posologique A5", 500, 180)],
    );
    expect(r.lignes.map((p) => [p.statut, p.attendueId])).toEqual([["CERTAINE", "p"], ["CERTAINE", "q"]]);
    // Deux lignes lues, une seule attendue : la plus ressemblante la prend, l'autre est HORS (sa seule candidate est prise).
    const deux = apparierLignes([lue("Fiche posologique A4", 500, 225), lue("Fiche posologique", 250, 225)], [att("p", "Fiche posologique A4", 500, 225)]);
    expect(deux.lignes.map((p) => [p.statut, p.attendueId])).toEqual([["CERTAINE", "p"], ["HORS", null]]);
  });

  it("une ligne au prix illisible s'apparie sur sa seule désignation — PROBABLE au mieux", () => {
    const r = apparierLignes([lue("Fiche posologique", 500, null)], [att("f", "Fiche posologique", 500, 225), att("b", "Banner", 3, 33_000)]);
    expect(r.lignes[0]).toMatchObject({ statut: "PROBABLE", attendueId: "f" });
  });
});
