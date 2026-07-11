/**
 * ANALYSE D'IMPACT (G12) — déterministe. À partir des sections CTD modifiées (opération
 * NEW/REPLACE/DELETE/APPEND), déduit les sections et faits du jumeau numérique à RÉ-VÉRIFIER.
 * Pur : aucune dépendance base, entièrement testable.
 */

interface Dependency {
  prefix: string; // section modifiée
  sections: string[]; // sections dépendantes à re-vérifier
  facts: string[]; // clés de faits à re-confirmer
}

// Dépendances réglementaires usuelles (CTD/ICH). Prudent : mieux vaut re-vérifier en trop.
const DEPENDENCIES: Dependency[] = [
  { prefix: "3.2.S", sections: ["3.2.P", "3.2.P.5", "3.2.P.8"], facts: ["INN", "IMPURITIES", "MANUFACTURER", "SPECIFICATIONS"] },
  { prefix: "3.2.P.8", sections: [], facts: ["SHELF_LIFE", "STORAGE"] }, // stabilité
  { prefix: "3.2.P.5", sections: [], facts: ["SPECIFICATIONS", "METHODS"] }, // contrôle produit fini
  { prefix: "3.2.P", sections: ["3.2.P.5", "3.2.P.8"], facts: ["DOSAGE_FORM", "PACKAGING", "SHELF_LIFE", "STRENGTH", "BATCH_SIZE"] },
  { prefix: "1.3", sections: [], facts: ["PRODUCT_NAME", "STRENGTH", "DOSAGE_FORM", "INDICATIONS", "DOSAGE"] }, // info produit
  { prefix: "5.3", sections: [], facts: ["REFERENCE_PRODUCT"] }, // bioéquivalence
  { prefix: "1.2", sections: [], facts: ["APPLICANT", "MAH", "OPERATOR"] }, // administratif
];

const matches = (section: string, prefix: string) => section === prefix || section.startsWith(`${prefix}.`);

export interface ImpactResult {
  modifiedSections: string[];
  affectedSections: string[]; // sections à re-vérifier (hors modifiées)
  factsToReverify: string[];
}

/** Déduit l'impact d'une modification portant sur `sections`. Déterministe et pur. */
export function analyzeImpact(sections: string[]): ImpactResult {
  const modified = [...new Set(sections.filter(Boolean))];
  const affected = new Set<string>();
  const facts = new Set<string>();

  for (const s of modified) {
    for (const dep of DEPENDENCIES) {
      if (matches(s, dep.prefix)) {
        for (const d of dep.sections) if (!modified.includes(d)) affected.add(d);
        for (const f of dep.facts) facts.add(f);
      }
    }
  }

  return {
    modifiedSections: modified,
    affectedSections: [...affected].sort(),
    factsToReverify: [...facts].sort(),
  };
}
