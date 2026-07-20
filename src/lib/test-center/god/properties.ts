import { can, PERMISSIONS, MODULES, ACTIONS } from "@/lib/rbac";
import { monthsBetweenYm, accrualStep } from "@/lib/scheduled";
import { redact } from "../redact";
import type { FindingInput } from "../types";
import { gen, checkProperty, type PropertyResult } from "./property";

/**
 * Propriétés vérifiées (§27) sur des fonctions PURES réelles du produit : RBAC, acquisition des
 * congés, calcul de mois, expurgation. Un contre-exemple est réduit au minimum (§34) et rapporté
 * avec sa graine pour reproduction.
 */

const ROLES = Object.keys(PERMISSIONS);
const canS = can as unknown as (r: string, m: string, a: string) => boolean;
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

interface Prop { id: string; label: string; result: PropertyResult<unknown> }

function run<T>(id: string, label: string, arb: Parameters<typeof checkProperty<T>>[0], prop: (v: T) => boolean, seed?: number): Prop {
  return { id, label, result: checkProperty(arb, prop, { runs: 200, seed }) as PropertyResult<unknown> };
}

export interface PropertiesReport { props: Prop[]; findings: FindingInput[]; passed: number; failed: number }

export function runProperties(seed?: number): PropertiesReport {
  const props: Prop[] = [
    // Le Super Admin domine tout droit accordé à n'importe quel rôle.
    run("P-RBAC-SUPERADMIN", "Le Super Admin couvre tout droit d'un autre rôle",
      gen.record({ role: gen.constantFrom(ROLES), m: gen.constantFrom(MODULES as readonly string[]), a: gen.constantFrom(ACTIONS as readonly string[]) }),
      (v: { role: string; m: string; a: string }) => !canS(v.role, v.m, v.a) || canS("SUPER_ADMIN", v.m, v.a), seed),

    // Acquisition des congés idempotente : recréditer le même mois n'ajoute rien (once-and-only-once).
    run("P-ACCRUAL-IDEMPOTENT", "Acquisition de congés : un mois n'est crédité qu'une fois",
      gen.record({ my: gen.int(1, 12), yy: gen.int(2000, 2100), tm: gen.int(1, 12), ty: gen.int(2000, 2100) }),
      (v: { my: number; yy: number; tm: number; ty: number }) => {
        const marker = ym(v.yy, v.my), target = ym(v.ty, v.tm);
        const s1 = accrualStep(marker, target);
        const s2 = accrualStep(s1.marker, target); // rejouer le même mois
        return s2.credit === 0;
      }, seed),

    // Nombre de mois toujours ≥ 0.
    run("P-MONTHS-NONNEG", "monthsBetweenYm ≥ 0",
      gen.record({ y1: gen.int(2000, 2100), m1: gen.int(1, 12), y2: gen.int(2000, 2100), m2: gen.int(1, 12) }),
      (v: { y1: number; m1: number; y2: number; m2: number }) => monthsBetweenYm(ym(v.y1, v.m1), ym(v.y2, v.m2)) >= 0, seed),

    // Monotonie : avancer la cible ne diminue jamais le nombre de mois écoulés.
    run("P-MONTHS-MONO", "monthsBetweenYm est croissant en la cible",
      gen.record({ y: gen.int(2000, 2098), m: gen.int(1, 12), off1: gen.int(0, 60), off2: gen.int(0, 60) }),
      (v: { y: number; m: number; off1: number; off2: number }) => {
        const base = v.y * 12 + (v.m - 1);
        const lo = Math.min(v.off1, v.off2), hi = Math.max(v.off1, v.off2);
        const a = base + lo, b = base + hi;
        const ymA = ym(Math.floor(a / 12), (a % 12) + 1), ymB = ym(Math.floor(b / 12), (b % 12) + 1);
        const start = ym(v.y, v.m);
        return monthsBetweenYm(start, ymB) >= monthsBetweenYm(start, ymA);
      }, seed),

    // Expurgation idempotente : re-expurger ne change plus rien.
    run("P-REDACT-IDEMPOTENT", "redact(redact(x)) = redact(x)",
      gen.record({ password: gen.stringOf("ab12!#", 40), token: gen.stringOf("xy90", 600), name: gen.stringOf("Zoé ", 30), n: gen.int(0, 999) }),
      (v: unknown) => JSON.stringify(redact(redact(v))) === JSON.stringify(redact(v)), seed),

    // Expurgation préserve la forme : mêmes clés de premier niveau.
    run("P-REDACT-SHAPE", "redact préserve les clés de premier niveau",
      gen.record({ secret: gen.stringOf("ab", 20), email: gen.stringOf("a@.", 20), count: gen.int(0, 99) }),
      (v: Record<string, unknown>) => {
        const r = redact(v) as Record<string, unknown>;
        const a = Object.keys(v).sort().join(","), b = Object.keys(r).sort().join(",");
        return a === b;
      }, seed),
  ];

  const findings: FindingInput[] = [];
  for (const p of props) {
    if (!p.result.ok) {
      findings.push({
        severity: "HIGH", category: "property", module: "ADMIN",
        title: `Propriété ${p.id} violée`,
        detail: `${p.label} — contre-exemple minimal après ${p.result.shrinkSteps ?? 0} réduction(s).`,
        evidence: { seed: p.result.seed, counterexample: redact(p.result.counterexample), minimal: redact(p.result.shrunk) },
        suggestion: `Reproduire avec la graine ${p.result.seed}. Une propriété fondamentale du produit est fausse.`,
        confidence: "high",
      });
    }
  }
  return { props, findings, passed: props.filter((p) => p.result.ok).length, failed: findings.length };
}
