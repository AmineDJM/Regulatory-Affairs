import { describe, expect, it } from "vitest";
import {
  avancement, dependancesSatisfaites, frontiere, incoherences, type Jalon,
} from "@/lib/missions/horizon/jalon";

const j = (o: number, p: Partial<Jalon> = {}): Jalon => ({
  ordre: o, titre: `Jalon ${o}`, resultat: `Le résultat ${o} est constatable`,
  statut: "PENDING", planVersion: 0, dependsOn: [], ...p,
});

describe("la frontière d'exécution", () => {
  it("part sur TOUS les jalons sans dépendance — deux collectes indépendantes ne s'attendent pas", () => {
    const f = frontiere([j(1), j(2), j(3, { dependsOn: [1, 2] })]);
    expect(f.courants.map((x) => x.ordre)).toEqual([1, 2]);
    expect(f.enAttente.map((x) => x.ordre)).toEqual([3]);
  });

  it("`aCompiler` ne retient que ceux qui n'ont PAS de sous-plan — c'est la paresse", () => {
    const f = frontiere([j(1, { statut: "ACTIVE", planVersion: 2 }), j(2)]);
    expect(f.courants.map((x) => x.ordre)).toEqual([1, 2]);
    expect(f.aCompiler.map((x) => x.ordre)).toEqual([2]);
  });

  it("un jalon ÉCARTÉ libère sa descendance — « finalement pas de PowerPoint » ne bloque pas la suite", () => {
    const f = frontiere([j(1, { statut: "SKIPPED" }), j(2, { dependsOn: [1] })]);
    expect(f.courants.map((x) => x.ordre)).toEqual([2]);
  });

  it("un jalon ANNULÉ ne libère PAS : ce qui en dépendait n'a pas ses entrées", () => {
    const f = frontiere([j(1, { statut: "CANCELLED" }), j(2, { dependsOn: [1] })]);
    expect(f.courants).toEqual([]);
    expect(f.enAttente.map((x) => x.ordre)).toEqual([2]);
  });

  it("un jalon BLOQUÉ n'est PAS terminé : la mission ne peut pas conclure dessus", () => {
    const f = frontiere([j(1, { statut: "DONE" }), j(2, { statut: "BLOCKED" })]);
    expect(f.termine).toBe(false);
    // Il n'est pas non plus « courant » : le moteur ne le relancerait pas seul.
    expect(f.courants).toEqual([]);
  });

  it("terminé quand tout est DONE / SKIPPED / CANCELLED, et seulement là", () => {
    expect(frontiere([j(1, { statut: "DONE" }), j(2, { statut: "SKIPPED" })]).termine).toBe(true);
    expect(frontiere([]).termine).toBe(false);
  });

  it("une dépendance vers un rang qui n'existe pas ne satisfait RIEN — le silence n'est pas une permission", () => {
    expect(dependancesSatisfaites(j(2, { dependsOn: [9] }), [j(2, { dependsOn: [9] })])).toBe(false);
  });
});

describe("l'avancement", () => {
  it("sort les annulés du dénominateur — sinon une mission réduite paraît en retard", () => {
    const a = avancement([
      j(1, { statut: "DONE" }), j(2, { statut: "DONE" }),
      j(3, { statut: "CANCELLED" }), j(4),
    ]);
    expect(a.total).toBe(4);
    expect(a.aboutis).toBe(2);
    expect(a.annules).toBe(1);
    expect(a.restants).toBe(1);
    expect(a.part).toBeCloseTo(2 / 3, 5);
  });

  it("compte les bloqués À PART des restants — l'agrégat cacherait ce qu'il faut regarder", () => {
    const a = avancement([j(1, { statut: "BLOCKED" }), j(2)]);
    expect(a.bloques).toBe(1);
    expect(a.part).toBe(0);
  });
});

describe("le découpage tient-il debout", () => {
  it("accepte un découpage sain", () => {
    expect(incoherences([j(1), j(2, { dependsOn: [1] })])).toEqual([]);
  });

  it("refuse un découpage vide", () => {
    expect(incoherences([]).map((i) => i.code)).toEqual(["VIDE"]);
  });

  it("refuse un cycle, et le NOMME une seule fois", () => {
    const out = incoherences([
      j(1, { dependsOn: [3] }), j(2, { dependsOn: [1] }), j(3, { dependsOn: [2] }),
    ]);
    const cycles = out.filter((i) => i.code === "CYCLE");
    expect(cycles).toHaveLength(1);
    expect(cycles[0].message).toContain("1 → 3 → 2");
  });

  it("refuse l'auto-dépendance", () => {
    const out = incoherences([j(1, { dependsOn: [1] })]);
    expect(out.some((i) => i.code === "CYCLE" && i.message.includes("dépend de lui-même"))).toBe(true);
  });

  it("refuse une dépendance morte", () => {
    const out = incoherences([j(1), j(2, { dependsOn: [9] })]);
    expect(out.map((i) => i.code)).toContain("DEPENDANCE_MORTE");
  });

  it("refuse deux jalons au même rang", () => {
    const out = incoherences([j(1), { ...j(1), titre: "Doublon" }]);
    expect(out.map((i) => i.code)).toContain("RANG_DOUBLE");
  });

  it("refuse un jalon sans résultat constatable — sinon sa fin ne peut être que « ça a tourné »", () => {
    const out = incoherences([j(1, { resultat: "   " })]);
    expect(out.map((i) => i.code)).toContain("RESULTAT_ABSENT");
  });

  it("dit TOUT ce qu'il sait en une fois — jamais une objection par tour (§118.18)", () => {
    const out = incoherences([
      j(1, { resultat: "" }),
      j(2, { dependsOn: [9] }),
      j(3, { dependsOn: [4] }), j(4, { dependsOn: [3] }),
    ]);
    const codes = new Set(out.map((i) => i.code));
    expect(codes.has("RESULTAT_ABSENT")).toBe(true);
    expect(codes.has("DEPENDANCE_MORTE")).toBe(true);
    expect(codes.has("CYCLE")).toBe(true);
  });
});
