import { describe, it, expect } from "vitest";
import { routeQuery, isConfident } from "./router";
import { runRouterBench } from "./bench";
import { GOLDEN_CORPUS } from "./golden-corpus";
import { HOLDOUT_CORPUS } from "./holdout-corpus";
import { estimateTokens, measure, measureToolDefs } from "./tokens";
import { fitToBudget, renderBlocks, scoreBlock, BUDGETS, type ContextBlock } from "./budget";

/**
 * CE FICHIER FIGE DES CHIFFRES, pas des impressions.
 *
 * Deux seuils, et ils ne disent pas la même chose :
 *
 *   • Le banc PRINCIPAL a servi à régler le routeur. Son score est un score d'APPRENTISSAGE :
 *     il vérifie qu'on n'a rien cassé, il ne prouve pas qu'on généralise.
 *   • Le jeu RÉSERVÉ n'a jamais servi à régler quoi que ce soit. C'est lui qui mesure vraiment,
 *     et son seuil est délibérément plus bas — parce qu'il est honnête.
 *
 * LE SEUIL QUI COMPTE VRAIMENT EST LE TROISIÈME : zéro confusion lire/agir. Manquer un raccourci
 * coûte une seconde ; prendre une lecture pour une écriture (ou l'inverse) change ce que le
 * produit FAIT. Ce seuil-là est à zéro, sur les deux bancs, et il n'a pas vocation à bouger.
 */

describe("banc de routage — apprentissage", () => {
  const report = runRouterBench(GOLDEN_CORPUS);

  it("le corpus reste substantiel et sa provenance reste traçable", () => {
    expect(report.cases).toBeGreaterThanOrEqual(150);
    // La part VERBATIM est ce qui donne sa valeur au banc : si elle tombe, le banc parle de
    // phrases que nous avons écrites nous-mêmes, et il mesure surtout notre imagination.
    expect(report.provenance.transcript).toBeGreaterThanOrEqual(25);
  });

  it("aucune régression de route", () => {
    expect(report.routeAccuracy).toBeGreaterThanOrEqual(0.99);
    expect(report.domainAccuracy).toBeGreaterThanOrEqual(0.95);
  });

  it("100 % sur les énoncés RÉELLEMENT dits par le PDG", () => {
    expect(report.transcriptRouteAccuracy).toBe(1);
  });

  it("aucune confusion entre lire et agir", () => {
    expect(report.dangerousMisroutes).toEqual([]);
  });
});

describe("jeu réservé — généralisation (jamais utilisé pour régler)", () => {
  const report = runRouterBench(HOLDOUT_CORPUS);

  it("tient le seuil honnête", () => {
    // Mesuré à 85 % au premier et unique passage. Le plancher est posé un cran en dessous :
    // il attrape une régression sans prétendre que 85 % était une cible.
    expect(report.routeAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(report.domainAccuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("et surtout : zéro confusion lire/agir sur des phrases inédites", () => {
    expect(report.dangerousMisroutes).toEqual([]);
  });

  it("quand il se trompe, il se trompe DU BON CÔTÉ", () => {
    // L'asymétrie qu'on a construite, vérifiée sur des phrases jamais vues : un échec doit
    // retomber sur un chemin PLUS cher (généraliste ou structuré), jamais sur un raccourci qui
    // répondrait vite et à côté.
    for (const f of report.failures) {
      expect(f.actualRoute).not.toBe("FAST_DETERMINISTIC");
      expect(f.actualRoute).not.toBe("ACTION");
    }
  });
});

describe("les gestes qui ne pardonnent pas ne prennent jamais de raccourci", () => {
  const dangereux = [
    "Supprime le dossier Raltegravir.",
    "Paie la facture de Pharmagene.",
    "Augmente le salaire de Raihana.",
    "Change les droits de Khaled.",
    "Désactive le compte de Khaled.",
    "Efface les mails de Deepak.",
  ];

  it.each(dangereux)("« %s » → ACTION, jamais une lecture rapide", (phrase) => {
    const r = routeQuery(phrase, { hasPendingMail: true, hasOpenDelivery: true, lastPerson: "Raihana" });
    expect(r.route).toBe("ACTION");
    expect(r.tool).toBeNull();
  });
});

describe("les formes que la mission nomme", () => {
  it("« Des mails aujourd'hui ? » ne réveille aucun modèle", () => {
    const r = routeQuery("Des mails aujourd'hui ?");
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.tier).toBe("FAST");
    expect(r.tool).toBe("gmail_search");
  });

  it("« Pourquoi Nintedanib est en retard ? » mérite le budget profond", () => {
    const r = routeQuery("Pourquoi Nintedanib est en retard ?");
    expect(r.route).toBe("DEEP_REASONING");
    expect(r.tier).toBe("DEEP");
    expect(r.domain).toBe("REGULATORY");
  });

  it("« Qui gère Nintedanib ? » interroge la base, il ne fouille pas (§10)", () => {
    const r = routeQuery("Qui gère Nintedanib ?");
    expect(r.route).toBe("STRUCTURED_QUERY");
    expect(r.tier).toBe("FAST");
  });

  it("« Retrouve le contrat indien dont Khaled parlait avant l'IAS. » va chercher", () => {
    expect(routeQuery("Retrouve le contrat indien dont Khaled parlait avant l'IAS.").route).toBe("HYBRID_RETRIEVAL");
  });

  it("un ordre poli reste un ordre", () => {
    expect(routeQuery("Peux-tu envoyer le mail à Deepak ?").route).toBe("ACTION");
    expect(routeQuery("S'il te plaît, relance Raihana.").route).toBe("ACTION");
    expect(routeQuery("Est-ce que tu peux assigner Nintedanib à Raihana ?").route).toBe("ACTION");
  });

  it("mais une lecture à l'impératif n'est PAS une écriture", () => {
    // La distinction qui empêche de faire passer une consultation par les gardes d'écriture.
    expect(routeQuery("Donne-moi les salariés et leurs e-mails.").route).toBe("STRUCTURED_QUERY");
    expect(routeQuery("Liste les dossiers de Fatma Zahra.").route).toBe("STRUCTURED_QUERY");
  });

  it("le décapage de politesse n'efface pas « et » ni « alors »", () => {
    // Ces deux mots PORTENT le sens : l'un enchaîne, l'autre réclame.
    expect(routeQuery("Et Raihana ?", { lastKind: "GMAIL_FROM" }).fastKind).toBe("GMAIL_FROM");
    expect(routeQuery("Alors ?", { hasOpenDelivery: true }).fastKind).toBe("RESUME_DELIVERY");
  });
});

describe("les entités que l'entreprise connaît priment sur les heuristiques (§14)", () => {
  it("une DCI se reconnaît à sa terminaison, même inconnue du dépôt", () => {
    expect(routeQuery("Où en est Bosutinib ?").domain).toBe("REGULATORY");
    expect(routeQuery("Où en est Pembrolizumab ?").domain).toBe("REGULATORY");
  });

  it("une entité résolue en base l'emporte", () => {
    const sans = routeQuery("Où en est ASARI ?");
    const avec = routeQuery("Où en est ASARI ?", { knownEntities: [{ name: "ASARI", domain: "FINANCE" }] });
    expect(sans.domain).toBe("GENERAL");
    expect(avec.domain).toBe("FINANCE");
  });
});

describe("la confiance se déclare", () => {
  it("le déterministe est sûr, l'inconnu ne prétend pas l'être", () => {
    expect(isConfident(routeQuery("Des mails aujourd'hui ?"))).toBe(true);
    expect(isConfident(routeQuery("Raconte-moi ce truc de l'autre fois."))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("l'estimation de tokens — utile, et honnête sur ce qu'elle est", () => {
  it("le compte de caractères est EXACT, le token est dérivé", () => {
    const m = measure("Des mails aujourd'hui ?");
    expect(m.chars).toBe(23);
    expect(m.tokens).toBeGreaterThan(4);
    expect(m.tokens).toBeLessThan(m.chars);
  });

  it("un texte vide ne coûte rien", () => {
    expect(estimateTokens("")).toBe(0);
    expect(measure("").chars).toBe(0);
  });

  it("croît de façon monotone — c'est tout ce qu'on lui demande", () => {
    const court = estimateTokens("Où en est Raltegravir ?");
    const long = estimateTokens("Où en est Raltegravir ? ".repeat(20));
    expect(long).toBeGreaterThan(court * 15);
  });

  it("mesure le coût des schémas d'outils, qui est le vrai poids de §23", () => {
    const defs = Array.from({ length: 50 }, (_, i) => ({
      name: `tool_${i}`, description: "Une description d'outil de longueur réaliste pour l'ERP.",
      input_schema: { type: "object", properties: { query: { type: "string" } } },
    }));
    expect(measureToolDefs(defs).tokens).toBeGreaterThan(500);
  });
});

describe("le budget de contexte — choisir, pas tronquer", () => {
  const bloc = (id: string, over: Partial<ContextBlock> = {}): ContextBlock => ({
    id, text: "x ".repeat(200), authority: "EVIDENCE", relevance: 0.5, ...over,
  });

  it("garde TOUJOURS les blocs critiques, même hors budget", () => {
    // L'identité, les droits, la politique d'envoi : les retirer pour tenir dans une cible ne
    // rendrait pas Adam plus rapide, cela le rendrait faux.
    const blocks = [
      bloc("identite", { critical: true, text: "y ".repeat(3_000) }),
      bloc("preuve-1"), bloc("preuve-2"),
    ];
    const fitted = fitToBudget(blocks, "FAST");
    expect(fitted.kept.map((b) => b.id)).toContain("identite");
    expect(fitted.overBudget).toBe(true);
  });

  it("un dépassement dû au critique est RAPPORTÉ, pas résolu en douce", () => {
    const fitted = fitToBudget([bloc("gros", { critical: true, text: "z ".repeat(9_000) })], "FAST");
    expect(fitted.overBudget).toBe(true);
    expect(fitted.dropped).toEqual([]);
  });

  it("l'autorité l'emporte sur la pertinence lexicale (§10, §18)", () => {
    // Un extrait de mail bourré des mots de la question ne doit pas chasser un fait canonique.
    const canonique = bloc("canonique", { authority: "CANONICAL", relevance: 0.5 });
    const mail = bloc("extrait-mail", { authority: "EVIDENCE", relevance: 1 });
    expect(scoreBlock(canonique)).toBeGreaterThan(scoreBlock(mail));
  });

  it("écarte le moins utile, pas le dernier arrivé", () => {
    // Chaque bloc pèse ~1 500 tokens : les deux ensemble dépassent la cible FAST (2 000), un
    // seul y tient. C'est la situation où le classement décide vraiment.
    const blocks = [
      bloc("faible", { authority: "INFERRED", relevance: 0.1, text: "a ".repeat(1_500) }),
      bloc("fort", { authority: "CANONICAL", relevance: 1, text: "b ".repeat(1_500) }),
    ];
    const fitted = fitToBudget(blocks, "FAST");
    expect(fitted.kept.map((b) => b.id)).toContain("fort");
    expect(fitted.dropped.map((b) => b.id)).toContain("faible");
  });

  it("signale quand on a donné trop peu", () => {
    expect(fitToBudget([bloc("miette", { text: "court" })], "DEEP").underBudget).toBe(true);
  });

  it("les cibles sont celles de la mission (§7)", () => {
    expect(BUDGETS.FAST.max).toBe(2_000);
    expect(BUDGETS.NORMAL.max).toBe(6_000);
    expect(BUDGETS.DEEP.max).toBe(20_000);
  });

  it("rend le critique en tête", () => {
    const rendu = renderBlocks(fitToBudget([
      bloc("preuve", { text: "PREUVE", authority: "EVIDENCE", relevance: 1 }),
      bloc("regle", { text: "RÈGLE", critical: true }),
    ], "NORMAL"));
    expect(rendu.indexOf("RÈGLE")).toBeLessThan(rendu.indexOf("PREUVE"));
  });
});
