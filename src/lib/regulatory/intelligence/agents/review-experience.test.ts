import { describe, it, expect } from "vitest";
import { buildPrompt } from "./review-agent";

/**
 * L'EXPÉRIENCE INTERNE (module Entraînement IA) injectée dans l'analyse : des précédents de NOS
 * produits passés, avec l'issue réelle de l'ANPP. Ces tests verrouillent la frontière qui rend
 * l'apprentissage sûr — un précédent ORIENTE l'analyse, il ne fonde JAMAIS une règle.
 */
const base = { filename: "3.2.P.8 Stabilite.pdf", ctdSection: "3.2.P.8", ctdTitle: "Stabilité", text: "Durée de conservation revendiquée : 36 mois." };

describe("buildPrompt — expérience interne (études de cas)", () => {
  it("injecte les précédents avec l'issue réelle et la leçon", () => {
    const p = buildPrompt({
      ...base,
      experience: [{
        label: "« Amoxicilline 500 mg — 2023 » — issue réelle : ACCEPTÉ AVEC RÉSERVES — leçon retenue : zone IVb exigée (pièce : 3.2.P.8.pdf)",
        snippet: "Les données long terme fournies couvraient la zone II uniquement.",
      }],
    });
    expect(p).toContain("EXPÉRIENCE INTERNE — PRODUITS PASSÉS");
    expect(p).toContain("ACCEPTÉ AVEC RÉSERVES");
    expect(p).toContain("zone IVb exigée");
  });

  it("dit EXPLICITEMENT qu'un précédent ne fonde jamais un ruleRef", () => {
    const p = buildPrompt({ ...base, experience: [{ label: "X", snippet: "y" }] });
    expect(p).toContain("Ne les cite JAMAIS dans `ruleRef`");
  });

  it("aucun bloc quand il n'y a pas d'étude de cas — pas de section fantôme", () => {
    const p = buildPrompt(base);
    expect(p).not.toContain("EXPÉRIENCE INTERNE");
  });

  it("borne les précédents à 3 : le contexte sert le document, pas l'inverse", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ label: `CAS_${i}`, snippet: `extrait ${i}` }));
    const p = buildPrompt({ ...base, experience: many });
    expect(p).toContain("CAS_2");
    expect(p).not.toContain("CAS_3");
  });

  it("les deux blocs coexistent : la règle (corpus) ET la jurisprudence maison (expérience)", () => {
    const p = buildPrompt({
      ...base,
      corpus: [{ label: "ICH — Q1A(R2)", snippet: "12 mois minimum." }],
      experience: [{ label: "« Produit X » — REJETÉ", snippet: "Stabilité insuffisante." }],
    });
    expect(p.indexOf("TEXTES OPPOSABLES")).toBeGreaterThan(-1);
    expect(p.indexOf("EXPÉRIENCE INTERNE")).toBeGreaterThan(p.indexOf("TEXTES OPPOSABLES"));
  });
});
