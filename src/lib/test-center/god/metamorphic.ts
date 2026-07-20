import { extractLooseJson } from "@/lib/regulatory/intelligence/ai/json";
import { monthsBetweenYm, accrualStep } from "@/lib/scheduled";
import type { FindingInput } from "../types";
import { gen, checkProperty, type PropertyResult } from "./property";

/**
 * Tests métamorphiques (§27) — relations qui DOIVENT tenir entre deux exécutions, y compris pour
 * l'IA/OCR : la sortie d'un extracteur JSON d'IA doit être **invariante au bruit de formatage**
 * (fences markdown, prose autour). Plus des relations sur le calcul de mois (invariance par
 * translation) et l'acquisition des congés (additivité). Contre-exemples réduits + graine.
 */

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const ymOf = (idx: number) => ym(Math.floor(idx / 12), (idx % 12) + 1);

interface Rel { id: string; label: string; result: PropertyResult<unknown> }

export interface MetamorphicReport { relations: Rel[]; findings: FindingInput[]; passed: number; failed: number }

export function runMetamorphic(seed?: number): MetamorphicReport {
  const relations: Rel[] = [
    // OCR/IA : l'extraction JSON est robuste au bruit de formatage (fences + prose autour).
    {
      id: "MR-AI-JSON-NOISE", label: "Extraction JSON d'IA invariante au bruit de formatage",
      result: checkProperty(
        gen.record({ a: gen.int(0, 100000), b: gen.stringOf("abcdefghij ", 24) }),
        (v: { a: number; b: string }) => {
          const bare = JSON.stringify(v);
          const noisy = `D'accord, voici le résultat demandé :\n\`\`\`json\n${bare}\n\`\`\`\nJ'espère que cela convient.`;
          return JSON.stringify(extractLooseJson(noisy)) === JSON.stringify(extractLooseJson(bare));
        }, { runs: 200, seed },
      ) as PropertyResult<unknown>,
    },
    // Calcul de mois invariant par translation : décaler les deux bornes du même nombre de mois.
    {
      id: "MR-MONTHS-TRANSLATE", label: "monthsBetweenYm invariant par translation",
      result: checkProperty(
        gen.record({ base: gen.int(24000, 25100), off: gen.int(0, 40), shift: gen.int(0, 400) }),
        (v: { base: number; off: number; shift: number }) => {
          const a = ymOf(v.base), b = ymOf(v.base + v.off);
          const a2 = ymOf(v.base + v.shift), b2 = ymOf(v.base + v.off + v.shift);
          return monthsBetweenYm(a, b) === monthsBetweenYm(a2, b2);
        }, { runs: 200, seed },
      ) as PropertyResult<unknown>,
    },
    // Acquisition additive : un saut de N mois crédite autant que N pas mensuels cumulés.
    {
      id: "MR-ACCRUAL-ADDITIVE", label: "Acquisition congés : un saut de N mois = N pas mensuels",
      result: checkProperty(
        gen.record({ base: gen.int(24000, 25000), n: gen.int(0, 24) }),
        (v: { base: number; n: number }) => {
          const start = ymOf(v.base), target = ymOf(v.base + v.n);
          const oneShot = accrualStep(start, target).credit;
          let marker = start, sum = 0;
          for (let k = 1; k <= v.n; k++) { const s = accrualStep(marker, ymOf(v.base + k)); sum += s.credit; marker = s.marker; }
          return Math.abs(oneShot - sum) < 1e-9;
        }, { runs: 200, seed },
      ) as PropertyResult<unknown>,
    },
  ];

  const findings: FindingInput[] = [];
  for (const r of relations) {
    if (!r.result.ok) {
      findings.push({
        severity: "HIGH", category: "metamorphic", module: "ADMIN",
        title: `Relation métamorphique ${r.id} rompue`,
        detail: `${r.label} — contre-exemple minimal après ${r.result.shrinkSteps ?? 0} réduction(s).`,
        evidence: { seed: r.result.seed, minimal: r.result.shrunk },
        suggestion: `Reproduire avec la graine ${r.result.seed}.`,
        confidence: "high",
      });
    }
  }
  return { relations, findings, passed: relations.filter((r) => r.result.ok).length, failed: findings.length };
}
