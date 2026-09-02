import { describe, it, expect } from "vitest";
import {
  PIECE_KINDS, pieceKindOf, legalKindOfPiece, filesInLegal, PIECE_KIND_LABEL,
  pieceKindOptions, filingNotice, legalTitleFromPiece,
} from "./from-piece";

describe("la nature d'une pièce réclamée", () => {
  it("EST CELLE D'UNE PIÈCE DE DOSSIER DE PAIEMENT — un seul vocabulaire", () => {
    // Deux vocabulaires pour un même objet finissent par ne plus se correspondre.
    expect(PIECE_KINDS).toEqual(["INVOICE", "PURCHASE_ORDER", "QUOTE", "DELIVERY_NOTE", "CONTRACT", "PROOF", "OTHER"]);
    for (const k of PIECE_KINDS) expect(PIECE_KIND_LABEL[k].length).toBeGreaterThan(0);
    expect(pieceKindOptions()).toHaveLength(PIECE_KINDS.length);
  });

  it("une valeur inconnue vaut « Autre » — jamais une nature choisie au hasard", () => {
    expect(pieceKindOf("INVOICE")).toBe("INVOICE");
    expect(pieceKindOf(null)).toBe("OTHER");
    expect(pieceKindOf("FACTURE")).toBe("OTHER");
  });
});

describe("ce qui rejoint le registre des engagements", () => {
  it("FACTURE, BON DE COMMANDE, DEVIS, CONTRAT — et ils gardent leur nature", () => {
    expect(legalKindOfPiece("INVOICE")).toBe("INVOICE");
    expect(legalKindOfPiece("PURCHASE_ORDER")).toBe("PURCHASE_ORDER");
    expect(legalKindOfPiece("QUOTE")).toBe("QUOTE");
    expect(legalKindOfPiece("CONTRACT")).toBe("CONTRACT");
    for (const k of ["INVOICE", "PURCHASE_ORDER", "QUOTE", "CONTRACT"]) expect(filesInLegal(k), k).toBe(true);
  });

  it("ET RIEN D'AUTRE — un bon de livraison n'engage pas, un justificatif appartient au dossier", () => {
    // Les y verser ferait de Legal un second Drive, et le registre perdrait ce qui fait sa
    // valeur : on peut le lire en entier.
    for (const k of ["DELIVERY_NOTE", "PROOF", "OTHER", null, "n'importe quoi"]) {
      expect(legalKindOfPiece(k), String(k)).toBeNull();
      expect(filesInLegal(k), String(k)).toBe(false);
    }
  });
});

describe("ce qu'on annonce à celui qui réclame", () => {
  it("LE CLASSEMENT SE DIT AVANT, pas après — sinon on se demande qui a mis ça dans Legal", () => {
    const n = filingNotice("INVOICE");
    expect(n).toMatch(/Legal/);
    expect(n).toMatch(/facture/i);
    // Et il dit aussi QUI verra la pièce : classer ne doit pas élargir l'exposition en silence.
    expect(n).toMatch(/visible de vous/i);
  });

  it("et rien du tout quand la pièce n'y va pas", () => {
    expect(filingNotice("PROOF")).toBeNull();
    expect(filingNotice(null)).toBeNull();
  });
});

describe("le titre dans le registre", () => {
  it("REPREND CE QU'ON A ÉCRIT EN LA RÉCLAMANT, et la référence du fil", () => {
    expect(legalTitleFromPiece("La facture définitive de l'agence", "PIE-2026-014"))
      .toBe("La facture définitive de l'agence (PIE-2026-014)");
  });

  it("à défaut, la référence seule — jamais un titre technique vide de sens", () => {
    expect(legalTitleFromPiece("   ", "PIE-2026-014")).toBe("PIE-2026-014");
  });
});
