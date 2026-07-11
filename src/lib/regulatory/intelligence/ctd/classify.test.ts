import { describe, it, expect } from "vitest";
import { classifyDocument } from "./classify";

const c = (path: string, filename: string, ext = "pdf", textSample?: string) =>
  classifyDocument({ path, filename, ext, textSample });

describe("classifyDocument — classification CTD déterministe (golden set)", () => {
  it("code CTD explicite dans le chemin → section exacte, forte confiance", () => {
    const r = c("m3/3.2.p.8-stabilite.pdf", "3.2.p.8-stabilite.pdf");
    expect(r.section).toBe("3.2.P.8");
    expect(r.module).toBe("M3");
    expect(r.method).toBe("code-path");
    expect(r.confidence).toBeGreaterThan(0.9);
    expect(r.suggestedFilename).toContain("3.2.P.8");
  });

  it("choisit la section LA PLUS SPÉCIFIQUE (3.2.P.8 plutôt que 3.2.P)", () => {
    const r = c("module 3/3.2.P.8 stability.pdf", "3.2.P.8 stability.pdf");
    expect(r.section).toBe("3.2.P.8");
  });

  it("séparateurs alternatifs (tirets) reconnus", () => {
    const r = c("m3", "3-2-p-5-controle-produit-fini.pdf");
    expect(r.section).toBe("3.2.P.5");
    expect(r.module).toBe("M3");
  });

  it("QOS : alias explicite « 2.3 » → code-path ; phrase seule → keyword", () => {
    const byCode = c("resumes", "2.3 QOS.docx", "docx");
    expect(byCode.section).toBe("2.3");
    expect(byCode.method).toBe("code-path"); // le code « 2.3 » (et l'alias « qos ») figurent au nom

    const byPhrase = c("resumes", "Quality Overall Summary.docx", "docx", "Quality Overall Summary of the product");
    expect(byPhrase.section).toBe("2.3");
    expect(byPhrase.method).toBe("keyword"); // acronyme QOS absent → apparié par la phrase
  });

  it("bordereau de versement (ANPP) sans code → 1.2.1 par mot-clé", () => {
    const r = c("m1", "bordereau_versement_etasdjil.pdf", "pdf", "Bordereau de versement des droits d'enregistrement E-TASDJIL");
    expect(r.section).toBe("1.2.1");
    expect(r.method).toBe("keyword");
    expect(r.module).toBe("M1");
  });

  it("certificat BPF/GMP sans code → 1.5 par mot-clé", () => {
    const r = c("documents", "certificat-BPF.pdf", "pdf", "Certificat de bonnes pratiques de fabrication (BPF/GMP)");
    expect(r.section).toBe("1.5");
  });

  it("stabilité par contenu (nom neutre) → 3.2.P.8", () => {
    const r = c("annexes", "annexe07.pdf", "pdf", "Études de stabilité — shelf life 24 mois, zone IVb");
    expect(r.section).toBe("3.2.P.8");
    expect(r.method).toBe("keyword");
  });

  it("module seul détecté (aucune section) → module-only", () => {
    const r = c("racine", "module 4 documents.pdf", "pdf", "contenu générique sans indice de section");
    expect(r.module).toBe("M4");
    expect(r.section).toBeNull();
    expect(r.method).toBe("module-only");
  });

  it("aucun indice fiable → non classé (pas d'invention)", () => {
    const r = c("divers", "photo_batiment.pdf", "pdf", "texte sans rapport réglementaire");
    expect(r.section).toBeNull();
    expect(r.module).toBeNull();
    expect(r.method).toBe("none");
    expect(r.confidence).toBe(0);
    expect(r.suggestedFilename).toBeNull();
  });
});
