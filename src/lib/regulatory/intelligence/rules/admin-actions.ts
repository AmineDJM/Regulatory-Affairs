"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { regCan } from "../access";
import { regAudit } from "../audit";
import type { LoadedRule } from "./engine";
import { parseRuleTests, runRuleTests, type RuleTestResult } from "./rule-engine";
import { seedRulePacks } from "./seed-packs";

/**
 * Administration du MOTEUR DE RÈGLES (G5). **Super Admin / regulatory.rules.manage.**
 * Amorçage des packs, activation/retrait (ACTIVE = fait foi), (dés)activation d'une règle,
 * exécution des tests golden — tout tracé.
 */

interface Result { ok: boolean; error?: string }

const str = (fd: FormData, k: string) => { const v = fd.get(k); return v ? String(v).trim() : null; };

function canManage(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN" || regCan(user as never, "regulatory.rules.manage");
}

export async function seedRulePacksAction(): Promise<Result & { packs?: number; rules?: number }> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration des règles." };
  const { packs, rules, skipped } = await seedRulePacks(user.id);
  await regAudit({ actorId: user.id, action: "RULES_SEEDED", detail: `Packs de règles amorcés : ${packs} pack(s), ${rules} règle(s) (${skipped} déjà présents).` });
  revalidatePath("/admin/regulatory-corpus");
  if (packs === 0) return { ok: false, error: "Tous les packs de base sont déjà présents." };
  return { ok: true, packs, rules };
}

export async function setRulePackStatus(formData: FormData): Promise<Result> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration des règles." };
  const packId = str(formData, "packId");
  const status = str(formData, "status"); // DRAFT | ACTIVE | RETIRED
  if (!packId || !status || !["DRAFT", "ACTIVE", "RETIRED"].includes(status)) return { ok: false, error: "Paramètres invalides." };

  const pack = await prisma.regulatoryRulePack.findUnique({ where: { id: packId }, select: { code: true, name: true } });
  if (!pack) return { ok: false, error: "Pack introuvable." };

  await prisma.regulatoryRulePack.update({
    where: { id: packId },
    data: { status: status as "DRAFT" | "ACTIVE" | "RETIRED", approvedById: status === "ACTIVE" ? user.id : undefined, approvedAt: status === "ACTIVE" ? new Date() : undefined },
  });
  await regAudit({ actorId: user.id, action: `RULEPACK_${status}`, detail: `Pack de règles « ${pack.name} » → ${status}.` });
  revalidatePath("/admin/regulatory-corpus");
  return { ok: true };
}

export async function toggleRuleActive(formData: FormData): Promise<Result> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration des règles." };
  const ruleId = str(formData, "ruleId");
  const active = str(formData, "active") === "true";
  if (!ruleId) return { ok: false, error: "Règle absente." };
  const rule = await prisma.regulatoryRule.findUnique({ where: { id: ruleId }, select: { code: true } });
  if (!rule) return { ok: false, error: "Règle introuvable." };
  await prisma.regulatoryRule.update({ where: { id: ruleId }, data: { active } });
  await regAudit({ actorId: user.id, action: active ? "RULE_ENABLED" : "RULE_DISABLED", detail: `Règle « ${rule.code} » ${active ? "activée" : "désactivée"}.` });
  revalidatePath("/admin/regulatory-corpus");
  return { ok: true };
}

export interface PackTestReport {
  ok: boolean;
  error?: string;
  total?: number;
  passed?: number;
  rules?: { code: string; title: string; results: RuleTestResult[] }[];
}

/** Exécute les tests golden de TOUTES les règles d'un pack — validation avant activation. */
export async function runRulePackTests(formData: FormData): Promise<PackTestReport> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration des règles." };
  const packId = str(formData, "packId");
  if (!packId) return { ok: false, error: "Pack absent." };

  const rules = await prisma.regulatoryRule.findMany({
    where: { packId },
    orderBy: { ordinal: "asc" },
    select: { code: true, kind: true, sectionCode: true, factKey: true, severity: true, blocker: true, title: true, detail: true, remediation: true, tests: true },
  });

  const report: { code: string; title: string; results: RuleTestResult[] }[] = [];
  let total = 0, passed = 0;
  for (const r of rules) {
    const cases = parseRuleTests(r.tests);
    if (cases.length === 0) continue;
    const loaded: LoadedRule = {
      code: r.code, kind: r.kind, sectionCode: r.sectionCode, factKey: r.factKey, severity: r.severity,
      blocker: r.blocker, title: r.title, detail: r.detail, remediation: r.remediation, citation: null,
    };
    const results = runRuleTests(loaded, cases);
    total += results.length;
    passed += results.filter((x) => x.ok).length;
    report.push({ code: r.code, title: r.title, results });
  }
  await regAudit({ actorId: user.id, action: "RULEPACK_TESTED", detail: `Tests golden du pack : ${passed}/${total} cas conformes.` });
  return { ok: true, total, passed, rules: report };
}
