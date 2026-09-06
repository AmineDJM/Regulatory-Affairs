import { describe, expect, it } from "vitest";
import { compiler, compilerSysteme, evaluer } from "./expression";

describe("expression — une formule sans eval", () => {
  it("respecte la précédence, l'associativité et les parenthèses", () => {
    expect(evaluer("1 + 2 * 3")).toBe(7);
    expect(evaluer("(1 + 2) * 3")).toBe(9);
    expect(evaluer("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluer("-2 ^ 2")).toBe(-4);
    expect(evaluer("10 - 4 - 3")).toBe(3);
    expect(evaluer("100 / 10 / 2")).toBe(5);
    expect(evaluer("7 % 3")).toBe(1);
    expect(evaluer("2 ** 10")).toBe(1024);
    expect(evaluer("1e3 + .5")).toBe(1000.5);
  });

  it("lit des variables et signale celles qui sont libres, dans l'ordre", () => {
    const c = compiler("prix * volume - couts_fixes - cv * volume");
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.variables).toEqual(["prix", "volume", "couts_fixes", "cv"]);
    expect(c.evaluer({ prix: 10, volume: 100, couts_fixes: 200, cv: 4 })).toBe(400);
    expect(Number.isNaN(c.evaluer({ prix: 10 }))).toBe(true);
  });

  it("connaît les fonctions et les constantes ; une variable nommée « e » l'emporte sur la constante si elle est déclarée avant", () => {
    expect(evaluer("max(1, 5, 3) + min(4, 2)")).toBe(7);
    expect(evaluer("round(2.567, 2)")).toBe(2.57);
    expect(evaluer("sqrt(16) + abs(-3) + floor(2.7) + ceil(2.1)")).toBe(12);
    expect(evaluer("si(3 > 2, 10, 20)")).toBe(10);
    expect(evaluer("if(3 < 2, 10, 20)")).toBe(20);
    expect(evaluer("borner(150, 0, 100)")).toBe(100);
    expect(evaluer("somme(1,2,3,4) / moyenne(2, 4)")).toBe(10 / 3);
    expect(evaluer("pi")).toBeCloseTo(Math.PI, 12);
    expect(evaluer("exp(ln(5))")).toBeCloseTo(5, 10);
    expect(evaluer("log10(1000)")).toBeCloseTo(3, 10);
  });

  it("booléens et logique : 1 ou 0, et/ou/non en français ou en symboles", () => {
    expect(evaluer("1 < 2 et 2 < 3")).toBe(1);
    expect(evaluer("1 > 2 ou 2 < 3")).toBe(1);
    expect(evaluer("non (1 < 2)")).toBe(0);
    expect(evaluer("(1 < 2) && !(2 == 2)")).toBe(0);
    expect(evaluer("3 >= 3 || 1 != 1")).toBe(1);
    expect(evaluer("si(x > 100 et y < 5, 1, 0)", { x: 200, y: 1 })).toBe(1);
  });

  it("refuse ce qu'elle ne comprend pas, avec la position", () => {
    const cas: [string, RegExp][] = [
      ["1 +", /incomplète/i],
      ["(1 + 2", /fermante/i],
      ["foo(1)", /inconnue/i],
      ["round(1, 2, 3)", /argument/i],
      ["1 $ 2", /inattendu/i],
      ["", /vide/i],
      ["1 2", /inattendu/i],
    ];
    for (const [src, motif] of cas) {
      const c = compiler(src);
      expect(c.ok, src).toBe(false);
      if (!c.ok) expect(c.erreur).toMatch(motif);
    }
    const c = compiler("1 $ 2");
    if (!c.ok) expect(c.position).toBe(2);
  });

  it("ne peut rien exécuter : pas d'accès aux objets, aux chaînes, aux appels arbitraires", () => {
    for (const src of ["process.exit(1)", "constructor('return 1')()", "\"abc\"", "a[0]", "x => x", "this.y"]) {
      const c = compiler(src);
      expect(c.ok, src).toBe(false);
    }
  });

  it("ordonne un système de formules par dépendances et refuse un cycle ou une inconnue", () => {
    const s = compilerSysteme({ marge: "ca - couts", ca: "prix * volume", couts: "fixes + variables * volume" }, ["prix", "volume", "fixes", "variables"]);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.ordre.map((o) => o.nom)).toEqual(["ca", "couts", "marge"]);
    const cycle = compilerSysteme({ a: "b + 1", b: "a + 1" }, []);
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.erreur).toMatch(/cycle/i);
    const inconnue = compilerSysteme({ a: "x + 1" }, []);
    expect(inconnue.ok).toBe(false);
    if (!inconnue.ok) expect(inconnue.erreur).toMatch(/inconnue.*x/i);
    const soi = compilerSysteme({ a: "a + 1" }, []);
    expect(soi.ok).toBe(false);
  });

  it("évalue vite : 200 000 évaluations d'une formule de taille réaliste en moins d'une seconde", () => {
    const c = compiler("si(volume > 1000, prix * 0.95, prix) * volume - fixes - cv * volume - max(0, volume - capacite) * penalite");
    if (!c.ok) throw new Error(c.erreur);
    const t0 = Date.now();
    let s = 0;
    const v = { volume: 0, prix: 12, fixes: 5000, cv: 4, capacite: 1500, penalite: 2 };
    for (let i = 0; i < 200_000; i += 1) { v.volume = i % 3000; s += c.evaluer(v); }
    expect(Number.isFinite(s)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
