import { INVARIANTS } from "../invariants/registry";
import { STATE_MACHINES } from "../state-machines/registry";
import type { FindingInput } from "../types";
import { makeRng } from "./property";

/**
 * Mutation testing (§27) — valide la SUITE elle-même. On fabrique des mondes synthétiques **en
 * mémoire** (aucune écriture base), on y introduit des corruptions métier réalistes (mutations),
 * puis on exécute TOUS les prédicats d'invariants du modèle. Une mutation détectée = « tuée » ;
 * une mutation **survivante** (qu'aucun invariant n'attrape) prouve que la suite est insuffisante.
 * « Une suite dont tous les tests passent mais qui ne détecte pas les mutations est insuffisante. »
 */

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

function predicatesFor(model: string): Predicate[] {
  const inv = INVARIANTS.filter((i) => i.predicate?.model === model).map((i) => i.predicate!.holds);
  const sm = STATE_MACHINES.filter((m) => m.model === model && m.coupling).map((m) => (r: Row) => m.coupling!.holds(r));
  return [...inv, ...sm];
}

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

interface MutationOp {
  id: string; model: string; describe: string;
  base: (rng: () => number) => Row; // enregistrement VALIDE
  mutate: (row: Row, rng: () => number) => Row; // corruption ciblée
}

const OPS: MutationOp[] = [
  { id: "MUT-USR-ROLE", model: "user", describe: "rôle inconnu injecté",
    base: (r) => ({ role: pick(r, ["SALES_USER", "VIEWER", "DIRECTION", "SUPER_ADMIN"]), secondaryRole: null }),
    mutate: (row, r) => ({ ...row, role: `GHOST_${Math.floor(r() * 999)}` }) },
  { id: "MUT-WFI-DROP-SLUG", model: "workflowInstance", describe: "instance IN_PROGRESS privée d'étape courante",
    base: () => ({ status: "IN_PROGRESS", currentSlug: "final" }),
    mutate: (row) => ({ ...row, currentSlug: null }) },
  { id: "MUT-WFI-TERMINAL-SLUG", model: "workflowInstance", describe: "instance terminale avec étape restante",
    base: (r) => ({ status: pick(r, ["APPROVED", "REJECTED", "CANCELLED"]), currentSlug: null }),
    mutate: (row) => ({ ...row, currentSlug: "final" }) },
  { id: "MUT-VAL-NO-DATE", model: "validationRequest", describe: "décision sans date de décision",
    base: (r) => ({ status: pick(r, ["APPROVED", "REJECTED"]), decidedAt: new Date() }),
    mutate: (row) => ({ ...row, decidedAt: null }) },
  { id: "MUT-VAL-PENDING-DATE", model: "validationRequest", describe: "en attente mais déjà datée",
    base: () => ({ status: "PENDING", decidedAt: null }),
    mutate: (row) => ({ ...row, decidedAt: new Date() }) },
  { id: "MUT-BUDGET-PHANTOM", model: "budgetEnvelope", describe: "module fantôme dans une enveloppe",
    base: (r) => ({ modules: [pick(r, ["FINANCES", "SPONSORING", "EVENTS"])] }),
    mutate: (row) => ({ ...row, modules: [...(row.modules as string[]), "MODULE_FANTOME"] }) },
  { id: "MUT-LEAVE-BADMONTH", model: "employee", describe: "marqueur d'acquisition à mois invalide",
    base: (r) => ({ leaveAccruedThrough: `20${pick(r, ["20", "24", "26"])}-0${pick(r, ["1", "5", "9"])}` }),
    mutate: (row) => ({ ...row, leaveAccruedThrough: "2026-13" }) },
  { id: "MUT-EXP-NEGATIVE", model: "expenseOrder", describe: "montant négatif",
    base: (r) => ({ amount: Math.floor(r() * 100000) }),
    mutate: (row, r) => ({ ...row, amount: -1 - Math.floor(r() * 5000) }) },
];

export interface MutationOpReport { id: string; model: string; describe: string; introduced: number; detected: number; survived: number }
export interface MutationReport {
  introduced: number; detected: number; survived: number; killRate: number;
  perOp: MutationOpReport[];
  baseSanityOk: boolean;
  findings: FindingInput[];
}

export function runMutationTesting(seed = 0xC0FFEE, perOp = 30): MutationReport {
  const rng = makeRng(seed);
  const perOpReports: MutationOpReport[] = [];
  const findings: FindingInput[] = [];
  let baseSanityOk = true;
  let introduced = 0, detected = 0, survived = 0;

  for (const op of OPS) {
    const preds = predicatesFor(op.model);
    let opDetected = 0, opSurvived = 0;
    const survivors: Row[] = [];
    for (let i = 0; i < perOp; i++) {
      const base = op.base(rng);
      if (preds.some((p) => !p(base))) baseSanityOk = false; // le témoin doit être valide
      const mutant = op.mutate(base, rng);
      const killed = preds.some((p) => !p(mutant));
      if (killed) opDetected++;
      else { opSurvived++; if (survivors.length < 3) survivors.push(mutant); }
    }
    introduced += perOp; detected += opDetected; survived += opSurvived;
    perOpReports.push({ id: op.id, model: op.model, describe: op.describe, introduced: perOp, detected: opDetected, survived: opSurvived });
    if (opSurvived > 0) {
      findings.push({
        severity: "HIGH", category: "mutation", module: "ADMIN",
        title: `Mutation survivante — ${op.describe} (${op.id})`,
        detail: `${opSurvived}/${perOp} corruption(s) « ${op.describe} » ne sont attrapées par AUCUN invariant du modèle « ${op.model} » : la suite est insuffisante sur ce point.`,
        evidence: survivors,
        suggestion: "Ajouter/renforcer un invariant qui détecte cette corruption métier.",
        confidence: "high",
      });
    }
  }

  if (!baseSanityOk) {
    findings.push({
      severity: "MEDIUM", category: "mutation", module: "ADMIN",
      title: "Témoin de mutation invalide",
      detail: "Un enregistrement témoin (non muté) est rejeté par un invariant — le générateur de témoins ou l'invariant est trop strict (faux positif possible).",
      confidence: "medium",
    });
  }

  return { introduced, detected, survived, killRate: introduced ? detected / introduced : 1, perOp: perOpReports, baseSanityOk, findings };
}
