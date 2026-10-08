import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { UserRole } from "@prisma/client";
import {
  bornesAnnee, CATEGORIES_AD_PRO, CHEMIN_BUDGET_MARKETING, dansLaPortee, domaineParDefaut, estEnveloppeMarketing,
  MODULES_AD_PRO_BUDGET, totaliser,
} from "./domaine";
import {
  PERMISSIONS, canGovernMarketingEnvelope, canManageEnvelope, canViewEnvelope,
  type Action, type EffectiveAccess, type Module, type SessionUser,
} from "@/lib/rbac";
import { BUDGET_MARKETING_TABS, MODULE_LABELS, NAVIGATION } from "@/lib/labels";

/**
 * BUDGET MARKETING (Direction, 08/10) — quelles enveloppes sont « marketing », qui les voit / les gère, et la règle
 * qui fait que Budgets et Budget Marketing ne peuvent pas diverger : une seule ligne, une seule addition.
 */

function utilisateur(role: UserRole, modules: Partial<Record<Module, Action[]>>, id = `u-${role}`): SessionUser {
  const m = new Map<string, { actions: Set<Action>; scope: "ALL" }>();
  for (const [k, v] of Object.entries(modules)) m.set(k, { actions: new Set(v), scope: "ALL" });
  return { id, role, access: { modules: m, rowGrants: new Map() } as unknown as EffectiveAccess };
}
const duRole = (role: UserRole) => utilisateur(role, PERMISSIONS[role] as Partial<Record<Module, Action[]>>);

const vide = { accessRoles: [], accessUserIds: [], managerRoles: [], managerUserIds: [] };
const MARKETING = { ...vide, domaine: "MARKETING" };
const GENERALE = { ...vide, domaine: "GENERAL" };

describe("quelles enveloppes sont marketing", () => {
  it("le champ décide ; absent = générale", () => {
    expect(estEnveloppeMarketing({ domaine: "MARKETING" })).toBe(true);
    expect(estEnveloppeMarketing({ domaine: "GENERAL" })).toBe(false);
    expect(estEnveloppeMarketing({})).toBe(false);
    expect(estEnveloppeMarketing({ domaine: null })).toBe(false);
  });

  it("à la bascule : une enveloppe qui ne couvre QUE la famille Ad & Pro devient marketing", () => {
    expect(domaineParDefaut({ modules: ["SPONSORING", "EVENTS"] })).toBe("MARKETING");
    expect(domaineParDefaut({ modules: [...MODULES_AD_PRO_BUDGET] })).toBe("MARKETING");
    expect(domaineParDefaut({ modules: [], module: "CONGRESS_NATIONAL" })).toBe("MARKETING");
  });

  it("une enveloppe mixte, transverse ou hors Ad & Pro reste générale", () => {
    expect(domaineParDefaut({ modules: ["SPONSORING", "GENERAL_MEANS"] })).toBe("GENERAL");
    expect(domaineParDefaut({ modules: [] })).toBe("GENERAL");
    expect(domaineParDefaut({ modules: ["RH"] })).toBe("GENERAL");
    expect(domaineParDefaut({ modules: [], module: null })).toBe("GENERAL");
  });

  it("la migration applique la MÊME famille que le code (aucune dérive silencieuse)", () => {
    const sql = readFileSync(join(process.cwd(), "prisma/migrations/20270116090000_budget_marketing/migration.sql"), "utf8");
    expect(sql.charCodeAt(0), "pas de BOM").not.toBe(0xfeff);
    const listes = [...sql.matchAll(/\(('[A-Z_]+'(?:,\s*'[A-Z_]+')*)\)/g)].map((m) => m[1].replace(/'/g, "").split(/,\s*/).sort());
    expect(listes.length).toBeGreaterThanOrEqual(1);
    for (const l of listes) expect(l).toEqual([...MODULES_AD_PRO_BUDGET].sort());
    expect(sql).toMatch(/ARRAY\['SPONSORING','EVENTS','CONGRESS_NATIONAL','CONGRESS_INTERNATIONAL','PROMO_MATERIAL','AD_PRO_OTHER'\]/);
    expect(sql).toMatch(/IF NOT EXISTS/);
  });

  it("les catégories Ad & Pro d'office couvrent chacune un module de la famille, une fois", () => {
    expect(CATEGORIES_AD_PRO.map((c) => c.module).sort()).toEqual([...MODULES_AD_PRO_BUDGET].sort());
  });
});

describe("portée et totaux — Budgets et Budget Marketing ne divergent pas", () => {
  const enveloppes = [
    { id: "a", domaine: "MARKETING", total: 5_000_000, allocated: 4_000_000, consumed: 1_200_000 },
    { id: "b", domaine: "GENERAL", total: 20_000_000, allocated: 18_000_000, consumed: 9_000_000 },
    { id: "c", domaine: "MARKETING", total: 1_000_000, allocated: 1_000_000, consumed: 1_100_000 },
    { id: "d", domaine: "GENERAL", total: 0, allocated: 0, consumed: 0 },
  ];

  it("Budgets voit tout, Budget Marketing seulement le marketing", () => {
    expect(enveloppes.filter((e) => dansLaPortee(e, "TOUT")).map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    expect(enveloppes.filter((e) => dansLaPortee(e, undefined)).map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    expect(enveloppes.filter((e) => dansLaPortee(e, "MARKETING")).map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("le total de Budgets = marketing + général, poste par poste (les enveloppes marketing y restent comptées)", () => {
    const tout = totaliser(enveloppes);
    const mkt = totaliser(enveloppes.filter((e) => dansLaPortee(e, "MARKETING")));
    const gen = totaliser(enveloppes.filter((e) => !estEnveloppeMarketing(e)));
    expect(tout.count).toBe(mkt.count + gen.count);
    expect(tout.total).toBe(mkt.total + gen.total);
    expect(tout.allocated).toBe(mkt.allocated + gen.allocated);
    expect(tout.consumed).toBe(mkt.consumed + gen.consumed);
    expect(tout.remaining).toBe(mkt.remaining + gen.remaining);
    expect(mkt).toEqual({ count: 2, total: 6_000_000, allocated: 5_000_000, consumed: 2_300_000, remaining: 3_700_000 });
  });

  it("une enveloppe annuelle couvre l'année entière ; une année absurde retombe sur l'année en cours", () => {
    const { debut, fin } = bornesAnnee(2027);
    expect(debut.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(fin.toISOString().slice(0, 10)).toBe("2027-12-31");
    expect(bornesAnnee(42, new Date("2026-10-08T00:00:00Z")).debut.getUTCFullYear()).toBe(2026);
    expect(bornesAnnee(null, new Date("2026-10-08T00:00:00Z")).debut.getUTCFullYear()).toBe(2026);
  });
});

describe("qui voit et gère les enveloppes marketing", () => {
  it("défauts du module : Direction Marketing, Direction, DG gèrent ; les Finances lisent ; les autres rien", () => {
    for (const r of ["PRODUCT_MANAGER", "DIRECTION", "GENERAL_MANAGER"] as UserRole[]) {
      expect(PERMISSIONS[r].BUDGET_MARKETING, r).toEqual(expect.arrayContaining(["VIEW", "CREATE", "UPDATE", "DELETE"]));
    }
    expect(PERMISSIONS.FINANCE_BUDGET_MANAGER.BUDGET_MARKETING).toEqual(["VIEW", "EXPORT"]);
    for (const r of ["MEDICAL_DELEGATE", "SALES_USER", "OPERATIONS_DIRECTOR", "VIEWER", "HEAD_OF_REGULATORY"] as UserRole[]) {
      expect(PERMISSIONS[r].BUDGET_MARKETING, r).toBeUndefined();
    }
  });

  it("la Direction Marketing voit et gère une enveloppe marketing sans liste d'accès — pas une générale", () => {
    const dm = duRole("PRODUCT_MANAGER");
    expect(canViewEnvelope(dm, MARKETING)).toBe(true);
    expect(canManageEnvelope(dm, MARKETING)).toBe(true);
    expect(canViewEnvelope(dm, GENERALE)).toBe(false);
    expect(canManageEnvelope(dm, GENERALE)).toBe(false);
    expect(canGovernMarketingEnvelope(dm, "CREATE")).toBe(true);
    expect(canGovernMarketingEnvelope(dm, "UPDATE", MARKETING)).toBe(true);
    expect(canGovernMarketingEnvelope(dm, "DELETE", GENERALE)).toBe(false);
  });

  it("les Finances lisent les enveloppes marketing sans les gérer", () => {
    const fin = duRole("FINANCE_BUDGET_MANAGER");
    expect(canViewEnvelope(fin, MARKETING)).toBe(true);
    expect(canManageEnvelope(fin, MARKETING)).toBe(false);
    expect(canGovernMarketingEnvelope(fin, "UPDATE", MARKETING)).toBe(false);
    // …et l'enveloppe générale reste stricte, comme avant.
    expect(canViewEnvelope(fin, GENERALE)).toBe(false);
  });

  it("sans le module, rien ne change : un délégué ne voit pas une enveloppe marketing", () => {
    const del = duRole("MEDICAL_DELEGATE");
    expect(canViewEnvelope(del, MARKETING)).toBe(false);
    expect(canGovernMarketingEnvelope(del, "CREATE")).toBe(false);
  });

  it("une restriction posée dans la console l'emporte : Voir seul ne gère pas", () => {
    const lecteur = utilisateur("PRODUCT_MANAGER", { BUDGET_MARKETING: ["VIEW"] });
    expect(canViewEnvelope(lecteur, MARKETING)).toBe(true);
    expect(canManageEnvelope(lecteur, MARKETING)).toBe(false);
    expect(canGovernMarketingEnvelope(lecteur, "CREATE")).toBe(false);
  });

  it("le Super Admin gouverne tout", () => {
    const sa = duRole("SUPER_ADMIN");
    expect(canGovernMarketingEnvelope(sa, "DELETE", GENERALE)).toBe(true);
    expect(canManageEnvelope(sa, MARKETING)).toBe(true);
  });
});

describe("le module dans le menu", () => {
  it("« Budget Marketing », rangé sous Marketing, avec ses quatre écrans", () => {
    expect(MODULE_LABELS.BUDGET_MARKETING).toBe("Budget Marketing");
    const entree = NAVIGATION.find((n) => n.href === CHEMIN_BUDGET_MARKETING);
    expect(entree?.module).toBe("BUDGET_MARKETING");
    expect(entree?.pole).toBe("MARKETING");
    expect(BUDGET_MARKETING_TABS.map((t) => t.href)).toEqual([
      "/budget-marketing", "/budget-marketing/depenses", "/budget-marketing/ad-pro", "/budget-marketing/reglages",
    ]);
    for (const t of BUDGET_MARKETING_TABS) expect(t.module).toBe("BUDGET_MARKETING");
  });

  it("les écrans gardent la porte du module", () => {
    for (const f of ["page.tsx", "depenses/page.tsx", "ad-pro/page.tsx", "reglages/page.tsx"]) {
      expect(readFileSync(join(process.cwd(), "src/app/(app)/budget-marketing", f), "utf8"), f).toContain('requireModule("BUDGET_MARKETING")');
    }
  });
});
