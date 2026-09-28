import { describe, expect, it } from "vitest";
import { apercu, lecture, lienSur, refusTitresNiveau1, segments, sommaire, titres } from "./markdown";

/**
 * LE CORPS D'UN ARTICLE (§118.158) — ce que le contrat interdit (un titre de niveau 1), et la
 * structure que le site va en tirer (le sommaire). Chaque cas nomme la façon dont une règle
 * trop large ou trop étroite se tromperait.
 */
describe("les titres de niveau 1 sont refusés sous leurs trois formes, et seulement là", () => {
  it("« # Titre » est un titre de niveau 1, avec sa ligne HUMAINE", () => {
    const md = "Introduction.\n\n# Le principe\n\nTexte.";
    const h1 = titres(md).filter((t) => t.niveau === 1);
    expect(h1).toEqual([{ niveau: 1, texte: "Le principe", ligne: 3, forme: "diese" }]);
  });

  it("le titre souligné de « === » en est un aussi — la forme qu'on oublie", () => {
    const md = "Le principe\n===========\n\nTexte.";
    expect(titres(md)).toEqual([{ niveau: 1, texte: "Le principe", ligne: 1, forme: "souligne" }]);
  });

  it("la balise <h1> en est un troisième", () => {
    expect(titres("<h1>Titre</h1>").map((t) => [t.niveau, t.forme])).toEqual([[1, "html"]]);
  });

  it("« #hashtag » n'est PAS un titre — il faut une espace après le dièse", () => {
    expect(titres("#traçabilité #qualité")).toEqual([]);
  });

  it("un « # » dans un bloc de code n'est PAS un titre — sinon un exemple de script serait refusé", () => {
    const md = "Voici la commande :\n\n```bash\n# installer\nnpm install\n```\n\n## Suite";
    expect(titres(md).map((t) => t.niveau)).toEqual([2]);
  });

  it("…ni dans un bloc de code indenté", () => {
    expect(titres("Texte.\n\n    # commentaire\n    code").filter((t) => t.niveau === 1)).toEqual([]);
  });

  it("un bloc de code jamais refermé absorbe la suite, comme le fera le rendu du site", () => {
    // Un bloc qui s'ouvre et ne se ferme pas absorbe la suite : c'est ce que ferait le rendu du
    // site. On ne signale donc PAS un titre que le site afficherait comme du code.
    expect(titres("```\n# pas un titre").filter((t) => t.niveau === 1)).toEqual([]);
  });

  it("« ## » et « ### » sont des niveaux 2 et 3, pas des niveaux 1", () => {
    expect(titres("## A\n### B").map((t) => t.niveau)).toEqual([2, 3]);
  });

  it("un « --- » après un paragraphe est un titre de niveau 2 ; après une ligne vide, un séparateur", () => {
    expect(titres("Section\n---").map((t) => t.niveau)).toEqual([2]);
    expect(titres("Texte.\n\n---\n\nSuite.")).toEqual([]);
  });

  it("le refus nomme la ligne exacte et le geste qui le lève", () => {
    const [r] = refusTitresNiveau1("Intro.\n\n# Introduction\n\nTexte.");
    expect(r).toMatch(/ligne 3/);
    expect(r).toMatch(/« # Introduction »/);
    expect(r).toMatch(/remplacez « # » par « ## »/);
  });

  it("au-delà de trois titres fautifs, le refus en cite trois et COMPTE le reste", () => {
    const md = ["# A", "# B", "# C", "# D", "# E"].join("\n\n");
    const [r] = refusTitresNiveau1(md);
    expect(r).toMatch(/5 titres/);
    expect(r).toMatch(/et 2 autres/);
  });

  it("un corps propre ne produit aucun refus", () => {
    expect(refusTitresNiveau1("Intro.\n\n## Le principe\n\nTexte.")).toEqual([]);
  });
});

describe("le sommaire est celui que le site construira", () => {
  it("les ## et les ### seulement, dans l'ordre", () => {
    const md = "Intro.\n\n## Le principe\n\n### Détail\n\n#### Trop fin\n\n## En pratique";
    expect(sommaire(md).map((s) => `${s.niveau}:${s.texte}`)).toEqual(["2:Le principe", "3:Détail", "2:En pratique"]);
  });

  it("les dièses de fermeture ne font pas partie du titre", () => {
    expect(sommaire("## Le principe ##").map((s) => s.texte)).toEqual(["Le principe"]);
  });
});

describe("l'aperçu est fait de blocs, jamais de HTML — et un lien douteux reste inerte", () => {
  it("titres, paragraphes, listes, citations, code et séparateurs", () => {
    const md = [
      "Intro **forte** et *douce*.",
      "",
      "## Section",
      "",
      "- un",
      "- deux",
      "",
      "1. premier",
      "2. second",
      "",
      "> cité",
      "",
      "```",
      "code()",
      "```",
      "",
      "---",
    ].join("\n");
    expect(apercu(md).map((b) => b.t)).toEqual(["paragraphe", "titre", "liste", "liste", "citation", "code", "separateur"]);
    const listes = apercu(md).filter((b) => b.t === "liste");
    expect(listes.map((l) => (l as { ordonnee: boolean }).ordonnee)).toEqual([false, true]);
  });

  it("un lien web devient un lien ; un lien « javascript: » reste du texte", () => {
    expect(segments("[site](https://www.adventumdz.com)")).toEqual([{ t: "lien", v: "site", href: "https://www.adventumdz.com" }]);
    // Ce qui compte : AUCUN segment de lien, et le texte entier conservé — visible, donc
    // corrigeable par l'auteur, et inerte.
    const douteux = segments("[clic](javascript:alert(1))");
    expect(douteux.some((x) => x.t === "lien")).toBe(false);
    expect(douteux.map((x) => x.v).join("")).toBe("[clic](javascript:alert(1))");
    expect(lienSur("data:text/html,x")).toBe(false);
    expect(lienSur("/blog/autre")).toBe(true);
    expect(lienSur("//evil.example/x")).toBe(false);
  });

  it("gras, italique et code en ligne", () => {
    expect(segments("a **b** c *d* `e`")).toEqual([
      { t: "texte", v: "a " }, { t: "gras", v: "b" }, { t: "texte", v: " c " },
      { t: "italique", v: "d" }, { t: "texte", v: " " }, { t: "code", v: "e" },
    ]);
  });

  it("le temps de lecture ne compte pas la ponctuation Markdown comme des mots", () => {
    expect(lecture("## Titre\n\n- un deux trois")).toEqual({ mots: 4, minutes: 1 });
    expect(lecture("")).toEqual({ mots: 0, minutes: 0 });
  });
});
