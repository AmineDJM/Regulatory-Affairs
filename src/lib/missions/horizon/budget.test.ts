import { describe, expect, it } from "vitest";
import { peutReplanifier, REPLANS_PAR_JALON, signatureRefus } from "@/lib/missions/horizon/budget";

describe("la signature d'un refus", () => {
  it("porte les CODES, jamais les clés d'étape — un renommage ne doit pas déguiser le même mur", () => {
    const a = signatureRefus([{ code: "CARDINALITY" }, { code: "CYCLE" }]);
    const b = signatureRefus([{ code: "CYCLE" }, { code: "CARDINALITY" }]);
    expect(a).toBe(b);
    expect(a).toBe("CARDINALITY|CYCLE");
  });

  it("dédoublonne : trois étapes refusées pour la même raison, c'est une raison", () => {
    expect(signatureRefus([{ code: "CARDINALITY" }, { code: "CARDINALITY" }])).toBe("CARDINALITY");
  });
});

describe("le budget est LOCAL et se juge au PROGRÈS", () => {
  it("laisse partir le premier sous-plan sans rien comparer", () => {
    const v = peutReplanifier({ replans: 0, dernierRefus: null }, null);
    expect(v.autorise).toBe(true);
    expect(v.motif).toBe("PREMIER");
  });

  it("autorise tant que le refus CHANGE — même au huitième tour", () => {
    const v = peutReplanifier({ replans: 8, dernierRefus: "CYCLE" }, "MISSING_PRIMITIVE");
    expect(v.autorise).toBe(true);
    expect(v.motif).toBe("PROGRES");
    expect(v.phrase).toContain("CYCLE → MISSING_PRIMITIVE");
  });

  it("refuse dès que le refus REVIENT IDENTIQUE — c'est le seul arrêt normal", () => {
    const v = peutReplanifier({ replans: 1, dernierRefus: "CARDINALITY" }, "CARDINALITY");
    expect(v.autorise).toBe(false);
    expect(v.motif).toBe("REPETITION");
  });

  it("le plafond est OPÉRATIONNEL : il borne la dépense, il ne dit pas que c'est insurmontable", () => {
    const v = peutReplanifier({ replans: REPLANS_PAR_JALON, dernierRefus: "A" }, "B");
    expect(v.autorise).toBe(false);
    expect(v.motif).toBe("PLAFOND");
    expect(v.phrase).toContain("opérationnel");
  });

  it("le plafond de CE jalon ne dit rien des autres — c'est la fin de PLANS_MAX global", () => {
    // Un jalon épuisé, un jalon neuf : le second part, alors qu'un plafond global l'aurait tué.
    expect(peutReplanifier({ replans: REPLANS_PAR_JALON, dernierRefus: "A" }, "B").autorise).toBe(false);
    expect(peutReplanifier({ replans: 0, dernierRefus: null }, null).autorise).toBe(true);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE OSCILLATION N'EST PAS UN PROGRÈS (§118.67)
 *
 * MESURÉ, mission `cmttakgtd…` : « Le refus a changé (INVALID_SHAPE → OBJECTIF_NON_CONSTATE) »
 * écrit DEUX fois pour le même jalon. Ne comparer qu'au DERNIER refus ne retient qu'un pas
 * d'histoire — A → B → A → B change à chaque tour et ne progresse jamais. Cinq sous-plans,
 * neuf versions de plan, huit verdicts de juge (chacun un appel de modèle), 1,10 $.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("le progrès se juge sur TOUTE l'histoire des refus", () => {
  it("un refus DÉJÀ RENCONTRÉ arrête la boucle, même s'il n'est pas celui du tour précédent", () => {
    const v = peutReplanifier(
      { replans: 3, dernierRefus: "OBJECTIF_NON_CONSTATE", refusVus: ["INVALID_SHAPE", "OBJECTIF_NON_CONSTATE"] },
      "INVALID_SHAPE");
    expect(v.autorise).toBe(false);
    expect(v.motif).toBe("REPETITION");
    // LE REFUS MONTRE LE CHEMIN PARCOURU : « on revient sur ses pas » ne se démontre pas sans lui.
    expect(v.phrase).toContain("DÉJÀ été rencontré");
    expect(v.phrase).toContain("INVALID_SHAPE → OBJECTIF_NON_CONSTATE → INVALID_SHAPE");
  });

  it("un refus VRAIMENT NEUF passe, même après deux murs différents", () => {
    // CE QUI FERAIT TOMBER CE TEST : refuser dès qu'il y a de l'histoire. Ce serait un plafond
    // déguisé en règle de progrès, et un refus à tort coûte une mission (§118.27).
    const v = peutReplanifier(
      { replans: 2, dernierRefus: "INVALID_SHAPE", refusVus: ["MISSING_PRIMITIVE", "INVALID_SHAPE"] },
      "CARDINALITY");
    expect(v.autorise).toBe(true);
    expect(v.motif).toBe("PROGRES");
  });

  it("sans historique, le comportement est EXACTEMENT l'ancien", () => {
    // L'absence de `refusVus` ne doit rien durcir : les jalons d'avant la colonne, et les
    // appels qui ne la passent pas, doivent se comporter comme avant.
    expect(peutReplanifier({ replans: 1, dernierRefus: "A" }, "B").autorise).toBe(true);
    expect(peutReplanifier({ replans: 1, dernierRefus: "A" }, "A").autorise).toBe(false);
  });

  it("le tout premier refus passe, avec un historique vide", () => {
    expect(peutReplanifier({ replans: 0, dernierRefus: null, refusVus: [] }, "INVALID_SHAPE").motif).toBe("PROGRES");
  });

  it("la répétition IMMÉDIATE garde son message à elle — deux causes, deux phrases", () => {
    const v = peutReplanifier({ replans: 2, dernierRefus: "A", refusVus: ["A"] }, "A");
    expect(v.motif).toBe("REPETITION");
    expect(v.phrase).toContain("même refus qu'au tour précédent");
  });
});
