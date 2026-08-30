import { describe, it, expect } from "vitest";
import {
  isRecipient, canReadDirective, canPublishDirectives, publishesImmediately,
  validateAudience, describeAudience, describeSends,
  type DirectiveScope, type DirectivePerson,
} from "./audience";

const scope = (over: Partial<DirectiveScope> = {}): DirectiveScope => ({
  audience: "USERS", targetUserIds: [], targetRole: null, companyId: null, ...over,
});
const person = (over: Partial<DirectivePerson> = {}): DirectivePerson => ({
  id: "u1", role: "MEDICAL_DELEGATE", ...over,
});

describe("portée d'une directive", () => {
  it("TOUS LES SALARIÉS — personne n'est oublié, quel que soit le rôle ou l'entité", () => {
    const d = scope({ audience: "ALL" });
    expect(isRecipient(person(), d)).toBe(true);
    expect(isRecipient(person({ id: "u9", role: "VIEWER", companyIds: [] }), d)).toBe(true);
  });

  it("PLUSIEURS PERSONNES — chacune des nommées, et elles seules", () => {
    const d = scope({ targetUserIds: ["u1", "u2", "u7"] });
    expect(isRecipient(person({ id: "u2" }), d)).toBe(true);
    expect(isRecipient(person({ id: "u7" }), d)).toBe(true);
    expect(isRecipient(person({ id: "u3" }), d)).toBe(false);
  });

  it("ENTITÉ — les salariés qui en relèvent, pas ceux d'à côté", () => {
    const d = scope({ audience: "COMPANY", companyId: "adventum" });
    expect(isRecipient(person({ companyIds: ["adventum"] }), d)).toBe(true);
    expect(isRecipient(person({ companyIds: ["pharmagene"] }), d)).toBe(false);
    expect(isRecipient(person({ companyIds: [] }), d)).toBe(false);
    expect(isRecipient(person(), d)).toBe(false); // aucune entité connue
  });

  it("RÔLE — le rôle CUMULÉ compte autant que le principal", () => {
    const d = scope({ audience: "ROLE", targetRole: "HR_MANAGER" });
    expect(isRecipient(person({ role: "HR_MANAGER" }), d)).toBe(true);
    expect(isRecipient(person({ role: "SALES_USER", secondaryRole: "HR_MANAGER" }), d)).toBe(true);
    expect(isRecipient(person({ role: "SALES_USER" }), d)).toBe(false);
  });

  it("une portée mal remplie ne touche personne — pas « tout le monde par défaut »", () => {
    expect(isRecipient(person(), scope({ audience: "ROLE", targetRole: null }))).toBe(false);
    expect(isRecipient(person({ companyIds: ["x"] }), scope({ audience: "COMPANY" }))).toBe(false);
  });
});

describe("publication — rien ne part sans la direction générale", () => {
  it("seuls le DG et le Super Admin publient", () => {
    expect(canPublishDirectives(person({ role: "GENERAL_MANAGER" }))).toBe(true);
    expect(canPublishDirectives(person({ role: "SUPER_ADMIN" }))).toBe(true);
    expect(canPublishDirectives(person({ role: "HR_MANAGER" }))).toBe(false);
    expect(canPublishDirectives(person({ role: "OPERATIONS_DIRECTOR" }))).toBe(false);
  });

  it("une note écrite PAR le DG part d'emblée — se valider soi-même serait un clic vide", () => {
    expect(publishesImmediately(person({ role: "GENERAL_MANAGER" }))).toBe(true);
    expect(publishesImmediately(person({ role: "HR_MANAGER" }))).toBe(false);
  });

  it("NON PUBLIÉE = invisible du destinataire, même s'il est bien dans la portée", () => {
    const d = { ...scope({ audience: "ALL" }), publication: "PENDING_APPROVAL" as const, fromId: "auteur" };
    expect(canReadDirective(person({ id: "u1" }), d)).toBe(false);
    // …mais son auteur la suit, sinon il la croirait perdue,
    expect(canReadDirective(person({ id: "auteur" }), d)).toBe(true);
    // …et le valideur doit la voir pour la signer.
    expect(canReadDirective(person({ id: "dg", role: "GENERAL_MANAGER" }), d)).toBe(true);
  });

  it("PUBLIÉE = visible des seuls destinataires", () => {
    const d = { ...scope({ targetUserIds: ["u2"] }), publication: "PUBLISHED" as const, fromId: "auteur" };
    expect(canReadDirective(person({ id: "u2" }), d)).toBe(true);
    expect(canReadDirective(person({ id: "u3" }), d)).toBe(false);
  });

  it("REFUSÉE ne se diffuse pas davantage qu'un brouillon", () => {
    const d = { ...scope({ audience: "ALL" }), publication: "REJECTED" as const, fromId: "auteur" };
    expect(canReadDirective(person({ id: "u1" }), d)).toBe(false);
  });
});

describe("ce qui manque est DIT", () => {
  it("nomme la case à remplir, portée par portée", () => {
    expect(validateAudience(scope())).toMatch(/au moins une personne/);
    expect(validateAudience(scope({ audience: "ROLE" }))).toMatch(/rôle/);
    expect(validateAudience(scope({ audience: "COMPANY" }))).toMatch(/entité/);
    expect(validateAudience(scope({ audience: "ALL" }))).toBeNull();
    expect(validateAudience(scope({ targetUserIds: ["u1"] }))).toBeNull();
  });
});

describe("libellés", () => {
  it("porte le nombre de destinataires quand il est connu", () => {
    expect(describeAudience(scope({ audience: "ALL" }), { count: 212 })).toBe("Tous les salariés — 212 personnes");
    expect(describeAudience(scope({ audience: "COMPANY", companyId: "c" }), { company: "Adventum", count: 34 }))
      .toBe("Adventum — 34 personnes");
    expect(describeAudience(scope({ audience: "ALL" }), { count: 1 })).toBe("Tous les salariés — 1 personne");
  });

  it("liste les personnes, puis compte au-delà de trois", () => {
    const d = scope({ targetUserIds: ["a", "b", "c", "d", "e"] });
    expect(describeAudience(d, { users: ["Amine", "Sara", "Karim", "Nadia", "Yacine"] })).toBe("Amine, Sara, Karim +2");
    expect(describeAudience(d)).toBe("5 personnes");
  });

  it("la relance dit combien de fois — pas « envoyée »", () => {
    expect(describeSends(0, null)).toBe("Jamais envoyée.");
    expect(describeSends(1, "2026-08-30T10:00:00Z")).toBe("Envoyée une fois — dernier envoi le 30/08/2026.");
    expect(describeSends(3, "2026-08-30T10:00:00Z")).toMatch(/Envoyée 3 fois/);
  });
});
