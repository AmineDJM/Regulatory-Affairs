import { describe, it, expect } from "vitest";
import { lecteurDeLaReclamation, lireQuantite, peutContribuer, refusTransition, statutsSuivants } from "./regles";

const R = { declaredById: "kam", ownerId: "od", status: "OUVERTE" };

describe("retours & réclamations — qui lit, qui contribue", () => {
  it("la vue de tout, le déclarant et le responsable lisent ; personne d'autre", () => {
    expect(lecteurDeLaReclamation({ userId: "x", voitTout: true, instruit: false }, R)).toBe(true);
    expect(lecteurDeLaReclamation({ userId: "kam", voitTout: false, instruit: false }, R)).toBe(true);
    expect(lecteurDeLaReclamation({ userId: "od", voitTout: false, instruit: false }, R)).toBe(true);
    expect(lecteurDeLaReclamation({ userId: "autre", voitTout: false, instruit: false }, R)).toBe(false);
  });
  it("clôturée, seul qui instruit y écrit encore", () => {
    const close = { ...R, status: "CLOTUREE" };
    expect(peutContribuer({ userId: "kam", voitTout: false, instruit: false }, close)).toBe(false);
    expect(peutContribuer({ userId: "od", voitTout: true, instruit: true }, close)).toBe(true);
  });
});

describe("retours & réclamations — le statut", () => {
  it("OUVERTE → EN_ANALYSE → CLOTUREE ; clôturer demande une conclusion ; rouvrir remet en analyse", () => {
    expect(statutsSuivants("OUVERTE")).toEqual(["EN_ANALYSE", "CLOTUREE"]);
    expect(refusTransition("EN_ANALYSE", "CLOTUREE", "")).toMatch(/conclusion/);
    expect(refusTransition("EN_ANALYSE", "CLOTUREE", "Lot conforme, retour accepté")).toBeNull();
    expect(refusTransition("CLOTUREE", "OUVERTE", null)).not.toBeNull();
    expect(refusTransition("CLOTUREE", "EN_ANALYSE", null)).toBeNull();
  });
  it("la quantité est un entier de boîtes", () => {
    expect(lireQuantite("1 200")).toBe(1200);
    expect(lireQuantite("")).toBeNull();
    expect(lireQuantite("2,5")).toBeNull();
  });
});
