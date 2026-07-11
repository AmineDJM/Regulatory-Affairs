import { describe, it, expect } from "vitest";
import { buildSupplierEmailDraft, draftSupplierEmail, type AiFn } from "./draft";

describe("buildSupplierEmailDraft — modèle déterministe (G8)", () => {
  it("intègre les questions numérotées, l'échéance et le produit", () => {
    const draft = buildSupplierEmailDraft({
      productName: "Amoxival 500", dossierRef: "REG-1", supplierName: "Acme Pharma",
      questions: ["Fournir le CPP à jour.", "Préciser la taille de lot."], deadline: new Date("2026-09-01"),
    });
    expect(draft).toContain("Amoxival 500");
    expect(draft).toContain("REG-1");
    expect(draft).toContain("Cher Acme Pharma");
    expect(draft).toContain("1. Fournir le CPP à jour.");
    expect(draft).toContain("2. Préciser la taille de lot.");
    expect(draft).toMatch(/1er septembre 2026|01 septembre 2026|septembre 2026/);
  });

  it("greeting générique sans nom de fournisseur", () => {
    const draft = buildSupplierEmailDraft({ dossierRef: "REG-2", questions: ["Question"] });
    expect(draft).toContain("Madame, Monsieur,");
  });
});

describe("draftSupplierEmail — brouillon (jamais envoyé)", () => {
  it("utilise l'IA quand elle répond, sinon repli sur le modèle", async () => {
    const ai: AiFn = async () => ({ ok: true, configured: true, text: "Objet : Compléments\n\nBonjour, merci de fournir…" });
    const r = await draftSupplierEmail({ dossierRef: "REG-3", questions: ["Q1"] }, ai);
    expect(r.aiUsed).toBe(true);
    expect(r.draft).toContain("Compléments");
  });

  it("repli déterministe si l'IA échoue ou renvoie trop court", async () => {
    const ai: AiFn = async () => ({ ok: false, configured: true, error: "boom" });
    const r = await draftSupplierEmail({ dossierRef: "REG-4", productName: "P", questions: ["Q1"] }, ai);
    expect(r.aiUsed).toBe(false);
    expect(r.draft).toContain("REG-4");
    expect(r.draft).toContain("1. Q1");
  });
});
