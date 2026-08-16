import { describe, it, expect } from "vitest";
import { startTimer, formatTiming, slowestPhase } from "./timing";

/** Horloge pilotée : on mesure la mesure, sans attendre. */
function fakeClock(steps: number[]) {
  let i = 0;
  let t = 0;
  return () => {
    const v = t;
    t += steps[i] ?? 0;
    i += 1;
    return v;
  };
}

describe("Le découpage d'un téléversement", () => {
  it("attribue à chaque étape le temps qui la sépare de la précédente", () => {
    // t0=0, puis marques à 100, 400, 450
    const timer = startTimer(fakeClock([100, 300, 50, 0]));
    timer.mark("réception");
    timer.mark("stockage");
    timer.mark("base");
    const t = timer.done("objet", 1048576);
    expect(t.phases).toEqual([
      { name: "réception", ms: 100 },
      { name: "stockage", ms: 300 },
      { name: "base", ms: 50 },
    ]);
  });

  it("dit OÙ les octets sont partis — la réponse la plus utile du diagnostic", () => {
    const t = startTimer(fakeClock([10, 0])).done("base", 0);
    expect(t.backend).toBe("base");
  });

  it("calcule un débit comparable d'un envoi à l'autre", () => {
    // 10 Mo en 2 s → 5 Mo/s
    const timer = startTimer(fakeClock([2000, 0]));
    const t = timer.done("objet", 10 * 1048576);
    expect(t.totalMs).toBe(2000);
    expect(t.throughputMbs).toBe(5);
  });

  it("un envoi instantané ne rend pas un débit infini", () => {
    // Contenu déjà présent : rien n'a transité, la division serait par zéro.
    const t = startTimer(fakeClock([0, 0])).done("objet", 5_000_000);
    expect(Number.isFinite(t.throughputMbs)).toBe(true);
    expect(t.throughputMbs).toBe(0);
  });

  it("sans aucune étape, le total reste mesuré", () => {
    const t = startTimer(fakeClock([42, 0])).done("objet", 0);
    expect(t.phases).toEqual([]);
    expect(t.totalMs).toBe(42);
  });
});

describe("La ligne qu'on colle dans un message", () => {
  const timing = () => {
    const timer = startTimer(fakeClock([120, 4000, 30, 0]));
    timer.mark("réception");
    timer.mark("stockage");
    timer.mark("base");
    return timer.done("base", 20 * 1048576);
  };

  it("annonce l'étape la PLUS COÛTEUSE en premier — la réponse dès le premier mot", () => {
    const line = formatTiming(timing());
    expect(line.indexOf("stockage 4000 ms")).toBeLessThan(line.indexOf("réception 120 ms"));
  });

  it("porte la taille, le débit et le backend", () => {
    const line = formatTiming(timing());
    expect(line).toContain("20.0 Mo");
    expect(line).toContain("stockage base");
  });

  it("nomme le coupable", () => {
    expect(slowestPhase(timing())?.name).toBe("stockage");
    expect(slowestPhase(startTimer(fakeClock([1, 0])).done("objet", 0))).toBeNull();
  });
});
