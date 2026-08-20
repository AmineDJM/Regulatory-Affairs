import { describe, it, expect } from "vitest";
import {
  cleanLines, estimatedTotal, summarize, seesBudget, purchaseStage, canWithdraw,
  STAGE_LABEL, STAGE_TONE, type PurchaseLine,
} from "./purchase-request";

const line = (p: Partial<PurchaseLine>): PurchaseLine => ({
  articleId: null, label: "Cartouches", quantity: 1, unitPrice: null, ...p,
});

describe("cleanLines — on jette le bruit, on ne l'enregistre pas", () => {
  it("écarte les lignes sans libellé", () => {
    expect(cleanLines([line({ label: "  " }), line({ label: "Ramettes" })])).toHaveLength(1);
  });

  it("ramène une quantité absurde à 1 plutôt que de refuser la demande", () => {
    expect(cleanLines([line({ quantity: 0 })])[0].quantity).toBe(1);
    expect(cleanLines([line({ quantity: -3 })])[0].quantity).toBe(1);
    expect(cleanLines([line({ quantity: 2.7 })])[0].quantity).toBe(2);
  });

  it("un prix nul ou négatif n'est pas un prix", () => {
    expect(cleanLines([line({ unitPrice: 0 })])[0].unitPrice).toBeNull();
    expect(cleanLines([line({ unitPrice: -5 })])[0].unitPrice).toBeNull();
  });

  it("une chaîne vide d'article vaut « autre »", () => {
    expect(cleanLines([line({ articleId: "" })])[0].articleId).toBeNull();
  });
});

describe("estimatedTotal — indicatif, et jamais faussement gratuit", () => {
  it("somme les lignes qui portent un prix", () => {
    expect(estimatedTotal([line({ unitPrice: 1200, quantity: 2 }), line({ unitPrice: 800, quantity: 1 })])).toBe(3200);
  });

  it("ignore les lignes sans prix, sans les compter à zéro", () => {
    expect(estimatedTotal([line({ unitPrice: 1000 }), line({ unitPrice: null })])).toBe(1000);
  });

  // Afficher « 0 DZD » ferait croire à une demande gratuite : on préfère ne rien afficher.
  it("rend null quand AUCUNE ligne n'a de prix", () => {
    expect(estimatedTotal([line({}), line({})])).toBeNull();
    expect(estimatedTotal([])).toBeNull();
  });
});

describe("summarize — ce qui tient sur une ligne de liste", () => {
  it("reprend les articles, quantité comprise", () => {
    expect(summarize([line({ label: "Ramettes", quantity: 5 })])).toBe("5× Ramettes");
  });

  it("ne répète pas « 1× »", () => {
    expect(summarize([line({ label: "Agrafeuse" })])).toBe("Agrafeuse");
  });

  it("tronque au-delà de trois articles, en disant combien il en reste", () => {
    const many = ["a", "b", "c", "d", "e"].map((l) => line({ label: l }));
    expect(summarize(many)).toBe("a, b, c (+2)");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(summarize([])).toBe("Demande d'achat");
  });
});

describe("seesBudget — le demandeur ne voit pas l'enveloppe", () => {
  // Connaître le reste transforme une demande en négociation : le rôle du demandeur est de dire
  // ce dont il a besoin, pas d'arbitrer une caisse qu'il ne tient pas.
  it("suit strictement le droit sur le module", () => {
    expect(seesBudget(true)).toBe(true);
    expect(seesBudget(false)).toBe(false);
  });
});

describe("purchaseStage — la décision prime sur le statut", () => {
  it("en attente tant que personne n'a tranché", () => {
    expect(purchaseStage("AWAITING_VALIDATION", { status: "PENDING" })).toBe("PENDING");
    expect(purchaseStage("NEW", null)).toBe("PENDING");
  });

  // Une demande refusée dont le statut est resté « bloqué » doit se lire « refusée » :
  // « bloquée » n'explique rien à celui qui attend.
  it("refusée se dit refusée, quel que soit le statut de la demande", () => {
    expect(purchaseStage("BLOCKED", { status: "REJECTED" })).toBe("REJECTED");
    expect(purchaseStage("IN_PROGRESS", { status: "REJECTED" })).toBe("REJECTED");
  });

  it("validée puis effectuée", () => {
    expect(purchaseStage("IN_PROGRESS", { status: "APPROVED" })).toBe("APPROVED");
    expect(purchaseStage("DONE", { status: "APPROVED" })).toBe("DONE");
  });

  it("l'annulation l'emporte sur tout", () => {
    expect(purchaseStage("CANCELLED", { status: "APPROVED" })).toBe("CANCELLED");
  });
});

describe("canWithdraw — on retire tant que personne n'a décidé", () => {
  it("oui en attente", () => {
    expect(canWithdraw("PENDING")).toBe(true);
  });

  // Après la décision, la retirer effacerait une trace : on ne saurait plus pourquoi un achat
  // a été lancé.
  it("non une fois tranchée", () => {
    for (const s of ["APPROVED", "REJECTED", "DONE", "CANCELLED"] as const) {
      expect(canWithdraw(s), s).toBe(false);
    }
  });
});

describe("libellés d'étape", () => {
  it("couvrent les cinq étapes, sans trou", () => {
    const keys = ["APPROVED", "CANCELLED", "DONE", "PENDING", "REJECTED"];
    expect(Object.keys(STAGE_LABEL).sort()).toEqual(keys);
    expect(Object.keys(STAGE_TONE).sort()).toEqual(keys);
  });

  it("disent QUI attend — pas « en attente » tout court", () => {
    expect(STAGE_LABEL.PENDING).toContain("directeur");
  });
});
