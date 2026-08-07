import { describe, it, expect } from "vitest";
import { buildPrompt } from "./review-agent";

/**
 * Le corpus ingéré était INVISIBLE pour l'analyse principale : on pouvait charger quarante
 * lignes directrices sans qu'un seul constat n'en tienne compte. Ces tests verrouillent le
 * chaînon qui manquait — et surtout la règle qui le rend utile : un constat qui cite sa source
 * se défend en séance, les autres non.
 */
const base = { filename: "3.2.P.8 Stabilite.pdf", ctdSection: "3.2.P.8", ctdTitle: "Stabilité", text: "Durée de conservation revendiquée : 36 mois." };

describe("buildPrompt — textes opposables du corpus", () => {
  it("injecte les extraits AVEC leur référence, et demande de les citer", () => {
    const p = buildPrompt({
      ...base,
      corpus: [{ label: "ICH — Q1A(R2) (v. 2003), 2.1.7 Stockage", snippet: "Les études long terme couvrent 12 mois minimum." }],
    });
    expect(p).toContain("TEXTES OPPOSABLES");
    expect(p).toContain("ICH — Q1A(R2) (v. 2003), 2.1.7 Stockage");
    expect(p).toContain("Les études long terme couvrent 12 mois minimum.");
    expect(p).toContain("ruleRef");
  });

  it("interdit explicitement d'inventer une référence", () => {
    // Sans cette consigne, un modèle privé de source pertinente en fabrique une plausible —
    // et un constat appuyé sur une référence inexistante se retourne contre nous en séance.
    const p = buildPrompt({ ...base, corpus: [{ label: "X", snippet: "y" }] });
    expect(p).toContain("N'invente jamais une référence");
  });

  it("n'ajoute AUCUN bloc quand le corpus est vide — pas de section fantôme", () => {
    const p = buildPrompt(base);
    expect(p).not.toContain("TEXTES OPPOSABLES");
  });

  it("borne le nombre d'extraits : le contexte sert le document, pas l'inverse", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ label: `SOURCE_${i}`, snippet: `extrait ${i}` }));
    const p = buildPrompt({ ...base, corpus: many });
    expect(p).toContain("SOURCE_5");
    expect(p).not.toContain("SOURCE_6"); // au-delà de 6, on n'ajoute plus
  });

  it("garde le document encadré comme donnée NON FIABLE, corpus ou pas", () => {
    // Le corpus est du contexte de confiance ; le document analysé ne l'est jamais.
    const p = buildPrompt({ ...base, corpus: [{ label: "A", snippet: "b" }] });
    expect(p).toContain("<<<DEBUT_DOCUMENT_NON_FIABLE>>>");
    expect(p).toContain("<<<FIN_DOCUMENT_NON_FIABLE>>>");
  });
});
