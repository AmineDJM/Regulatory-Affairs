import { describe, it, expect } from "vitest";
import {
  sourceOf, cashAvailable, resolveSource, sourceChange, defaultSource,
  SOURCE_LABEL, SOURCE_HINT,
} from "./payment-source";

const RECEIVED = { id: "c1", status: "RECEIVED" };
const PENDING = { id: "c1", status: "ALLOTTED" };

describe("sourceOf — d'où sort une dépense déjà enregistrée", () => {
  it("de la caisse quand elle y est rattachée", () => {
    expect(sourceOf({ pettyCashId: "c1" })).toBe("CASH");
  });
  it("hors caisse sinon", () => {
    expect(sourceOf({ pettyCashId: null })).toBe("OFF_CASH");
    expect(sourceOf({})).toBe("OFF_CASH");
  });
});

describe("cashAvailable — les trois conditions, et pas deux", () => {
  it("une caisse reçue, entre les mains de celui qui saisit", () => {
    expect(cashAvailable(RECEIVED, { isHolder: true })).toBe(true);
  });

  // Une somme décidée mais pas encaissée n'existe pas encore : en sortir de l'argent
  // fausserait le fond dès la première dépense.
  it("pas une caisse simplement décidée", () => {
    expect(cashAvailable(PENDING, { isHolder: true })).toBe(false);
  });

  it("pas quelqu'un d'autre que le détenteur", () => {
    expect(cashAvailable(RECEIVED, { isHolder: false })).toBe(false);
  });

  it("la direction générale peut régulariser", () => {
    expect(cashAvailable(RECEIVED, { isHolder: false, globalView: true })).toBe(true);
  });

  it("pas de caisse du tout", () => {
    expect(cashAvailable(null, { isHolder: true })).toBe(false);
  });
});

describe("resolveSource — ce qui est demandé, confronté à ce qui est possible", () => {
  it("hors caisse par défaut, sans rien demander", () => {
    expect(resolveSource(null, RECEIVED, { isHolder: true })).toEqual({ source: "OFF_CASH", pettyCashId: null });
    expect(resolveSource("OFF_CASH", RECEIVED, { isHolder: true })).toEqual({ source: "OFF_CASH", pettyCashId: null });
  });

  it("la caisse quand elle est demandée ET disponible", () => {
    expect(resolveSource("CASH", RECEIVED, { isHolder: true })).toEqual({ source: "CASH", pettyCashId: "c1" });
  });

  // LE POINT : on ne retombe jamais silencieusement sur « hors caisse ». La dépense serait
  // enregistrée, le budget consommé, et le fond du mois resterait faux jusqu'au solde.
  it("REFUSE, avec un motif, quand la caisse est demandée sans être disponible", () => {
    const noCash = resolveSource("CASH", null, { isHolder: true });
    expect(noCash.error).toContain("Aucune caisse");

    const notReceived = resolveSource("CASH", PENDING, { isHolder: true });
    expect(notReceived.error).toContain("confirmée reçue");

    const notHolder = resolveSource("CASH", RECEIVED, { isHolder: false });
    expect(notHolder.error).toContain("détient la caisse");
  });
});

describe("sourceChange — le changement de moyen de paiement, dit en clair", () => {
  it("rien à dire quand rien ne change", () => {
    expect(sourceChange("CASH", "CASH")).toBeNull();
    expect(sourceChange("OFF_CASH", "OFF_CASH")).toBeNull();
  });

  it("dit dans quel sens la dépense a bougé", () => {
    expect(sourceChange("OFF_CASH", "CASH")).toContain("rattachée à la caisse");
    expect(sourceChange("CASH", "OFF_CASH")).toContain("sortie de la caisse");
  });
});

describe("defaultSource — le formulaire s'ouvre sur le cas fréquent", () => {
  it("la caisse quand on la détient", () => {
    expect(defaultSource(RECEIVED, { isHolder: true })).toBe("CASH");
  });
  it("hors caisse sinon — jamais un choix qui sera refusé", () => {
    expect(defaultSource(RECEIVED, { isHolder: false })).toBe("OFF_CASH");
    expect(defaultSource(null, { isHolder: true })).toBe("OFF_CASH");
  });
});

describe("libellés", () => {
  it("couvrent les deux moyens, sans trou", () => {
    expect(Object.keys(SOURCE_LABEL).sort()).toEqual(["CASH", "OFF_CASH"]);
    expect(Object.keys(SOURCE_HINT).sort()).toEqual(["CASH", "OFF_CASH"]);
  });
});
