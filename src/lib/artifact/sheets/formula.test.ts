import { describe, expect, it } from "vitest";
import { afficher, analyser, decaler, fonctionsDe, formeR1C1, nomsDe, referencesDe, tokeniser, traduireFormulePartagee } from "@/lib/artifact/sheets/formula";
import { a1DePlage, cleDe, coordDeA1, coordDeCle, lettresDeColonne, plageDeA1 } from "@/lib/artifact/sheets/refs";

describe("références A1", () => {
  it("convertit lettres ↔ colonnes et lit les plages, colonnes et lignes entières", () => {
    expect(lettresDeColonne(1)).toBe("A"); expect(lettresDeColonne(26)).toBe("Z"); expect(lettresDeColonne(27)).toBe("AA"); expect(lettresDeColonne(16384)).toBe("XFD");
    expect(coordDeA1("$B$7")).toEqual({ row: 7, col: 2 });
    expect(plageDeA1("D20:B4")).toEqual({ r1: 4, c1: 2, r2: 20, c2: 4 });
    expect(a1DePlage(plageDeA1("A:C")!)).toBe("A:C");
    expect(a1DePlage(plageDeA1("3:5")!)).toBe("3:5");
    expect(coordDeA1("A0")).toBeNull();
    const k = cleDe(123456, 789); expect(coordDeCle(k)).toEqual({ row: 123456, col: 789 });
  });
});

describe("l'analyseur de formules", () => {
  it("lit nombres, textes, erreurs, booléens, références simples, plages, feuilles citées, externes", () => {
    const n = analyser("=IF('Ma feuille'!$A$1>0,Ventes!B2:B10,\"n/a\")")!;
    expect(n.k).toBe("call");
    const refs = referencesDe(n);
    expect(refs.map((r) => afficher({ k: "ref", ref: r }))).toEqual(["'Ma feuille'!$A$1", "Ventes!B2:B10"]);
    expect(analyser("=#DIV/0!")).toEqual({ k: "err", v: "#DIV/0!" });
    expect(analyser("=TRUE")).toEqual({ k: "bool", v: true });
    expect(analyser("=[1]Externe!A1")!.k).toBe("ref");
    expect(referencesDe(analyser("=SUM(A:A)+SUM(3:3)")!).map((r) => r.type)).toEqual(["col", "row"]);
  });

  it("respecte les priorités d'Excel : -2^2 = 4, ^ à gauche, % postfixé, & après +", () => {
    expect(afficher(analyser("=-2^2")!)).toBe("-2^2");
    const n = analyser("=-2^2")!;
    expect(n).toEqual({ k: "bin", op: "^", g: { k: "un", op: "-", a: { k: "num", v: 2 } }, d: { k: "num", v: 2 } });
    expect(analyser("=2^3^2")).toEqual({ k: "bin", op: "^", g: { k: "bin", op: "^", g: { k: "num", v: 2 }, d: { k: "num", v: 3 } }, d: { k: "num", v: 2 } });
    expect(analyser("=A1*10%")).toEqual({ k: "bin", op: "*", g: { k: "ref", ref: expect.objectContaining({ r1: 1, c1: 1 }) }, d: { k: "pct", a: { k: "num", v: 10 } } });
    expect(afficher(analyser("=\"a\"&1+2")!)).toBe("\"a\"&1+2");
    expect(analyser("=\"a\"&1+2")!.k).toBe("bin");
  });

  it("accepte le séparateur français, les arguments omis et les constantes de tableau", () => {
    expect(afficher(analyser("=SI(A1;B1;C1)")!)).toBe("SI(A1,B1,C1)");
    const omis = analyser("=IF(A1,,B1)")!;
    expect(omis.k === "call" && omis.args[1]).toEqual({ k: "name", nom: "" });
    expect(afficher(analyser("=SUM({1,2;3,4})")!)).toBe("SUM({1,2;3,4})");
  });

  it("rend null sur ce qu'il ne lit pas à coup sûr — jamais un arbre approximatif", () => {
    expect(analyser("=Tableau1[Montant]")).toBeNull();
    expect(analyser("=SUM(A1:A3")).toBeNull();
    expect(analyser("=A1 B1")).toBeNull();
    expect(analyser("=\"non fermé")).toBeNull();
    expect(tokeniser("=1 +\t2")).toHaveLength(3);
  });

  it("nomme fonctions et noms définis", () => {
    const n = analyser("=IFERROR(VLOOKUP(A2,Tarifs,2,FALSE)*TauxTVA,0)")!;
    expect([...fonctionsDe(n)]).toEqual(["IFERROR", "VLOOKUP"]);
    expect([...nomsDe(n)]).toEqual(["Tarifs", "TauxTVA"]);
  });
});

describe("la forme R1C1 et le décalage", () => {
  it("deux formules du même motif ont la même forme R1C1 ; une absolue garde son ancrage", () => {
    expect(formeR1C1("=B2*C2", { row: 2, col: 4 })).toBe("R[-2]C[-2]*R[-2]C[-1]".replace("R[-2]C[-2]", "RC[-2]").replace("R[-2]C[-1]", "RC[-1]"));
    expect(formeR1C1("=B2*C2", { row: 2, col: 4 })).toBe(formeR1C1("=B3*C3", { row: 3, col: 4 }));
    expect(formeR1C1("=B2*$C$1", { row: 2, col: 4 })).toBe("RC[-2]*R1C3");
    expect(formeR1C1("=SUM(A:A)", { row: 5, col: 3 })).toBe("SUM(C[-2]:C[-2])");
    expect(formeR1C1("=B2*C2", { row: 2, col: 4 })).not.toBe(formeR1C1("=B2*D2", { row: 2, col: 4 }));
  });

  it("décale les références relatives seulement, et rend #REF! quand on sort de la feuille", () => {
    expect(afficher(decaler(analyser("=A1+$A$1+Feuil2!B$2")!, 2, 1))).toBe("B3+$A$1+Feuil2!C$2");
    expect(afficher(decaler(analyser("=A1")!, -1, 0))).toBe("#REF!");
    expect(traduireFormulePartagee("B2*C2", { row: 2, col: 4 }, { row: 7, col: 4 })).toBe("B7*C7");
  });
});
