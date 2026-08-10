import { describe, it, expect } from "vitest";
import { canViewOrgChart, canEditOrgChart } from "./org-chart-access";

/**
 * Accès à l'organigramme : le Super Admin voit et modifie toujours ; les rôles et personnes
 * ouverts par l'admin CONSULTENT seulement. Sans réglage, personne d'autre n'entre.
 */

const settings = (roles: string[] = [], userIds: string[] = []) => ({
  orgChartViewerRoles: roles,
  orgChartViewerUserIds: userIds,
});

describe("canViewOrgChart", () => {
  it("le Super Admin voit toujours, même sans aucun réglage", () => {
    expect(canViewOrgChart({ id: "u1", role: "SUPER_ADMIN" }, settings())).toBe(true);
  });

  it("par défaut (aucun rôle, aucune personne), personne d'autre ne voit", () => {
    expect(canViewOrgChart({ id: "u2", role: "RH" }, settings())).toBe(false);
    expect(canViewOrgChart({ id: "u3", role: "DIRECTION" }, settings())).toBe(false);
  });

  it("un rôle ouvert donne l'accès à tous ceux qui le portent", () => {
    const s = settings(["RH"]);
    expect(canViewOrgChart({ id: "u2", role: "RH" }, s)).toBe(true);
    expect(canViewOrgChart({ id: "u3", role: "SALES_USER" }, s)).toBe(false);
  });

  it("une personne nommée entre quel que soit son rôle", () => {
    const s = settings([], ["u9"]);
    expect(canViewOrgChart({ id: "u9", role: "MEDICAL_DELEGATE" }, s)).toBe(true);
    expect(canViewOrgChart({ id: "u8", role: "MEDICAL_DELEGATE" }, s)).toBe(false);
  });

  it("le « autre rôle » (fonction cumulée) compte aussi — sinon le cumul n'aurait aucun effet", () => {
    const s = settings(["RH"]);
    expect(canViewOrgChart({ id: "u4", role: "SALES_USER", secondaryRole: "RH" }, s)).toBe(true);
    expect(canViewOrgChart({ id: "u5", role: "SALES_USER", secondaryRole: null }, s)).toBe(false);
  });
});

describe("canEditOrgChart", () => {
  it("réorganiser reste au Super Admin — un simple consultant ne modifie rien", () => {
    expect(canEditOrgChart({ role: "SUPER_ADMIN" })).toBe(true);
    expect(canEditOrgChart({ role: "RH" })).toBe(false);
    expect(canEditOrgChart({ role: "DIRECTION" })).toBe(false);
  });
});
