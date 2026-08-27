import { describe, expect, it, beforeEach } from "vitest";
import {
  rerank, recencyScore, coverage, queryTerms, FUNNEL,
  cacheGet, cacheSet, cacheKey, cacheClear, cacheSize, CACHE_TTL_MS,
  type Rerankable,
} from "./rerank";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RECLASSEMENT (§4) — ce qui transforme trente candidats en cinq résultats utiles.
 *
 * Le rappel répond à « qu'est-ce qui contient ces mots ? ». Le reclassement répond à « lequel
 * dois-je lire ? ». Ces tests portent sur la SECONDE question, la seule que l'utilisateur se pose
 * vraiment — et sur les deux façons de s'y tromper : mettre en avant un vieux document parce
 * qu'il contient le mot, et rendre cinq fois le même document sous cinq angles identiques.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const NOW = new Date("2026-08-27T10:00:00Z");
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);

const hit = (over: Partial<Rerankable> & { itemId: string }): Rerankable => ({
  snippet: "texte quelconque",
  score: 0.6,
  matchedBy: "lexical",
  documentDate: daysAgo(30),
  sourceType: "drive_file",
  ...over,
});

describe("les signaux, un par un", () => {
  it("ne retient que les mots qui discriminent", () => {
    // « le », « de », « du » se retrouvent partout : les compter dilue la couverture jusqu'à ce
    // qu'elle ne veuille plus rien dire.
    expect(queryTerms("Pourquoi le dossier de Nivolumab est bloqué ?")).toEqual([
      "pourquoi", "dossier", "nivolumab", "bloque",
    ]);
  });

  it("la fraîcheur décroît sans falaise", () => {
    // Un document de treize mois ne devient pas sans valeur le jour de son anniversaire.
    expect(recencyScore(daysAgo(0), NOW)).toBeCloseTo(1, 2);
    expect(recencyScore(daysAgo(365), NOW)).toBeCloseTo(0.5, 2);
    expect(recencyScore(daysAgo(366), NOW)).toBeLessThan(recencyScore(daysAgo(365), NOW));
  });

  it("une date inconnue n'est ni récompensée ni punie", () => {
    const unknown = recencyScore(null, NOW);
    expect(unknown).toBeGreaterThan(recencyScore(daysAgo(1000), NOW));
    expect(unknown).toBeLessThan(recencyScore(daysAgo(0), NOW));
  });

  it("la couverture porte sur l'extrait MONTRÉ, pas sur le document entier", () => {
    // Un extrait qui ne contient pas le mot demandé ne répond pas, même si le document l'a
    // quelque part page 60.
    const terms = queryTerms("pénalité de retard contractuelle");
    expect(coverage("La pénalité de retard est contractuelle.", terms)).toBe(1);
    expect(coverage("Conditions générales de vente.", terms)).toBe(0);
  });
});

describe("le classement final", () => {
  it("une correspondance EXACTE passe devant une ressemblance sémantique", () => {
    const out = rerank(
      [
        hit({ itemId: "a", matchedBy: "semantic", score: 0.6, snippet: "sujet voisin" }),
        hit({ itemId: "b", matchedBy: "exact", score: 0.6, snippet: "sujet voisin" }),
      ],
      "sujet",
      { now: NOW },
    );
    // Une preuve n'est pas une ressemblance : les mettre à égalité ferait remonter « qui parle du
    // même thème » au-dessus de « qui contient le mot ».
    expect(out[0].itemId).toBe("b");
  });

  it("à égalité de correspondance, le plus RÉCENT gagne", () => {
    const out = rerank(
      [
        hit({ itemId: "vieux", documentDate: daysAgo(900) }),
        hit({ itemId: "recent", documentDate: daysAgo(2) }),
      ],
      "dossier",
      { now: NOW },
    );
    expect(out[0].itemId).toBe("recent");
    expect(out[0].because).toContain("récent");
  });

  it("une source qui fait autorité passe devant un e-mail qui la commente", () => {
    const out = rerank(
      [
        hit({ itemId: "mail", sourceType: "email" }),
        hit({ itemId: "dossier", sourceType: "regulatory" }),
      ],
      "statut",
      { now: NOW },
    );
    expect(out[0].itemId).toBe("dossier");
  });

  it("un document qui CITE l'entité de la question remonte", () => {
    const out = rerank(
      [
        hit({ itemId: "sans", entityIds: ["autre"] }),
        hit({ itemId: "avec", entityIds: ["ent-keytruda"] }),
      ],
      "keytruda",
      { now: NOW, queryEntityIds: ["ent-keytruda"] },
    );
    expect(out[0].itemId).toBe("avec");
    expect(out[0].because.join(" ")).toContain("entité");
  });
});

describe("la diversité — cinq angles, pas cinq paragraphes voisins", () => {
  it("le deuxième extrait d'un même document est pénalisé", () => {
    const out = rerank(
      [
        hit({ itemId: "contrat", snippet: "extrait 1", score: 0.9 }),
        hit({ itemId: "contrat", snippet: "extrait 2", score: 0.88 }),
        hit({ itemId: "autre", snippet: "extrait A", score: 0.7 }),
      ],
      "contrat",
      { now: NOW, limit: 3 },
    );
    // Le meilleur extrait du contrat garde sa place ; l'autre document passe devant le second
    // extrait du même contrat, qui répondrait une deuxième fois à la même chose.
    expect(out[0].itemId).toBe("contrat");
    expect(out[1].itemId).toBe("autre");
    expect(out[2].because.join(" ")).toContain("même document");
  });

  it("le meilleur extrait d'un document n'est JAMAIS pénalisé", () => {
    const out = rerank([hit({ itemId: "seul", score: 0.8 })], "x", { now: NOW });
    expect(out[0].because.join(" ")).not.toContain("même document");
  });
});

describe("l'entonnoir, et ses bornes", () => {
  it("coupe à cinq par défaut", () => {
    const many = Array.from({ length: 30 }, (_, i) => hit({ itemId: `d${i}` }));
    expect(rerank(many, "dossier", { now: NOW })).toHaveLength(5);
  });

  it("les bornes de l'entonnoir décroissent — c'est ce qui en fait un entonnoir", () => {
    expect(FUNNEL.afterMetadata).toBeGreaterThan(FUNNEL.afterHybrid);
    expect(FUNNEL.afterHybrid).toBeGreaterThan(FUNNEL.afterRerank);
    // §4 : cinq résultats utiles. Un entonnoir qui rendrait cinquante documents à Terra
    // paierait des jetons pour du bruit.
    expect(FUNNEL.afterRerank).toBeLessThanOrEqual(5);
  });

  it("chaque résultat explique pourquoi il est là", () => {
    const out = rerank([hit({ itemId: "a", matchedBy: "exact", snippet: "dossier bloqué" })], "dossier", { now: NOW });
    expect(out[0].because.length).toBeGreaterThan(0);
  });

  it("une liste vide ne casse rien", () => {
    expect(rerank([], "quoi que ce soit")).toEqual([]);
  });
});

describe("le cache", () => {
  beforeEach(cacheClear);

  it("rend ce qu'on y a mis, et rien d'autre", () => {
    cacheSet("k", { v: 1 });
    expect(cacheGet<{ v: number }>("k")?.v).toBe(1);
    expect(cacheGet("autre")).toBeNull();
  });

  it("expire — un cache long ferait mentir une couche qui doit dire l'état ACTUEL", () => {
    const t = Date.now();
    cacheSet("k", { v: 1 }, t);
    expect(cacheGet("k", t + CACHE_TTL_MS - 1)).not.toBeNull();
    expect(cacheGet("k", t + CACHE_TTL_MS + 1)).toBeNull();
  });

  it("la clé porte le PÉRIMÈTRE — servir à l'un ce qui fut calculé pour l'autre serait une fuite", () => {
    expect(cacheKey(["q", "societe-A"])).not.toBe(cacheKey(["q", "societe-B"]));
  });

  it("ne grossit pas indéfiniment", () => {
    for (let i = 0; i < 400; i += 1) cacheSet(`k${i}`, i);
    expect(cacheSize()).toBeLessThanOrEqual(200);
    // Éviction du plus ancien : les dernières clés écrites survivent.
    expect(cacheGet<number>("k399")).toBe(399);
    expect(cacheGet("k0")).toBeNull();
  });
});
