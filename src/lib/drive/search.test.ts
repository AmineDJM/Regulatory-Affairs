import { describe, it, expect } from "vitest";
import {
  MIN_QUERY, fold, normalizeQuery, matchesQuery, rankHit, sortHits, describePath, searchSummary,
  type SearchHit,
} from "./search";

/** Un résultat de recherche minimal — seuls le nom, le type et la date pèsent sur le classement. */
function hit(name: string, isFile: boolean, updatedAt: string): SearchHit {
  return { id: name, name, isFile, updatedAt, path: "Drive" };
}

describe("fold — sans accent, sans casse", () => {
  it("retire les accents français", () => {
    expect(fold("Règlement")).toBe("reglement");
    expect(fold("Procédé")).toBe("procede");
    expect(fold("Août")).toBe("aout");
    expect(fold("Naïve")).toBe("naive");
  });

  it("abaisse la casse", () => {
    expect(fold("CONTRAT")).toBe("contrat");
  });

  it("laisse intact ce qui n'a pas d'accent", () => {
    expect(fold("Bilan 2026.xlsx")).toBe("bilan 2026.xlsx");
  });

  it("est idempotent — replier un texte déjà replié ne change rien", () => {
    expect(fold(fold("Décision N°12"))).toBe(fold("Décision N°12"));
  });
});

describe("normalizeQuery — ce qu'on accepte de chercher", () => {
  it("refuse une saisie plus courte que le minimum", () => {
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
  });

  it("refuse une saisie qui n'est que des espaces", () => {
    expect(normalizeQuery("   ")).toBeNull();
  });

  it("accepte à partir du minimum", () => {
    expect("ab".length).toBe(MIN_QUERY);
    expect(normalizeQuery("ab")).toBe("ab");
  });

  it("écrase les espaces multiples et rogne les bords", () => {
    expect(normalizeQuery("  contrat   cadre  ")).toBe("contrat cadre");
  });

  it("garde les accents de la saisie — c'est `fold` qui les ignore, pas la saisie qui les perd", () => {
    expect(normalizeQuery("Règlement")).toBe("Règlement");
  });
});

describe("matchesQuery — la correspondance", () => {
  it("trouve sans accent ce qui en porte", () => {
    expect(matchesQuery("Règlement intérieur.pdf", "reglement")).toBe(true);
  });

  it("trouve avec accent ce qui n'en porte pas", () => {
    expect(matchesQuery("Reglement interieur.pdf", "règlement")).toBe(true);
  });

  it("ignore la casse", () => {
    expect(matchesQuery("CONTRAT CADRE.docx", "contrat")).toBe(true);
  });

  it("trouve un terme au milieu du nom", () => {
    expect(matchesQuery("2026-04 Facture Sanofi.pdf", "facture")).toBe(true);
  });

  it("ne trouve pas ce qui n'y est pas", () => {
    expect(matchesQuery("Contrat cadre.docx", "avenant")).toBe(false);
  });
});

describe("rankHit — la pertinence", () => {
  it("0 : le nom exact", () => {
    expect(rankHit("Contrat", "contrat")).toBe(0);
    expect(rankHit("Règlement", "reglement")).toBe(0);
  });

  it("1 : le nom commence par le terme", () => {
    expect(rankHit("Contrat cadre 2026.docx", "contrat")).toBe(1);
  });

  it("2 : un MOT du nom commence par le terme", () => {
    expect(rankHit("Bilan rapport 2026.xlsx", "rapport")).toBe(2);
    expect(rankHit("2026-04-facture.pdf", "facture")).toBe(2);
    expect(rankHit("Note (rapport).docx", "rapport")).toBe(2);
  });

  it("3 : le terme est ailleurs dans le nom", () => {
    expect(rankHit("Zzrapportzz.pdf", "rapport")).toBe(3);
  });

  it("classe le nom exact devant le préfixe, et le préfixe devant le mot interne", () => {
    expect(rankHit("Facture", "facture")).toBeLessThan(rankHit("Facture Sanofi.pdf", "facture"));
    expect(rankHit("Facture Sanofi.pdf", "facture")).toBeLessThan(rankHit("2026 Facture.pdf", "facture"));
  });
});

describe("sortHits — le classement final", () => {
  it("remonte le nom exact avant tout le reste, quelle que soit la date", () => {
    const sorted = sortHits(
      [hit("Vieux dossier facture.pdf", true, "2026-08-01T00:00:00.000Z"), hit("Facture", true, "2020-01-01T00:00:00.000Z")],
      "facture",
    );
    expect(sorted[0]!.name).toBe("Facture");
  });

  it("à pertinence égale, les dossiers passent devant les fichiers", () => {
    const sorted = sortHits(
      [hit("Factures.pdf", true, "2026-08-01T00:00:00.000Z"), hit("Factures", false, "2020-01-01T00:00:00.000Z")],
      "factures",
    );
    // « Factures » (dossier) est un nom exact, « Factures.pdf » ne l'est pas : le rang tranche déjà.
    expect(sorted.map((h) => h.name)).toEqual(["Factures", "Factures.pdf"]);
  });

  it("à pertinence ET type égaux, le plus récemment touché passe devant", () => {
    const sorted = sortHits(
      [hit("Facture A.pdf", true, "2026-01-01T00:00:00.000Z"), hit("Facture B.pdf", true, "2026-08-01T00:00:00.000Z")],
      "facture",
    );
    expect(sorted.map((h) => h.name)).toEqual(["Facture B.pdf", "Facture A.pdf"]);
  });

  it("un dossier passe devant un fichier de MÊME rang", () => {
    const sorted = sortHits(
      [hit("Facture 2026.pdf", true, "2026-08-01T00:00:00.000Z"), hit("Facture 2025", false, "2020-01-01T00:00:00.000Z")],
      "facture",
    );
    expect(sorted[0]!.isFile).toBe(false);
  });

  it("ne modifie pas le tableau reçu", () => {
    const rows = [hit("B.pdf", true, "2026-01-01T00:00:00.000Z"), hit("A.pdf", true, "2026-08-01T00:00:00.000Z")];
    const before = rows.map((r) => r.name);
    sortHits(rows, "pdf");
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});

describe("describePath — l'emplacement, écrit comme on le lit", () => {
  it("nomme la racine quand le nœud y est posé", () => {
    expect(describePath("Drive", [])).toBe("Drive");
  });

  it("enchaîne les dossiers depuis la racine", () => {
    expect(describePath("Drive", ["Contrats", "2026"])).toBe("Drive › Contrats › 2026");
  });

  it("porte le nom de la catégorie quand le nœud en vient", () => {
    expect(describePath("Promotion Médicale", ["Visuels"])).toBe("Promotion Médicale › Visuels");
  });
});

describe("searchSummary", () => {
  it("dit l'absence de résultat sans détour", () => {
    expect(searchSummary(0, "avenant")).toBe("Aucun résultat pour « avenant ».");
  });

  it("accorde le pluriel", () => {
    expect(searchSummary(1, "contrat")).toBe("1 résultat pour « contrat ».");
    expect(searchSummary(3, "contrat")).toBe("3 résultats pour « contrat ».");
  });
});
