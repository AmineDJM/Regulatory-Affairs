import { describe, expect, it } from "vitest";
import { evaluerCondition, issueDe, lireChemin, lireCondition } from "@/lib/missions/runtime/condition";

/**
 * L'ÉTAPE CONDITIONNELLE, au cas près : l'issue d'une attente (fait / temps), les tests de sortie,
 * les valeurs manquantes, et le sens d'erreur — une condition qu'on ne sait pas évaluer n'autorise pas.
 */
const parTemps = { status: "DONE", result: { reveillePar: "TEMPS", instant: "2026-09-05T10:00:00Z" } };
const parFait = { status: "DONE", result: { reveillePar: "MESSAGE_RECEIVED", payload: { from: "Raihana" } } };
const fournie = { status: "DONE", result: { fourniPar: "u1", contenu: "ok" } };
const lecture = { status: "DONE", result: { prix: 4200, devise: "DZD", items: [{ statut: "BLOQUE" }, { statut: "OK" }], vide: [] } };

describe("issueDe — ce qu'une étape amont a produit", () => {
  it("distingue le temps, le fait, la personne, l'échec", () => {
    expect(issueDe(parTemps).issue).toBe("TIMEOUT");
    expect(issueDe(parFait).issue).toBe("EVENT");
    expect(issueDe(fournie).issue).toBe("EVENT");
    expect(issueDe(lecture).issue).toBe("DONE");
    expect(issueDe({ status: "FAILED", result: null }).issue).toBe("FAILED");
    expect(issueDe({ status: "SKIPPED", result: null }).issue).toBe("SKIPPED");
    expect(issueDe({ status: "RUNNING", result: null }).issue).toBe("EN_COURS");
  });
});

describe("evaluerCondition — la branche « sinon »", () => {
  it("TIMEOUT part sur une attente réglée par le temps, pas sur une réponse", () => {
    expect(evaluerCondition({ step: "attente", outcome: "TIMEOUT" }, parTemps).remplie).toBe(true);
    const v = evaluerCondition({ step: "attente", outcome: "TIMEOUT" }, parFait);
    expect(v.remplie).toBe(false);
    expect(v.raison).toMatch(/MESSAGE_RECEIVED/);
  });
  it("EVENT part sur une réponse ou une entrée humaine, pas sur le temps", () => {
    expect(evaluerCondition({ step: "attente", outcome: "EVENT" }, parFait).remplie).toBe(true);
    expect(evaluerCondition({ step: "attente", outcome: "EVENT" }, fournie).remplie).toBe(true);
    expect(evaluerCondition({ step: "attente", outcome: "EVENT" }, parTemps).remplie).toBe(false);
  });
  it("DONE couvre les deux issues d'une attente — c'est un raffinement, pas une contradiction", () => {
    expect(evaluerCondition({ step: "a", outcome: "DONE" }, parTemps).remplie).toBe(true);
    expect(evaluerCondition({ step: "a", outcome: "DONE" }, parFait).remplie).toBe(true);
    expect(evaluerCondition({ step: "a", outcome: "DONE" }, { status: "FAILED", result: null }).remplie).toBe(false);
  });
  it("un amont introuvable ou encore en cours n'autorise pas", () => {
    expect(evaluerCondition({ step: "x", outcome: "DONE" }, undefined).remplie).toBe(false);
    expect(evaluerCondition({ step: "x", outcome: "DONE" }, { status: "WAITING", result: null }).remplie).toBe(false);
  });
});

describe("evaluerCondition — le test de sortie (« si prix > 5 000, demande validation »)", () => {
  it("compare en nombres quand les deux côtés en sont", () => {
    expect(evaluerCondition({ step: "l", path: "prix", op: "gt", value: "5000" }, lecture).remplie).toBe(false);
    expect(evaluerCondition({ step: "l", path: "prix", op: "gt", value: "4 000" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "prix", op: "lte", value: "4200" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "prix", op: "eq", value: "4200,0" }, lecture).remplie).toBe(true);
  });
  it("refuse une comparaison numérique sur du texte, et le dit", () => {
    const v = evaluerCondition({ step: "l", path: "devise", op: "gt", value: "10" }, lecture);
    expect(v.remplie).toBe(false);
    expect(v.raison).toMatch(/numérique impossible/);
  });
  it("eq / ne / contains sont insensibles à la casse ; exists / empty regardent la présence", () => {
    expect(evaluerCondition({ step: "l", path: "devise", op: "eq", value: "dzd" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "devise", op: "ne", value: "EUR" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "items.0.statut", op: "contains", value: "bloq" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "items", op: "exists" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "vide", op: "empty" }, lecture).remplie).toBe(true);
    expect(evaluerCondition({ step: "l", path: "absent", op: "exists" }, lecture).remplie).toBe(false);
    expect(evaluerCondition({ step: "l", path: "absent", op: "empty" }, lecture).remplie).toBe(true);
  });
  it("issue ET test se cumulent", () => {
    const amont = { status: "DONE", result: { reveillePar: "EMAIL_RECEIVED", payload: { montant: "12000" } } };
    expect(evaluerCondition({ step: "a", outcome: "EVENT", path: "payload.montant", op: "gte", value: "10000" }, amont).remplie).toBe(true);
    expect(evaluerCondition({ step: "a", outcome: "TIMEOUT", path: "payload.montant", op: "gte", value: "10000" }, amont).remplie).toBe(false);
  });
  it("une condition vide n'autorise rien", () => {
    expect(evaluerCondition({ step: "a" }, lecture).remplie).toBe(false);
  });
});

describe("lireChemin / lireCondition — relecture sans confiance", () => {
  it("lit les chemins pointés et les indices, jamais le prototype", () => {
    expect(lireChemin({ a: { b: [10, { c: "x" }] } }, "a.b.1.c")).toBe("x");
    expect(lireChemin({ a: 1 }, "a.b")).toBeUndefined();
    expect(lireChemin({}, "constructor")).toBeUndefined();
    expect(lireChemin({}, "__proto__.polluted")).toBeUndefined();
  });
  it("retype une condition persistée et rejette ce qui n'en est pas une", () => {
    expect(lireCondition({ step: "a", outcome: "TIMEOUT", path: null, op: null, value: null })).toEqual({ step: "a", outcome: "TIMEOUT" });
    expect(lireCondition({ step: "a", op: "gt", path: "prix", value: 5000 })).toEqual({ step: "a", op: "gt", path: "prix", value: "5000" });
    expect(lireCondition({ step: "a", outcome: "N_IMPORTE_QUOI" })).toBeNull();
    expect(lireCondition({ step: "" })).toBeNull();
    expect(lireCondition("attente")).toBeNull();
    expect(lireCondition(null)).toBeNull();
  });
});
