import { describe, expect, it } from "vitest";
import {
  articleRepris, detenuParLeSite, lireDepotDuSite, offreAdminReprise, offreExempleReprise, origineReprise,
} from "./reprise-lecture";
import { corpsArticle, corpsOffre, ecartsArticle, serialiser, type ArticleSaisi, type OffreSaisie } from "./contrat";

/**
 * LA LECTURE DU DÉPÔT DU SITE ET LE MARQUEUR DE REPRISE (§118.160) — règles pures.
 *
 * Deux propriétés portent tout le reste : une réponse qu'on ne lit pas à coup sûr ne devient pas une
 * reprise à moitié vide (`null`, éléments écartés ET comptés) ; et le marqueur n'apparaît QUE sur un
 * contenu repris, en dernier — un article ordinaire sérialise exactement comme avant, donc aucune
 * empreinte ne change et rien ne repart pour rien au déploiement.
 */

const article = (extra: Record<string, unknown> = {}) => ({
  slug: "enregistrement-medicament-algerie-etapes",
  title: "Enregistrement d'un médicament en Algérie",
  description: "Guide pratique.",
  body: "Intro.\r\n\r\n## Avant le dossier\r\n\r\nTexte.",
  category: "Réglementaire",
  tags: ["enregistrement", "Algérie"],
  author: "Adventum Pharma",
  date: "2026-03-18T00:00:00.000Z",
  updated: "2026-09-15T00:00:00.000Z",
  featured: true,
  replaced: false,
  ...extra,
});

describe("lireDepotDuSite — ce qu'on ne lit pas à coup sûr ne devient pas une reprise", () => {
  it("une réponse sans liste `articles` n'est PAS « le dépôt est vide » : null", () => {
    expect(lireDepotDuSite(null)).toBeNull();
    expect(lireDepotDuSite("<html>")).toBeNull();
    expect(lireDepotDuSite([])).toBeNull();
    expect(lireDepotDuSite({})).toBeNull();
    expect(lireDepotDuSite({ articles: "x" })).toBeNull();
    expect(lireDepotDuSite({ articles: [] })).toEqual({ articles: [], exemples: [], illisibles: 0 });
  });

  it("lit le Markdown BRUT, les dates, la mise en avant — et le fait que le site cache déjà le fichier", () => {
    const d = lireDepotDuSite({ articles: [article(), article({ slug: "autre-article", replaced: true, date: "pas une date", updated: null })] })!;
    expect(d.illisibles).toBe(0);
    expect(d.articles[0]).toMatchObject({
      slug: "enregistrement-medicament-algerie-etapes", titre: "Enregistrement d'un médicament en Algérie", aLaUne: true, cache: false,
      corps: "Intro.\n\n## Avant le dossier\n\nTexte.",
    });
    expect(d.articles[0]!.date?.toISOString()).toBe("2026-03-18T00:00:00.000Z");
    expect(d.articles[1]).toMatchObject({ cache: true, date: null, maj: null });
  });

  it("écarte ET compte : adresse impropre, corps vide, doublon d'adresse, élément qui n'est pas un objet", () => {
    const d = lireDepotDuSite({
      articles: [
        article(), article(), // doublon
        article({ slug: "Majuscules-Interdites" }), article({ slug: "../evasion" }), article({ slug: "x".repeat(97) }),
        article({ slug: "sans-corps", body: "   " }), "texte", null,
      ],
      sampleJobs: [{ slug: "ok", title: "Poste" }, { slug: "sans-titre", title: "" }, { slug: "Mauvais Slug", title: "T" }, 42],
    })!;
    expect(d.articles.map((a) => a.slug)).toEqual(["enregistrement-medicament-algerie-etapes"]);
    expect(d.exemples.map((e) => e.slug)).toEqual(["ok"]);
    expect(d.illisibles).toBe(7 + 3);
  });
});

describe("traduire en contenu de l'ERP — ce qui est en ligne reste en ligne, ce qui ne l'est pas ne le devient pas", () => {
  it("un article du dépôt : même adresse, même texte, publié tant que le site le montrait", () => {
    const [visible, cache] = lireDepotDuSite({ articles: [article(), article({ slug: "cache", replaced: true })] })!.articles;
    expect(articleRepris(visible!)).toMatchObject({ slug: visible!.slug, published: true, featured: true, repriseDe: visible!.slug });
    expect(articleRepris(cache!), "le site le cachait déjà : il ne redevient pas visible").toMatchObject({ published: false, repriseDe: "cache" });
  });

  it("une offre d'exemple : TOUJOURS en brouillon, sans marqueur (un site relié ne la montre plus)", () => {
    const [e] = lireDepotDuSite({ articles: [], sampleJobs: [{ slug: "ex", title: "Poste", type: "CDI", mission: ["a", ""], profile: "p1\np2" }] })!.exemples;
    expect(offreExempleReprise(e!)).toMatchObject({ published: false, repriseDe: null, type: "CDI", mission: ["a"], profile: ["p1", "p2"] });
  });

  it("une offre saisie sur le site : son état est gardé ; sans identifiant sûr ou déjà à l'ERP, rien n'est repris", () => {
    const brut = (o: Record<string, unknown>) => ({ externalId: null, titre: String(o.title ?? ""), url: null, slug: null, brut: o });
    expect(offreAdminReprise(brut({ id: "job-123", title: "Poste", published: true }))).toMatchObject({ cle: "job-123", saisie: { published: true, repriseDe: "job-123" } });
    expect(offreAdminReprise(brut({ id: "job-124", title: "Poste", published: false }))?.saisie.published).toBe(false);
    expect(offreAdminReprise(brut({ id: "a/b", title: "Poste" })), "un identifiant qu'on ne saurait pas redonner au site").toBeNull();
    expect(offreAdminReprise(brut({ id: "job-125", title: "  " }))).toBeNull();
    expect(offreAdminReprise({ ...brut({ id: "job-126", title: "Poste" }), externalId: "deja-erp" }), "déjà un contenu de l'ERP").toBeNull();
  });

  it("le site DÉTIENT-il déjà sa copie ? l'article du dépôt et l'offre saisie oui ; l'exemple non", () => {
    expect(detenuParLeSite("ARTICLE_DEPOT")).toBe(true);
    expect(detenuParLeSite("OFFRE_ADMIN")).toBe(true);
    expect(detenuParLeSite("OFFRE_EXEMPLE")).toBe(false);
    expect(detenuParLeSite(null)).toBe(false);
    expect(detenuParLeSite("AUTRE")).toBe(false);
    expect(origineReprise("AUTRE")).toBeNull();
  });
});

describe("le marqueur de reprise dans les corps — en dernier, et seulement pour une reprise", () => {
  const saisie: ArticleSaisi = {
    title: "T", body: "Corps.", description: "D", slug: "t", category: null, tags: ["a"], author: null,
    date: new Date("2026-03-18T00:00:00.000Z"), updated: new Date("2026-09-15T00:00:00.000Z"), featured: false, published: true,
  };
  const offre: OffreSaisie = {
    title: "Poste", department: null, location: null, type: "CDI", experience: null, summary: null, mission: [], profile: [], offer: [], published: true,
  };

  it("un article ORDINAIRE sérialise exactement comme avant : aucune empreinte ne change au déploiement", () => {
    const c = corpsArticle(saisie, new Date());
    expect(Object.keys(c)).toEqual(["title", "body", "description", "slug", "category", "tags", "author", "date", "featured", "published", "updated"]);
    expect(serialiser(c)).not.toMatch(/replaces/);
    expect(serialiser(corpsArticle({ ...saisie, repriseDe: null }, new Date()))).toBe(serialiser(c));
    expect(serialiser(corpsArticle({ ...saisie, repriseDe: "  " }, new Date())), "un marqueur vide n'en est pas un").toBe(serialiser(c));
  });

  it("un article REPRIS porte `replacesFile`, en dernier", () => {
    const c = corpsArticle({ ...saisie, repriseDe: "fichier-du-depot" }, new Date());
    expect(Object.keys(c).at(-1)).toBe("replacesFile");
    expect(c.replacesFile).toBe("fichier-du-depot");
  });

  it("une offre : `replacesJob` seulement pour une offre saisie sur le site, en dernier", () => {
    expect(Object.keys(corpsOffre(offre))).not.toContain("replacesJob");
    const c = corpsOffre({ ...offre, repriseDe: "job-9" });
    expect(Object.keys(c).at(-1)).toBe("replacesJob");
    expect(c.replacesJob).toBe("job-9");
  });

  it("l'écart sur le marqueur se juge quand le site DIT ce qu'il détient — jamais sur une clé qu'il ne rend pas", () => {
    const voulu = corpsArticle({ ...saisie, repriseDe: "fichier" }, new Date());
    const site = { ...voulu } as Record<string, unknown>;
    expect(ecartsArticle(voulu, site)).toEqual([]);
    expect(ecartsArticle(voulu, { ...site, replacesFile: null }), "le site a perdu le marqueur : le fichier reviendrait").toEqual(["replacesFile"]);
    const { replacesFile: _absent, ...ancien } = site;
    void _absent;
    expect(ecartsArticle(voulu, ancien), "un site qui ne rend pas la clé ne fait pas repousser chaque nuit").toEqual([]);
  });
});
