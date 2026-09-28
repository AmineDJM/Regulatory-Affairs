import { describe, expect, it } from "vitest";
import {
  classerReponse, corpsArticle, corpsOffre, DELAIS_REESSAI_MS, ecartsArticle, ecartsOffre, ESSAIS_MAX,
  etatPublication, externalIdValide, lignes, lireArticlesDuDepot, lireListeSite, messageDuSite,
  planifierRapprochement, prochainEssai, refusArticle, refusOffre, serialiser, slugSuggere, slugValide,
  type ArticleSaisi, type EtatVoulu, type FaitsPublication, type OffreSaisie,
} from "./contrat";

/**
 * LE CONTRAT DE L'API DE CONTENU DU SITE, CÔTÉ ERP (§118.158) — pur, joué sans base.
 * Les chiffres de ce banc (limites, délais, codes) sont ceux de `docs/openapi.yaml` et de
 * `docs/ERP-INTEGRATION.md` du dépôt du site : ce sont eux que l'ERP doit tenir.
 */

const OFFRE: OffreSaisie = {
  title: "Directeur Supply Chain",
  department: "Supply Chain",
  location: "Cheraga, Alger",
  type: "CDI",
  experience: "10 ans minimum",
  summary: "Pilotage de la chaîne d'approvisionnement.",
  mission: ["Piloter les flux", "Structurer la politique de stocks"],
  profile: ["Ingénieur logistique"],
  offer: ["Un rôle de direction"],
  published: true,
};

const ARTICLE: ArticleSaisi = {
  title: "Traçabilité des lots : ce que change la sérialisation",
  body: "Texte d'introduction.\n\n## Le principe\n\nChaque unité reçoit un code unique.",
  description: "Pourquoi la sérialisation modifie en profondeur la traçabilité pharmaceutique.",
  slug: null,
  category: "Qualité",
  tags: ["traçabilité", "qualité"],
  author: null,
  date: new Date("2026-09-20T09:00:00.000Z"),
  updated: null,
  featured: false,
  published: true,
};

describe("l'identifiant externe est la clé d'idempotence — il doit être sûr pour une URL", () => {
  it("un cuid, une référence simple : oui", () => {
    expect(externalIdValide("cmtx9k2l30000abcd1234efgh")).toBe(true);
    expect(externalIdValide("JOB-1042")).toBe(true);
  });
  it("vide, trop long, ou porteur d'un caractère réservé : non", () => {
    expect(externalIdValide("")).toBe(false);
    expect(externalIdValide("a".repeat(129))).toBe(false);
    expect(externalIdValide("a".repeat(128))).toBe(true);
    for (const x of ["a/b", "a b", "a?b", "a#b", "é"]) expect(externalIdValide(x), x).toBe(false);
  });
});

describe("une offre part avec ce que le contrat connaît — et rien d'autre", () => {
  it("le corps porte EXACTEMENT les dix champs de JobInput : aucune donnée interne ne peut s'y glisser", () => {
    // La rémunération et la justification d'un recrutement vivent sur la demande interne. Le
    // corps est construit champ par champ : il ne peut pas les contenir, et ce test le fige.
    expect(Object.keys(corpsOffre(OFFRE))).toEqual([
      "title", "department", "location", "type", "experience", "summary", "mission", "profile", "offer", "published",
    ]);
  });

  it("un poste qui n'est plus ouvert part en brouillon, quoi qu'on ait coché", () => {
    expect(corpsOffre(OFFRE, true).published).toBe(true);
    expect(corpsOffre(OFFRE, false).published).toBe(false);
    expect(corpsOffre({ ...OFFRE, published: false }, true).published).toBe(false);
  });

  it("un champ vidé part VIDE, pas absent — sinon un site qui fusionne garderait l'ancienne valeur", () => {
    const c = corpsOffre({ ...OFFRE, experience: null, mission: [] });
    expect(c.experience).toBe("");
    expect(c.mission).toEqual([]);
  });

  it("les puces tapées par réflexe sont retirées, les lignes vides tombent", () => {
    expect(lignes("- un\n\n• deux\n* trois\n1. quatre\n2) cinq\n   ")).toEqual(["un", "deux", "trois", "quatre", "cinq"]);
    expect(lignes(null)).toEqual([]);
  });

  it("tous les refus d'une offre arrivent EN UNE FOIS (§118.18)", () => {
    const refus = refusOffre({ ...OFFRE, title: "  ", summary: "x".repeat(601), mission: Array.from({ length: 31 }, (_, i) => `m${i}`) });
    expect(refus).toHaveLength(3);
    expect(refus.join(" ")).toMatch(/intitulé du poste est obligatoire/);
    expect(refus.join(" ")).toMatch(/résumé dépasse 600 caractères \(601\)/);
    expect(refus.join(" ")).toMatch(/31 lignes/);
  });

  it("aux limites exactes, rien n'est refusé", () => {
    expect(refusOffre({ ...OFFRE, title: "x".repeat(160), summary: "y".repeat(600), mission: Array.from({ length: 30 }, (_, i) => `m${i}`) })).toEqual([]);
    expect(refusOffre({ ...OFFRE, title: "x".repeat(161) })).toHaveLength(1);
  });
});

describe("un article part avec une date TOUJOURS, et ses valeurs par défaut écrites", () => {
  it("sans date choisie, c'est la date de première mise en ligne qui part — jamais « maintenant » à chaque correction", () => {
    const premiere = new Date("2026-09-01T08:00:00.000Z");
    expect(corpsArticle({ ...ARTICLE, date: null }, premiere).date).toBe("2026-09-01T08:00:00.000Z");
    expect(corpsArticle(ARTICLE, premiere).date).toBe("2026-09-20T09:00:00.000Z");
  });

  it("catégorie et auteur par défaut sont ÉCRITS, comme le site les appliquerait", () => {
    const c = corpsArticle({ ...ARTICLE, category: null, author: "  " }, new Date());
    expect(c.category).toBe("Secteur");
    expect(c.author).toBe("Adventum Pharma");
  });

  it("le slug n'est envoyé que s'il est donné ; `updated` que s'il existe", () => {
    const sans = corpsArticle(ARTICLE, new Date());
    expect("slug" in sans).toBe(false);
    expect("updated" in sans).toBe(false);
    const avec = corpsArticle({ ...ARTICLE, slug: "tracabilite", updated: new Date("2026-09-25T00:00:00Z") }, new Date());
    expect(avec.slug).toBe("tracabilite");
    expect(avec.updated).toBe("2026-09-25T00:00:00.000Z");
  });

  it("les mots-clés sont dédoublonnés sans la casse ; les fins de ligne sont unifiées", () => {
    const c = corpsArticle({ ...ARTICLE, tags: ["Qualité", "qualité", " GMP "], body: "a\r\nb" }, new Date());
    expect(c.tags).toEqual(["Qualité", "GMP"]);
    expect(c.body).toBe("a\nb");
  });

  it("tous les refus d'un article arrivent en une fois, y compris ceux du corps Markdown", () => {
    const refus = refusArticle({ ...ARTICLE, title: "", body: "", slug: "Mauvais Slug", tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, ["titre de niveau 1 (ligne 3)"]);
    expect(refus).toHaveLength(5);
    expect(refus.join(" ")).toMatch(/« Mauvais Slug » n'est pas valide/);
    expect(refus.join(" ")).toMatch(/exemple : mauvais-slug/);
  });

  it("le slug : minuscules, chiffres, tirets simples, 96 caractères au plus", () => {
    expect(slugValide("tracabilite-des-lots")).toBe(true);
    for (const x of ["Tracabilite", "trac--abilite", "-trac", "trac-", "é", "a".repeat(97)]) expect(slugValide(x), x).toBe(false);
    expect(slugSuggere("Traçabilité des lots : ce que change la sérialisation")).toBe("tracabilite-des-lots-ce-que-change-la-serialisation");
    expect(slugValide(slugSuggere("Œuvre & santé — 2027 !"))).toBe(true);
  });
});

describe("sérialiser UNE fois : la chaîne signée est la chaîne envoyée", () => {
  it("deux corps égaux donnent la même chaîne, octet pour octet", () => {
    const a = corpsOffre(OFFRE);
    const b = corpsOffre({ ...OFFRE, mission: [...OFFRE.mission] });
    expect(serialiser(a)).toBe(serialiser(b));
  });
});

describe("une réponse du site dit à la file quoi faire", () => {
  it("le tableau du contrat (§6) — réseau, succès, absent, à corriger, bloquant", () => {
    const cas: [Parameters<typeof classerReponse>[0], number | null, string][] = [
      ["PUT", null, "REESSAYER"],
      ["PUT", 200, "SUCCES"], ["PUT", 201, "SUCCES"], ["DELETE", 200, "SUCCES"], ["PUT", 204, "SUCCES"],
      ["DELETE", 404, "DEJA_ABSENT"],
      ["PUT", 404, "CORRIGER"], ["PUT", 400, "CORRIGER"], ["PUT", 422, "CORRIGER"], ["PUT", 403, "CORRIGER"], ["PUT", 409, "CORRIGER"],
      // « Ne pas réessayer sur 4xx (hors 429) » : le 408 aussi, le contrat est explicite.
      ["PUT", 408, "CORRIGER"],
      ["PUT", 401, "BLOQUANT"], ["GET", 401, "BLOQUANT"],
      ["PUT", 301, "BLOQUANT"], ["PUT", 308, "BLOQUANT"],
      ["PUT", 429, "REESSAYER"], ["PUT", 503, "REESSAYER"], ["PUT", 500, "REESSAYER"], ["PUT", 502, "REESSAYER"], ["PUT", 504, "REESSAYER"],
    ];
    for (const [m, s, attendu] of cas) expect(classerReponse(m, s), `${m} ${s}`).toBe(attendu);
  });

  it("les délais du contrat : 1 s, 5 s, 30 s, 2 min, 10 min — puis la file s'arrête", () => {
    const t0 = new Date("2026-09-28T10:00:00.000Z");
    const delais = [1, 2, 3, 4, 5].map((n) => prochainEssai(n, t0)!.getTime() - t0.getTime());
    expect(delais).toEqual([1_000, 5_000, 30_000, 120_000, 600_000]);
    expect(delais).toEqual([...DELAIS_REESSAI_MS]);
    expect(ESSAIS_MAX).toBe(6);
    expect(prochainEssai(6, t0)).toBeNull();
    expect(prochainEssai(0, t0)).toBeNull();
  });

  it("un Retry-After plus long est honoré, plafonné à une heure ; plus court, il ne raccourcit rien", () => {
    const t0 = new Date("2026-09-28T10:00:00.000Z");
    expect(prochainEssai(1, t0, 90)!.getTime() - t0.getTime()).toBe(90_000);
    expect(prochainEssai(1, t0, 99_999)!.getTime() - t0.getTime()).toBe(3_600_000);
    expect(prochainEssai(3, t0, 2)!.getTime() - t0.getTime()).toBe(30_000);
  });

  it("le message d'erreur du site est lu dans `{error}`, sinon dans le corps brut", () => {
    expect(messageDuSite('{"error":"title est requis"}')).toBe("title est requis");
    expect(messageDuSite("<html>Bad Gateway</html>")).toBe("<html>Bad Gateway</html>");
    expect(messageDuSite("")).toBeNull();
    expect(messageDuSite(null)).toBeNull();
  });
});

describe("comparer ce que l'ERP veut à ce que le site détient — sans fausses divergences", () => {
  it("une offre identique est conforme, même si le site rend une liste en texte ou un champ vide en null", () => {
    const voulu = corpsOffre({ ...OFFRE, experience: null });
    const site = { ...voulu, experience: null, mission: voulu.mission.join("\n") };
    expect(ecartsOffre(voulu, site)).toEqual([]);
  });

  it("un intitulé ou un état de publication différent est un écart nommé", () => {
    const voulu = corpsOffre(OFFRE);
    expect(ecartsOffre(voulu, { ...voulu, title: "Autre", published: false })).toEqual(["title", "published"]);
  });

  it("un article : mots-clés comparés comme un ensemble, date au jour, corps aux fins de ligne près", () => {
    const voulu = corpsArticle(ARTICLE, new Date());
    const site = {
      ...voulu,
      tags: ["QUALITÉ", "traçabilité"],
      date: "2026-09-20",
      body: `${voulu.body.replace(/\n/g, "\r\n")}\n\n`,
    };
    expect(ecartsArticle(voulu, site)).toEqual([]);
  });

  it("un site qui omet catégorie, auteur et « à la une » applique ses valeurs par défaut — pas d'écart", () => {
    const voulu = corpsArticle({ ...ARTICLE, category: null, author: null }, new Date());
    const { category: _c, author: _a, featured: _f, ...site } = voulu;
    expect(ecartsArticle(voulu, site)).toEqual([]);
  });

  it("un article qu'on veut en brouillon et que le site montre (défaut `published: true`) EST un écart", () => {
    const voulu = corpsArticle({ ...ARTICLE, published: false }, new Date());
    const { published: _p, ...site } = voulu;
    expect(ecartsArticle(voulu, site)).toEqual(["published"]);
  });

  it("le slug ne se compare que s'il a été envoyé", () => {
    const sans = corpsArticle(ARTICLE, new Date());
    expect(ecartsArticle(sans, { ...sans, slug: "derive-par-le-site" })).toEqual([]);
    const avec = corpsArticle({ ...ARTICLE, slug: "voulu" }, new Date());
    expect(ecartsArticle(avec, { ...avec, slug: "autre" })).toEqual(["slug"]);
  });
});

describe("la réconciliation quotidienne : repousser ce qui diverge, ne jamais supprimer ce qu'on ne connaît pas", () => {
  const voulu = (externalId: string, over: Partial<OffreSaisie> = {}): EtatVoulu => ({
    nature: "JOB", externalId, libelle: externalId, operation: "PUT", corps: corpsOffre({ ...OFFRE, ...over }),
  });
  const site = (externalId: string | null, corps: Record<string, unknown>, url = `/carrieres/${externalId}`) => ({
    ...corps, externalId, url, slug: String(externalId), title: corps.title,
  });

  it("absent → repoussé ; divergent → repoussé avec ses champs ; identique → conforme", () => {
    const a = voulu("A");
    const b = voulu("B");
    const c = voulu("C");
    const plan = planifierRapprochement([a, b, c], {
      jobs: lireListeSite([site("B", { ...b.corps!, title: "Changé" }), site("C", c.corps as unknown as Record<string, unknown>)]).enregistrements,
      posts: [],
      depot: [],
    });
    expect(plan.aPousser.map((p) => [p.externalId, p.raison])).toEqual([["A", "absent du site"], ["B", "écart sur title"]]);
    expect(plan.conformes.map((p) => [p.externalId, p.url])).toEqual([["C", "/carrieres/C"]]);
  });

  it("supprimé dans l'ERP et encore sur le site → le DELETE est rejoué ; déjà absent → conforme", () => {
    const d: EtatVoulu = { nature: "JOB", externalId: "D", libelle: "D", operation: "DELETE", corps: null };
    const e: EtatVoulu = { nature: "JOB", externalId: "E", libelle: "E", operation: "DELETE", corps: null };
    const plan = planifierRapprochement([d, e], { jobs: lireListeSite([site("D", { title: "x" })]).enregistrements, posts: [], depot: [] });
    expect(plan.aSupprimer.map((x) => x.externalId)).toEqual(["D"]);
    expect(plan.conformes.map((x) => x.externalId)).toEqual(["E"]);
  });

  it("un externalId inconnu de l'ERP est NOMMÉ comme orphelin — et n'est jamais mis à supprimer", () => {
    const plan = planifierRapprochement([], { jobs: lireListeSite([site("TEST-1", { title: "Offre de test" })]).enregistrements, posts: [], depot: [] });
    expect(plan.orphelins).toEqual([{ nature: "JOB", externalId: "TEST-1", titre: "Offre de test", url: "/carrieres/TEST-1" }]);
    expect(plan.aSupprimer).toEqual([]);
  });

  it("un contenu CONNU que le contrat refuse aujourd'hui (corps nul) n'est ni repoussé ni orphelin", () => {
    // Sans ce cas, un contenu écrit hors des actions (ou après un changement de règle) et encore
    // détenu par le site sortait « inconnu de l'ERP » — une phrase fausse, adressée aux Super Admins.
    const v: EtatVoulu = { nature: "POST", externalId: "P9", libelle: "Hors contrat", operation: "PUT", corps: null, refus: "Le titre `# …` ligne 1" };
    const plan = planifierRapprochement([v], { jobs: [], posts: lireListeSite([{ externalId: "P9", title: "Hors contrat" }]).enregistrements, depot: [] });
    expect(plan.orphelins).toEqual([]);
    expect(plan.aPousser).toEqual([]);
    expect(plan.aSupprimer).toEqual([]);
    expect(plan.conformes).toEqual([]);
  });

  it("une saisie manuelle du site (sans externalId) est comptée et laissée en paix", () => {
    const plan = planifierRapprochement([], { jobs: lireListeSite([{ externalId: null, title: "Saisie admin" }]).enregistrements, posts: lireListeSite([{ title: "Article admin" }]).enregistrements, depot: [] });
    expect(plan.manuels).toEqual({ jobs: 1, posts: 1 });
    expect(plan.orphelins).toEqual([]);
  });

  it("un article dont le slug est celui d'un article du DÉPÔT du site est signalé : le site l'ignore publiquement", () => {
    const corps = corpsArticle(ARTICLE, new Date());
    const v: EtatVoulu = { nature: "POST", externalId: "P1", libelle: "Traçabilité", operation: "PUT", corps };
    const plan = planifierRapprochement([v], {
      jobs: [],
      posts: lireListeSite([{ ...corps, externalId: "P1", url: "/blog/tracabilite-des-lots", slug: "tracabilite-des-lots" }]).enregistrements,
      depot: lireArticlesDuDepot([{ slug: "tracabilite-des-lots", title: "Traçabilité (fichier du dépôt)", url: "/blog/tracabilite-des-lots" }]),
    });
    expect(plan.collisions).toEqual([{ externalId: "P1", libelle: "Traçabilité", slug: "tracabilite-des-lots", titreDuDepot: "Traçabilité (fichier du dépôt)" }]);
    // Conforme côté contenu — et pourtant invisible : c'est exactement pourquoi la collision se dit à part.
    expect(plan.conformes.map((c) => c.externalId)).toEqual(["P1"]);
  });

  it("une réponse illisible n'est pas lue comme « le site n'a rien »", () => {
    const l = lireListeSite([1, "x", null, { title: "ok", externalId: "A" }]);
    expect(l.enregistrements).toHaveLength(1);
    expect(l.illisibles).toBe(3);
  });
});

describe("l'état affiché ne dit « En ligne » que lorsque le site l'a confirmé", () => {
  const base: FaitsPublication = {
    existe: true, operation: "PUT", etat: "DONE", essais: 1, prochainEssai: null, dernierStatut: 201,
    derniereErreur: null, publieDansErp: true, publieSurLeSite: true, urlPublique: "/carrieres/x", suspendu: null,
  };
  it("coché dans l'ERP mais jamais parti : « À envoyer », pas « En ligne »", () => {
    expect(etatPublication({ ...base, existe: false, etat: null, operation: null }).libelle).toBe("À envoyer");
    expect(etatPublication({ ...base, existe: false, etat: null, operation: null, publieDansErp: false }).libelle).toBe("Brouillon");
  });
  it("confirmé par le site : « En ligne » avec l'adresse ; confirmé en brouillon : « Retiré du site »", () => {
    expect(etatPublication(base)).toMatchObject({ libelle: "En ligne", ton: "success", detail: "/carrieres/x" });
    expect(etatPublication({ ...base, publieSurLeSite: false }).libelle).toBe("Retiré du site");
    expect(etatPublication({ ...base, operation: "DELETE" }).libelle).toBe("Supprimé du site");
  });
  it("en file : le motif de l'attente est dit — configuration absente, clé refusée, prochain essai", () => {
    expect(etatPublication({ ...base, etat: "PENDING", essais: 0, suspendu: "NON_CONFIGURE" }).detail).toMatch(/pas configurée/);
    expect(etatPublication({ ...base, etat: "PENDING", essais: 0, suspendu: "BLOQUE" }).libelle).toBe("Suspendu");
    expect(etatPublication({ ...base, etat: "PENDING", essais: 2, dernierStatut: 503 }).detail).toMatch(/2 essai\(s\).*503/);
    expect(etatPublication({ ...base, etat: "PENDING", essais: 1, dernierStatut: null }).detail).toMatch(/site injoignable/);
  });
  it("en échec : un refus du site (4xx) n'est pas une panne réseau", () => {
    expect(etatPublication({ ...base, etat: "FAILED", dernierStatut: 422, derniereErreur: "title requis" })).toMatchObject({ libelle: "Refusé par le site", detail: "title requis" });
    expect(etatPublication({ ...base, etat: "FAILED", dernierStatut: 503 }).libelle).toBe("Échec d'envoi");
  });
});
