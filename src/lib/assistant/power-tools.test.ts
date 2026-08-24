import { describe, it, expect } from "vitest";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { POWER_TOOLS, powerToolsFor, executePowerTool, powerToolsBriefing } from "./power-tools";

/**
 * Ce qui est verrouillé ici n'est pas la LISTE des outils (elle grandira) mais la RÈGLE :
 * un outil s'ouvre sur un DROIT, jamais sur un rôle en dur — et le droit est revérifié à
 * l'exécution, parce que la liste envoyée au modèle est une suggestion, pas une autorisation.
 */

function userWith(perms: Partial<Record<Module, Action[]>>, role = "DELEGATE"): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ASSIGNED" as const },
    ]),
  );
  return {
    id: "u1", name: "Test", email: "t@x.dz", role: role as CurrentUser["role"],
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

describe("powerToolsFor — les pouvoirs suivent les DROITS, pas le rôle", () => {
  it("n'ouvre le budget qu'à qui a le droit de voir les Budgets", () => {
    const withBudget = powerToolsFor(userWith({ BUDGETS: ["VIEW"] })).map((t) => t.name);
    const without = powerToolsFor(userWith({ REGULATORY: ["VIEW"] })).map((t) => t.name);
    expect(withBudget).toContain("read_budget");
    expect(without).not.toContain("read_budget");
  });

  it("n'ouvre les finances qu'à qui a le droit de voir les Finances", () => {
    expect(powerToolsFor(userWith({ FINANCES: ["VIEW"] })).map((t) => t.name)).toContain("read_finances");
    expect(powerToolsFor(userWith({ BUDGETS: ["VIEW"] })).map((t) => t.name)).not.toContain("read_finances");
  });

  it("n'ouvre la RH qu'à qui a le droit de voir le module RH", () => {
    expect(powerToolsFor(userWith({ RH: ["VIEW"] })).map((t) => t.name)).toContain("read_hr_overview");
    expect(powerToolsFor(userWith({})).map((t) => t.name)).not.toContain("read_hr_overview");
  });

  it("laisse à TOUT LE MONDE la file de ses propres décisions", () => {
    expect(powerToolsFor(userWith({})).map((t) => t.name)).toContain("list_pending_decisions");
  });

  it("donne toutes les lectures à un compte qui a tous les droits — sans le nommer « admin »", () => {
    // La liste des droits SUIT le registre : chaque nouvel outil déclare le module qui l'ouvre,
    // et ce compte-ci les porte tous (le rôle ne sert qu'aux outils exécutifs, gérés à part).
    const omni = userWith({
      BUDGETS: ["VIEW"], FINANCES: ["VIEW"], RH: ["VIEW"], WORKSPACE: ["VIEW"],
      STOCKS: ["VIEW"], MEDICAL: ["VIEW"], MAIL_REGISTER: ["VIEW"], REGULATORY: ["VIEW"],
    }, "SUPER_ADMIN");
    const names = powerToolsFor(omni).map((t) => t.name);
    expect(new Set(names)).toEqual(new Set(POWER_TOOLS.map((t) => t.def.name)));
  });

  it("aucun outil ne se gate sur un rôle : le Super Admin SANS droit budget n'a pas l'outil", () => {
    // Le point de la règle : c'est la matrice d'accès qui décide, pas l'étiquette du compte.
    const names = powerToolsFor(userWith({}, "SUPER_ADMIN")).map((t) => t.name);
    expect(names).not.toContain("read_budget");
  });
});

describe("executePowerTool — le droit est revérifié à l'exécution", () => {
  it("refuse un outil que la personne n'a pas, même si le modèle l'appelle", async () => {
    const r = await executePowerTool("read_budget", {}, userWith({ REGULATORY: ["VIEW"] }));
    expect(r).toMatch(/ne vous est pas ouvert/i);
  });

  it("rend null sur un nom qui n'est pas un outil de pouvoir (l'appelant continue son aiguillage)", async () => {
    expect(await executePowerTool("search_people", { query: "x" }, userWith({}))).toBeNull();
  });
});

describe("powerToolsBriefing", () => {
  it("annonce au modèle les outils réellement ouverts, et eux seuls", () => {
    const brief = powerToolsBriefing(userWith({ BUDGETS: ["VIEW"] }));
    expect(brief).toContain("read_budget");
    expect(brief).not.toContain("read_finances");
  });

  it("n'est jamais vide : la file de décisions est ouverte à tous", () => {
    expect(powerToolsBriefing(userWith({}))).toContain("list_pending_decisions");
  });
});
