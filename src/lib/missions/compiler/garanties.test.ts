import { describe, it, expect } from "vitest";
import {
  auMoinsUnePartira, direCondition, estInconditionnelle, nombreGaranti, sExcluent,
  type ConditionLue,
} from "@/lib/missions/compiler/garanties";

/**
 * CE QUE CE BANC EXIGE, ET POURQUOI CHAQUE CAS EXISTE.
 *
 * La règle vient d'un défaut mesuré (§118.67) : deux étapes ARTIFACT conditionnées à la
 * complétude des données, toutes deux ignorées, zéro fichier livré. Mais le remède — « une
 * étape conditionnelle ne compte pas » — est plus dangereux que le défaut s'il refuse la forme
 * que la règle 18 du planificateur IMPOSE pour une relance. Chaque test ci-dessous nomme donc
 * le cas EXACT qui ferait tomber l'assertion.
 */

const attente = (cle: string) => cle === "attendre:khaled";
const w = (c: Partial<ConditionLue> & { step: string }): ConditionLue => c as ConditionLue;

describe("estInconditionnelle", () => {
  it("une étape sans « when » part quoi qu'il arrive", () => {
    expect(estInconditionnelle({ key: "produire:excel" })).toBe(true);
    expect(estInconditionnelle({ key: "produire:excel", when: null })).toBe(true);
  });

  it("une condition dont l'étape amont est vide ne conditionne rien", () => {
    // Le plan a écrit un objet `when` sans amont : il n'y a rien à observer, donc rien ne
    // retient l'étape. La traiter comme conditionnelle refuserait un plan parfaitement sain.
    expect(estInconditionnelle({ key: "x", when: w({ step: "   " }) })).toBe(true);
  });

  it("une condition réelle retient l'étape", () => {
    expect(estInconditionnelle({ key: "x", when: w({ step: "amont", path: "ok", op: "eq", value: "true" }) })).toBe(false);
  });
});

describe("sExcluent — les trois seules paires exactes", () => {
  it("EVENT et TIMEOUT sur une ATTENTE D'ÉVÉNEMENT : elle se règle par un fait ou par le temps, jamais ni l'un ni l'autre", () => {
    expect(sExcluent(w({ step: "attendre:khaled", outcome: "TIMEOUT" }), w({ step: "attendre:khaled", outcome: "EVENT" }), attente)).toBe(true);
  });

  it("EVENT et TIMEOUT sur une étape QUI N'EST PAS une attente : `issueDe` rend DONE, les deux branches sont fausses", () => {
    // C'est le cas qui ferait tomber l'assertion si on ne regardait pas le type de l'amont :
    // un WORKER qui finit DONE sans marqueur de réveil n'est ni EVENT ni TIMEOUT.
    expect(sExcluent(w({ step: "consolider", outcome: "TIMEOUT" }), w({ step: "consolider", outcome: "EVENT" }), attente)).toBe(false);
  });

  it("le même test en « eq » et en « ne » : `comparerValeurs` calcule l'égalité une fois et rend ok ou !ok", () => {
    expect(sExcluent(
      w({ step: "normaliser", path: "donneesCompletes", op: "eq", value: "true" }),
      w({ step: "normaliser", path: "donneesCompletes", op: "ne", value: "true" }),
      attente)).toBe(true);
  });

  it("« eq » et « ne » sur des VALEURS différentes ne s'excluent pas", () => {
    expect(sExcluent(
      w({ step: "lire", path: "statut", op: "eq", value: "OK" }),
      w({ step: "lire", path: "statut", op: "ne", value: "KO" }),
      attente)).toBe(false);
  });

  it("« exists » et « empty » sur le même champ : `!estVide` face à `estVide`", () => {
    expect(sExcluent(
      w({ step: "lire", path: "pieces", op: "exists" }),
      w({ step: "lire", path: "pieces", op: "empty" }),
      attente)).toBe(true);
  });

  it("« gt » et « lte » SEMBLENT complémentaires et ne le sont pas — les deux sont fausses sur une valeur non numérique", () => {
    // Le cœur de la règle. `comparerValeurs` rend ok:false des deux côtés quand la comparaison
    // numérique est impossible : deux branches fausses ensemble, zéro livrable.
    expect(sExcluent(
      w({ step: "lire", path: "prix", op: "gt", value: "5000" }),
      w({ step: "lire", path: "prix", op: "lte", value: "5000" }),
      attente)).toBe(false);
  });

  it("deux conditions sur des AMONTS différents ne s'excluent jamais — c'est le défaut mesuré", () => {
    expect(sExcluent(
      w({ step: "normaliser:retour-initial", path: "donneesCompletes", op: "eq", value: "true" }),
      w({ step: "normaliser:retour-correction", path: "donneesCompletes", op: "eq", value: "true" }),
      attente)).toBe(false);
  });

  it("la même issue avec un test EN PLUS d'un côté ne s'exclut pas", () => {
    // « si DONE » face à « si DONE et X ≠ 3 » : les deux peuvent être fausses (l'amont échoue).
    expect(sExcluent(
      w({ step: "attendre:khaled", outcome: "EVENT" }),
      w({ step: "attendre:khaled", outcome: "TIMEOUT", path: "x", op: "ne", value: "3" }),
      attente)).toBe(false);
  });

  it("le même test sous des ISSUES différentes ne s'exclut pas", () => {
    expect(sExcluent(
      w({ step: "attendre:khaled", outcome: "EVENT", path: "x", op: "eq", value: "3" }),
      w({ step: "attendre:khaled", outcome: "TIMEOUT", path: "x", op: "ne", value: "3" }),
      attente)).toBe(false);
  });

  it("une condition absente ne s'exclut avec rien", () => {
    expect(sExcluent(null, w({ step: "a", outcome: "EVENT" }), attente)).toBe(false);
    expect(sExcluent(w({ step: "a", outcome: "EVENT" }), undefined, attente)).toBe(false);
  });
});

describe("nombreGaranti", () => {
  it("une liste vide ne garantit rien", () => {
    expect(nombreGaranti([], attente)).toBe(0);
    expect(auMoinsUnePartira([], attente)).toBe(false);
  });

  it("LE DÉFAUT MESURÉ : deux livrables, deux conditions indépendantes, zéro garantie", () => {
    const etapes = [
      { key: "produire:registre-initial", when: w({ step: "normaliser:retour-initial", path: "donneesCompletes", op: "eq", value: "true" }) },
      { key: "produire:registre-correction", when: w({ step: "normaliser:retour-correction", path: "donneesCompletes", op: "eq", value: "true" }) },
    ];
    expect(nombreGaranti(etapes, attente)).toBe(0);
    expect(auMoinsUnePartira(etapes, attente)).toBe(false);
  });

  it("LA FORME QUE LA RÈGLE 18 IMPOSE : relance en TIMEOUT, suite en EVENT — une part toujours", () => {
    const etapes = [
      { key: "relancer", when: w({ step: "attendre:khaled", outcome: "TIMEOUT" }) },
      { key: "remercier", when: w({ step: "attendre:khaled", outcome: "EVENT" }) },
    ];
    expect(nombreGaranti(etapes, attente)).toBe(1);
    expect(auMoinsUnePartira(etapes, attente)).toBe(true);
  });

  it("UNE PAIRE GARANTIT UNE ÉTAPE, JAMAIS DEUX", () => {
    // C'est ce qui rend le compte utilisable pour la cardinalité : « un Excel ET un PowerPoint »
    // ne sont pas couverts par deux branches qui s'excluent — une seule des deux partira.
    const etapes = [
      { key: "produire:excel", when: w({ step: "attendre:khaled", outcome: "EVENT" }) },
      { key: "produire:ppt", when: w({ step: "attendre:khaled", outcome: "TIMEOUT" }) },
    ];
    expect(nombreGaranti(etapes, attente)).toBe(1);
  });

  it("une inconditionnelle suffit, quelles que soient les conditionnelles autour", () => {
    const etapes = [
      { key: "produire:excel" },
      { key: "produire:annexe", when: w({ step: "lire", path: "gros", op: "eq", value: "true" }) },
    ];
    expect(nombreGaranti(etapes, attente)).toBe(1);
  });

  it("deux inconditionnelles garantissent deux pièces", () => {
    expect(nombreGaranti([{ key: "a" }, { key: "b" }], attente)).toBe(2);
  });

  it("une étape n'est appariée qu'UNE fois : trois branches sur la même attente ne font pas trois garanties", () => {
    const etapes = [
      { key: "a", when: w({ step: "attendre:khaled", outcome: "EVENT" }) },
      { key: "b", when: w({ step: "attendre:khaled", outcome: "TIMEOUT" }) },
      { key: "c", when: w({ step: "attendre:khaled", outcome: "EVENT" }) },
    ];
    expect(nombreGaranti(etapes, attente)).toBe(1);
  });
});

describe("direCondition — un refus montre ce qu'il a LU (§118.34)", () => {
  it("nomme l'amont, l'issue et le test", () => {
    expect(direCondition(w({ step: "normaliser:retour", path: "donneesCompletes", op: "eq", value: "true" })))
      .toBe("si « normaliser:retour » donneesCompletes eq « true »");
    expect(direCondition(w({ step: "attendre:khaled", outcome: "timeout" })))
      .toBe("si « attendre:khaled » issue TIMEOUT");
    expect(direCondition(w({ step: "amont" }))).toBe("si « amont » aboutit");
  });

  it("dit « sans condition » plutôt que de rendre un vide trompeur", () => {
    expect(direCondition(null)).toBe("sans condition");
    expect(direCondition(w({ step: "" }))).toBe("sans condition");
  });
});
