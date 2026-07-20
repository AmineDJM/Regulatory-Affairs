import { describe, expect, it } from "vitest";
import { gen, checkProperty } from "./property";
import { runProperties } from "./properties";
import { runMetamorphic } from "./metamorphic";
import { runMutationTesting } from "./mutation";
import { runFuzzing } from "./fuzz";
import { runFlakyDetection } from "./flaky";
import { demonstrateMinimization } from "./minimize";
import { timeTravelAccrual } from "./time-travel";
import { godModeSelfValidation } from "./index";

// GOD MODE est PUR (aucune base) → pas de garde DB.
describe("Test Center — GOD MODE : le testeur se valide lui-même (§27/§33/§34)", () => {
  it("le moteur PBT détecte ET réduit un contre-exemple (test du test)", () => {
    const r = checkProperty(gen.int(0, 100000), (n) => n < 500, { seed: 1, runs: 300 });
    expect(r.ok).toBe(false);
    expect(r.shrunk).toBe(500); // borne minimale exacte
  });

  it("les propriétés fondamentales tiennent (RBAC, congés, expurgation)", () => {
    const r = runProperties(12345);
    expect(r.failed).toBe(0);
    expect(r.passed).toBe(r.props.length);
  });

  it("les relations métamorphiques tiennent (JSON d'IA robuste au bruit, mois, acquisition)", () => {
    const r = runMetamorphic(12345);
    expect(r.failed).toBe(0);
  });

  it("mutation testing : la suite TUE toutes les mutations (0 survivant, killRate 1)", () => {
    const r = runMutationTesting(0xC0FFEE, 30);
    expect(r.baseSanityOk).toBe(true); // témoins valides
    expect(r.introduced).toBeGreaterThan(0);
    expect(r.survived).toBe(0);
    expect(r.killRate).toBe(1);
  });

  it("fuzzing des validateurs : total (0 crash) + sécurisé (0 exécutable accepté)", () => {
    const r = runFuzzing(42, 800);
    expect(r.crashes).toBe(0);
    expect(r.malformed).toBe(0);
    expect(r.securityBreaches).toBe(0);
  });

  it("détection d'instabilité : moteurs déterministes à graine fixe (reproductibilité 1)", () => {
    const r = runFlakyDetection(6);
    expect(r.flakyCount).toBe(0);
    expect(r.reproducibility).toBe(1);
  });

  it("minimisation : converge vers la borne et fournit une reproduction", () => {
    const m = demonstrateMinimization(7, 1000);
    expect(m.found).toBe(true);
    expect(m.minimal).toBe(1000);
    expect(m.steps).toBeGreaterThan(0);
    expect(m.reproduction).toContain("seed");
  });

  it("time-travel : acquisition congés idempotente (une fois/mois, ni zéro ni double)", () => {
    const t = timeTravelAccrual("2026-01", 18, 3);
    expect(t.ok).toBe(true);
    expect(t.actualCredit).toBeCloseTo(t.expectedCredit, 9);
    expect(t.doubleCredits).toBe(0);
    expect(t.missedCredits).toBe(0);
  });

  it("auto-validation globale : selfValidationOk et 0 échec bloquant", () => {
    const g = godModeSelfValidation();
    expect(g.selfValidationOk).toBe(true);
    expect(g.blockingFailures).toBe(0);
  });
});
