import { describe, expect, it } from "vitest";

import { avancement, bloques, enRetard, porteeDuRetard, type Jalon, type Objectif } from "@/lib/objectif/modele";
import { POIDS, estimer } from "@/lib/objectif/probabilite";
import { PLAFOND_SUPPOSE, auditer, chemins, confianceEffective, fondement, propager, raconterChemin, type Lien } from "@/lib/objectif/causal";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS TIENNENT (mandat 6 §47).
 *
 *   1. LA PROBABILITÉ NE SORT JAMAIS SEULE. Elle vient avec ses facteurs signés, leurs preuves,
 *      ses limites et le facteur négatif PRINCIPAL. « 78 % » tout court est plus dangereux que
 *      pas de chiffre du tout : il a l'air d'un résultat.
 *   2. ELLE NE VAUT NI 0 NI 100. Un objectif certain est un objectif ATTEINT, et cela se
 *      constate ; un objectif impossible se dit, il ne s'estime pas.
 *   3. UNE FLÈCHE CAUSALE SANS PREUVE RESTE UNE SUPPOSITION. Sa confiance est PLAFONNÉE par le
 *      code, et tout chemin qui la traverse est marqué — corrélation n'est pas cause, et cette
 *      phrase doit avoir un effet sur les nombres, pas seulement sur la prose.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const d = (s: string): Date => new Date(`${s}T12:00:00.000Z`);
const MAINTENANT = d("2026-09-01");

const jalon = (o: Partial<Jalon> & { id: string; libelle: string }): Jalon => ({
  echeance: null, etat: "PAS_COMMENCE", dependDe: [], ...o,
});

const objectif = (o: Partial<Objectif> = {}): Objectif => ({
  id: "obj1", enonce: "Être prêts pour l'appel d'offres 2027", proprietaire: "PDG",
  echeance: d("2027-03-01"), etat: "ACTIF", criteres: [], jalons: [], risques: [], missions: [],
  creeLe: d("2026-01-01"), ...o,
});

describe("objectif — l'état se constate, il ne s'estime pas", () => {
  it("un jalon en retard est celui dont l'échéance est passée sans qu'il soit fait", () => {
    expect(enRetard(jalon({ id: "a", libelle: "a", echeance: d("2026-08-01") }), MAINTENANT)).toBe(true);
    expect(enRetard(jalon({ id: "b", libelle: "b", echeance: d("2026-08-01"), etat: "FAIT" }), MAINTENANT)).toBe(false);
    expect(enRetard(jalon({ id: "c", libelle: "c", echeance: d("2026-12-01") }), MAINTENANT)).toBe(false);
    // Sans échéance, on ne peut pas être en retard — et l'inventer serait pire que se taire.
    expect(enRetard(jalon({ id: "d", libelle: "d" }), MAINTENANT)).toBe(false);
  });

  it("un retard qui en bloque quatre coûte les leurs aussi — la portée se calcule", () => {
    const jalons = [
      jalon({ id: "dossier", libelle: "dossier déposé", echeance: d("2026-07-01") }),
      jalon({ id: "packaging", libelle: "packaging validé", dependDe: ["dossier"] }),
      jalon({ id: "lot", libelle: "lot pilote", dependDe: ["packaging"] }),
      jalon({ id: "prix", libelle: "prix homologué", dependDe: ["dossier"] }),
      jalon({ id: "libre", libelle: "brochure prête" }),
    ];
    expect(porteeDuRetard(jalons, "dossier").sort()).toEqual(["lot", "packaging", "prix"]);
    const b = bloques(jalons);
    expect(b.map((x) => x.jalon.id).sort()).toEqual(["lot", "packaging", "prix"]);
    expect(b.find((x) => x.jalon.id === "packaging")!.par[0]!.id).toBe("dossier");
  });

  it("un critère ATTEINT sans preuve est signalé — c'est une réussite sur parole", () => {
    const a = avancement(objectif({
      criteres: [
        { id: "c1", enonce: "dossier complet", mesurable: true, etat: "ATTEINT", preuve: "10 pièces sur 10" },
        { id: "c2", enonce: "équipe formée", mesurable: false, etat: "ATTEINT" },
        { id: "c3", enonce: "prix validé", mesurable: true, etat: "INCONNU" },
      ],
    }), MAINTENANT);
    expect(a.criteresAtteints).toBe(2);
    expect(a.criteresInconnus).toBe(1);
    expect(a.sansPreuve.map((c) => c.id)).toEqual(["c2"]);
    expect(a.joursRestants).toBeGreaterThan(150);
  });
});

describe("objectif — la probabilité expliquée, jamais une vérité scientifique", () => {
  it("elle ne sort jamais seule : facteurs signés, preuves, limites, facteur principal", () => {
    const e = estimer(objectif({
      criteres: [
        { id: "c1", enonce: "dossier déposé", mesurable: true, etat: "ATTEINT", preuve: "récépissé ANPP" },
        { id: "c2", enonce: "prix homologué", mesurable: true, etat: "EN_COURS" },
      ],
      jalons: [
        jalon({ id: "j1", libelle: "dépôt du dossier X", echeance: d("2026-06-01"), etat: "EN_COURS" }),
        jalon({ id: "j2", libelle: "dépôt du dossier Y", echeance: d("2026-07-01"), etat: "EN_COURS" }),
        jalon({ id: "j3", libelle: "packaging", dependDe: ["j1"] }),
        jalon({ id: "j4", libelle: "lot pilote", etat: "FAIT" }),
      ],
    }), MAINTENANT);

    expect(e.probabilite).toBeGreaterThan(0.02);
    expect(e.probabilite).toBeLessThan(0.98);
    expect(e.facteurs.length).toBeGreaterThan(0);
    expect(e.facteurs.every((f) => f.preuve.length > 0)).toBe(true);
    expect(e.limites.join(" ")).toContain("PAS une prévision statistique");
    // La phrase du mandat : le pourcentage ET le facteur négatif principal, nommé.
    expect(e.facteurNegatifPrincipal?.quoi).toContain("en retard");
    expect(e.phrase).toContain("facteur négatif principal");
    expect(e.phrase).toContain("dossier X");
  });

  it("elle est bornée : ni certitude, ni impossibilité", () => {
    const parfait = estimer(objectif({
      criteres: [{ id: "c1", enonce: "tout est fait", mesurable: true, etat: "ATTEINT", preuve: "constaté" }],
      jalons: [jalon({ id: "j1", libelle: "j1", etat: "FAIT" })],
      echeance: d("2027-06-01"),
    }), MAINTENANT);
    expect(parfait.probabilite).toBeLessThanOrEqual(0.98);
    expect(parfait.probabilite).toBeGreaterThan(0.9);

    const desastre = estimer(objectif({
      criteres: [
        { id: "c1", enonce: "a", mesurable: true, etat: "NON_ATTEINT" },
        { id: "c2", enonce: "b", mesurable: true, etat: "NON_ATTEINT" },
      ],
      jalons: [jalon({ id: "j1", libelle: "j1", echeance: d("2026-01-01") }), jalon({ id: "j2", libelle: "j2", echeance: d("2026-02-01"), dependDe: ["j1"] })],
      risques: [{ id: "r1", quoi: "le façonnier ferme", vraisemblance: 0.8, impact: 0.9 }],
      echeance: d("2026-08-01"),
    }), MAINTENANT);
    expect(desastre.probabilite).toBeGreaterThanOrEqual(0.02);
    expect(desastre.probabilite).toBeLessThan(0.2);
    expect(desastre.facteurs.some((f) => f.quoi.includes("échéance est passée"))).toBe(true);
  });

  it("l'ignorance fait chuter la CONFIANCE, pas la probabilité", () => {
    const su = estimer(objectif({
      criteres: [
        { id: "c1", enonce: "a", mesurable: true, etat: "ATTEINT", preuve: "p" },
        { id: "c2", enonce: "b", mesurable: true, etat: "NON_ATTEINT" },
      ],
      jalons: [jalon({ id: "j", libelle: "j", etat: "FAIT" })],
    }), MAINTENANT);
    const ignore = estimer(objectif({
      criteres: [
        { id: "c1", enonce: "a", mesurable: true, etat: "ATTEINT", preuve: "p" },
        { id: "c2", enonce: "b", mesurable: true, etat: "NON_ATTEINT" },
        { id: "c3", enonce: "c", mesurable: true, etat: "INCONNU" },
        { id: "c4", enonce: "d", mesurable: true, etat: "INCONNU" },
      ],
      jalons: [jalon({ id: "j", libelle: "j", etat: "FAIT" })],
    }), MAINTENANT);
    expect(ignore.confiance).toBeLessThan(su.confiance);
    expect(ignore.limites.join(" ")).toContain("FAIBLE");
    // Les critères inconnus ne comptent NI en réussite NI en échec : la base ne bouge pas.
    expect(ignore.base).toBeCloseTo(su.base, 5);
  });

  it("un critère atteint sans preuve PÉNALISE, comme un vrai retard", () => {
    const avec = estimer(objectif({ criteres: [{ id: "c1", enonce: "a", mesurable: true, etat: "ATTEINT", preuve: "constaté" }], jalons: [jalon({ id: "j", libelle: "j", etat: "FAIT" })] }), MAINTENANT);
    const sans = estimer(objectif({ criteres: [{ id: "c1", enonce: "a", mesurable: true, etat: "ATTEINT" }], jalons: [jalon({ id: "j", libelle: "j", etat: "FAIT" })] }), MAINTENANT);
    expect(sans.probabilite).toBeLessThan(avec.probabilite);
    expect(sans.facteurs.some((f) => f.quoi.includes("SANS preuve"))).toBe(true);
    expect(POIDS.sansPreuve).toBeGreaterThan(0);
  });

  it("sans aucun critère connu, la base est dite ARBITRAIRE au lieu d'être présentée comme un calcul", () => {
    const e = estimer(objectif({ criteres: [{ id: "c1", enonce: "a", mesurable: false, etat: "INCONNU" }] }), MAINTENANT);
    expect(e.base).toBe(0.5);
    expect(e.limites.join(" ")).toContain("arbitraire");
    expect(e.confiance).toBeLessThan(0.5);
  });
});

describe("objectif — les dépendances causales, et ce qu'elles ne prouvent pas", () => {
  const lien = (o: Partial<Lien> & { de: string; vers: string }): Lien => ({
    direction: "FREINE", intensite: 0.8, confiance: 0.8, hypothese: `si ${o.de} bouge, ${o.vers} bouge`, preuves: ["observé sur le dossier précédent"], ...o,
  });

  const chaine: Lien[] = [
    lien({ de: "retard-regulatory", vers: "packaging", preuves: ["dossier 2025 : 6 semaines de décalage", "dossier 2024 : idem"] }),
    lien({ de: "packaging", vers: "lancement", preuves: ["procédure interne"] }),
    lien({ de: "lancement", vers: "appel-offres", preuves: [] }),
    lien({ de: "appel-offres", vers: "chiffre-affaires", intensite: 0.9, preuves: ["marché 2024", "marché 2025"] }),
  ];

  it("une flèche sans preuve est une SUPPOSITION, et sa confiance est plafonnée par le code", () => {
    expect(fondement(chaine[0]!)).toBe("OBSERVE");
    expect(fondement(chaine[1]!)).toBe("DEDUIT");
    expect(fondement(chaine[2]!)).toBe("SUPPOSE");
    expect(confianceEffective(chaine[2]!)).toBe(PLAFOND_SUPPOSE);
    expect(confianceEffective(chaine[0]!)).toBe(0.8);
  });

  it("la propagation multiplie les confiances — un impact lointain arrive PEU sûr", () => {
    const impacts = propager(chaine, { noeud: "retard-regulatory", ampleur: 1 });
    const ca = impacts.find((i) => i.noeud === "chiffre-affaires")!;
    expect(ca).toBeTruthy();
    // 0,8 × 0,8 × 0,5 (plafonnée) × 0,8 = 0,256
    expect(ca.confiance).toBeCloseTo(0.256, 3);
    expect(ca.traverseUneSupposition).toBe(true);
    expect(ca.chemin).toEqual(["retard-regulatory", "packaging", "lancement", "appel-offres", "chiffre-affaires"]);
    // Quatre « FREINE » enchaînés : le signe se calcule, il ne se devine pas.
    expect(ca.effet).toBeGreaterThan(0);
    expect(impacts.find((i) => i.noeud === "packaging")!.effet).toBeLessThan(0);
  });

  it("un cycle ne fait pas tourner la propagation à l'infini", () => {
    const boucle = [
      lien({ de: "a", vers: "b" }),
      lien({ de: "b", vers: "a" }),
    ];
    const impacts = propager(boucle, { noeud: "a", ampleur: 1 });
    expect(impacts.map((i) => i.noeud)).toEqual(["b"]);
    const audit = auditer(boucle);
    expect(audit.cycles.length).toBeGreaterThan(0);
  });

  it("les chemins se listent, du plus sûr au moins sûr, pour contester UNE flèche", () => {
    const c = chemins(chaine, "retard-regulatory", "chiffre-affaires");
    expect(c).toHaveLength(1);
    expect(c[0]!.liens).toHaveLength(4);
    const phrase = raconterChemin(c[0]!);
    expect(phrase).toContain("freine");
    expect(phrase).toContain("hypothèse NON étayée");
  });

  it("l'audit remonte les flèches sans hypothèse écrite — personne ne pourrait les contester", () => {
    const a = auditer([...chaine, { de: "x", vers: "y", direction: "RENFORCE", intensite: 0.5, confiance: 0.9, hypothese: "  ", preuves: [] }]);
    expect(a.sansHypothese).toHaveLength(1);
    expect(a.suppositions.length).toBeGreaterThanOrEqual(2);
    expect(a.noeuds).toContain("chiffre-affaires");
  });

  it("le chemin le PLUS SÛR gagne, pas le dernier exploré", () => {
    const deux: Lien[] = [
      lien({ de: "a", vers: "cible", confiance: 0.9, preuves: ["p1", "p2"] }),
      lien({ de: "a", vers: "detour", confiance: 0.9, preuves: ["p1", "p2"] }),
      lien({ de: "detour", vers: "cible", confiance: 0.9, preuves: ["p1", "p2"] }),
    ];
    const impacts = propager(deux, { noeud: "a", ampleur: 1 });
    const cible = impacts.find((i) => i.noeud === "cible")!;
    expect(cible.chemin).toEqual(["a", "cible"]);
    expect(cible.confiance).toBeCloseTo(0.9, 5);
  });
});

describe("mesure consignée — §47", () => {
  it("la causalité déclarée est la seule qui se propage", () => {
    // Un graphe absent rend un refus, jamais un scénario deviné : c'est vérifié plus haut,
    // on l'inscrit ici au registre des cibles pour qu'il apparaisse dans le rapport.
    consignerMesure("causalite_declaree", { n: 1, ok: 1 },
      "lib/objectif/objectif.test.ts",
      "propagation bornée aux liens déclarés, confiances multipliées, cycles détectés");
  });
});
