import { describe, it, expect } from "vitest";
import { renvoiPossible, etatApresRenvoi, attendSaCorrection, refusParLeDemandeur, REFUS_EN_CORRECTION } from "./renvoi";
import { PROMO_STEPS, type PromoState } from "./circuit";

const TOUS: PromoState[] = [...PROMO_STEPS, "REFUSED"];

describe("Renvoyer un dossier de matériel promotionnel pour correction (audit 360°, R05)", () => {
  it("on renvoie là où un AUTRE que le demandeur tranche — et nulle part ailleurs", () => {
    const renvoyables = TOUS.filter(renvoiPossible);
    expect(renvoyables.sort()).toEqual(["REVIEW_DG", "REVIEW_EXECUTIVE", "REVIEW_MANAGER", "REVIEW_MEDICAL_INFO", "REVIEW_REQUEST"]);
    // Le demandeur ne se renvoie pas sa propre étape ; les devis et l'exécution ne sont pas des décisions.
    for (const s of ["REVIEW_REQUESTER", "QUOTE_TO_REQUEST", "QUOTE_REQUESTED", "IN_EXECUTION", "COMPLETED", "REFUSED"] as PromoState[]) {
      expect(renvoiPossible(s), s).toBe(false);
      expect(etatApresRenvoi(s), s).toBeNull();
    }
  });

  it("la DEMANDE se corrige sur place ; un CHOIX se refait au choix des lignes", () => {
    expect(etatApresRenvoi("REVIEW_REQUEST")).toBe("REVIEW_REQUEST");
    for (const s of ["REVIEW_MANAGER", "REVIEW_DG", "REVIEW_EXECUTIVE", "REVIEW_MEDICAL_INFO"] as PromoState[]) {
      expect(etatApresRenvoi(s), s).toBe("REVIEW_REQUESTER");
    }
  });

  it("le dossier est chez son demandeur SEULEMENT à l'une de ses deux étapes, et marqué", () => {
    const quand = new Date("2026-10-03T10:00:00Z");
    expect(attendSaCorrection({ circuitState: "REVIEW_REQUEST", returnedAt: quand })).toBe(true);
    expect(attendSaCorrection({ circuitState: "REVIEW_REQUESTER", returnedAt: quand.toISOString() })).toBe(true);
    // Sans marque, la même étape n'est pas « à corriger » — sans ce témoin, une règle qui lirait
    // l'étape seule passerait.
    expect(attendSaCorrection({ circuitState: "REVIEW_REQUEST", returnedAt: null })).toBe(false);
    // Une marque restée posée ailleurs (le demandeur a redemandé des devis) ne dit rien.
    expect(attendSaCorrection({ circuitState: "QUOTE_REQUESTED", returnedAt: quand })).toBe(false);
    expect(attendSaCorrection({ circuitState: null, returnedAt: quand })).toBe(false);
  });

  it("la phrase du validateur est celle du moteur Ad & Pro — deux rédactions diraient deux choses", () => {
    expect(REFUS_EN_CORRECTION).toMatch(/chez son demandeur, pour correction/);
  });

  it("le demandeur ne REFUSE pas sa propre demande — il l'annule, ou redemande des devis", () => {
    const pm = { circuitState: "REVIEW_REQUESTER", requesterId: "kam", circuitVersion: 2 };
    expect(refusParLeDemandeur({ id: "kam" }, pm)).toMatch(/Redemander des devis/);
    expect(refusParLeDemandeur({ id: "kam" }, { ...pm, circuitVersion: 1 })).toMatch(/annulez le dossier/);
    expect(refusParLeDemandeur({ id: "kam" }, { ...pm, circuitVersion: 1 })).not.toMatch(/Redemander/);
    // Un validateur, ou le demandeur à une étape qui n'est pas la sienne : pas de refus ici.
    expect(refusParLeDemandeur({ id: "sa" }, pm)).toBeNull();
    expect(refusParLeDemandeur({ id: "kam" }, { ...pm, circuitState: "REVIEW_MANAGER" })).toBeNull();
    expect(refusParLeDemandeur({ id: "kam" }, { ...pm, requesterId: null })).toBeNull();
  });
});
