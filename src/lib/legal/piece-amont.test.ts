import { describe, expect, it } from "vitest";
import {
  AVAL_QUI_FIGE, NATURES_AMONT, PIECE_AMONT_INTROUVABLE, phrasePieceAmontNonRattachee, pieceDefinitive, refusPieceAmont,
  type TypePieceEmise,
} from "@/lib/legal/piece-emise";
import { NATURE_LEGALE, TYPES_DOCUMENT } from "@/lib/artifact/factory/commercial";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PIÈCE DONT UNE PIÈCE ÉMISE DÉCOULE — la règle pure (audit 360°, lot D1c — F1).
 *
 * La fabrique ne vérifiait que l'existence et la société de la pièce amont : un bon de commande
 * pouvait « suivre » une facture, ou un devis annulé. La table `NATURES_AMONT` est lue par la
 * fabrique (refus) ET par le menu du compositeur : ce qu'on propose est ce qu'on accepte.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const piece = (kind: string, status = "ACTIVE", nom = "DV-2026-0001") => ({ kind, status, nom });

describe("ce qui suit quoi", () => {
  it("un devis ne suit rien ; un BC suit un devis ; une facture suit un devis ou un BC ; un avoir suit sa facture", () => {
    expect(NATURES_AMONT).toEqual({
      DEVIS: [], BON_DE_COMMANDE: ["QUOTE"], FACTURE: ["QUOTE", "PURCHASE_ORDER"], AVOIR: ["INVOICE"],
    });
  });

  it("toute chaîne permise est une chaîne qui FIGE l'amont — sauf l'avoir, dont la facture ne se révise de toute façon pas", () => {
    // Si un BC peut suivre un devis, le devis ne doit plus se réviser sous lui : les deux tables se lisent dans les
    // deux sens, et une divergence laisserait réviser une pièce dont une autre découle (§118.194).
    const typeDeNature = new Map(TYPES_DOCUMENT.map((t) => [NATURE_LEGALE[t] as string, t as TypePieceEmise]));
    for (const type of TYPES_DOCUMENT) {
      for (const nature of NATURES_AMONT[type]) {
        const amont = typeDeNature.get(nature)!;
        expect(amont, nature).toBeDefined();
        if (pieceDefinitive(amont)) continue;
        expect(AVAL_QUI_FIGE[amont], `${type} suit ${amont}`).toContain(NATURE_LEGALE[type]);
      }
    }
  });
});

describe("le refus : la nature d'abord, le statut ensuite", () => {
  it("un devis ne fait suite à aucune pièce", () => {
    expect(refusPieceAmont("DEVIS", piece("QUOTE"))).toBe("Un devis ne fait suite à aucune pièce : retirez la pièce amont.");
  });

  it("un BC qui « suivrait » une facture : la nature est NOMMÉE, et le geste qui corrige", () => {
    const r = refusPieceAmont("BON_DE_COMMANDE", piece("INVOICE", "ACTIVE", "FA-2026-0007"))!;
    expect(r).toBe("Un bon de commande fait suite à un devis : la pièce « FA-2026-0007 » est une facture — choisissez le devis dont il découle, ou aucune pièce.");
  });

  it("la nature se juge AVANT le statut : une facture annulée n'est pas « annulée » pour un BC, elle n'est pas un devis", () => {
    expect(refusPieceAmont("BON_DE_COMMANDE", piece("INVOICE", "CANCELLED"))).toContain("fait suite à un devis");
  });

  it("une pièce annulée ne se suit pas", () => {
    expect(refusPieceAmont("FACTURE", piece("PURCHASE_ORDER", "CANCELLED", "BC-2026-0003"))).toBe(
      "La pièce « BC-2026-0003 » est annulée : une pièce ne fait pas suite à une pièce annulée — choisissez la pièce en vigueur, ou aucune.",
    );
  });

  it("les chaînes justes passent", () => {
    expect(refusPieceAmont("BON_DE_COMMANDE", piece("QUOTE"))).toBeNull();
    expect(refusPieceAmont("FACTURE", piece("QUOTE"))).toBeNull();
    expect(refusPieceAmont("FACTURE", piece("PURCHASE_ORDER", "SIGNED"))).toBeNull();
    expect(refusPieceAmont("AVOIR", piece("INVOICE"))).toBeNull();
  });

  it("une nature inconnue de la phrase n'est pas devinée", () => {
    expect(refusPieceAmont("FACTURE", piece("LEASE"))).toContain("est d'une autre nature");
  });

  it("l'absence et l'illisible ont UNE phrase — c'est celle de l'appelant, pas une nature révélée", () => {
    expect(PIECE_AMONT_INTROUVABLE).toBe("La pièce amont (devis / bon de commande) n'existe plus.");
  });
});

describe("la pièce identique rendue dit la pièce amont qu'elle ne porte pas", () => {
  it("rien de demandé, ou la même : rien à dire", () => {
    expect(phrasePieceAmontNonRattachee("BC-1", null, null)).toBeNull();
    expect(phrasePieceAmontNonRattachee("BC-1", "dv1", "dv1")).toBeNull();
  });
  it("demandée et absente de la pièce rendue : dit, avec le geste qui la rattache", () => {
    expect(phrasePieceAmontNonRattachee("BC-1", null, "dv1")).toBe(
      "La pièce identique BC-1 ne fait suite à aucune pièce : la pièce amont demandée ne lui a pas été rattachée — ouvrez sa fiche, « Modifier » › « Fait suite à ».",
    );
    expect(phrasePieceAmontNonRattachee("BC-1", "dv0", "dv1")).toContain("fait suite à une autre pièce");
  });
});
