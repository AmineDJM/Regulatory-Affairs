import { describe, expect, it } from "vitest";
import {
  routeKnowledge, skipsDocuments, documentBudget,
  KNOWLEDGE_ROUTES, type KnowledgeRoute,
} from "./router";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC D'ESSAI DU ROUTAGE (§3, §23).
 *
 * ── CE QU'ON MESURE, ET POURQUOI C'EST UN BANC ET NON UNE LISTE D'ASSERTIONS ─────────────
 *
 * Un routeur à marqueurs se juge sur un TAUX, pas sur des cas isolés : on peut toujours faire
 * passer un exemple en ajoutant un motif, et se retrouver avec un routeur qui connaît par cœur
 * ses tests et rien d'autre. Le corpus ci-dessous est donc étiqueté à l'avance, le taux est
 * calculé, et le seuil est un plancher — jamais un objectif à ajuster après coup.
 *
 * ── LA RÈGLE QUE CE FICHIER PROTÈGE ──────────────────────────────────────────────────────
 *
 * « Ne pas appeler un autre LLM uniquement pour décider ERP/RAG. » Le routeur n'importe RIEN,
 * ce qui rend l'appel impossible plutôt qu'interdit — et se vérifie en une ligne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le corpus étiqueté. Les questions sont écrites comme le PDG les pose, pas comme un test. */
const CORPUS: { q: string; expected: KnowledgeRoute }[] = [
  // ── ERP_ONLY : un état, un chiffre, une colonne ──────────────────────────────────────
  { q: "Combien de dossiers Regulatory sont en cours ?", expected: "ERP_ONLY" },
  { q: "Quel est le statut du dossier Pembrolizumab ?", expected: "ERP_ONLY" },
  { q: "Qui est le responsable du dossier Nivolumab ?", expected: "ERP_ONLY" },
  { q: "Liste des dossiers en retard", expected: "ERP_ONLY" },
  { q: "Quel est le total des paiements en attente ?", expected: "ERP_ONLY" },
  { q: "Montre-moi ce qui est à valider aujourd'hui", expected: "ERP_ONLY" },
  { q: "Combien de personnes dans l'effectif ?", expected: "ERP_ONLY" },
  { q: "Quelle est l'échéance du dossier 2026-041 ?", expected: "ERP_ONLY" },
  { q: "Où en est le dossier Keytruda ?", expected: "ERP_ONLY" },
  { q: "Quel est le stock disponible sur ce produit ?", expected: "ERP_ONLY" },
  { q: "Affiche les demandes de congés en attente", expected: "ERP_ONLY" },
  { q: "Solde de trésorerie ce mois", expected: "ERP_ONLY" },

  // ── RAG_ONLY : ce qu'un écrit contient ───────────────────────────────────────────────
  { q: "Que disait le courrier de l'ANPP ?", expected: "RAG_ONLY" },
  { q: "Que dit le contrat sur la durée de préavis ?", expected: "RAG_ONLY" },
  { q: "D'après le compte rendu, qu'a-t-on décidé ?", expected: "RAG_ONLY" },
  { q: "Quelle clause prévoit la pénalité de retard ?", expected: "RAG_ONLY" },
  { q: "Résume le rapport ecrit de la semaine", expected: "RAG_ONLY" },
  { q: "Donne-moi l'extrait exact du PDF sur la stabilité", expected: "RAG_ONLY" },
  { q: "Que stipule la convention avec le laboratoire ?", expected: "RAG_ONLY" },
  { q: "Dans le cahier des charges, quelles sont les exigences ?", expected: "RAG_ONLY" },

  // ── ERP_AND_RAG : le pourquoi, la vérification, la comparaison ───────────────────────
  { q: "Pourquoi le dossier Nivolumab est bloqué ?", expected: "ERP_AND_RAG" },
  { q: "Explique-moi pourquoi ce paiement n'est pas parti", expected: "ERP_AND_RAG" },
  { q: "Vérifie que le montant du contrat correspond à la facture", expected: "ERP_AND_RAG" },
  { q: "Compare le budget prévu et le budget consommé", expected: "ERP_AND_RAG" },
  { q: "D'où vient l'écart sur cette enveloppe ?", expected: "ERP_AND_RAG" },
  { q: "Y a-t-il une contradiction entre le devis et la commande ?", expected: "ERP_AND_RAG" },
  { q: "Quel est l'historique de ce dossier depuis janvier ?", expected: "ERP_AND_RAG" },
  { q: "Comment se fait-il que ce dossier soit encore en présoumission ?", expected: "ERP_AND_RAG" },

  // ── GRAPH_AUGMENTED : les relations ──────────────────────────────────────────────────
  { q: "Quel est le lien entre ce fournisseur et nos dossiers ?", expected: "GRAPH_AUGMENTED" },
  { q: "Quels dossiers dépendent de ce laboratoire ?", expected: "GRAPH_AUGMENTED" },
  { q: "Qui travaille sur le dossier Pembrolizumab ?", expected: "GRAPH_AUGMENTED" },
  { q: "Où apparaît ce contrat dans nos dossiers ?", expected: "GRAPH_AUGMENTED" },
  { q: "Tout ce qui concerne l'ANPP", expected: "GRAPH_AUGMENTED" },
  { q: "Quels projets sont impactés par cette décision ?", expected: "GRAPH_AUGMENTED" },

  // ── AGENTIC_RESEARCH : la vraie recherche ouverte ────────────────────────────────────
  { q: "Trouve pourquoi Regulatory ne fonctionne pas", expected: "AGENTIC_RESEARCH" },
  { q: "Analyse tout Regulatory et identifie les blocages", expected: "AGENTIC_RESEARCH" },
  { q: "Fais le tour de ce qui coince en ce moment", expected: "AGENTIC_RESEARCH" },
  { q: "Audit complet du module Finances", expected: "AGENTIC_RESEARCH" },
  { q: "Creuse et remonte la piste de ce dysfonctionnement", expected: "AGENTIC_RESEARCH" },
];

describe("§3 — le routeur choisit sans appeler personne", () => {
  it("aucun modèle, aucune base : le module n'importe RIEN", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/knowledge/router.ts", "utf8"),
    );
    // La règle est vérifiée sur le FICHIER, pas sur une intention. Rendre l'appel impossible
    // vaut mieux que l'interdire : personne ne peut « juste ajouter un petit import ».
    expect(src).not.toMatch(/^\s*import\s/m);
  });

  it("route en moins d'une milliseconde par question", () => {
    const t0 = performance.now();
    for (let i = 0; i < 1_000; i += 1) routeKnowledge(CORPUS[i % CORPUS.length].q);
    const perCall = (performance.now() - t0) / 1_000;
    // Le routage passe devant CHAQUE tour : s'il coûtait une milliseconde, il coûterait plus
    // que la requête SQL qu'il économise sur les cas simples.
    expect(perCall).toBeLessThan(1);
  });
});

describe("§23 — le banc, et son taux", () => {
  it("route correctement au moins 90 % du corpus", () => {
    const wrong: string[] = [];
    for (const c of CORPUS) {
      const d = routeKnowledge(c.q);
      if (d.route !== c.expected) wrong.push(`« ${c.q} » → ${d.route} (attendu ${c.expected})`);
    }
    const rate = (CORPUS.length - wrong.length) / CORPUS.length;
    // Le message porte les ERREURS, pas seulement le taux : un banc qui dit « 87 % » sans dire
    // lesquelles ne sert qu'à constater la régression, pas à la corriger.
    expect(rate, `Taux ${Math.round(rate * 100)} %. Mal routées :\n  ${wrong.join("\n  ")}`)
      .toBeGreaterThanOrEqual(0.9);
  });

  it("chaque route du contrat est réellement atteignable", () => {
    // Une route déclarée mais jamais produite est une route morte : elle donne l'illusion d'une
    // couverture qui n'existe pas.
    const reached = new Set(CORPUS.map((c) => routeKnowledge(c.q).route));
    for (const r of KNOWLEDGE_ROUTES) expect(reached.has(r), `route jamais atteinte : ${r}`).toBe(true);
  });
});

describe("l'économie que le routage produit", () => {
  it("une question d'état ne touche AUCUN document", () => {
    // C'est tout l'intérêt : « combien de dossiers en cours ? » ne doit pas déclencher une
    // recherche vectorielle sur quarante mille documents pour une réponse qu'un COUNT donne.
    const d = routeKnowledge("Combien de dossiers en cours ?");
    expect(skipsDocuments(d)).toBe(true);
    expect(documentBudget(d.route)).toBe(0);
  });

  it("une question de contenu ne touche pas le graphe", () => {
    const d = routeKnowledge("Que disait le courrier de l'ANPP ?");
    expect(d.scope.documents).toBe(true);
    expect(d.scope.graph).toBe(false);
    expect(d.scope.agentic).toBe(false);
  });

  it("un « pourquoi » interroge l'ERP ET les documents, EN PARALLÈLE", () => {
    // §3 l'exige explicitement : les interroger l'un après l'autre doublerait la latence d'une
    // question dont les deux moitiés sont indépendantes.
    const d = routeKnowledge("Pourquoi ce dossier est-il bloqué ?");
    expect(d.scope.erp && d.scope.documents).toBe(true);
    expect(d.scope.parallel).toBe(true);
  });

  it("la recherche ouverte reste RARE et assumée", () => {
    const agentic = CORPUS.filter((c) => routeKnowledge(c.q).route === "AGENTIC_RESEARCH").length;
    // Si un tiers des questions déclenchait une enquête, le routeur ne servirait à rien.
    expect(agentic / CORPUS.length).toBeLessThan(0.2);
  });

  it("le budget documentaire croît avec le coût de la route, jamais l'inverse", () => {
    const budgets = KNOWLEDGE_ROUTES.map(documentBudget);
    for (let i = 1; i < budgets.length; i += 1) {
      expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]);
    }
  });
});

describe("le routeur s'explique", () => {
  it("donne toujours une raison lisible", () => {
    for (const c of CORPUS.slice(0, 8)) {
      const d = routeKnowledge(c.q);
      expect(d.why.length).toBeGreaterThan(20);
    }
  });

  it("nomme les marqueurs qui ont pesé", () => {
    const d = routeKnowledge("Pourquoi le dossier est bloqué ?");
    expect(d.signals).toContain("pourquoi");
  });

  it("une question sans marqueur retombe sur le MOINS cher, en le disant", () => {
    const d = routeKnowledge("Regulatory");
    expect(d.route).toBe("ERP_ONLY");
    expect(d.confidence).toBeLessThan(0.5); // et il annonce qu'il n'est pas sûr
    expect(d.why).toContain("moins chère");
  });

  it("une question vide ne déclenche rien", () => {
    const d = routeKnowledge("   ");
    expect(d.scope.documents).toBe(false);
    expect(d.confidence).toBe(0);
  });

  it("la confiance baisse quand deux lectures se valent", () => {
    const net = routeKnowledge("Pourquoi ce dossier est-il bloqué ?");
    const flou = routeKnowledge("Regulatory");
    expect(net.confidence).toBeGreaterThan(flou.confidence);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE HOLDOUT — le seul chiffre qui mesure vraiment quelque chose.
 *
 * Le corpus ci-dessus a servi à ÉCRIRE les marqueurs : y obtenir 100 % ne prouve que la cohérence
 * interne du routeur avec lui-même. Ces vingt-et-une formulations ont été écrites APRÈS coup et
 * n'ont JAMAIS servi à ajuster un motif. C'est leur taux qui dit si le routeur généralise.
 *
 * Un premier holdout avait donné 75 % et révélé quatre trous de vocabulaire (« lettre »,
 * « liés à », « touche quels », « ils collent ») plus un vrai défaut de conception : « trouve
 * pourquoi » contient « pourquoi », les deux marqueurs s'égalisaient, et le départage par le
 * moins cher choisissait la mauvaise route. D'où `subsumes`. Ce holdout-ci a été écrit ensuite,
 * et n'a rien corrigé : il constate.
 *
 * ⚠️ NE JAMAIS ajuster un marqueur pour faire passer une ligne d'ici. Le jour où on le fait, ce
 * fichier cesse de mesurer quoi que ce soit et devient une deuxième liste d'exemples appris.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const HOLDOUT: { q: string; expected: KnowledgeRoute }[] = [
  { q: "Ça fait combien au total les factures de janvier ?", expected: "ERP_ONLY" },
  { q: "Quels sont les dossiers dont personne ne s'occupe ?", expected: "ERP_ONLY" },
  { q: "Il me faut la liste des employés du service commercial", expected: "ERP_ONLY" },
  { q: "Le budget marketing, il reste quoi dessus ?", expected: "ERP_ONLY" },
  { q: "Quelle date limite pour le dossier 41 ?", expected: "ERP_ONLY" },
  { q: "Sors-moi le statut de tous les produits", expected: "ERP_ONLY" },
  { q: "Qu'est-ce qui est écrit dans l'annexe technique ?", expected: "RAG_ONLY" },
  { q: "La note de service de mai disait quoi exactement ?", expected: "RAG_ONLY" },
  { q: "Cherche dans le contrat la partie sur les pénalités", expected: "RAG_ONLY" },
  { q: "Quel article du cahier des charges parle de la traçabilité ?", expected: "RAG_ONLY" },
  { q: "Pourquoi personne n'a validé ce devis ?", expected: "ERP_AND_RAG" },
  { q: "Vérifie si le prix facturé est celui du contrat", expected: "ERP_AND_RAG" },
  { q: "Quelle est la différence entre ce qu'on a commandé et ce qu'on a reçu ?", expected: "ERP_AND_RAG" },
  { q: "Raconte-moi l'évolution de ce dossier", expected: "ERP_AND_RAG" },
  { q: "Quelle est l'origine de ce blocage ?", expected: "ERP_AND_RAG" },
  { q: "Ce fournisseur, il est rattaché à quels produits ?", expected: "GRAPH_AUGMENTED" },
  { q: "Montre-moi le lien entre cette facture et le bon de commande", expected: "GRAPH_AUGMENTED" },
  { q: "Ce changement affecte quels dossiers ?", expected: "GRAPH_AUGMENTED" },
  { q: "Fais le tour de tout ce qui bloque en Regulatory et propose des actions", expected: "AGENTIC_RESEARCH" },
  { q: "Identifie pourquoi nos délais dérapent", expected: "AGENTIC_RESEARCH" },
  { q: "Audit de la chaîne devis-commande-facture", expected: "AGENTIC_RESEARCH" },
];

describe("le holdout — le taux qui compte", () => {
  it("généralise à au moins 85 % sur des formulations jamais vues", () => {
    const wrong: string[] = [];
    for (const c of HOLDOUT) {
      const d = routeKnowledge(c.q);
      if (d.route !== c.expected) wrong.push(`« ${c.q} » → ${d.route} (attendu ${c.expected})`);
    }
    const rate = (HOLDOUT.length - wrong.length) / HOLDOUT.length;
    expect(rate, `Holdout ${Math.round(rate * 100)} %. Mal routées :\n  ${wrong.join("\n  ")}`)
      .toBeGreaterThanOrEqual(0.85);
  });

  it("le holdout n'est PAS le corpus d'entraînement", () => {
    // Une garde bête et utile : le jour où quelqu'un recopie le corpus ici pour faire monter le
    // taux, le holdout cesse d'être un holdout — et ce test le dit.
    const trainSet = new Set(CORPUS.map((c) => c.q));
    for (const h of HOLDOUT) expect(trainSet.has(h.q), `« ${h.q} » est dans les deux`).toBe(false);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE BANC D'INGESTION A TROUVÉ — et qui ne doit plus jamais revenir.
 *
 * Ces trois tests ne viennent pas d'une relecture : ils viennent d'un corpus de 43 fichiers
 * ingéré pour de vrai, puis de 25 questions à réponse connue posées au système complet. Le
 * rappel bout en bout était de 2 sur 25 — alors que l'index, interrogé directement, en trouvait
 * 19. L'écart était entièrement dû au routage.
 *
 * `scripts/bench/knowledge-bench.ts` rejoue la mesure ; ces tests en figent les conclusions.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("routage — les défauts que la mesure a trouvés", () => {
  it("une QUESTION entière sans marqueur ouvre aussi les documents", () => {
    // 17 questions du banc avaient leur réponse indexée au rang #1 ou #2 et n'étaient jamais
    // rendues : le routeur les traitait comme des demandes d'état sur la seule foi de l'absence
    // de marqueur. L'absence de marqueur n'est pas une preuve.
    for (const q of [
      "Quelle est la contre-indication rénale de la metformine ?",
      "Quelle est la fourchette salariale du poste de pharmacien assurance qualité ?",
      "What was the median progression-free survival in the pivotal trial?",
    ]) {
      const d = routeKnowledge(q);
      expect(d.scope.documents, `« ${q} » n'ouvre pas les documents`).toBe(true);
      expect(d.signals).toContain("question-sans-marqueur");
    }
  });

  it("un TERME jeté dans la barre reste une demande d'état", () => {
    // Le pendant du test précédent, et ce qui l'empêche de dégénérer en « tout chercher ».
    // « Regulatory » est de la navigation : ouvrir les documents ne rendrait rien d'utile.
    for (const q of ["Regulatory", "Amine", "budget 2026"]) {
      const d = routeKnowledge(q);
      expect(d.scope.documents, `« ${q} » ne devrait pas ouvrir les documents`).toBe(false);
    }
  });

  it("une question en arabe n'est pas prise pour une question vide", () => {
    // LE DÉFAUT LE PLUS GRAVE DES TROIS, et le plus silencieux. La normalisation réduisait la
    // question à `[a-z0-9]` : une question en arabe devenait une chaîne VIDE, et le routeur
    // répondait « rien à chercher ». Chez Adventum, l'ANPP écrit en arabe.
    const d = routeKnowledge("ما هو أجل تقديم الوثائق التكميلية");
    expect(d.why).not.toContain("Question vide");
    expect(d.scope.documents).toBe(true);
  });

  it("une question réellement vide reste vide", () => {
    // Le correctif ci-dessus ne doit pas faire disparaître le cas qu'il traverse.
    expect(routeKnowledge("   ").why).toContain("Question vide");
    expect(routeKnowledge("!!! ???").why).toContain("Question vide");
  });
});
