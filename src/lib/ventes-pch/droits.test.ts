import { describe, it, expect } from "vitest";
import { PERMISSIONS, MODULES } from "@/lib/rbac";
import { MODULE_LABELS, NAVIGATION, VENTES_PCH_TABS } from "@/lib/labels";

/** VENTES PCH — le module, ses droits par défaut, son entrée de menu (Direction, 08/10). */
describe("Ventes PCH — droits et menu", () => {
  it("est un module réglable dans la console, nommé comme dans le menu", () => {
    expect(MODULES).toContain("PCH_VENTES");
    expect(MODULE_LABELS.PCH_VENTES).toBe("Ventes PCH");
  });

  it("défauts : opérations et Direction gèrent ; commercial, promotion et marketing lisent ; les autres rien", () => {
    for (const r of ["OPERATIONS_DIRECTOR", "DIRECTION", "GENERAL_MANAGER", "SUPER_ADMIN"] as const) {
      expect(PERMISSIONS[r].PCH_VENTES, r).toEqual(expect.arrayContaining(["VIEW", "UPLOAD", "UPDATE"]));
    }
    for (const r of ["NATIONAL_SALES", "HEAD_OF_SALES", "MEDICAL_PROMOTION_MANAGER", "PRODUCT_MANAGER"] as const) {
      expect(PERMISSIONS[r].PCH_VENTES, r).toEqual(["VIEW", "EXPORT"]);
    }
    expect(PERMISSIONS.MEDICAL_DELEGATE.PCH_VENTES).toBeUndefined();
    expect(PERMISSIONS.SALES_USER.PCH_VENTES).toBeUndefined();
  });

  it("remplace « Ventes » (SALES, retiré) dans Operations & Sales ; l'historique se lit avec Ventes PCH", () => {
    const entree = NAVIGATION.find((n) => n.href === "/sales");
    expect(entree).toMatchObject({ module: "PCH_VENTES", label: "Ventes PCH", pole: "OPERATIONS_SALES" });
    expect(NAVIGATION.some((n) => n.module === "SALES")).toBe(false);
    expect(VENTES_PCH_TABS.find((t) => t.href === "/sales/historique")?.module).toBe("PCH_VENTES");
  });
});
