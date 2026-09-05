import { describe, expect, it } from "vitest";
import { decrireRegles, evaluerRegles, graviteDe, lireEtat, lireRegles, reglesParDefaut, signatureDe, type EtatCible } from "@/lib/missions/watch/rules";

/**
 * LES RÈGLES D'UNE SURVEILLANCE, au cas près — et la propriété qui rend « seulement s'il y a un
 * problème » supportable : la signature d'un problème est STABLE d'un jour à l'autre.
 */
const T0 = new Date("2026-09-05T09:00:00Z");
const iso = (jours: number) => new Date(T0.getTime() + jours * 86_400_000).toISOString();
const dossier = (extra: Partial<EtatCible> = {}): EtatCible => ({
  existe: true, statut: "AWAITING_ANPP", terminal: false, bloque: false, echeance: iso(5), dernierChangement: iso(-20), champs: { montant: 12_000 }, ...extra,
});

describe("evaluerRegles — ce qui est un problème", () => {
  it("échéance proche, silence, blocage, statut, seuil, disparition", () => {
    const p = evaluerRegles(dossier({ bloque: true, statut: "BLOCKED" }), [
      { code: "ECHEANCE_PROCHE", jours: 7 }, { code: "SANS_CHANGEMENT", jours: 14 }, { code: "BLOQUE" },
      { code: "STATUT_PARMI", valeurs: ["blocked"] }, { code: "VALEUR", champ: "montant", op: "gt", valeur: "10000" }, { code: "DISPARU" },
    ], null, T0);
    expect(p.map((x) => x.code).sort()).toEqual(["BLOQUE", "ECHEANCE_PROCHE", "SANS_CHANGEMENT", "STATUT_PARMI", "VALEUR"]);
    expect(p.find((x) => x.code === "ECHEANCE_PROCHE")?.detail).toMatch(/dans 5 jour/);
    expect(p.find((x) => x.code === "SANS_CHANGEMENT")?.detail).toMatch(/depuis 20 jour/);
    expect(graviteDe(p)).toBe("ATTENTION");
  });
  it("rien ne se déclenche quand tout va bien, et une cible terminée n'a plus d'échéance ni de silence", () => {
    expect(evaluerRegles(dossier({ echeance: iso(30), dernierChangement: iso(-2) }), reglesParDefaut("REGULATORY_PRODUCT"), null, T0)).toEqual([]);
    expect(evaluerRegles(dossier({ terminal: true, statut: "CLOSED", echeance: iso(-3) }), reglesParDefaut("REGULATORY_PRODUCT"), null, T0)).toEqual([]);
  });
  it("une échéance dépassée est un problème distinct d'une échéance proche", () => {
    const p = evaluerRegles(dossier({ echeance: iso(-2), dernierChangement: iso(-1) }), reglesParDefaut("TASK"), null, T0);
    expect(p.map((x) => x.code)).toEqual(["ECHEANCE_DEPASSEE"]);
    expect(p[0].detail).toMatch(/dépassée de 2 jour/);
  });
  it("le changement de statut se voit par rapport à l'état PRÉCÉDENT, une fois, en information", () => {
    const regles = [{ code: "STATUT_CHANGE" as const }];
    expect(evaluerRegles(dossier(), regles, null, T0)).toEqual([]);
    const p = evaluerRegles(dossier({ statut: "RESPONDING_TO_QUERIES" }), regles, dossier(), T0);
    expect(p).toHaveLength(1);
    expect(p[0].gravite).toBe("INFO");
    expect(graviteDe(p)).toBe("INFO");
    expect(p[0].detail).toMatch(/AWAITING_ANPP à RESPONDING_TO_QUERIES/);
  });
  it("une cible disparue court-circuite tout le reste", () => {
    const p = evaluerRegles({ existe: false }, reglesParDefaut("REGULATORY_PRODUCT"), null, T0);
    expect(p.map((x) => x.code)).toEqual(["DISPARU"]);
  });
});

describe("signatureDe — le même problème n'est dit qu'une fois", () => {
  it("est stable quand seuls les compteurs de jours bougent, et change quand le problème change", () => {
    const regles = reglesParDefaut("REGULATORY_PRODUCT");
    const j0 = signatureDe(evaluerRegles(dossier(), regles, null, T0));
    const j1 = signatureDe(evaluerRegles(dossier(), regles, null, new Date(T0.getTime() + 86_400_000)));
    expect(j0).not.toBe("");
    expect(j1).toBe(j0);
    const autre = signatureDe(evaluerRegles(dossier({ dernierChangement: iso(-1) }), regles, null, T0));
    expect(autre).not.toBe(j0);
    expect(signatureDe([])).toBe("");
  });
});

describe("relecture sans confiance et libellés", () => {
  it("lireRegles retype et écarte l'inconnu ; lireEtat retype l'état persisté", () => {
    expect(lireRegles([{ code: "sans_changement", jours: 3.4 }, { code: "N_IMPORTE" }, { code: "VALEUR", champ: "x" }, { code: "VALEUR", champ: "x", op: "gt", valeur: 5 }]))
      .toEqual([{ code: "SANS_CHANGEMENT", jours: 3 }, { code: "VALEUR", champ: "x", op: "gt", valeur: "5" }]);
    expect(lireEtat({ existe: true, statut: "TODO", echeance: iso(1) })?.statut).toBe("TODO");
    expect(lireEtat({ statut: "TODO" })).toBeNull();
    expect(lireEtat("x")).toBeNull();
  });
  it("decrireRegles parle français", () => {
    expect(decrireRegles(reglesParDefaut("TASK"))).toMatch(/échéance à moins de 3 jours ; échéance dépassée ; silence de plus de 7 jours ; disparition/);
  });
});
