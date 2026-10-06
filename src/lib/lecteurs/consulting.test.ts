import { describe, expect, it } from "vitest";
import {
  POLES_CONSULTING, MODULE_DU_POLE, CHEMIN_LISTE_POLE, LIBELLE_POLE, poleDe, poleOppose,
  transfertAutorise, refusTransfert, polesLisibles, estPoleConsulting,
} from "./consulting";

describe("le pôle d'un contrat de consulting (§118.150)", () => {
  it("chaque pôle a SON module, sa liste et son libellé — et deux pôles ne partagent aucun des trois", () => {
    for (const p of POLES_CONSULTING) {
      expect(MODULE_DU_POLE[p]).toBeTruthy();
      expect(CHEMIN_LISTE_POLE[p]).toMatch(/^\//);
      expect(LIBELLE_POLE[p]).toBeTruthy();
    }
    expect(new Set(POLES_CONSULTING.map((p) => MODULE_DU_POLE[p])).size).toBe(POLES_CONSULTING.length);
    expect(new Set(POLES_CONSULTING.map((p) => CHEMIN_LISTE_POLE[p])).size).toBe(POLES_CONSULTING.length);
    expect(MODULE_DU_POLE.AD_PRO).toBe("CONSULTING");
    // Le pôle RH relève du sous-module « Employés » depuis le découpage des RH (Direction, 06/10).
    expect(MODULE_DU_POLE.RH).toBe("EMPLOYEES");
  });

  it("le pôle opposé est une involution", () => {
    for (const p of POLES_CONSULTING) expect(poleOppose(poleOppose(p))).toBe(p);
    expect(poleOppose("AD_PRO")).toBe("RH");
  });

  it("ce qu'on ne lit pas à coup sûr retombe sur le défaut du schéma, jamais sur RH", () => {
    expect(poleDe("RH")).toBe("RH");
    expect(poleDe("AD_PRO")).toBe("AD_PRO");
    for (const v of [null, undefined, "", "rh", "HR", 3, {}]) {
      expect(poleDe(v)).toBe("AD_PRO");
      expect(estPoleConsulting(v)).toBe(false);
    }
  });

  it("transférer exige de modifier les DEUX modules — un seul côté ne suffit jamais", () => {
    expect(transfertAutorise({ modifieDepart: true, modifieArrivee: true })).toBe(true);
    expect(transfertAutorise({ modifieDepart: true, modifieArrivee: false })).toBe(false);
    expect(transfertAutorise({ modifieDepart: false, modifieArrivee: true })).toBe(false);
    expect(transfertAutorise({ modifieDepart: false, modifieArrivee: false })).toBe(false);
  });

  it("le refus NOMME les deux modules et qui a le droit", () => {
    const m = refusTransfert("AD_PRO", "RH");
    expect(m).toMatch(/CONSULTING/);
    expect(m).toMatch(/\bEMPLOYEES\b/);
    expect(m).toMatch(/Ad & Pro/);
    expect(m).toMatch(/Ressources humaines/);
    expect(m).toMatch(/Super Admin/);
  });

  it("les pôles lisibles suivent les droits de lecture, MODULE par module", () => {
    const voit = (...modules: string[]) => (m: string) => modules.includes(m);
    expect(polesLisibles(voit("CONSULTING", "EMPLOYEES"))).toEqual(["AD_PRO", "RH"]);
    expect(polesLisibles(voit("CONSULTING"))).toEqual(["AD_PRO"]);
    expect(polesLisibles(voit("EMPLOYEES"))).toEqual(["RH"]);
    expect(polesLisibles(voit())).toEqual([]);
    // Un module sans rapport n'ouvre aucun pôle : le prédicat est interrogé sur les modules
    // de la table, et sur eux seuls.
    expect(polesLisibles(voit("SPONSORING", "LEGAL"))).toEqual([]);
  });
});
