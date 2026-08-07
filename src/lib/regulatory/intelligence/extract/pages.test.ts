import { describe, it, expect } from "vitest";
import { buildPagedContent, pageAtOffset, pageSpanOfSlice, anchorEvidence, PAGE_SEPARATOR } from "./pages";

/**
 * La carte des pages est ce qui transforme « l'outil dit page 52 » en « l'outil MONTRE la
 * page 52 ». Une erreur d'un caractère ici, et chaque clic ouvre la mauvaise page — pire
 * qu'aucun lien, parce qu'on s'y fie.
 */
describe("buildPagedContent", () => {
  it("place chaque page à la position annoncée par la carte", () => {
    const { content, pageMap } = buildPagedContent(["AAA", "BBBB", "CC"]);
    expect(pageMap).toEqual([0, 3 + PAGE_SEPARATOR.length, 3 + 4 + 2 * PAGE_SEPARATOR.length]);
    // La preuve par relecture : le contenu à l'offset annoncé EST le début de la page.
    expect(content.slice(pageMap[1], pageMap[1] + 4)).toBe("BBBB");
    expect(content.slice(pageMap[2], pageMap[2] + 2)).toBe("CC");
  });

  it("ne retaille pas le contenu — retailler décalerait toutes les positions", () => {
    const { content, pageMap } = buildPagedContent(["", "page deux"]);
    expect(pageAtOffset(pageMap, content.indexOf("page deux"))).toBe(2);
  });
});

describe("pageAtOffset", () => {
  const { pageMap } = buildPagedContent(["a".repeat(100), "b".repeat(100), "c".repeat(100)]);

  it("rend la bonne page aux positions ordinaires et aux FRONTIÈRES", () => {
    expect(pageAtOffset(pageMap, 0)).toBe(1);
    expect(pageAtOffset(pageMap, 99)).toBe(1);
    expect(pageAtOffset(pageMap, pageMap[1])).toBe(2); // premier caractère de la page 2
    expect(pageAtOffset(pageMap, pageMap[2] + 50)).toBe(3);
    expect(pageAtOffset(pageMap, 10_000)).toBe(3); // au-delà de la fin → dernière page
  });

  it("survit à une carte vide", () => {
    expect(pageAtOffset([], 42)).toBe(1);
  });
});

describe("pageSpanOfSlice", () => {
  const { pageMap } = buildPagedContent(["a".repeat(100), "b".repeat(100), "c".repeat(100)]);

  it("couvre les pages réellement touchées par la tranche", () => {
    expect(pageSpanOfSlice(pageMap, 0, 100)).toEqual({ start: 1, end: 1 });
    expect(pageSpanOfSlice(pageMap, 50, 150)).toEqual({ start: 1, end: 2 });
    // `end` est EXCLUSIF : une tranche qui s'arrête pile au début de la page 2 ne la touche pas.
    expect(pageSpanOfSlice(pageMap, 0, pageMap[1])).toEqual({ start: 1, end: 1 });
  });
});

describe("anchorEvidence — la vérification qui prime sur l'estimation", () => {
  const pages = [
    "Certificat GMP du site de fabrication, émis par l'autorité compétente.",
    "La durée de conservation revendiquée est de 36 mois à température ambiante.",
    "Composition qualitative et quantitative du produit fini, par unité de prise.",
  ];
  const { content, pageMap } = buildPagedContent(pages);

  it("retrouve la page EXACTE d'une citation", () => {
    expect(anchorEvidence(content, pageMap, "La durée de conservation revendiquée est de 36 mois")).toBe(2);
    expect(anchorEvidence(content, pageMap, "Composition qualitative et quantitative")).toBe(3);
  });

  it("retrouve une citation malgré les sauts de ligne du PDF", () => {
    // Le PDF casse ses lignes où bon lui semble ; la citation du modèle, jamais.
    const broken = content.replace("durée de conservation", "durée\nde   conservation");
    expect(anchorEvidence(broken, pageMap, "La durée de conservation revendiquée est de 36 mois")).toBe(2);
  });

  it("rend null pour une preuve INTROUVABLE — jamais une page inventée", () => {
    expect(anchorEvidence(content, pageMap, "Ce texte n'existe nulle part dans le document fourni.")).toBeNull();
  });

  it("refuse d'ancrer une citation trop courte pour être discriminante", () => {
    expect(anchorEvidence(content, pageMap, "de")).toBeNull();
    expect(anchorEvidence(content, pageMap, null)).toBeNull();
  });

  it("est insensible à la casse", () => {
    expect(anchorEvidence(content, pageMap, "certificat gmp du site de fabrication")).toBe(1);
  });
});
