import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PERMISSIONS, defaultScope, type Module, type Action } from "@/lib/rbac";
import { NAVIGATION } from "@/lib/labels";
import { sections360 } from "./vues-360-acces";
import type { SessionUser } from "@/lib/rbac";

/**
 * VUES 360° ET CLOISONNEMENT (§69, §86) — une section n'apparaît qu'à qui a le droit de son module ; le KAM ne
 * touche ni aux règles de segmentation, ni à la structure de la BU, ni à la répartition des coûts.
 */

const acteur = (role: keyof typeof PERMISSIONS): SessionUser => {
  const modules = new Map<Module, { actions: Set<Action>; scope: "ALL" | "ASSIGNED" }>();
  for (const [m, a] of Object.entries(PERMISSIONS[role])) modules.set(m as Module, { actions: new Set(a as Action[]), scope: defaultScope(role, m as Module) });
  return { id: "u", role, secondaryRole: null, access: { modules } } as unknown as SessionUser;
};

describe("sections 360° par rôle", () => {
  it("le KAM voit la segmentation et le terrain, pas les finances", () => {
    const s = sections360(acteur("MEDICAL_DELEGATE"));
    expect(s.segmentation).toBe(true);
    expect(s.finances).toBe(false);
  });
  it("§86 — le KAM ne publie pas de règles, ne gère pas la BU, ne répartit pas les coûts", () => {
    const p = PERMISSIONS.MEDICAL_DELEGATE;
    expect(p.SEGMENTATION).not.toContain("VALIDATE");
    expect(p.SALES_PLANNING ?? []).not.toContain("UPDATE");
    expect(p.FINANCES ?? []).not.toContain("VALIDATE");
    expect(p.CONSUMPTION).toBeUndefined();
  });
  it("l'action de répartition exige « Valider » sur les Finances", () => {
    expect(readFileSync("src/lib/actions/repartition-couts-actions.ts", "utf8")).toContain('userCan(user, "FINANCES", "VALIDATE")');
  });
  it("menu : Produits et Consommation sont des modules à part (accès réglables dans la console)", () => {
    expect(NAVIGATION.find((n) => n.href === "/produits")?.module).toBe("PRODUCTS");
    expect(NAVIGATION.find((n) => n.href === "/consommation")?.module).toBe("CONSUMPTION");
  });
});
