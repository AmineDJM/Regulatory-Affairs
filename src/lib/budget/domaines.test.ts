import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { UserRole } from "@prisma/client";
import {
  DOMAINES, DOMAINES_POLE, MODULES_REGULATORY_BUDGET, dansLaPortee, domaineDe, domaineRegulatoryParDefaut, poleDe, totaliser,
  type DomainePole,
} from "./domaines";
import { domaineParDefaut } from "@/lib/budget-marketing/domaine";
import {
  PERMISSIONS, canGovernPoleEnvelope, canManageEnvelope, canViewEnvelope,
  type Action, type EffectiveAccess, type Module, type SessionUser,
} from "@/lib/rbac";
import { BUDGET_OPERATIONS_TABS, BUDGET_REGULATORY_TABS, MODULE_LABELS, NAVIGATION } from "@/lib/labels";

/**
 * BUDGET REGULATORY et BUDGET OPERATIONS & SALES (Direction, 08/10) — après le Budget Marketing, la même mécanique pour
 * deux autres pôles : quelles enveloppes sont à qui, qui les voit et les gère, et la règle qui fait que Budgets reste
 * la SOMME exacte des domaines.
 */

function utilisateur(role: UserRole, modules: Partial<Record<Module, Action[]>>, id = `u-${role}`): SessionUser {
  const m = new Map<string, { actions: Set<Action>; scope: "ALL" }>();
  for (const [k, v] of Object.entries(modules)) m.set(k, { actions: new Set(v), scope: "ALL" });
  return { id, role, access: { modules: m, rowGrants: new Map() } as unknown as EffectiveAccess };
}
const duRole = (role: UserRole) => utilisateur(role, PERMISSIONS[role] as Partial<Record<Module, Action[]>>);
const vide = { accessRoles: [], accessUserIds: [], managerRoles: [], managerUserIds: [] };
const env = (domaine: string) => ({ ...vide, domaine });

describe("quel pôle tient une enveloppe", () => {
  it("le champ décide ; absent ou inconnu = générale", () => {
    for (const d of DOMAINES_POLE) {
      expect(domaineDe({ domaine: d })).toBe(d);
      expect(poleDe({ domaine: d })).toBe(d);
    }
    expect(domaineDe({ domaine: "GENERAL" })).toBe("GENERAL");
    expect(domaineDe({ domaine: "N_IMPORTE_QUOI" })).toBe("GENERAL");
    expect(domaineDe({})).toBe("GENERAL");
    expect(poleDe({ domaine: null })).toBeNull();
  });

  it("chaque portée ne lit que son domaine ; Budgets lit tout", () => {
    const es = [env("MARKETING"), env("REGULATORY"), env("OPERATIONS"), env("GENERAL"), {}];
    expect(es.filter((e) => dansLaPortee(e, "TOUT"))).toHaveLength(5);
    expect(es.filter((e) => dansLaPortee(e, undefined))).toHaveLength(5);
    for (const d of DOMAINES_POLE) expect(es.filter((e) => dansLaPortee(e, d)).map(domaineDe)).toEqual([d]);
  });

  it("à la bascule : une enveloppe générale qui ne couvre QUE Regulatory devient REGULATORY", () => {
    expect(domaineRegulatoryParDefaut({ domaine: "GENERAL", modules: ["REGULATORY"] })).toBe("REGULATORY");
    expect(domaineRegulatoryParDefaut({ domaine: "GENERAL", modules: [], module: "REGULATORY" })).toBe("REGULATORY");
  });

  it("une enveloppe mixte, transverse, d'un autre pôle ou « opérations » devinée ne bouge pas", () => {
    expect(domaineRegulatoryParDefaut({ domaine: "GENERAL", modules: ["REGULATORY", "GENERAL_MEANS"] })).toBe("GENERAL");
    expect(domaineRegulatoryParDefaut({ domaine: "GENERAL", modules: [] })).toBe("GENERAL");
    expect(domaineRegulatoryParDefaut({ domaine: "MARKETING", modules: ["REGULATORY"] })).toBe("MARKETING");
    expect(domaineRegulatoryParDefaut({ domaine: "GENERAL", modules: ["LOGISTICS"] })).toBe("GENERAL");
    expect(domaineRegulatoryParDefaut({ domaine: "GENERAL", modules: ["PCH"] })).toBe("GENERAL");
  });

  it("la règle Marketing de la première bascule est inchangée", () => {
    expect(domaineParDefaut({ modules: ["SPONSORING", "EVENTS"] })).toBe("MARKETING");
    expect(domaineParDefaut({ modules: ["REGULATORY"] })).toBe("GENERAL");
  });

  it("la migration applique la MÊME règle que le code, une seule fois, sans BOM", () => {
    const dir = join(process.cwd(), "prisma/migrations/20270117100000_budget_regulatory_operations");
    expect(existsSync(dir)).toBe(true);
    const sql = readFileSync(join(dir, "migration.sql"), "utf8");
    expect(sql.charCodeAt(0), "pas de BOM").not.toBe(0xfeff);
    expect(sql).toMatch(/IF NOT EXISTS/);
    expect(sql).toMatch(/WHERE e\."domaine" = 'GENERAL'/);
    const listes = [...sql.matchAll(/ARRAY\[('[A-Z_]+'(?:,\s*'[A-Z_]+')*)\]/g)].map((m) => m[1].replace(/'/g, "").split(/,\s*/).sort());
    expect(listes.length).toBeGreaterThanOrEqual(1);
    for (const l of listes) expect(l).toEqual([...MODULES_REGULATORY_BUDGET].sort());
    expect(sql).not.toMatch(/SET "domaine" = 'OPERATIONS'/);
    expect(sql.match(/SET "domaine" = '[A-Z]+'/g)).toEqual([`SET "domaine" = 'REGULATORY'`]);
    for (const col of ['"cle"', '"businessUnitId"', '"regulatoryProductId"']) expect(sql).toContain(col);
  });
});

describe("totaux — Budgets est la somme exacte des domaines", () => {
  const enveloppes = [
    { id: "m", domaine: "MARKETING", total: 5_000_000, allocated: 4_000_000, consumed: 1_200_000 },
    { id: "r", domaine: "REGULATORY", total: 8_000_000, allocated: 8_000_000, consumed: 2_500_000 },
    { id: "o", domaine: "OPERATIONS", total: 60_000_000, allocated: 55_000_000, consumed: 41_000_000 },
    { id: "g", domaine: "GENERAL", total: 20_000_000, allocated: 18_000_000, consumed: 9_000_000 },
    { id: "r2", domaine: "REGULATORY", total: 1_000_000, allocated: 0, consumed: 1_100_000 },
  ];

  it("poste par poste, toutes portées additionnées = Budgets", () => {
    const tout = totaliser(enveloppes.filter((e) => dansLaPortee(e, "TOUT")));
    const parts = [...DOMAINES_POLE.map((d) => totaliser(enveloppes.filter((e) => dansLaPortee(e, d)))), totaliser(enveloppes.filter((e) => poleDe(e) === null))];
    for (const k of ["count", "total", "allocated", "consumed", "remaining"] as const) {
      expect(parts.reduce((a, p) => a + p[k], 0), k).toBe(tout[k]);
    }
    expect(totaliser(enveloppes.filter((e) => dansLaPortee(e, "REGULATORY")))).toEqual({ count: 2, total: 9_000_000, allocated: 8_000_000, consumed: 3_600_000, remaining: 5_400_000 });
  });

  it("aucune enveloppe n'est comptée dans deux pôles", () => {
    for (const e of enveloppes) expect(DOMAINES_POLE.filter((d) => dansLaPortee(e, d)).length).toBeLessThanOrEqual(1);
  });
});

describe("qui voit et gère les enveloppes de chaque pôle", () => {
  it("défauts : Regulatory — Head of Regulatory, Direction, DG gèrent ; Finances et assistante lisent", () => {
    for (const r of ["HEAD_OF_REGULATORY", "DIRECTION", "GENERAL_MANAGER", "SUPER_ADMIN"] as UserRole[]) {
      expect(PERMISSIONS[r].BUDGET_REGULATORY, r).toEqual(expect.arrayContaining(["VIEW", "CREATE", "UPDATE", "DELETE"]));
    }
    expect(PERMISSIONS.FINANCE_BUDGET_MANAGER.BUDGET_REGULATORY).toEqual(["VIEW", "EXPORT"]);
    expect(PERMISSIONS.REGULATORY_ASSISTANT.BUDGET_REGULATORY).toEqual(["VIEW", "EXPORT"]);
    for (const r of ["OPERATIONS_DIRECTOR", "PRODUCT_MANAGER", "MEDICAL_DELEGATE", "VIEWER"] as UserRole[]) {
      expect(PERMISSIONS[r].BUDGET_REGULATORY, r).toBeUndefined();
    }
  });

  it("défauts : Operations & Sales — Directeur des Opérations, Direction, DG gèrent ; Finances lisent", () => {
    for (const r of ["OPERATIONS_DIRECTOR", "DIRECTION", "GENERAL_MANAGER", "SUPER_ADMIN"] as UserRole[]) {
      expect(PERMISSIONS[r].BUDGET_OPERATIONS, r).toEqual(expect.arrayContaining(["VIEW", "CREATE", "UPDATE", "DELETE"]));
    }
    expect(PERMISSIONS.FINANCE_BUDGET_MANAGER.BUDGET_OPERATIONS).toEqual(["VIEW", "EXPORT"]);
    for (const r of ["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "PRODUCT_MANAGER", "MEDICAL_DELEGATE", "VIEWER"] as UserRole[]) {
      expect(PERMISSIONS[r].BUDGET_OPERATIONS, r).toBeUndefined();
    }
  });

  const cas: [UserRole, DomainePole][] = [["HEAD_OF_REGULATORY", "REGULATORY"], ["OPERATIONS_DIRECTOR", "OPERATIONS"], ["PRODUCT_MANAGER", "MARKETING"]];
  it.each(cas)("%s gère les enveloppes de SON pôle — jamais celles d'un autre, ni une générale", (role, pole) => {
    const u = duRole(role);
    for (const d of [...DOMAINES_POLE, "GENERAL"]) {
      const e = env(d);
      expect(canManageEnvelope(u, e), `${role} gère ${d}`).toBe(d === pole);
      expect(canGovernPoleEnvelope(u, pole, "UPDATE", e), `${role} gouverne ${d}`).toBe(d === pole);
    }
    expect(canGovernPoleEnvelope(u, pole, "CREATE")).toBe(true);
    for (const autre of DOMAINES_POLE.filter((d) => d !== pole)) expect(canGovernPoleEnvelope(u, autre, "CREATE")).toBe(false);
  });

  it("les Finances lisent les trois pôles sans les gérer ; l'enveloppe générale reste stricte", () => {
    const fin = duRole("FINANCE_BUDGET_MANAGER");
    for (const d of DOMAINES_POLE) {
      expect(canViewEnvelope(fin, env(d)), d).toBe(true);
      expect(canManageEnvelope(fin, env(d)), d).toBe(false);
    }
    expect(canViewEnvelope(fin, env("GENERAL"))).toBe(false);
  });

  it("une restriction de la console l'emporte : Voir seul ne gère pas", () => {
    const lecteur = utilisateur("HEAD_OF_REGULATORY", { BUDGET_REGULATORY: ["VIEW"] });
    expect(canViewEnvelope(lecteur, env("REGULATORY"))).toBe(true);
    expect(canManageEnvelope(lecteur, env("REGULATORY"))).toBe(false);
    expect(canGovernPoleEnvelope(lecteur, "REGULATORY", "CREATE")).toBe(false);
  });
});

describe("les modules dans le menu", () => {
  it("Budget Regulatory sous Regulatory, Budget Operations & Sales sous Operations & Sales, quatre écrans chacun", () => {
    expect(MODULE_LABELS.BUDGET_REGULATORY).toBe("Budget Regulatory");
    expect(MODULE_LABELS.BUDGET_OPERATIONS).toBe("Budget Operations & Sales");
    const reg = NAVIGATION.find((n) => n.href === DOMAINES.REGULATORY.chemin);
    const ops = NAVIGATION.find((n) => n.href === DOMAINES.OPERATIONS.chemin);
    expect(reg?.module).toBe("BUDGET_REGULATORY");
    expect(reg?.pole).toBe("REGULATORY");
    expect(ops?.module).toBe("BUDGET_OPERATIONS");
    expect(ops?.pole).toBe("OPERATIONS_SALES");
    expect(BUDGET_REGULATORY_TABS.map((t) => t.href)).toEqual(["/budget-regulatory", "/budget-regulatory/bv", "/budget-regulatory/depenses", "/budget-regulatory/reglages"]);
    expect(BUDGET_OPERATIONS_TABS.map((t) => t.href)).toEqual(["/budget-operations", "/budget-operations/masse-salariale", "/budget-operations/depenses", "/budget-operations/reglages"]);
    for (const t of BUDGET_REGULATORY_TABS) expect(t.module).toBe("BUDGET_REGULATORY");
    for (const t of BUDGET_OPERATIONS_TABS) expect(t.module).toBe("BUDGET_OPERATIONS");
  });

  it("les écrans gardent la porte de leur module", () => {
    for (const t of [...BUDGET_REGULATORY_TABS, ...BUDGET_OPERATIONS_TABS]) {
      const fichier = join(process.cwd(), "src/app/(app)", t.href, "page.tsx");
      expect(readFileSync(fichier, "utf8"), t.href).toContain(`requireModule("${t.module}")`);
    }
  });
});
