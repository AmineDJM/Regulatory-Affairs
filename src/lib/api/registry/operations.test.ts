import { describe, it, expect } from "vitest";
import { OPERATIONS, getOperation, validateParams, describeOperations } from "./operations";
import { SCOPES, WRITE_SCOPES } from "@/lib/api/scopes";
import { MODULES } from "@/lib/rbac";

const mail = getOperation("mail.create")!;

describe("registre des opérations — ce qui n'est pas déclaré n'existe pas", () => {
  it("chaque opération porte un nom UNIQUE et stable", () => {
    const names = OPERATIONS.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
    // « module.verbe », en minuscules : c'est l'identifiant public, il ne doit pas changer de forme.
    for (const n of names) expect(n, n).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });

  it("toute opération exige une portée d'ÉCRITURE — jamais `erp.read`", () => {
    // Le point qui compte : une opération est une écriture. Si l'une d'elles se contentait de la
    // portée de lecture, un client « lecture seule » pourrait modifier l'ERP.
    for (const o of OPERATIONS) {
      expect(SCOPES, o.name).toContain(o.scope);
      expect(WRITE_SCOPES, o.name).toContain(o.scope);
    }
  });

  it("chaque opération vise un module CONNU", () => {
    for (const o of OPERATIONS) expect(MODULES, o.name).toContain(o.module);
  });

  it("un nom inconnu n'ouvre rien", () => {
    expect(getOperation("mail.delete_everything")).toBeNull();
    expect(getOperation("")).toBeNull();
  });

  it("le catalogue publié ne fuit AUCUNE fonction — seulement de la description", () => {
    const json = JSON.parse(JSON.stringify(describeOperations()));
    expect(json).toHaveLength(OPERATIONS.length);
    for (const o of json) {
      expect(o).not.toHaveProperty("run");
      expect(typeof o.description).toBe("string");
      expect(Array.isArray(o.params)).toBe(true);
    }
  });
});

describe("validateParams — refuser, jamais deviner", () => {
  it("accepte un appel correct et convertit les types", () => {
    const r = validateParams(mail, { title: "Relance CNAS", direction: "INCOMING", sentAt: "2026-08-17T14:30:00Z" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.title).toBe("Relance CNAS");
    expect(r.values.direction).toBe("INCOMING");
    expect(r.values.sentAt).toBeInstanceOf(Date);
  });

  it("exige les paramètres obligatoires, en les NOMMANT", () => {
    const r = validateParams(mail, { sender: "CNAS" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("title");
  });

  it("REFUSE un paramètre inconnu au lieu de l'ignorer en silence", () => {
    // Un agent invente volontiers un nom de champ plausible. L'accepter sans rien en faire lui
    // ferait croire que son intention a été prise en compte.
    const r = validateParams(mail, { title: "X", objet: "Relance" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("objet");
    expect(r.error).toContain("title"); // et l'on dit ce qui était attendu
  });

  it("refuse une valeur hors énumération plutôt que de la corriger", () => {
    const r = validateParams(mail, { title: "X", direction: "SORTANT" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("INCOMING");
  });

  it("refuse une date illisible, en montrant le format attendu", () => {
    const r = validateParams(mail, { title: "X", sentAt: "hier après-midi" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("date ISO");
  });

  it("un paramètre facultatif vide vaut « rien », pas la chaîne vide", () => {
    const r = validateParams(mail, { title: "X", sender: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.sender).toBeNull();
  });

  it("un corps qui n'est pas un objet est refusé", () => {
    expect(validateParams(mail, null).ok).toBe(false);
    expect(validateParams(mail, "title=X").ok).toBe(false);
    expect(validateParams(mail, ["title"]).ok).toBe(false);
  });

  it("le rattachement de produit exige SES trois paramètres", () => {
    const link = getOperation("product.link_dossier")!;
    expect(validateParams(link, { kind: "BD", id: "p1" }).ok).toBe(false);
    expect(validateParams(link, { kind: "BD", id: "p1", regulatoryProductId: "r1" }).ok).toBe(true);
    // Un catalogue inventé n'ouvre rien.
    expect(validateParams(link, { kind: "AUTRE", id: "p1", regulatoryProductId: "r1" }).ok).toBe(false);
  });
});
