import { describe, expect, it } from "vitest";

import { FAMILLES, capaciteDuCorpus, engendrer, type Monde } from "@/lib/evals/autonomie/corpus";
import { consignerMesure } from "@/lib/evals/registre";
import {
  CAUSES, POIDS, causer, comparer, juger, scoreAutonomie, verifierExigences, type Observation,
} from "@/lib/evals/autonomie/juges";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS TIENNENT (mandat 6 §43).
 *
 * Le banc d'autonomie mesure Adam ; ces tests mesurent le BANC. Trois choses, et si l'une cède,
 * tous les chiffres produits par le banc deviennent des opinions :
 *
 *   1. LE CORPUS EST REPRODUCTIBLE. Deux runs à la même graine tirent les mêmes missions —
 *      sans quoi « la version N+1 fait mieux » pourrait n'être qu'un tirage plus facile.
 *   2. UN FAUX SUCCÈS EST DÉTECTÉ. Une mission infaisable conclue COMPLETED, une mission conclue
 *      sans juge, une cardinalité fausse : trois façons d'avoir l'air d'avoir réussi.
 *   3. UN ÉCHEC A UNE CAUSE, ET C'EST LA BONNE. « Le planificateur s'est trompé » et « rien ne
 *      sait le faire » appellent deux travaux opposés ; les confondre rend la classification
 *      inutile, donc la feuille de route fausse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MONDE: Monde = {
  personnes: ["Yassine Belkacem", "Nesrine Haddad", "Khaled Meziane"],
  produits: ["Trastuzumab 150 mg", "Pembrolizumab 100 mg"],
  partenaires: ["Hetero Labs", "Cipla"],
  wilayas: ["Alger", "Oran", "Constantine"],
  dossiers: ["REG-2026-014", "REG-2026-021"],
  mois: ["janvier", "février", "mars"],
  effectif: 33,
};

const obs = (o: Partial<Observation>): Observation => ({
  id: "t", famille: "FINANCE", profondeur: "COMPLET", exigences: [], cardinalite: null,
  lancee: true, differe: false, erreurLancement: null, refus: [],
  statut: "COMPLETED", etapes: 3, noeuds: {}, capacites: [], primitives: [], domaines: [], lectures: [], ecritures: [],
  attentes: 0, artefacts: 0, iterations: 0, horsDroit: [], echecs: [],
  jugeSatisfait: true, aDemande: false, aDemandeAccord: false, faitsSansProvenance: 0,
  manqueNomme: false, reprises: 0, appelsModele: 1, coutUsd: 0.01, ms: 1000, ...o,
});

describe("banc d'autonomie — le corpus", () => {
  it("est REPRODUCTIBLE : même graine, mêmes missions", () => {
    const a = engendrer(MONDE, { nombre: 120, graine: 7 });
    const b = engendrer(MONDE, { nombre: 120, graine: 7 });
    expect(a.map((m) => m.demande)).toEqual(b.map((m) => m.demande));
    // Et une graine différente donne un corpus différent : sinon la graine ne servirait à rien.
    const c = engendrer(MONDE, { nombre: 120, graine: 8 });
    expect(c.map((m) => m.demande)).not.toEqual(a.map((m) => m.demande));
  });

  it("couvre les SEIZE familles avant qu'un gabarit ne resserve", () => {
    const corpus = engendrer(MONDE, { nombre: 200, graine: 43 });
    const familles = new Set(corpus.map((m) => m.famille));
    for (const f of FAMILLES) expect(familles.has(f), `famille absente du corpus : ${f}`).toBe(true);
  });

  it("ne répète jamais deux fois la même phrase", () => {
    const corpus = engendrer(MONDE, { nombre: 300, graine: 43 });
    expect(new Set(corpus.map((m) => m.demande)).size).toBe(corpus.length);
    // Un monde étroit ne peut pas produire 300 phrases distinctes : le banc en rend MOINS
    // plutôt que de répéter. Mesurer la répétition n'est pas mesurer l'autonomie.
    expect(corpus.length).toBeLessThanOrEqual(300);
    expect(corpus.length).toBeGreaterThan(30);
  });

  it("porte la cardinalité EXACTE quand la demande dénombre", () => {
    const corpus = engendrer(MONDE, { nombre: 200, graine: 43 });
    const eventail = corpus.filter((m) => m.exigences.includes("EVENTAIL"));
    expect(eventail.length).toBeGreaterThan(0);
    for (const m of eventail) expect(m.cardinalite).toBe(33);
  });

  it("écarte les gabarits que le monde ne peut pas remplir, et le DIT", () => {
    const pauvre: Monde = { ...MONDE, produits: [], partenaires: [] };
    const c = capaciteDuCorpus(pauvre);
    expect(c.ecartes.length).toBeGreaterThan(0);
    expect(c.ecartes.join(" ")).toMatch(/produits|partenaires/);
    // Et le corpus engendré ne contient alors aucune mission parlant d'un produit inexistant.
    const corpus = engendrer(pauvre, { nombre: 100, graine: 43 });
    expect(corpus.every((m) => !m.demande.includes("undefined") && !/ de \./.test(m.demande))).toBe(true);
  });
});

describe("banc d'autonomie — la cause d'un échec", () => {
  it("un refus de compilation est une faute du PLANIFICATEUR, quelle que soit sa formulation", () => {
    const c = causer(obs({ lancee: false, differe: false, statut: null, erreurLancement: "plan refusé", refus: ["WRONG_CARDINALITY etape-3: 33 destinataires dans une étape"] }));
    expect(c?.cause).toBe("PLANIFICATEUR");
  });

  it("une capacité inventée est un défaut de DÉCOUVERTE, pas une primitive absente", () => {
    const c = causer(obs({ lancee: false, statut: null, erreurLancement: null, refus: ["UNKNOWN_CAPABILITY etape-1: send_sms"] }));
    expect(c?.cause).toBe("DECOUVERTE");
  });

  it("une capacité refusée par le droit est une PERMISSION — et pas une dette", () => {
    const c = causer(obs({ lancee: false, statut: null, refus: ["FORBIDDEN_CAPABILITY etape-2: read_finances"] }));
    expect(c?.cause).toBe("PERMISSION");
    expect(c?.manque?.dette).toBe(false);
  });

  it("une cardinalité fausse est une faute de plan MÊME quand tout s'exécute", () => {
    const c = causer(obs({ statut: "COMPLETED", cardinalite: 33, iterations: 1 }));
    expect(c?.cause).toBe("PLANIFICATEUR");
    expect(c?.manque?.preuve).toContain("33");
    expect(c?.manque?.nature).toBe("MODELE");
  });

  it("une recherche qui ne ramène rien est un défaut de CONTEXTE, pas une donnée absente", () => {
    const recherche = causer(obs({ statut: "FAILED", echecs: [{ capacite: "search_documents", erreur: "Aucun résultat pour cette requête.", kind: "NOT_FOUND" }] }));
    expect(recherche?.cause).toBe("CONTEXTE");
    // La même phrase sur une capacité qui n'est pas une recherche reste une DONNÉE manquante.
    const donnee = causer(obs({ statut: "FAILED", echecs: [{ capacite: "read_finances", erreur: "Aucun résultat pour cette requête.", kind: "NOT_FOUND" }] }));
    expect(donnee?.cause).toBe("DONNEE");
  });

  it("les dix causes sont toutes atteignables — les neuf du mandat, plus l'indisponibilité", () => {
    // La dixième n'est pas un défaut d'Adam : c'est le refus d'en inventer un quand le
    // fournisseur n'a pas répondu. Elle est comptée ici pour la même raison que les autres —
    // une cause qu'aucune observation n'atteint est une case morte du classement.
    expect(CAUSES).toHaveLength(10);
    const atteintes = new Set([
      causer(obs({ lancee: false, statut: null, refus: ["MALFORMED"] }))?.cause,
      causer(obs({ lancee: false, statut: null, refus: ["UNKNOWN_CAPABILITY x"] }))?.cause,
      causer(obs({ lancee: false, statut: null, refus: ["FORBIDDEN_CAPABILITY x"] }))?.cause,
      causer(obs({ statut: "FAILED", echecs: [{ capacite: "docusign", erreur: "Aucun outil ne sait signer électroniquement.", kind: null }] }))?.cause,
      causer(obs({ statut: "FAILED", echecs: [{ capacite: "read_finances", erreur: "Aucune ligne trouvée.", kind: null }] }))?.cause,
      causer(obs({ statut: "FAILED", echecs: [{ capacite: "search_drive", erreur: "Aucun résultat.", kind: null }] }))?.cause,
      causer(obs({ statut: "FAILED", echecs: [{ capacite: "gmail_search", erreur: "Le service est indisponible.", kind: null }] }))?.cause,
      causer(obs({ statut: "FAILED", echecs: [{ capacite: "show_chart", erreur: "Ce type de graphique est inconnu du renderer.", kind: null }] }))?.cause,
      causer(obs({ statut: "FAILED", echecs: [{ capacite: "create_task", erreur: "Entrée invalide : champ obligatoire manquant.", kind: null }] }))?.cause,
      causer(obs({ differe: true, statut: "PLANNING", etapes: 0 }))?.cause,
    ]);
    for (const c of CAUSES) expect(atteintes.has(c), `cause jamais atteinte : ${c}`).toBe(true);
  });
});

describe("banc d'autonomie — le verdict", () => {
  it("réussie exige le juge, la forme, les droits ET les preuves — « ça a tourné » ne suffit pas", () => {
    const bonne = juger(obs({
      exigences: ["LECTURE", "CALCUL"], lectures: ["read_finances", "product_economics"],
      capacites: ["read_finances", "product_economics", "calcul_statistiques"], primitives: ["INFORMATION", "CALCUL"], jugeSatisfait: true,
    }));
    expect(bonne.reussie).toBe(true);
    expect(bonne.fauxSucces).toBe(false);

    // Le même état, sans juge : ce n'est PAS une réussite, c'est un faux succès (§118.10).
    const sansJuge = juger(obs({
      exigences: ["LECTURE", "CALCUL"], lectures: ["read_finances", "product_economics"],
      capacites: ["read_finances", "product_economics", "calcul_statistiques"], primitives: ["INFORMATION", "CALCUL"], jugeSatisfait: null,
    }));
    expect(sansJuge.reussie).toBe(false);
    expect(sansJuge.fauxSucces).toBe(true);
  });

  it("une mission INFAISABLE réussit en NOMMANT le manque, et échoue en se concluant", () => {
    const honnete = juger(obs({ famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "BLOCKED", manqueNomme: true, jugeSatisfait: null }));
    expect(honnete.realisable).toBe(false);
    expect(honnete.reussie).toBe(true);
    expect(honnete.fauxSucces).toBe(false);

    const menteuse = juger(obs({ famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "COMPLETED", manqueNomme: false }));
    expect(menteuse.reussie).toBe(false);
    expect(menteuse.fauxSucces).toBe(true);
  });

  it("un envoi à 33 personnes en UNE étape est un faux succès, pas une optimisation", () => {
    const v = juger(obs({ exigences: ["EVENTAIL", "ECRITURE"], cardinalite: 33, iterations: 1, ecritures: ["send_message"], statut: "COMPLETED" }));
    expect(v.reussie).toBe(false);
    expect(v.fauxSucces).toBe(true);
    expect(v.violations.join(" ")).toContain("cardinalité 1 au lieu de 33");
  });

  it("une capacité appelée hors droit est une violation, quoi qu'il arrive ensuite", () => {
    const v = juger(obs({ horsDroit: ["read_finances"], jugeSatisfait: true }));
    expect(v.reussie).toBe(false);
    expect(v.violations[0]).toContain("hors droit");
    expect(v.cause).toBe("PERMISSION");
  });

  it("le juge lit les PRIMITIVES du registre, il ne redevine pas d'après le nom", () => {
    // `product_economics` est une capacité de CALCUL au registre, et son nom ne commence pas par
    // « calcul_ ». Le premier run du banc notait « aucun calcul » sur un plan qui en faisait un :
    // deux classements du même objet divergent toujours, il n'en reste qu'un.
    const t = verifierExigences(obs({ exigences: ["CALCUL"], capacites: ["product_economics"], primitives: ["CALCUL"] }));
    expect(t[0]!.ok).toBe(true);
    const sans = verifierExigences(obs({ exigences: ["CALCUL"], capacites: ["search_everything"], primitives: ["INFORMATION"] }));
    expect(sans[0]!.ok).toBe(false);
  });

  it("« plusieurs sources » se compte en DOMAINES du registre, pas en préfixes de noms", () => {
    const un = verifierExigences(obs({ exigences: ["PLUSIEURS_SOURCES"], domaines: ["mail"] }));
    expect(un[0]!.ok).toBe(false);
    const deux = verifierExigences(obs({ exigences: ["PLUSIEURS_SOURCES"], domaines: ["mail", "legal"] }));
    expect(deux[0]!.ok).toBe(true);
  });

  it("un plan qui ne tient pas la forme reçoit une cause NOMMÉE, pas un silence", () => {
    // Sans cela, le banc rendait « manques classés : 80 % » avec des échecs sans cause — et la
    // cible du mandat (≥ 95 % de classement) devenait inatteignable pour une raison de code.
    const v = juger(obs({ profondeur: "PLAN", statut: "RUNNING", exigences: ["REPRESENTATION"], artefacts: 0, primitives: ["INFORMATION"] }));
    expect(v.reussie).toBe(false);
    expect(v.cause).toBe("PLANIFICATEUR");
    expect(v.manque?.preuve).toContain("REPRESENTATION");
    // La nature est POSÉE, pas devinée : « le plan ne prévoit pas de représentation » ne
    // ressemble à aucune signature d'échec, et revenait INDETERMINE au premier run du banc.
    expect(v.manque?.nature).toBe("MODELE");
    expect(v.manque?.confiance).toBe(1);
  });

  it("une demande AMBIGUË se réussit en demandant, et se rate en devinant", () => {
    const demande = verifierExigences(obs({ exigences: ["AMBIGU"], aDemande: true, ecritures: [] }));
    expect(demande[0]!.ok).toBe(true);
    const devine = verifierExigences(obs({ exigences: ["AMBIGU"], aDemande: false, ecritures: ["send_email"] }));
    expect(devine[0]!.ok).toBe(false);
  });
});

describe("banc d'autonomie — le score", () => {
  it("les poids somment à 1 — sinon le score n'est pas sur 100", () => {
    expect(Object.values(POIDS).reduce((a, x) => a + x, 0)).toBeCloseTo(1, 10);
  });

  it("un run parfait vaut 100, et un seul faux succès se paie exactement", () => {
    const parfait = Array.from({ length: 10 }, (_, i) => juger(obs({ id: `m${i}`, jugeSatisfait: true })));
    const s = scoreAutonomie(parfait);
    expect(s.score).toBe(100);
    expect(s.fauxSucces).toBe(0);
    expect(s.reussite).toBe(1);

    const avecFaux = [...parfait.slice(0, 9), juger(obs({ id: "m9", famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "COMPLETED" }))];
    const s2 = scoreAutonomie(avecFaux);
    expect(s2.fauxSucces).toBe(1);
    // Le faux succès coûte sa part du poids « sansFauxSucces » (1/10 des 20 points) ; la mission
    // infaisable ratée ne touche PAS la réussite, qui ne porte que sur les tâches réalisables.
    expect(s2.reussite).toBe(1);
    expect(s2.score).toBeLessThan(100);
    expect(100 - s2.score).toBeGreaterThan(1.5);
  });

  it("le dénominateur de la réussite EXCLUT les missions infaisables", () => {
    const v = [
      juger(obs({ id: "a" })),
      juger(obs({ id: "b", famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "BLOCKED", manqueNomme: true, jugeSatisfait: null })),
    ];
    const s = scoreAutonomie(v);
    expect(s.missions).toBe(2);
    expect(s.realisables).toBe(1);
    expect(s.reussite).toBe(1);
    expect(s.manqueNomme).toBe(1);
  });

  it("le coût partiel n'est jamais présenté comme un total", () => {
    const s = scoreAutonomie([juger(obs({ id: "a", coutUsd: 0.02 })), juger(obs({ id: "b", coutUsd: null }))]);
    expect(s.coutTotalUsd).toBeNull();
    expect(s.coutParReussite).toBeNull();
  });

  it("deux corpus de tailles différentes ne se comparent PAS", () => {
    const a = scoreAutonomie([juger(obs({ id: "a" }))]);
    const b = scoreAutonomie([juger(obs({ id: "a" })), juger(obs({ id: "b" }))]);
    const d = comparer(a, b);
    expect(d.comparable).toBe(false);
    expect(d.raison).toContain("corpus différents");
  });

  it("une régression est NOMMÉE, pas noyée dans un score global", () => {
    const avant = scoreAutonomie([juger(obs({ id: "a" })), juger(obs({ id: "b" }))]);
    const apres = scoreAutonomie([
      juger(obs({ id: "a" })),
      juger(obs({ id: "b", famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "COMPLETED" })),
    ]);
    const d = comparer(avant, apres);
    expect(d.comparable).toBe(true);
    expect(d.score).toBeLessThan(0);
    expect(d.regressions.join(" ")).toContain("faux succès");
  });
});

describe("banc d'autonomie — le niveau PLAN ne se confond pas avec le niveau COMPLET", () => {
  it("un plan qui compile et tient sa forme réussit AU NIVEAU DU PLAN, sans juge", () => {
    const v = juger(obs({
      profondeur: "PLAN", statut: "RUNNING", jugeSatisfait: null,
      exigences: ["LECTURE", "CALCUL"], lectures: ["read_finances", "product_economics"],
      capacites: ["read_finances", "product_economics", "calcul_statistiques"], primitives: ["INFORMATION", "CALCUL"],
    }));
    expect(v.reussie).toBe(true);
    expect(v.fauxSucces).toBe(false);
    // Le MÊME état jugé au niveau COMPLET est un faux succès : personne ne s'est prononcé.
    const complet = juger(obs({
      profondeur: "COMPLET", statut: "COMPLETED", jugeSatisfait: null,
      exigences: ["LECTURE", "CALCUL"], lectures: ["read_finances", "product_economics"],
      capacites: ["read_finances", "product_economics", "calcul_statistiques"], primitives: ["INFORMATION", "CALCUL"],
    }));
    expect(complet.reussie).toBe(false);
    expect(complet.fauxSucces).toBe(true);
  });

  it("au niveau du plan, une mission infaisable réussit en ne promettant RIEN", () => {
    const refuse = juger(obs({ profondeur: "PLAN", famille: "INFAISABLE", exigences: ["INFAISABLE"], lancee: false, statut: null, ecritures: [] }));
    expect(refuse.reussie).toBe(true);

    const annonce = juger(obs({ profondeur: "PLAN", famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "RUNNING", manqueNomme: true, ecritures: [] }));
    expect(annonce.reussie).toBe(true);

    // Un plan accepté qui prévoit d'ÉCRIRE pour une mission que rien ne sait faire : le faux
    // succès n'a pas encore eu lieu, mais il est déjà en préparation.
    const promet = juger(obs({ profondeur: "PLAN", famille: "INFAISABLE", exigences: ["INFAISABLE"], statut: "RUNNING", ecritures: ["send_email"], manqueNomme: false }));
    expect(promet.reussie).toBe(false);
    expect(promet.fauxSucces).toBe(true);
  });

  it("une cardinalité fausse est vue DÈS LE PLAN — c'est là qu'elle se corrige le moins cher", () => {
    const v = juger(obs({ profondeur: "PLAN", statut: "RUNNING", exigences: ["EVENTAIL"], cardinalite: 33, iterations: 1 }));
    expect(v.reussie).toBe(false);
    expect(v.violations.join(" ")).toContain("cardinalité 1 au lieu de 33");
    expect(v.cause).toBe("PLANIFICATEUR");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE PANNE DE FOURNISSEUR N'EST PAS UN DÉFAUT D'ADAM.
 *
 * Ce bloc existe à cause d'un run réel : le 2026-09-06, un mandataire a redémarré au milieu du
 * banc de 200 missions. Le fournisseur est devenu injoignable, le runtime a fait exactement ce
 * qu'il devait — RETENIR les demandes pour reprise — et le banc a publié « 18,9 % de réussite »
 * en imputant 151 échecs au PLANIFICATEUR. Le score était faux de moitié, et l'imputation
 * désignait un composant qui n'avait pas été appelé une seule fois.
 *
 * Deux propriétés en sortent, et elles sont tenues ici :
 *   · une mission que le fournisseur a empêchée sort du dénominateur, comptée et DITE ;
 *   · au-delà d'un dixième de pertes, le banc se déclare NON CONCLUANT — il calcule quand même,
 *     mais il refuse de faire passer une moitié de corpus pour le corpus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("l'indisponibilité du fournisseur — le banc refuse d'inventer un coupable", () => {
  it("une mission RETENUE par le runtime ne s'impute pas au planificateur", () => {
    // Le cas exact : `lancerMission` a rendu ok avec `differe`, donc zéro étape, zéro capacité.
    const v = juger(obs({
      profondeur: "PLAN", differe: true, statut: "PLANNING", etapes: 0,
      capacites: [], primitives: [], domaines: [], lectures: [],
      exigences: ["LECTURE", "CALCUL"],
    }));
    expect(v.cause).toBe("INDISPONIBLE");
    expect(v.cause).not.toBe("PLANIFICATEUR");
    expect(v.exploitable).toBe(false);
    expect(v.reussie).toBe(false);
    // Le manque est classé, et il pointe le SERVICE — pas le modèle, pas le plan.
    expect(v.manque?.nature).toBe("SOURCE_INACCESSIBLE");
  });

  it("un lancement tombé sur une panne de transport est classé pareil, sans drapeau", () => {
    for (const err of [
      "connect ECONNREFUSED 127.0.0.1:33749",
      "openai responses error orchestrator 502 upstream request failed",
      "fetch failed",
      "socket hang up",
    ]) {
      const v = juger(obs({ profondeur: "PLAN", lancee: false, statut: null, erreurLancement: err, exigences: ["LECTURE"] }));
      expect(v.cause, err).toBe("INDISPONIBLE");
    }
  });

  it("un VRAI refus du compilateur reste au débit du planificateur — le correctif ne blanchit rien", () => {
    const v = juger(obs({
      profondeur: "PLAN", lancee: false, statut: null,
      erreurLancement: "plan refusé", refus: ["WRONG_CARDINALITY etape2: 33 destinataires dans une étape"],
      exigences: ["LECTURE"],
    }));
    expect(v.cause).toBe("PLANIFICATEUR");
    expect(v.exploitable).not.toBe(false);
  });

  it("les missions inexploitables sortent du dénominateur, et le banc DIT combien", () => {
    const bonnes = Array.from({ length: 9 }, (_, i) => juger(obs({ id: `ok${i}`, profondeur: "PLAN", statut: "RUNNING", exigences: [], lectures: ["search_people"], capacites: ["search_people"] })));
    const perdues = Array.from({ length: 5 }, (_, i) => juger(obs({ id: `ko${i}`, profondeur: "PLAN", differe: true, statut: "PLANNING", etapes: 0, capacites: [], lectures: [], exigences: ["LECTURE"] })));

    const s = scoreAutonomie([...bonnes, ...perdues]);
    expect(s.missionsTentees).toBe(14);
    expect(s.inexploitables).toBe(5);
    expect(s.missions).toBe(9);
    // LE POINT : la réussite se calcule sur les 9, pas sur les 14. Sans cela, cinq pannes de
    // réseau feraient chuter le taux de 100 % à 64 % et on chercherait un défaut inexistant.
    expect(s.reussite).toBe(1);
    // Et la perte est trop lourde pour conclure.
    expect(s.concluant).toBe(false);
  });

  it("en dessous du seuil, le banc conclut normalement", () => {
    const bonnes = Array.from({ length: 19 }, (_, i) => juger(obs({ id: `ok${i}`, profondeur: "PLAN", statut: "RUNNING", exigences: [], lectures: ["search_people"], capacites: ["search_people"] })));
    const perdue = juger(obs({ id: "ko", profondeur: "PLAN", differe: true, statut: "PLANNING", etapes: 0, capacites: [], lectures: [], exigences: ["LECTURE"] }));
    const s = scoreAutonomie([...bonnes, perdue]);
    expect(s.inexploitables).toBe(1);
    expect(s.concluant).toBe(true);
  });
});

describe("mesure consignée — §43", () => {
  it("une panne de fournisseur sort du dénominateur et le banc annonce ses pertes", () => {
    const differee = juger(obs({ profondeur: "PLAN", differe: true, statut: "PLANNING", etapes: 0, capacites: [], lectures: [], exigences: ["LECTURE"] }));
    const vraiRefus = juger(obs({ profondeur: "PLAN", lancee: false, statut: null, refus: ["WRONG_CARDINALITY"], exigences: ["LECTURE"] }));
    const s = scoreAutonomie([
      ...Array.from({ length: 9 }, (_, i) => juger(obs({ id: `ok${i}`, profondeur: "PLAN", statut: "RUNNING", exigences: [], lectures: ["search_people"], capacites: ["search_people"] }))),
      ...Array.from({ length: 5 }, () => differee),
    ]);
    const ok = (differee.cause === "INDISPONIBLE" ? 1 : 0)
      + (vraiRefus.cause === "PLANIFICATEUR" ? 1 : 0)
      + (s.missions === 9 && s.inexploitables === 5 && !s.concluant ? 1 : 0);
    consignerMesure("panne_jamais_imputee", { n: 3, ok },
      "lib/evals/autonomie/autonomie.test.ts",
      "INDISPONIBLE hors dénominateur, vrai refus toujours au planificateur, banc déclaré non concluant");
  });
});

describe("mesure consignée — §43 (corpus)", () => {
  it("le corpus est déterministe, couvre les seize familles et ne se répète pas", () => {
    const a = engendrer(MONDE, { nombre: 120, graine: 7 });
    const b = engendrer(MONDE, { nombre: 120, graine: 7 });
    const memeSuite = JSON.stringify(a.map((m) => m.id)) === JSON.stringify(b.map((m) => m.id));
    const familles = new Set(a.map((m) => m.famille));
    const phrases = new Set(a.map((m) => m.demande));
    const ok = (memeSuite ? 1 : 0) + (familles.size === FAMILLES.length ? 1 : 0) + (phrases.size === a.length ? 1 : 0);
    consignerMesure("corpus_reproductible", { n: 3, ok }, "lib/evals/autonomie/autonomie.test.ts",
      `${a.length} missions, ${familles.size}/${FAMILLES.length} familles, ${phrases.size} phrases distinctes`);
  });
});
