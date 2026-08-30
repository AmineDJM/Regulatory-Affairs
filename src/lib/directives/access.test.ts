import { describe, it, expect } from "vitest";
import {
  canIssueDirective, canReadDirectives, describeDirectiveAccess,
  EMPTY_DIRECTIVE_ACCESS, type DirectiveAccessSettings,
} from "./access";

const settings = (over: Partial<DirectiveAccessSettings> = {}): DirectiveAccessSettings => ({
  ...EMPTY_DIRECTIVE_ACCESS, ...over,
});
const p = (id: string, role: string, secondaryRole?: string) => ({ id, role, secondaryRole });

describe("accès du module Directives — réglés par le Super Admin", () => {
  it("le Super Admin et le DG gardent tout, même liste vide : ils distribuent ces accès", () => {
    for (const role of ["SUPER_ADMIN", "GENERAL_MANAGER"]) {
      expect(canIssueDirective(p("x", role), settings())).toBe(true);
      expect(canReadDirectives(p("x", role), settings())).toBe(true);
    }
  });

  it("sans réglage ni matrice, personne d'autre n'émet", () => {
    expect(canIssueDirective(p("u1", "HR_MANAGER"), settings())).toBe(false);
    expect(canReadDirectives(p("u1", "HR_MANAGER"), settings())).toBe(false);
  });

  it("les réglages S'AJOUTENT à la matrice — un lot d'admin ne retire jamais un droit acquis", () => {
    expect(canIssueDirective(p("u1", "HR_MANAGER"), settings(), true)).toBe(true);
    expect(canReadDirectives(p("u1", "HR_MANAGER"), settings(), { read: true })).toBe(true);
  });

  it("ouverture par RÔLE, principal ou cumulé", () => {
    const s = settings({ directiveIssuerRoles: ["OPERATIONS_DIRECTOR"] });
    expect(canIssueDirective(p("u1", "OPERATIONS_DIRECTOR"), s)).toBe(true);
    expect(canIssueDirective(p("u2", "SALES_USER", "OPERATIONS_DIRECTOR"), s)).toBe(true);
    expect(canIssueDirective(p("u3", "SALES_USER"), s)).toBe(false);
  });

  it("ouverture NOMMÉE — une personne, sans toucher à son rôle", () => {
    const s = settings({ directiveIssuerUserIds: ["donna"] });
    expect(canIssueDirective(p("donna", "EXECUTIVE_ASSISTANT"), s)).toBe(true);
    expect(canIssueDirective(p("autre", "EXECUTIVE_ASSISTANT"), s)).toBe(false);
  });

  it("ÉMETTRE implique LIRE — on ne rédige pas dans un module qu'on ne voit pas", () => {
    const s = settings({ directiveIssuerRoles: ["OPERATIONS_DIRECTOR"] });
    expect(canReadDirectives(p("u1", "OPERATIONS_DIRECTOR"), s)).toBe(true);
  });

  it("…mais LIRE n'implique pas ÉMETTRE : la plupart lisent sans jamais écrire", () => {
    const s = settings({ directiveReaderRoles: ["MEDICAL_DELEGATE"] });
    expect(canReadDirectives(p("u1", "MEDICAL_DELEGATE"), s)).toBe(true);
    expect(canIssueDirective(p("u1", "MEDICAL_DELEGATE"), s)).toBe(false);
  });

  it("l'écran d'administration COMPTE ce qu'il ouvre", () => {
    expect(describeDirectiveAccess(settings())).toMatch(/Aucun accès ajouté/);
    const s = settings({ directiveReaderRoles: ["A", "B"], directiveIssuerUserIds: ["u1"] });
    expect(describeDirectiveAccess(s)).toBe(
      "2 accès en lecture · 1 accès en rédaction — en plus des droits du rôle. La publication reste à la direction générale.",
    );
  });
});
