import { describe, expect, it } from "vitest";
import { estMorteParElleMeme, etapesEnImpasse, peutEncoreAvancer } from "@/lib/missions/runtime/impasse";

/**
 * LE CAS MESURÉ, REPRODUIT À L'IDENTIQUE — mission `cmtta95k1…`.
 *
 * Deux envois en échec définitif (« Équipe Regulatory » n'est pas une personne) et onze étapes
 * PENDING qui en descendent. La mission le voyait (BLOCKED) ; le jalon, non — il comptait ces
 * onze étapes comme du travail à venir, restait ACTIVE pour toujours, et la reprise de jalon
 * (§118.47) n'a jamais pu se déclencher.
 */
const e = (key: string, status: string, dependsOn: string[] = [], attempt = 0, maxAttempts = 3) =>
  ({ key, status, attempt, maxAttempts, dependsOn });

describe("estMorteParElleMeme", () => {
  it("un échec aux tentatives ÉPUISÉES est mort ; un échec réparable ne l'est pas", () => {
    expect(estMorteParElleMeme(e("a", "FAILED", [], 3, 3))).toBe(true);
    expect(estMorteParElleMeme(e("a", "FAILED", [], 1, 3))).toBe(false);
  });

  it("une annulation est morte ; une attente, une exécution et un acquis ne le sont pas", () => {
    expect(estMorteParElleMeme(e("a", "CANCELLED"))).toBe(true);
    for (const s of ["WAITING", "RUNNING", "READY", "PENDING", "DONE", "SKIPPED"]) {
      expect(estMorteParElleMeme(e("a", s)), s).toBe(false);
    }
  });
});

describe("etapesEnImpasse", () => {
  it("LE CAS MESURÉ : deux envois morts, onze étapes derrière — toutes en impasse", () => {
    const etapes = [
      e("demander:nivolex", "FAILED", [], 3, 3),
      e("demander:trastuzex", "FAILED", [], 3, 3),
      ...Array.from({ length: 11 }, (_, i) =>
        e(`suite-${i}`, "PENDING", [i < 6 ? "demander:nivolex" : "demander:trastuzex"])),
    ];
    const mortes = etapesEnImpasse(etapes);
    expect(mortes.size).toBe(13);
    expect(peutEncoreAvancer(etapes)).toBe(false);
  });

  it("la contagion se propage EN CHAÎNE, pas seulement d'un cran", () => {
    const etapes = [
      e("a", "FAILED", [], 3, 3), e("b", "PENDING", ["a"]), e("c", "PENDING", ["b"]), e("d", "PENDING", ["c"]),
    ];
    expect([...etapesEnImpasse(etapes)].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("une branche INDÉPENDANTE de l'échec survit — sinon un seul échec tuerait tout le plan", () => {
    const etapes = [
      e("mort", "FAILED", [], 3, 3), e("aval", "PENDING", ["mort"]),
      e("autre", "PENDING", []), e("suite-autre", "PENDING", ["autre"]),
    ];
    expect([...etapesEnImpasse(etapes)].sort()).toEqual(["aval", "mort"]);
    expect(peutEncoreAvancer(etapes)).toBe(true);
  });

  it("une étape IGNORÉE ne contamine RIEN — ses descendantes partent (§37)", () => {
    // CE QUI FERAIT TOMBER CE TEST : ranger SKIPPED parmi les morts. Une branche délibérément
    // écartée entraînerait toute sa suite, et le plan mourrait de fonctionner comme prévu.
    const etapes = [e("ignoree", "SKIPPED"), e("apres", "PENDING", ["ignoree"])];
    expect(etapesEnImpasse(etapes).size).toBe(0);
    expect(peutEncoreAvancer(etapes)).toBe(true);
  });

  it("une étape en ATTENTE n'est jamais en impasse — un événement peut la réveiller", () => {
    // CE QUI FERAIT TOMBER CE TEST : compter WAITING comme mort. On fermerait une mission que
    // la réponse attendue allait débloquer — le faux échec symétrique du faux succès.
    const etapes = [e("mort", "FAILED", [], 3, 3), e("attente", "WAITING", ["mort"])];
    expect([...etapesEnImpasse(etapes)]).toEqual(["mort"]);
    expect(peutEncoreAvancer(etapes)).toBe(true);
  });

  it("un échec qui a ENCORE des tentatives ne condamne pas sa descendance", () => {
    const etapes = [e("a", "FAILED", [], 1, 3), e("b", "PENDING", ["a"])];
    expect(etapesEnImpasse(etapes).size).toBe(0);
    expect(peutEncoreAvancer(etapes)).toBe(true);
  });

  it("aucun mort : aucune impasse, et la fonction ne parcourt rien", () => {
    expect(etapesEnImpasse([e("a", "PENDING"), e("b", "DONE")]).size).toBe(0);
  });
});

describe("peutEncoreAvancer — le LOT jugé et le GRAPHE entier sont deux choses", () => {
  it("une étape du jalon condamnée par un mort d'un AUTRE jalon est bien vue morte", () => {
    // Ne regarder que le lot ferait manquer la contagion qui vient d'à côté : `suite` n'a
    // aucune dépendance DANS son lot, et serait comptée comme du travail à venir.
    const toutes = [e("amont-jalon-1", "FAILED", [], 3, 3), e("suite", "PENDING", ["amont-jalon-1"])];
    const lot = [toutes[1]!];
    expect(peutEncoreAvancer(lot, toutes)).toBe(false);
    expect(peutEncoreAvancer(lot, lot)).toBe(true);
  });

  it("un lot ENTIÈREMENT terminé ne peut plus avancer — c'est le cas nominal", () => {
    expect(peutEncoreAvancer([e("a", "DONE"), e("b", "SKIPPED")])).toBe(false);
  });

  it("une seule étape vivante suffit à ne pas conclure (§118.9)", () => {
    expect(peutEncoreAvancer([e("a", "DONE"), e("b", "FAILED", [], 3, 3), e("c", "READY")])).toBe(true);
  });
});
