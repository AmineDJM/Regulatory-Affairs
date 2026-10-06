import { describe, expect, it } from "vitest";
import { buildRef } from "@/lib/refs";
import { PERMISSIONS, defaultScope } from "@/lib/rbac";
import { NAVIGATION } from "@/lib/labels";
import {
  PREFIXE_REFERENCE_PV, STATUTS_PV, lecteurDuCasPv, lireAgePv, peutJoindreAuCasPv, refusEnquetePv, refusTransitionPv, statutsSuivantsPv,
} from "./regles";

/** PHARMACOVIGILANCE (Direction, 06/10) — les règles pures du module, et ses droits par défaut. */

describe("statuts d'un cas", () => {
  it("un cas reçu se prend en analyse, part en enquête ou se clôt — il ne revient jamais à « Reçu »", () => {
    expect(statutsSuivantsPv("RECU")).toEqual(["EN_ANALYSE", "ENQUETE", "CLOS"]);
    for (const s of STATUTS_PV) expect(statutsSuivantsPv(s)).not.toContain("RECU");
  });

  it("un cas clos se rouvre en analyse, et seulement ainsi", () => {
    expect(statutsSuivantsPv("CLOS")).toEqual(["EN_ANALYSE"]);
    expect(refusTransitionPv("CLOS", "EN_ANALYSE", null)).toBeNull();
    expect(refusTransitionPv("CLOS", "ENQUETE", null)).toMatch(/ne passe pas/);
  });

  it("clore exige une note de clôture", () => {
    expect(refusTransitionPv("EN_ANALYSE", "CLOS", "  ")).toMatch(/note de clôture/);
    expect(refusTransitionPv("EN_ANALYSE", "CLOS", "Imputabilité douteuse, déclaré au CNPM.")).toBeNull();
  });

  it("un statut identique est refusé, en le disant", () => {
    expect(refusTransitionPv("EN_ANALYSE", "EN_ANALYSE", null)).toMatch(/déjà/);
  });

  it("une enquête exige les informations demandées, et pas sur un cas clos", () => {
    expect(refusEnquetePv("RECU", "")).toMatch(/informations/);
    expect(refusEnquetePv("CLOS", "Numéro de lot ?")).toMatch(/clos/);
    expect(refusEnquetePv("ENQUETE", "Évolution à J7 ?")).toBeNull();
  });
});

describe("qui lit un cas", () => {
  const cas = { reporterId: "kam", status: "ENQUETE", participants: [{ userId: "medecin" }] };
  it("le déclarant, les participants, qui reçoit les cas — personne d'autre", () => {
    expect(lecteurDuCasPv({ userId: "kam", voitTout: false }, cas)).toBe(true);
    expect(lecteurDuCasPv({ userId: "medecin", voitTout: false }, cas)).toBe(true);
    expect(lecteurDuCasPv({ userId: "reg", voitTout: true }, cas)).toBe(true);
    expect(lecteurDuCasPv({ userId: "autre-kam", voitTout: false }, cas)).toBe(false);
    expect(lecteurDuCasPv({ userId: "admin", voitTout: false, superAdmin: true }, cas)).toBe(true);
  });

  it("joindre une pièce : le KAM tant que le cas est ouvert, qui instruit toujours", () => {
    const kam = { userId: "kam", voitTout: false, instruit: false };
    expect(peutJoindreAuCasPv(kam, cas)).toBe(true);
    expect(peutJoindreAuCasPv(kam, { ...cas, status: "CLOS" })).toBe(false);
    expect(peutJoindreAuCasPv({ userId: "reg", voitTout: true, instruit: true }, { ...cas, status: "CLOS" })).toBe(true);
    expect(peutJoindreAuCasPv({ userId: "autre", voitTout: false, instruit: false }, cas)).toBe(false);
  });
});

describe("référence et saisie", () => {
  it("la référence suit PV-AAAA-NNN, au maximum présent", () => {
    expect(buildRef(PREFIXE_REFERENCE_PV, 2026, [])).toBe("PV-2026-001");
    expect(buildRef(PREFIXE_REFERENCE_PV, 2026, ["PV-2026-001", "PV-2026-007"])).toBe("PV-2026-008");
  });

  it("l'âge du patient : un entier plausible, sinon rien", () => {
    expect(lireAgePv("42")).toBe(42);
    expect(lireAgePv("")).toBeNull();
    expect(lireAgePv("4.5")).toBeNull();
    expect(lireAgePv("300")).toBeNull();
  });
});

describe("droits par défaut", () => {
  it("Regulatory reçoit les cas avec ses gestes de Regulatory, en portée TOUT", () => {
    expect(PERMISSIONS.HEAD_OF_REGULATORY.PHARMACOVIGILANCE).toEqual(PERMISSIONS.HEAD_OF_REGULATORY.REGULATORY);
    expect(PERMISSIONS.REGULATORY_ASSISTANT.PHARMACOVIGILANCE).toEqual(PERMISSIONS.REGULATORY_ASSISTANT.REGULATORY);
    expect(defaultScope("HEAD_OF_REGULATORY", "PHARMACOVIGILANCE")).toBe("ALL");
    expect(defaultScope("REGULATORY_ASSISTANT", "PHARMACOVIGILANCE")).toBe("ALL");
  });

  it("le KAM signale (Voir, Créer, Téléverser) et ne lit que ses cas", () => {
    expect(PERMISSIONS.MEDICAL_DELEGATE.PHARMACOVIGILANCE).toEqual(["VIEW", "CREATE", "UPLOAD"]);
    expect(defaultScope("MEDICAL_DELEGATE", "PHARMACOVIGILANCE")).toBe("ASSIGNED");
  });

  it("qui n'a ni Regulatory ni les rapports terrain n'a rien", () => {
    expect(PERMISSIONS.COORDINATOR.PHARMACOVIGILANCE).toBeUndefined();
  });

  it("l'entrée de menu est au pôle Regulatory, gardée : le KAM n'y voit pas la boîte", () => {
    const entree = NAVIGATION.find((n) => n.module === "PHARMACOVIGILANCE");
    expect(entree?.href).toBe("/regulatory/pharmacovigilance");
    expect(entree?.pole).toBe("REGULATORY");
    expect(entree?.gate).toBe("pharmacovigilance");
  });
});
