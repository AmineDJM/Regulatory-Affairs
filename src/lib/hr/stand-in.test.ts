import { describe, it, expect } from "vitest";
import {
  STAND_IN_LABEL, isDelegatable, normalizeDelegated, isDelegationActive, inactiveReason,
  delegatedActions, delegationsFor, actsFor, delegationNotice,
  type StandInLeave, type StandInStatus,
} from "./stand-in";

const leave = (over: Partial<StandInLeave> = {}): StandInLeave => ({
  leaveApproved: true,
  standInId: "remplacant",
  standInStatus: "APPROVED",
  standInModules: ["VALIDATIONS", "REGULATORY"],
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  ...over,
});

const during = new Date("2026-09-05T09:00:00Z");

describe("modules délégables — remplacer quelqu'un n'est pas devenir lui", () => {
  it("un module métier se délègue", () => {
    expect(isDelegatable("VALIDATIONS")).toBe(true);
    expect(isDelegatable("REGULATORY")).toBe(true);
    expect(isDelegatable("FINANCES")).toBe(true);
  });

  // Remplacer quelqu'un, ce n'est pas lire son Drive privé ni sa messagerie.
  it("les espaces PERSONNELS et la console d'administration ne se délèguent jamais", () => {
    expect(isDelegatable("DRIVE")).toBe(false);
    expect(isDelegatable("MESSAGING")).toBe(false);
    expect(isDelegatable("WORKSPACE")).toBe(false);
    expect(isDelegatable("ADMIN")).toBe(false);
  });

  it("normalise une liste : garde le valide, écarte le reste, dédoublonne", () => {
    expect(normalizeDelegated(["VALIDATIONS", "ADMIN", "PAS_UN_MODULE", " VALIDATIONS "]))
      .toEqual(["VALIDATIONS"]);
    expect(normalizeDelegated([])).toEqual([]);
  });
});

describe("isDelegationActive — quatre conditions, aucune superflue", () => {
  it("congé accordé + intérimaire validé + dans la fenêtre = actif", () => {
    expect(isDelegationActive(leave(), during)).toBe(true);
  });

  // Sans la validation RH, chacun se choisirait un remplaçant complaisant et la délégation
  // deviendrait un moyen de contourner un circuit.
  it("tant que les RH n'ont pas validé, rien ne s'ouvre", () => {
    expect(isDelegationActive(leave({ standInStatus: "PENDING" }), during)).toBe(false);
    expect(isDelegationActive(leave({ standInStatus: "REJECTED" }), during)).toBe(false);
  });

  it("un congé pas encore accordé n'ouvre aucun intérim — la personne est là", () => {
    expect(isDelegationActive(leave({ leaveApproved: false }), during)).toBe(false);
  });

  it("sans intérimaire désigné, il n'y a rien à activer", () => {
    expect(isDelegationActive(leave({ standInId: null }), during)).toBe(false);
  });

  it("hors de la fenêtre, la délégation est fermée — avant comme après", () => {
    expect(isDelegationActive(leave(), new Date("2026-08-31T23:00:00Z"))).toBe(false);
    expect(isDelegationActive(leave(), new Date("2026-09-11T08:00:00Z"))).toBe(false);
  });

  // S'arrêter à minuit laisserait le dernier jour du congé sans personne.
  it("le PREMIER et le DERNIER jour du congé sont couverts en entier", () => {
    expect(isDelegationActive(leave(), new Date("2026-09-01T07:00:00Z"))).toBe(true);
    expect(isDelegationActive(leave(), new Date("2026-09-10T22:00:00Z"))).toBe(true);
  });

  it("des dates illisibles ferment la délégation plutôt que de l'ouvrir au hasard", () => {
    expect(isDelegationActive(leave({ startDate: "n'importe quoi" }), during)).toBe(false);
  });
});

describe("inactiveReason — un refus qui dit pourquoi", () => {
  it("nomme la condition qui manque", () => {
    expect(inactiveReason(leave({ standInId: null }), during)).toContain("Aucun intérimaire");
    expect(inactiveReason(leave({ standInStatus: "PENDING" }), during)).toContain("pas encore validé");
    expect(inactiveReason(leave({ standInStatus: "REJECTED" }), during)).toContain("refusé");
    expect(inactiveReason(leave({ leaveApproved: false }), during)).toContain("pas encore accordé");
  });

  it("distingue « pas encore commencé » de « déjà terminé »", () => {
    expect(inactiveReason(leave(), new Date("2026-08-20T09:00:00Z"))).toContain("commencera");
    expect(inactiveReason(leave(), new Date("2026-10-01T09:00:00Z"))).toContain("pris fin");
  });

  it("quand tout est réuni, il n'y a rien à expliquer", () => {
    expect(inactiveReason(leave(), during)).toBeNull();
  });
});

describe("délégation des droits — jamais plus que ce que l'absent avait", () => {
  it("l'intérimaire reprend les droits de l'absent sur le module", () => {
    const actions = delegatedActions("HEAD_OF_REGULATORY", "REGULATORY");
    expect(actions).toContain("VIEW");
    expect(actions).toContain("UPDATE");
  });

  // Un remplaçant ne détruit pas : c'est le genre de geste qui se découvre au retour et qui ne
  // se répare pas.
  it("la SUPPRESSION n'est jamais déléguée", () => {
    for (const role of ["DIRECTION", "GENERAL_MANAGER", "HEAD_OF_REGULATORY"]) {
      expect(delegatedActions(role, "REGULATORY"), role).not.toContain("DELETE");
    }
  });

  // Une délégation qui ajouterait des droits serait une promotion déguisée, et le retour du
  // titulaire ne la retirerait pas.
  it("un module que l'absent n'avait pas ne se délègue pas", () => {
    expect(delegatedActions("MEDICAL_DELEGATE", "FINANCES")).toBeNull();
    expect(delegatedActions("RÔLE_INEXISTANT", "REGULATORY")).toBeNull();
  });

  it("delegationsFor ne rend que ce qui est réellement transmis", () => {
    const d = delegationsFor("MEDICAL_DELEGATE", ["FINANCES", "MEDICAL", "ADMIN"]);
    expect(d.map((x) => x.module)).toEqual(["MEDICAL"]);
  });

  it("une liste vide ne délègue rien", () => {
    expect(delegationsFor("DIRECTION", [])).toEqual([]);
  });
});

describe("actsFor — qui remplace qui, à cet instant", () => {
  const full = { ...leave(), absenteeUserId: "absent" };

  it("l'intérimaire validé agit pendant la fenêtre", () => {
    expect(actsFor(full, "remplacant", during)).toBe(true);
  });

  it("quelqu'un d'autre ne remplace personne", () => {
    expect(actsFor(full, "un-tiers", during)).toBe(false);
  });

  // Le cas naît tout seul le jour où quelqu'un se désigne par erreur — et ferait passer une
  // auto-validation pour une intérim.
  it("on ne se remplace pas soi-même", () => {
    expect(actsFor({ ...full, standInId: "absent" }, "absent", during)).toBe(false);
  });

  it("hors fenêtre, plus personne ne remplace", () => {
    expect(actsFor(full, "remplacant", new Date("2026-10-01T09:00:00Z"))).toBe(false);
  });
});

describe("messages", () => {
  it("chaque état porte un libellé", () => {
    for (const s of ["PENDING", "APPROVED", "REJECTED"] as StandInStatus[]) {
      expect(STAND_IN_LABEL[s]).toBeTruthy();
    }
  });

  it("le bandeau dit QUI l'on remplace et JUSQU'À QUAND", () => {
    const n = delegationNotice("Karim Saïdi", "2026-09-10");
    expect(n).toContain("Karim Saïdi");
    expect(n).toContain("septembre");
  });

  it("une date illisible ne produit pas « Invalid Date » à l'écran", () => {
    expect(delegationNotice("Karim", "???")).toContain("pendant son congé");
  });
});
