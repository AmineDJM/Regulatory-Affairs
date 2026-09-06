import { describe, expect, it } from "vitest";
import { evaluer, NIVEAUX, type Affirmation } from "@/lib/verification/risque";
import { applicables, conclure, echantillon, FICHES, METHODES, selectionner, type Resultat } from "@/lib/verification/methodes";
import { apprendre, feuille, redigerEval, ACTIONS, SEUIL_RECURRENCE, type Echec } from "@/lib/apprentissage/lecon";
import { consignerMesure } from "@/lib/evals/registre";
import { porteDeRegression } from "@/lib/cout/choix";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA VÉRIFICATION PROPORTIONNÉE ET L'APPRENTISSAGE DES ÉCHECS (mandat 6 §49).
 *
 * Deux propriétés dominent ce fichier :
 *   · une vérification qui passe ne dit PAS « c'est vrai », et le code refuse de le laisser
 *     croire — y compris quand quatre méthodes sur cinq confirment ;
 *   · une leçon est une PROPOSITION. Rien ne s'applique sans un accord humain, et aucune leçon
 *     ne peut proposer d'élargir un droit (§118.12 et §118.6).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const aff = (o: Partial<Affirmation> = {}): Affirmation => ({
  quoi: "le total des factures de septembre", obtention: "CALCUL_DETERMINISTE",
  exposition: "EQUIPE", reversible: true, ...o,
});

describe("le risque — la vérification se calcule, elle ne se ressent pas", () => {
  it("une lecture directe pour moi-même ne demande AUCUNE vérification", () => {
    const e = evaluer(aff({ obtention: "LECTURE_DIRECTE", exposition: "MOI" }));
    expect(e.niveau).toBe("AUCUN");
    expect(selectionner(aff({ obtention: "LECTURE_DIRECTE", exposition: "MOI" }), e.niveau).methodes).toHaveLength(0);
    // Et ne rien faire est une DÉCISION, dite comme telle.
    expect(selectionner(aff(), "AUCUN").justification).toMatch(/dévalue les vérifications qui comptent/i);
  });

  it("un virement irréversible vers un partenaire monte au niveau adversarial", () => {
    const e = evaluer(aff({
      obtention: "AGREGATION", exposition: "PARTENAIRE", reversible: false,
      montantDzd: 8_000_000, echeanceEngagee: true,
    }));
    expect(e.niveau).toBe("ADVERSARIAL");
    expect(e.facteurs.some((f) => /IRRÉVERSIBLE/.test(f.quoi))).toBe(true);
  });

  it("LA FRAGILITÉ DE L'OBTENTION compte autant que l'enjeu — le facteur qu'on oublie", () => {
    // Même sujet, même exposition, même montant. Seul le CHEMIN change.
    const solide = evaluer(aff({ obtention: "LECTURE_DIRECTE", exposition: "DIRECTION", montantDzd: 200_000 }));
    const fragile = evaluer(aff({ obtention: "LECTURE_PAR_MODELE", exposition: "DIRECTION", montantDzd: 200_000 }));
    expect(fragile.score).toBeGreaterThan(solide.score);
    expect(NIVEAUX.indexOf(fragile.niveau)).toBeGreaterThan(NIVEAUX.indexOf(solide.niveau));
    expect(fragile.principal).toMatch(/obtention/);
  });

  it("une affirmation sans source citable porte une limite qui le DIT", () => {
    const e = evaluer(aff({ obtention: "ASSERTION_MODELE" }));
    expect(e.limites.join(" ")).toMatch(/aucune source citable/i);
    // Et la limite générale est toujours là, quel que soit le niveau.
    expect(e.limites[0]).toMatch(/ne prouve pas que le résultat est VRAI/i);
  });
});

describe("les méthodes — ce qu'elles ne voient pas est ce qu'il faut savoir", () => {
  it("chaque méthode déclare au moins un angle mort, et le second modèle nomme LE bon", () => {
    for (const m of METHODES) {
      expect(FICHES[m].aveugleA.length, m).toBeGreaterThan(0);
      expect(FICHES[m].attrape.length, m).toBeGreaterThan(0);
    }
    // La ligne qui empêche de transformer un écho en preuve.
    expect(FICHES.SECOND_MODELE.aveugleA.join(" ")).toMatch(/contexte.*partagent|partagent.*contexte/i);
    expect(FICHES.SECOND_MODELE.aveugleA.join(" ")).toMatch(/écho/i);
    // Et le recalcul dit qu'il reproduit une entrée fausse à l'identique.
    expect(FICHES.RECALCUL.aveugleA.join(" ")).toMatch(/reproduit/i);
  });

  it("on ne propose que des méthodes APPLICABLES — une méthode inapplicable « passée » serait un faux", () => {
    // Pas de recalcul sur une assertion : il n'y a rien à recalculer.
    expect(applicables(aff({ obtention: "ASSERTION_MODELE" }))).not.toContain("RECALCUL");
    // Pas de source alternative pour une assertion sans source : il n'y a pas de première source.
    expect(applicables(aff({ obtention: "ASSERTION_MODELE" }))).not.toContain("SOURCE_ALTERNATIVE");
    // Mais bien un recalcul sur une agrégation.
    expect(applicables(aff({ obtention: "AGREGATION", montantDzd: 1000 }))).toContain("RECALCUL");
  });

  it("le RECALCUL passe devant le second modèle : gratuit, et c'est le seul qui PROUVE", () => {
    const a = aff({ obtention: "AGREGATION", montantDzd: 1000, cardinalite: 30 });
    const p = selectionner(a, "APPUYE");
    expect(p.methodes[0]).toBe("RECALCUL");
    expect(p.coutTotal).toBeLessThanOrEqual(2);
  });

  it("le programme porte les angles morts de ce qu'il N'A PAS fait, pas seulement de ce qu'il a fait", () => {
    const p = selectionner(aff({ obtention: "AGREGATION", montantDzd: 1000, cardinalite: 30 }), "LEGER");
    expect(p.methodes).toHaveLength(1);
    expect(p.anglesMorts.some((x) => /non appliqué/.test(x)), JSON.stringify(p.anglesMorts)).toBe(true);
  });

  it("une méthode indisponible sort de la sélection au lieu d'être comptée pour acquise", () => {
    const a = aff({ obtention: "AGREGATION", montantDzd: 1000, cardinalite: 30 });
    const p = selectionner(a, "APPUYE", ["RECALCUL"]);
    expect(p.methodes).not.toContain("RECALCUL");
    expect(p.methodes.length).toBe(2);
  });
});

describe("le verdict — le sens négatif l'emporte, toujours", () => {
  const prog = selectionner(aff({ obtention: "AGREGATION", montantDzd: 1000, cardinalite: 30 }), "ADVERSARIAL");

  it("UN recalcul qui contredit l'emporte sur QUATRE confirmations", () => {
    const r: Resultat[] = prog.methodes.map((m) => ({
      methode: m,
      accord: m === "RECALCUL" ? false : true,
      constat: m === "RECALCUL" ? "le total recalculé vaut 41 300 000, pas 43 100 000" : "cohérent",
      ...(m === "RECALCUL" ? { trouve: "41 300 000" } : {}),
    }));
    const v = conclure(prog, r);
    expect(v.issue).toBe("CONTREDIT");
    expect(v.phrase).toMatch(/déterministe/i);
    expect(v.desaccords[0]).toContain("41 300 000");
  });

  it("un désaccord NON déterministe ne tranche pas : c'est un DOUTE, pas un verdict", () => {
    // Un chiffre LU PAR UN MODÈLE dans un PDF : c'est là — et seulement là — qu'un second
    // modèle a du sens. Sur une agrégation faite par du code, il n'en aurait aucun, et
    // `applicables` ne le propose donc pas.
    const lu = aff({ obtention: "LECTURE_PAR_MODELE", exposition: "PARTENAIRE", reversible: false, montantDzd: 3_000_000 });
    const progLu = selectionner(lu, evaluer(lu).niveau);
    expect(progLu.methodes, JSON.stringify(progLu)).toContain("SECOND_MODELE");

    const r: Resultat[] = progLu.methodes.map((m) => ({
      methode: m, accord: m === "SECOND_MODELE" ? false : true, constat: "avis divergent",
    }));
    const v = conclure(progLu, r);
    // Un second modèle en désaccord n'établit rien — il signale qu'il faut regarder.
    expect(v.issue).toBe("DOUTE");
    expect(v.phrase).toMatch(/il faut regarder, pas arbitrer/i);
  });

  it("une méthode qui n'a PAS PU tourner ne confirme rien — et le verdict le dit", () => {
    const r: Resultat[] = prog.methodes.map((m, i) => ({
      methode: m, accord: i === 0 ? null : true, constat: i === 0 ? "service indisponible" : "cohérent",
    }));
    const v = conclure(prog, r);
    expect(v.issue).toBe("NON_VERIFIE");
    expect(v.phrase).toMatch(/INCOMPLÈTE/i);
    expect(v.phrase).toMatch(/ne confirme rien/i);
  });

  it("même TOUT confirmé, la phrase refuse de dire « c'est vrai »", () => {
    const r: Resultat[] = prog.methodes.map((m) => ({ methode: m, accord: true, constat: "cohérent" }));
    const v = conclure(prog, r);
    expect(v.issue).toBe("CONFIRME");
    expect(v.phrase).toMatch(/aucune ne l'a contredit, pas que c'est vrai/i);
    expect(v.anglesMorts.length).toBeGreaterThan(0);
  });
});

describe("l'échantillonnage — déterministe, sinon deux runs ne se comparent pas", () => {
  it("un petit lot se vérifie entièrement", () => {
    expect(echantillon(4, "LECTURE_PAR_MODELE")).toEqual([0, 1, 2, 3]);
  });

  it("plus l'obtention est fragile, plus on regarde", () => {
    const solide = echantillon(200, "LECTURE_DIRECTE").length;
    const fragile = echantillon(200, "ASSERTION_MODELE").length;
    expect(fragile).toBeGreaterThan(solide);
    expect(solide).toBeGreaterThanOrEqual(3);
  });

  it("les bornes sont toujours dedans, et deux appels donnent le même tirage", () => {
    const a = echantillon(120, "AGREGATION");
    const b = echantillon(120, "AGREGATION");
    expect(a).toEqual(b);
    expect(a[0]).toBe(0);
    expect(a[a.length - 1]).toBe(119);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// L'APPRENTISSAGE DES ÉCHECS
// ═══════════════════════════════════════════════════════════════════════════════════════════

const jour = (n: number) => new Date(2026, 8, n, 12);
const ech = (o: Partial<Echec> = {}): Echec => ({
  quand: jour(1), demande: "compare les délais ANPP de nos dossiers",
  cause: "DECOUVERTE", nature: "CAPACITE_ABSENTE", capacite: "regulatory_timeline", modele: "terra", ...o,
});

describe("apprendre — une leçon est une proposition, jamais un changement", () => {
  it("AUCUNE action possible ne touche à un droit — la liste est fermée", () => {
    // La garantie structurelle : même la cause PERMISSION ne peut proposer que de POSER la question.
    const l = apprendre(Array.from({ length: 5 }, (_, i) => ech({ cause: "PERMISSION", nature: "PERMISSION", quand: jour(i + 1) })));
    expect(l[0]!.action).toBe("POSER_LA_QUESTION_DU_DROIT");
    expect(ACTIONS).not.toContain("ACCORDER_UN_DROIT" as never);
    expect(ACTIONS.some((a) => /ACCORD|OUVRIR|ELARGIR|PERMISSION/.test(a) && a !== "POSER_LA_QUESTION_DU_DROIT")).toBe(false);
    // Et c'est un humain de la DIRECTION qui décide.
    expect(l[0]!.aApprouverPar).toBe("DIRECTION");
  });

  it("un échec unique est du BRUIT : observé, pas proposé", () => {
    const l = apprendre([ech()]);
    expect(l).toHaveLength(1);
    expect(l[0]!.occurrences).toBe(1);
    expect(l[0]!.proposable).toBe(false);
    expect(feuille(l).aDecider).toHaveLength(0);
    expect(feuille(l).resume).toMatch(/Rien à décider/i);
  });

  it("le même échec au seuil devient une proposition, et elle attend un accord", () => {
    const l = apprendre(Array.from({ length: SEUIL_RECURRENCE }, (_, i) => ech({ quand: jour(i + 1) })));
    expect(l[0]!.proposable).toBe(true);
    expect(l[0]!.action).toBe("PRECISER_UNE_DESCRIPTION");
    const f = feuille(l);
    expect(f.aDecider).toHaveLength(1);
    expect(f.resume).toMatch(/AUCUNE ne s'applique toute seule/i);
  });

  it("UNE correction humaine vaut le seuil à elle seule — c'est la meilleure preuve", () => {
    const l = apprendre([ech({ correctionHumaine: "Yassine a refait le rapprochement à la main" })]);
    expect(l[0]!.occurrences).toBe(1);
    expect(l[0]!.proposable).toBe(true);
    expect(l[0]!.corrections).toHaveLength(1);
  });

  it("deux FORMULATIONS du même défaut comptent ensemble — sinon aucune n'atteint jamais le seuil", () => {
    const l = apprendre([
      ech({ demande: "compare les délais ANPP", quand: jour(1) }),
      ech({ demande: "quels dossiers traînent à l'ANPP ?", quand: jour(2) }),
      ech({ demande: "sors-moi les délais moyens par dossier", quand: jour(3) }),
    ]);
    expect(l, JSON.stringify(l)).toHaveLength(1);
    expect(l[0]!.occurrences).toBe(3);
    expect(l[0]!.proposable).toBe(true);
    expect(l[0]!.exemples).toHaveLength(3);
  });

  it("une panne de fournisseur n'enseigne RIEN — elle ne produit aucune leçon", () => {
    const l = apprendre(Array.from({ length: 20 }, (_, i) => ech({ cause: "INDISPONIBLE", quand: jour((i % 28) + 1) })));
    expect(l).toHaveLength(0);
    const e = apprendre(Array.from({ length: 20 }, (_, i) => ech({ cause: "EXECUTION", quand: jour((i % 28) + 1) })));
    expect(e).toHaveLength(0);
  });

  it("l'eval proposé attend le MANQUE NOMMÉ quand la primitive n'existe pas encore", () => {
    const l = apprendre(Array.from({ length: 4 }, (_, i) => ech({ cause: "PRIMITIVE_ABSENTE", quand: jour(i + 1) })));
    const e = redigerEval(l[0]!)!;
    // Un eval qui attendrait la réussite serait rouge pour toujours et finirait ignoré.
    expect(e.attendu).toMatch(/NOMME précisément ce qui manque/i);
    expect(e.demande).toBe("compare les délais ANPP de nos dossiers");
    expect(e.pourquoi).toMatch(/vu 4 fois/);
  });

  it("un motif sous le seuil ne rend PAS d'eval — on n'écrit pas un test sur une anomalie", () => {
    expect(redigerEval(apprendre([ech()])[0]!)).toBeNull();
  });

  it("les leçons sortent par fréquence : l'ordre de traitement est l'ordre du coût réel", () => {
    const l = apprendre([
      ...Array.from({ length: 2 }, (_, i) => ech({ cause: "MODELE", nature: "MODELE", capacite: "a", quand: jour(i + 1) })),
      ...Array.from({ length: 6 }, (_, i) => ech({ cause: "PLANIFICATEUR", nature: "MODELE", capacite: "b", quand: jour(i + 1) })),
    ]);
    expect(l[0]!.occurrences).toBe(6);
    expect(l[0]!.action).toBe("GUIDER_LE_PLANIFICATEUR");
  });
});

describe("mesures consignées — §49", () => {
  it("une vérification qui passe ne dit jamais « c'est vrai », et le niveau se calcule", () => {
    const a = aff({ obtention: "AGREGATION", exposition: "PARTENAIRE", reversible: false, montantDzd: 8_000_000, cardinalite: 34 });
    const p = selectionner(a, evaluer(a).niveau);
    const v = conclure(p, p.methodes.map((m) => ({ methode: m, accord: true, constat: "cohérent" })));
    const nePasMentir = /pas que c'est vrai/i.test(v.phrase) && v.anglesMorts.length > 0 ? 1 : 0;
    consignerMesure("verifie_ne_dit_pas_vrai", { n: 1, ok: nePasMentir },
      "lib/verification/verification.test.ts",
      `${p.methodes.length} méthodes, ${v.anglesMorts.length} angles morts déclarés`);

    // Une méthode inapplicable n'est jamais proposée puis comptée comme faite.
    const sansSource = applicables(aff({ obtention: "ASSERTION_MODELE" }));
    const propre = !sansSource.includes("RECALCUL") && !sansSource.includes("SOURCE_ALTERNATIVE") ? 1 : 0;
    consignerMesure("verification_proportionnee", { n: 2, ok: propre + (evaluer(aff({ obtention: "LECTURE_DIRECTE", exposition: "MOI" })).niveau === "AUCUN" ? 1 : 0) },
      "lib/verification/verification.test.ts",
      "niveau calculé sur le risque ; aucune méthode inapplicable proposée");
  });

  it("la porte de régression et les planchers de coût", () => {
    const refuse = porteDeRegression({ exactitude: 0.97, coutUsd: 0.04 }, { exactitude: 0.91, coutUsd: 0.001 });
    consignerMesure("qualite_jamais_compensee", { n: 1, ok: refuse.accepte ? 0 : 1 },
      "lib/cout/cout.test.ts", "une économie payée en qualité est refusée quel que soit le montant");
  });
});
