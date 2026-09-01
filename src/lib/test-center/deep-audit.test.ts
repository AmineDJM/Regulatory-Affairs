import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { INVARIANTS } from "./invariants/registry";
import { STATE_MACHINES } from "./state-machines/registry";
import { isValidTransition } from "./state-machines/types";
import { rbacCoverage } from "./coverage";
import { deepAudit } from "./deep-audit";

const pred = (id: string) => {
  const inv = INVARIANTS.find((i) => i.id === id);
  if (!inv?.predicate) throw new Error(`predicate manquant : ${id}`);
  return inv.predicate.holds;
};

// ————— Tests PURS : les invariants DÉTECTENT bien les corruptions (aucune base requise) —————
describe("Test Center — invariants : les prédicats attrapent les violations", () => {
  it("INV-WFI-COUPLING : IN_PROGRESS sans étape, ou terminal avec étape, sont rejetés", () => {
    const p = pred("INV-WFI-COUPLING");
    expect(p({ status: "IN_PROGRESS", currentSlug: "final" })).toBe(true);
    expect(p({ status: "IN_PROGRESS", currentSlug: null })).toBe(false); // bloqué sans étape
    expect(p({ status: "APPROVED", currentSlug: null })).toBe(true);
    expect(p({ status: "APPROVED", currentSlug: "final" })).toBe(false); // terminal mais étape restante
  });

  it("INV-USR-ROLE : un rôle inconnu est rejeté", () => {
    const p = pred("INV-USR-ROLE");
    expect(p({ role: "SUPER_ADMIN", secondaryRole: null })).toBe(true);
    expect(p({ role: "GHOST_ROLE", secondaryRole: null })).toBe(false);
    expect(p({ role: "SUPER_ADMIN", secondaryRole: "PAS_UN_ROLE" })).toBe(false);
  });

  it("INV-VAL-COUPLING : décision sans date, ou attente avec date, sont rejetées", () => {
    const p = pred("INV-VAL-COUPLING");
    expect(p({ status: "PENDING", decidedAt: null })).toBe(true);
    expect(p({ status: "PENDING", decidedAt: new Date() })).toBe(false);
    expect(p({ status: "APPROVED", decidedAt: null })).toBe(false);
    expect(p({ status: "APPROVED", decidedAt: new Date() })).toBe(true);
  });

  it("INV-BUDGET-MODULES : un module fantôme est rejeté", () => {
    const p = pred("INV-BUDGET-MODULES");
    expect(p({ modules: ["FINANCES", "SPONSORING"] })).toBe(true);
    expect(p({ modules: ["MODULE_FANTOME"] })).toBe(false);
  });

  it("INV-EXP-AMOUNT : un montant négatif est rejeté", () => {
    const p = pred("INV-EXP-AMOUNT");
    expect(p({ amount: 0 })).toBe(true);
    expect(p({ amount: 1500.5 })).toBe(true);
    expect(p({ amount: -1 })).toBe(false);
  });

  it("INV-LEAVE-MARKER : un marqueur mal formé est rejeté", () => {
    const p = pred("INV-LEAVE-MARKER");
    expect(p({ leaveAccruedThrough: null })).toBe(true);
    expect(p({ leaveAccruedThrough: "2026-07" })).toBe(true);
    expect(p({ leaveAccruedThrough: "2026-13" })).toBe(false); // mois invalide
    expect(p({ leaveAccruedThrough: "juillet" })).toBe(false);
  });
});

describe("Test Center — machines à états : transitions déclarées", () => {
  it("valide/invalide correctement les transitions de l'ordre de dépense", () => {
    const m = STATE_MACHINES.find((s) => s.id === "expenseOrder")!;
    expect(isValidTransition(m, "PENDING", "PAID")).toBe(true);
    // PLUS DE RÉVISION NI D'ANNULATION AU DÉCAISSEMENT : l'ordre arrive autorisé par le centre
    // de paiement, et les Finances n'ont plus que trois états — non payé, reporté (une DATE sur
    // un ordre resté « à régler »), payé. L'état survit pour les ordres anciens, mais plus rien
    // ne peut y conduire.
    expect(isValidTransition(m, "PENDING", "REVISION_REQUESTED")).toBe(false);
    expect(isValidTransition(m, "PENDING", "CANCELLED")).toBe(false);
    expect(isValidTransition(m, "REVISION_REQUESTED", "PENDING")).toBe(true); // les anciens reviennent
    expect(isValidTransition(m, "PAID", "PENDING")).toBe(false); // PAID est terminal
    expect(isValidTransition(m, "PENDING", "IN_PROGRESS")).toBe(false); // état étranger
  });

  it("chaque machine déclare des transitions et un état initial", () => {
    for (const m of STATE_MACHINES) {
      expect(m.transitions.length).toBeGreaterThan(0);
      expect(m.initial.length).toBeGreaterThan(0);
      // Cohérence : tous les endpoints des transitions sont des états déclarés.
      for (const [from, to] of m.transitions) {
        expect(m.states).toContain(from);
        expect(m.states).toContain(to);
      }
    }
  });
});

describe("Test Center — couverture RBAC (pur)", () => {
  it("renvoie des métriques cohérentes", () => {
    const c = rbacCoverage();
    expect(c.roles).toBeGreaterThan(0);
    expect(c.modules).toBeGreaterThan(0);
    expect(c.totalGrants).toBeGreaterThan(0);
    expect(c.grantDensity).toBeGreaterThan(0);
    expect(c.grantDensity).toBeLessThanOrEqual(1);
  });
});

// ————— Test intégration : deepAudit tourne réellement sur la base —————
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

suite("Test Center — deepAudit : exécution réelle sur base", () => {
  it("produit invariants + machines à états + couverture, structure complète", async () => {
    const r = await deepAudit();
    expect(r.invariants.total).toBe(INVARIANTS.length);
    // chaque invariant a un résultat exploitable (réussi, échec ou explicitement ignoré).
    for (const res of r.invariants.results) {
      expect(typeof res.checked).toBe("number");
      expect(res.ok || res.skipped || res.violations > 0).toBe(true);
    }
    expect(r.stateMachines.machines.length).toBe(STATE_MACHINES.length);
    for (const m of r.stateMachines.machines) expect(m.declaredTransitions).toBeGreaterThan(0);
    expect(r.coverage.rbac.roles).toBeGreaterThan(0);
    expect(r.coverage.business.machines).toBe(STATE_MACHINES.length);
    expect(typeof r.blockingFailures).toBe("number");
  }, 60_000);
});
