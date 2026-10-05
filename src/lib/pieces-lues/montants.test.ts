import { describe, expect, it } from "vitest";
import { analyserNombre, analyserPourcentage, montantLu, pourcentageLu } from "@/lib/pieces-lues/montants";

describe("montantLu — un nombre imprimé se lit, il ne se devine pas (lot D2)", () => {
  it("lit les milliers séparés par une espace, une insécable ou une fine insécable", () => {
    expect(montantLu("1 234 567,89")).toBe(1_234_567.89);
    expect(montantLu("1\u00a0234\u00a0567,89")).toBe(1_234_567.89);
    expect(montantLu("1\u202f234\u202f567,89")).toBe(1_234_567.89);
    expect(montantLu("150 955,00")).toBe(150_955);
    expect(montantLu("1 234.5")).toBe(1_234.5);
  });

  it("le DERNIER séparateur est décimal quand les deux conventions se croisent", () => {
    expect(montantLu("1.234.567,89")).toBe(1_234_567.89);
    expect(montantLu("1,234,567.89")).toBe(1_234_567.89);
    expect(montantLu("1.234,5")).toBe(1_234.5);
    expect(montantLu("1,234.567")).toBe(1_234.567);
    // Un séparateur RÉPÉTÉ ne peut pas être décimal : ce sont des milliers.
    expect(montantLu("1.234.567")).toBe(1_234_567);
    expect(montantLu("1,234,567")).toBe(1_234_567);
  });

  it("« 1.200 » et « 1,200 » sont ILLISIBLES — 1 200 ou 1,2 : on ne choisit pas", () => {
    for (const t of ["1.200", "1,200", "12.500", "999,999"]) {
      const n = analyserNombre(t);
      expect(n.valeur, t).toBeNull();
      expect(n.raison, t).toMatch(/ambigu/);
    }
    expect(analyserNombre("1.200").raison).toContain("1 200 ou 1,2 ?");
    // Ce qui n'est PAS ambigu se lit : on n'écrit pas « 0 » millier, et des milliers se groupent par trois.
    expect(montantLu("0,125")).toBe(0.125);
    expect(montantLu("1234,567")).toBe(1_234.567);
    expect(montantLu("12,5")).toBe(12.5);
    expect(montantLu("0,10")).toBe(0.1);
    expect(montantLu("1200")).toBe(1_200);
  });

  it("les négatifs, les signes, les parenthèses et l'écriture scientifique sont illisibles", () => {
    for (const t of ["-5", "\u22125", "+5", "(5)", "1e3", "12 kg", "5,-"]) {
      const n = analyserNombre(t);
      expect(n.valeur, t).toBeNull();
      expect(n.raison, t).not.toBeNull();
    }
    expect(analyserNombre("-5").raison).toMatch(/signe/);
  });

  it("accepte un suffixe de dinar (DA, D.A., DZD), et aucune autre devise", () => {
    expect(montantLu("961 345,00 DA")).toBe(961_345);
    expect(montantLu("15 890 DZD")).toBe(15_890);
    // Devis imprimés à l'anglo-saxonne : la devise en PRÉFIXE, virgule des milliers, point décimal.
    expect(montantLu("DZD 300,000.00")).toBe(300_000);
    expect(montantLu("DZD 100,000.00")).toBe(100_000);
    expect(montantLu("DA 1 200,50")).toBe(1_200.5);
    expect(montantLu("1 500 D.A.")).toBe(1_500);
    expect(montantLu("1 200 EUR")).toBeNull();
    expect(analyserNombre("12 DA", { devise: false }).valeur).toBeNull();
  });

  it("un texte vide est une ABSENCE — ni un zéro, ni une illisibilité ; une valeur déjà convertie est refusée", () => {
    expect(analyserNombre("")).toEqual({ valeur: null, raison: null });
    expect(analyserNombre("   ")).toEqual({ valeur: null, raison: null });
    expect(analyserNombre(null)).toEqual({ valeur: null, raison: null });
    expect(analyserNombre(undefined)).toEqual({ valeur: null, raison: null });
    // Le modèle qui rend 1200 a déjà tranché l'ambiguïté qu'on lui demandait de recopier : on ne peut plus vérifier.
    expect(analyserNombre(1200).valeur).toBeNull();
    expect(analyserNombre(1200).raison).toMatch(/en texte/);
  });

  it("refuse des milliers irréguliers, un nombre démesuré ou trop de décimales", () => {
    for (const t of ["12 34", "1.23.456", "1 234 56", "1234567890123", "1,23456", ",5", "5,"]) {
      expect(montantLu(t), t).toBeNull();
      expect(analyserNombre(t).raison, t).not.toBeNull();
    }
  });

  it("lit un taux en POUR CENT et le rend en fraction", () => {
    expect(pourcentageLu("19 %")).toBe(0.19);
    expect(pourcentageLu("19,00 %")).toBe(0.19);
    expect(pourcentageLu("9")).toBe(0.09);
    expect(pourcentageLu("2%")).toBe(0.02);
    expect(pourcentageLu("0")).toBe(0);
    expect(pourcentageLu("")).toBeNull();
    expect(analyserPourcentage("")).toEqual({ valeur: null, raison: null });
    expect(analyserPourcentage("101 %").raison).toMatch(/100 %/);
    expect(analyserPourcentage("19.000 %").raison).toContain("« 19.000 % »");
  });
});
