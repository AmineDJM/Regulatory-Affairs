import { describe, expect, it } from "vitest";
import { capacitesImposees, composerContexte, rendreSituation, SITUATION_MAX_CHARS, SITUATION_MAX_FAITS } from "@/lib/missions/planner/plan";
import type { Situation } from "@/lib/missions/ports";

/**
 * LA COUCHE « SITUATION » DU PLANIFICATEUR — pure, donc testée sans base ni modèle.
 *
 * Le banc de missions inédites l'a rendue nécessaire : « Occupe-toi du dossier Trastuzumab »
 * était planifié sans un seul fait, « dossier » compris comme un dossier Drive, et la première
 * étape demandait au dirigeant ce que l'ERP savait déjà. Ces tests fixent ce que la couche
 * garantit : la provenance de chaque fait, les acteurs avant le dirigeant, les sources en échec
 * dites, des bornes, et l'élargissement du catalogue montré.
 */
const situation = (): Situation => ({
  entites: [{ type: "PRODUIT", id: "p1", label: "Trastuzex", ref: "REG-2026-9015", domaine: "REGULATORY" }],
  faits: [
    { source: "ERP:RegulatoryProduct", texte: "Trastuzex (Trastuzumab) — statut BLOCKED — responsable Raihana Cherif", ref: "REG-2026-9015" },
    { source: "recherche:Courriers", texte: "Relance certificat GMP Hetero Biopharma — Trastuzex — le 25/08/2026", ref: "CD-2026-0149" },
  ],
  acteurs: ["Raihana Cherif — responsable de Trastuzex"],
  domaines: ["REGULATORY", "MAIL"],
  capacitesSuggerees: ["inspect_record", "regulatory_operation", "gmail_prepare_mail"],
  couverture: { sources: ["dictionnaire", "recherche fédérée", "fiche REG-2026-9015"], enEchec: ["changements récents"], ms: 812 },
});

describe("planificateur — la situation établie par le code entre dans le contexte", () => {
  it("chaque fait porte sa provenance et sa référence, les acteurs passent avant le dirigeant, l'échec d'une source est dit", () => {
    const rendu = rendreSituation(situation());
    expect(rendu).toContain("[ERP:RegulatoryProduct] Trastuzex (Trastuzumab) — statut BLOCKED");
    expect(rendu).toContain("(réf. REG-2026-9015)");
    expect(rendu).toContain("PRODUIT Trastuzex (REG-2026-9015) → domaine REGULATORY");
    expect(rendu).toContain("AVANT de solliciter le dirigeant");
    expect(rendu).toContain("Raihana Cherif — responsable de Trastuzex");
    expect(rendu).toContain("EN ÉCHEC (non consultées, ne conclus pas à une absence) : changements récents");
    expect(rendu).toContain("ne les redemande à personne");
  });

  it("sans situation, le contexte est celui d'avant — rien n'est ajouté", () => {
    expect(rendreSituation(undefined)).toBe("");
    const ctx = composerContexte("Envoie un message à Amel", "- send_message", {});
    expect(ctx).not.toContain("SITUATION ÉTABLIE");
  });

  it("la situation est bornée en nombre de faits et en caractères", () => {
    const grosse = situation();
    grosse.faits = Array.from({ length: 200 }, (_, i) => ({ source: "recherche:X", texte: `fait numéro ${i} ${"x".repeat(150)}` }));
    const rendu = rendreSituation(grosse);
    const lignes = rendu.split("\n").filter((l) => l.startsWith("- [recherche:X]"));
    expect(lignes.length).toBeLessThanOrEqual(SITUATION_MAX_FAITS);
    expect(lignes.join("\n").length).toBeLessThanOrEqual(SITUATION_MAX_CHARS + 200);
  });

  it("le contexte complet place la situation avant les capacités et après les contraintes", () => {
    const ctx = composerContexte("Occupe-toi du dossier Trastuzumab", "- inspect_record", {
      contraintes: ["pas avant lundi"], situation: situation(),
    });
    const iContrainte = ctx.indexOf("pas avant lundi");
    const iSituation = ctx.indexOf("SITUATION ÉTABLIE PAR LE CODE");
    const iCapacites = ctx.indexOf("CAPACITÉS DISPONIBLES");
    expect(iContrainte).toBeGreaterThan(-1);
    expect(iSituation).toBeGreaterThan(iContrainte);
    expect(iCapacites).toBeGreaterThan(iSituation);
  });
});

describe("planificateur — l'enquête élargit le catalogue montré", () => {
  it("les capacités suggérées s'ajoutent à celles imposées, sans doublon, dans l'ordre, sous plafond", () => {
    expect(capacitesImposees(["send_message"], situation())).toEqual([
      "send_message", "inspect_record", "regulatory_operation", "gmail_prepare_mail",
    ]);
    expect(capacitesImposees(["inspect_record"], situation())).toEqual([
      "inspect_record", "regulatory_operation", "gmail_prepare_mail",
    ]);
    expect(capacitesImposees(undefined, undefined)).toEqual([]);
    const large = situation();
    large.capacitesSuggerees = Array.from({ length: 40 }, (_, i) => `cap_${i}`);
    expect(capacitesImposees([], large, 18)).toHaveLength(18);
  });
});
