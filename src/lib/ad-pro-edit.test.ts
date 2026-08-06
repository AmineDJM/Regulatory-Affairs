import { describe, it, expect } from "vitest";
import {
  canEditAdProRequest, isAdProDecided, editableField, describeChanges, EDITABLE_FIELDS,
} from "./ad-pro-edit";

const requester = { id: "u1", hasGlobalView: false, canUpdate: false };
const direction = { id: "dir", hasGlobalView: true, canUpdate: true };
const manager = { id: "u9", hasGlobalView: false, canUpdate: true };
const stranger = { id: "u9", hasGlobalView: false, canUpdate: false };

describe("canEditAdProRequest", () => {
  it("laisse le demandeur corriger sa demande tant qu'elle n'est pas tranchée", () => {
    expect(canEditAdProRequest(requester, { requesterId: "u1", decided: false })).toBe(true);
  });

  it("ferme la saisie au demandeur une fois la décision rendue", () => {
    // C'est la garantie qui compte : réécrire le montant demandé après un accord
    // transformerait la décision en autre chose que ce qui a été décidé.
    expect(canEditAdProRequest(requester, { requesterId: "u1", decided: true })).toBe(false);
  });

  it("laisse la Direction corriger même après la décision", () => {
    expect(canEditAdProRequest(direction, { requesterId: "u1", decided: true })).toBe(true);
  });

  it("ouvre la modification au droit UPDATE avant décision, pas après", () => {
    expect(canEditAdProRequest(manager, { requesterId: "u1", decided: false })).toBe(true);
    expect(canEditAdProRequest(manager, { requesterId: "u1", decided: true })).toBe(false);
  });

  it("refuse quelqu'un sans droit ni lien avec la demande", () => {
    expect(canEditAdProRequest(stranger, { requesterId: "u1", decided: false })).toBe(false);
  });

  it("ne se fie pas à un demandeur absent pour ouvrir la saisie", () => {
    // requesterId null ne doit jamais « matcher » : sinon une demande orpheline serait
    // modifiable par n'importe qui.
    expect(canEditAdProRequest({ id: "", hasGlobalView: false, canUpdate: false }, { requesterId: null, decided: false })).toBe(false);
  });
});

describe("isAdProDecided", () => {
  it("reconnaît les statuts terminaux de chaque type", () => {
    expect(isAdProDecided("SPONSORING", "APPROVED")).toBe(true);
    expect(isAdProDecided("SPONSORING", "PAID")).toBe(true);
    expect(isAdProDecided("SPONSORING", "AWAITING_FINAL")).toBe(false);
    expect(isAdProDecided("CONGRESS_NATIONAL", "COMPLETED")).toBe(true);
    expect(isAdProDecided("CONGRESS_INTERNATIONAL", "AWAITING_PRELIMINARY")).toBe(false);
  });
});

describe("liste blanche des champs", () => {
  it("accepte un champ descriptif et refuse un champ de décision", () => {
    expect(editableField("SPONSORING", "institution")?.type).toBe("text");
    // Les champs qui appartiennent au circuit ne doivent JAMAIS être modifiables ici.
    for (const forbidden of ["amountGranted", "status", "productManagerId", "productManagerNotes", "finalDecision", "requesterId", "reference"]) {
      expect(editableField("SPONSORING", forbidden)).toBeNull();
    }
    for (const forbidden of ["requestStatus", "finalAmount", "productManagerBudget", "finalNote"]) {
      expect(editableField("CONGRESS_NATIONAL", forbidden)).toBeNull();
      expect(editableField("CONGRESS_INTERNATIONAL", forbidden)).toBeNull();
    }
  });

  it("n'expose aucun champ en double dans un même type", () => {
    for (const kind of ["SPONSORING", "CONGRESS_NATIONAL", "CONGRESS_INTERNATIONAL"] as const) {
      const keys = EDITABLE_FIELDS[kind].map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("describeChanges", () => {
  it("ne retient que ce qui change, avant → après", () => {
    const out = describeChanges(
      "SPONSORING",
      { institution: "CHU Alger", city: "Alger", description: "x" },
      { institution: "CHU Oran", city: "Alger" },
    );
    expect(out).toEqual(["Institution / service / association : CHU Alger → CHU Oran"]);
  });

  it("ignore un champ absent de la modification plutôt que de le dire vidé", () => {
    // `after` ne porte que les champs soumis : un champ non soumis n'est pas un effacement.
    expect(describeChanges("SPONSORING", { city: "Alger" }, {})).toEqual([]);
  });

  it("note un effacement explicite", () => {
    expect(describeChanges("SPONSORING", { city: "Alger" }, { city: null })).toEqual(["Ville : Alger → —"]);
  });

  it("compare les dates sur le jour, pas sur l'heure", () => {
    const out = describeChanges(
      "CONGRESS_NATIONAL",
      { date: new Date("2026-05-04T00:00:00.000Z") },
      { date: new Date("2026-05-04T09:30:00.000Z") },
    );
    expect(out).toEqual([]);
  });

  it("ne considère pas un espace de bordure comme une modification", () => {
    expect(describeChanges("SPONSORING", { city: "Alger" }, { city: " Alger " })).toEqual([]);
  });
});
