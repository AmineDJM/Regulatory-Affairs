import { describe, expect, it } from "vitest";
import {
  motifDEngagement, refusSuppressionFichiers, refusSuppressionPiece, type FaitsPieceASupprimer,
} from "./suppression-piece";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI INTERDIT DE SUPPRIMER UNE PIÈCE LEGAL, OU SES FICHIERS (§118.209) — la décision pure.
 *
 * « On doit pouvoir supprimer les documents dans les demandes Ad & Pro » (Direction, 05/10) — mais
 * jamais ce qui a engagé la société ou quitté l'ERP. Chaque refus NOMME le geste qui reste : un refus
 * qui ne dit pas quoi faire fait chercher une panne qui n'existe pas.
 *
 * Les deux questions ne se confondent pas : les FICHIERS ne se ferment que sur l'ENGAGEMENT ; la PIÈCE se
 * ferme aussi quand une autre en découle, qu'un poste la porte, qu'un renouvellement la cite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const libre = (over: Partial<FaitsPieceASupprimer> = {}): FaitsPieceASupprimer => ({
  titre: "Devis Parkmall", reference: "DEV-2026-004", kind: "QUOTE",
  signee: false, reglee: false, ordre: null, aval: [], renouvelePar: null, postes: [], valideParLeCentre: null, receptionsAuStock: 0,
  ...over,
});

describe("une pièce libre se supprime — rien ne l'engage, rien n'en découle", () => {
  it("ni la pièce ni ses fichiers ne sont refusés", () => {
    expect(refusSuppressionPiece(libre())).toBeNull();
    expect(refusSuppressionFichiers(libre())).toBeNull();
    expect(motifDEngagement(libre())).toBeNull();
  });

  it("un ordre de dépense ANNULÉ n'est pas un engagement : la facture dont l'ordre a été retiré se supprime", () => {
    const f = libre({ kind: "INVOICE", ordre: { reference: "OD-2026-009", statut: "CANCELLED" } });
    expect(refusSuppressionPiece(f)).toBeNull();
    expect(refusSuppressionFichiers(f)).toBeNull();
  });
});

describe("ce qui ENGAGE la pièce la ferme — et ferme aussi ses fichiers", () => {
  const engagees: [string, Partial<FaitsPieceASupprimer>, RegExp][] = [
    ["signée", { kind: "PURCHASE_ORDER", signee: true }, /est signé : il a engagé la société/],
    ["facture réglée", { kind: "INVOICE", reglee: true }, /est réglée : la pièce est la justification/],
    ["ordre de dépense payé", { kind: "INVOICE", ordre: { reference: "OD-2026-009", statut: "PAID" } }, /ordre de dépense OD-2026-009 a été payé/],
    ["partie au règlement", { kind: "INVOICE", ordre: { reference: "OD-2026-010", statut: "PENDING" } }, /est partie au règlement .*OD-2026-010/],
    ["BC validé par le centre", { kind: "PURCHASE_ORDER", valideParLeCentre: "centre de validation Ad & Pro" }, /a été validé par le centre de validation Ad & Pro/],
  ];

  it.each(engagees)("%s : la pièce ET ses fichiers sont refusés, avec le geste qui reste", (_nom, over, motif) => {
    const f = libre(over);
    const piece = refusSuppressionPiece(f);
    const fichiers = refusSuppressionFichiers(f);
    expect(piece).toMatch(motif);
    expect(fichiers).toMatch(motif);
    expect(fichiers).toContain("ne se suppriment pas d'ici");
    // Le remède est NOMMÉ : annuler (motif à l'appui) ou corriger par un avoir — jamais « impossible » tout court.
    expect(piece).toMatch(/Annule|avoir/);
  });

  it("le remède dépend de ce qui engage : l'argent parti se corrige par un avoir, un ordre ouvert se retire en annulant", () => {
    expect(refusSuppressionPiece(libre({ kind: "INVOICE", reglee: true }))).toContain("avoir");
    expect(refusSuppressionPiece(libre({ kind: "INVOICE", ordre: { reference: null, statut: "PENDING" } }))).toMatch(/l'annulation retire l'ordre non réglé/);
    expect(refusSuppressionPiece(libre({ kind: "PURCHASE_ORDER", signee: true }))).toMatch(/Annulez-le plutôt, motif à l'appui/);
  });

  it("l'accord suit la nature : « signé » pour un bon de commande, « signée » pour une facture", () => {
    expect(refusSuppressionPiece(libre({ kind: "PURCHASE_ORDER", signee: true }))).toContain("est signé :");
    expect(refusSuppressionPiece(libre({ kind: "INVOICE", signee: true }))).toContain("est signée :");
  });
});

describe("les FICHIERS sont plus étroits que la pièce — seul l'engagement les ferme", () => {
  it("le devis dont un BC découle : la pièce est refusée (la chaîne), son PDF mal scanné se remplace", () => {
    const f = libre({ aval: [{ kind: "PURCHASE_ORDER", titre: "BC Parkmall", reference: "032/DG/2026", annulee: false }] });
    expect(refusSuppressionPiece(f)).toMatch(/est la base d'une autre pièce/);
    expect(refusSuppressionFichiers(f), "un fichier de devis se retire même quand un BC en découle").toBeNull();
  });

  it("une pièce portée par un poste : la pièce se retire depuis la carte du poste, ses fichiers restent à la personne", () => {
    const f = libre({ postes: ["Imprimerie"] });
    expect(refusSuppressionPiece(f)).toMatch(/rattaché au poste « Imprimerie » : une pièce de poste se retire depuis la carte de son poste/);
    expect(refusSuppressionFichiers(f)).toBeNull();
  });
});

describe("ce qui LIE la pièce à une autre — la chaîne devis → bon de commande → facture ne se coupe pas par le milieu", () => {
  it("l'aval est NOMMÉ, compté, et le geste dit par où commencer", () => {
    const f = libre({
      aval: [
        { kind: "PURCHASE_ORDER", titre: "BC", reference: "032/DG/2026", annulee: false },
        { kind: "PURCHASE_ORDER", titre: "BC bis", reference: "033/DG/2026", annulee: true },
      ],
    });
    const r = refusSuppressionPiece(f)!;
    expect(r).toContain("est la base de 2 autres pièces");
    expect(r).toContain("032/DG/2026");
    expect(r).toContain("033/DG/2026 (annulé)");
    expect(r).toContain("en partant de la fin de la chaîne");
  });

  it("plus de trois pièces en aval : trois nommées, le reste COMPTÉ (une liste raccourcie qui se tait se lit complète)", () => {
    const aval = [1, 2, 3, 4, 5].map((n) => ({ kind: "INVOICE", titre: `F${n}`, reference: `FA-${n}`, annulee: false }));
    const r = refusSuppressionPiece(libre({ kind: "PURCHASE_ORDER", aval }))!;
    expect(r).toContain("FA-1, FA-2, FA-3 et 2 autres");
    expect(r).not.toContain("FA-4");
  });

  it("l'engagement passe AVANT l'aval : un BC signé dont une facture découle dit d'abord qu'il est signé", () => {
    const f = libre({ kind: "PURCHASE_ORDER", signee: true, aval: [{ kind: "INVOICE", titre: "F", reference: "FA-1", annulee: false }] });
    expect(refusSuppressionPiece(f)).toContain("est signé");
  });

  it("du matériel entré au magasin sur une facture promotionnelle : la réception d'abord", () => {
    const r = refusSuppressionPiece(libre({ kind: "INVOICE", receptionsAuStock: 2 }))!;
    expect(r).toContain("2 lignes reçues");
    expect(r).toContain("Annulez d'abord la réception");
  });

  it("une pièce renouvelée : le renouvellement d'abord (le lien vers elle interdit de l'effacer)", () => {
    expect(refusSuppressionPiece(libre({ kind: "QUOTE", renouvelePar: "Devis Parkmall 2027" }))).toMatch(/a été renouvelé par « Devis Parkmall 2027 »/);
  });

  it("une pièce sans numéro se nomme par son titre", () => {
    expect(refusSuppressionPiece(libre({ reference: null, signee: true }))).toContain("« Devis Parkmall »");
  });
});
