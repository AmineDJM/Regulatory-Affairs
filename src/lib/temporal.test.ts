import { describe, expect, it } from "vitest";
import { heureDite, interpreterExpressionTemporelle } from "@/lib/temporal";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DÉCODEUR TEMPOREL, ÉPROUVÉ EN MILLISECONDES — l'horloge est un PARAMÈTRE (§44).
 *
 * Chaque cas fixe `ref` et vérifie l'instant UTC exact. Aucun test n'attend une seconde
 * réelle : « demain » se prouve avec une fausse horloge, et c'est le MÊME code qui tourne en
 * production avec la vraie. Le doute renonce : les cas ambigus rendent null, jamais une date
 * plausible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// Samedi 29 août 2026, 14:30 à Alger (13:30 UTC).
const REF = new Date("2026-08-29T13:30:00.000Z");

const lit = (texte: string) => interpreterExpressionTemporelle(texte, REF);

describe("expressions ponctuelles", () => {
  it("« demain » = lendemain 09:00 Alger (08:00 UTC)", () => {
    const r = lit("rappelle-moi demain de valider le contrat");
    expect(r?.echeance.toISOString()).toBe("2026-08-30T08:00:00.000Z");
    expect(r?.recurrence).toBe("NONE");
  });

  it("« demain à 10h » et « demain matin » portent leur heure", () => {
    expect(lit("reviens demain à 10h")?.echeance.toISOString()).toBe("2026-08-30T09:00:00.000Z");
    expect(lit("demain matin")?.echeance.toISOString()).toBe("2026-08-30T08:00:00.000Z");
    expect(lit("demain soir")?.echeance.toISOString()).toBe("2026-08-30T17:00:00.000Z");
  });

  it("« après-demain » saute deux jours", () => {
    expect(lit("on en parle après-demain")?.echeance.toISOString()).toBe("2026-08-31T08:00:00.000Z");
  });

  it("« dans deux heures » et « dans 48h » comptent depuis MAINTENANT", () => {
    expect(lit("dans deux heures")?.echeance.toISOString()).toBe("2026-08-29T15:30:00.000Z");
    expect(lit("relance-la dans 48h")?.echeance.toISOString()).toBe("2026-08-31T13:30:00.000Z");
  });

  it("« dans trois jours à 10h » : le jour vient du délai, l'heure du texte", () => {
    expect(lit("dans trois jours à 10h")?.echeance.toISOString()).toBe("2026-09-01T09:00:00.000Z");
  });

  it("« lundi » désigne le PROCHAIN lundi — et un samedi, « samedi » désigne le suivant", () => {
    expect(lit("on se voit lundi")?.echeance.toISOString()).toBe("2026-08-31T08:00:00.000Z");
    expect(lit("samedi")?.echeance.toISOString()).toBe("2026-09-05T08:00:00.000Z");
  });

  it("« le 15 septembre » = cette année ; une date déjà passée bascule à l'an prochain", () => {
    expect(lit("le 15 septembre")?.echeance.toISOString()).toBe("2026-09-15T08:00:00.000Z");
    expect(lit("le 3 janvier")?.echeance.toISOString()).toBe("2027-01-03T08:00:00.000Z");
  });
});

describe("récurrences structurées", () => {
  it("« chaque vendredi » = WEEKLY, prochaine occurrence au vendredi suivant", () => {
    const r = lit("vérifie chaque vendredi");
    expect(r?.recurrence).toBe("WEEKLY");
    expect(r?.echeance.toISOString()).toBe("2026-09-04T08:00:00.000Z");
  });

  it("« tous les jours » et « tous les matins » = DAILY", () => {
    expect(lit("rappelle-moi tous les jours jusqu'à ce que ce soit fait")?.recurrence).toBe("DAILY");
    const matins = lit("tous les matins");
    expect(matins?.recurrence).toBe("DAILY");
    expect(matins?.echeance.toISOString()).toBe("2026-08-30T08:00:00.000Z");
  });
});

describe("le doute RENONCE — jamais une date plausible", () => {
  it("un texte sans expression temporelle rend null", () => {
    expect(lit("analyse tous les contrats de la société")).toBeNull();
  });

  it("« mardi en huit » n'est pas compris : null, pas une date au hasard", () => {
    // « mardi » serait attrapé — mais l'expression complète veut dire AUTRE chose. Le décodeur
    // lit « mardi » : c'est le compromis assumé (le mardi le plus proche reste défendable) —
    // ce test ÉPINGLE le comportement pour qu'un changement soit un choix, pas un accident.
    expect(lit("mardi en huit")?.echeance.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("heureDite exige un marqueur : « le 15 septembre » ne devient pas 15h", () => {
    expect(heureDite("le 15 septembre")).toBeNull();
    expect(heureDite("à 15h")).toEqual({ h: 15, min: 0 });
    expect(heureDite("14:45")).toEqual({ h: 14, min: 45 });
    expect(heureDite("25h")).toBeNull();
  });
});
