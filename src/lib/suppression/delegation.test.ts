import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corbeillePermise, suppressionPermise, estDirecteurDesOperations, typesDeCorbeillePermis } from "./delegation";
import { PERMISSIONS, type SessionUser } from "@/lib/rbac";

/** Un utilisateur dont les droits sont ceux de la matrice de son rôle (sans console) — de quoi juger la règle. */
function acteur(role: string, secondaryRole: string | null = null): SessionUser {
  const matrice = (PERMISSIONS as Record<string, Record<string, string[]>>)[role] ?? {};
  const modules = new Map(Object.entries(matrice).map(([m, a]) => [m, { actions: new Set(a), scope: "ALL" }]));
  return { id: role, role, secondaryRole, access: { role, secondaryRole, modules, rowGrants: [], hidden: new Set() } } as unknown as SessionUser;
}

describe("le directeur des opérations supprime et récupère dans SES modules", () => {
  const ops = acteur("OPERATIONS_DIRECTOR");

  it("il est reconnu, en rôle principal comme secondaire", () => {
    expect(estDirecteurDesOperations(ops)).toBe(true);
    expect(estDirecteurDesOperations(acteur("MEDICAL_DELEGATE", "OPERATIONS_DIRECTOR"))).toBe(true);
    expect(estDirecteurDesOperations(acteur("MEDICAL_DELEGATE"))).toBe(false);
  });

  it("il restaure ce qui relève de ses modules : ventes, PCH, demandes administratives, stock promotionnel, Ad & Pro", () => {
    for (const k of ["SALE", "PCH_TENDER", "ADMIN_REQUEST", "PROMO_STOCK_ITEM", "SPONSORING", "EVENT"]) {
      expect(corbeillePermise(ops, k), k).toBe(true);
    }
  });

  it("pas ce qui n'est pas à lui : un dossier réglementaire, un salarié, une conversation", () => {
    for (const k of ["REGULATORY_PRODUCT", "EMPLOYEE", "CONVERSATION", "FINANCE_TRANSACTION"]) {
      expect(corbeillePermise(ops, k), k).toBe(false);
    }
  });

  it("il supprime (réversiblement) par le bouton commun dans ses modules, et seulement là", () => {
    expect(suppressionPermise(ops, "ADMIN_REQUEST")).toBe(true);
    expect(suppressionPermise(ops, "PROMO_STOCK_ITEM")).toBe(true);
    expect(suppressionPermise(ops, "REGULATORY_PRODUCT")).toBe(false);
  });

  it("un autre rôle n'en reçoit rien ; le Super Admin garde tout", () => {
    const del = acteur("MEDICAL_DELEGATE");
    expect(corbeillePermise(del, "SALE")).toBe(false);
    expect(suppressionPermise(del, "ADMIN_REQUEST")).toBe(false);
    const sa = { ...acteur("SUPER_ADMIN"), role: "SUPER_ADMIN" } as SessionUser;
    expect(corbeillePermise(sa, "REGULATORY_PRODUCT")).toBe(true);
    expect(typesDeCorbeillePermis(ops, ["SALE", "EMPLOYEE"])).toEqual(["SALE"]);
  });
});

describe("points d'appel", () => {
  const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
  it("la restauration et la suppression lisent la règle ; détruire pour de bon reste au Super Admin", () => {
    const a = lire("src/lib/actions/admin-delete-actions.ts");
    expect(a).toContain("corbeillePermise(user, rec.kind)");
    expect(a).toContain("peutSupprimerDansSesModules(user, kind, id)");
    const destroy = a.slice(a.indexOf("export async function destroyDeletedRecord"), a.indexOf("export async function destroyDeletedRecord") + 300);
    expect(destroy).toContain('user.role !== "SUPER_ADMIN"');
  });

  it("sa corbeille restaure sans détruire", () => {
    expect(lire("src/app/(app)/corbeille/page.tsx")).toContain("peutDetruire={false}");
  });
});
