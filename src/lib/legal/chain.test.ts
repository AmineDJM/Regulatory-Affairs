import { describe, it, expect } from "vitest";
import {
  chainOf, nextChainKind, missingKinds, delayDays, delayLabel, amountDrift, type ChainDoc,
} from "./chain";

const d = (id: string, kind: string, chainFromId: string | null = null): ChainDoc => ({ id, kind, chainFromId });

describe("Le fil d'un dossier d'achat", () => {
  const devis = d("q1", "QUOTE");
  const bc = d("b1", "PURCHASE_ORDER", "q1");
  const facture = d("f1", "INVOICE", "b1");
  const all = [devis, bc, facture];

  it("depuis n'importe quel maillon, on lit le fil ENTIER, dans l'ordre", () => {
    // C'est le point : ouvrir la facture doit montrer d'où elle vient, pas obliger à remonter
    // les fiches une à une.
    for (const start of ["q1", "b1", "f1"]) {
      expect(chainOf(all, start).map((x) => x.id)).toEqual(["q1", "b1", "f1"]);
    }
  });

  it("un devis à DEUX bons de commande : chaque BC remonte au devis, sans mélanger les branches", () => {
    const b2 = d("b2", "PURCHASE_ORDER", "q1");
    const f2 = d("f2", "INVOICE", "b2");
    const docs = [devis, bc, facture, b2, f2];
    // Depuis b2 : sa branche à lui — jamais celle de b1.
    expect(chainOf(docs, "b2").map((x) => x.id)).toEqual(["q1", "b2", "f2"]);
    expect(chainOf(docs, "b1").map((x) => x.id)).toEqual(["q1", "b1", "f1"]);
    // Depuis le devis : deux suites ex æquo ne se départagent pas — on s'arrête au devis
    // plutôt que d'afficher une branche choisie au hasard.
    expect(chainOf(docs, "q1").map((x) => x.id)).toEqual(["q1"]);
  });

  it("un cycle (erreur de saisie) ne gèle pas l'écran", () => {
    const a = d("a", "QUOTE", "b");
    const b = d("b", "PURCHASE_ORDER", "a");
    expect(chainOf([a, b], "a").length).toBeLessThanOrEqual(2);
  });

  it("une pièce inconnue rend un fil vide", () => {
    expect(chainOf(all, "nope")).toEqual([]);
  });
});

describe("Ce qui suit, ce qui manque", () => {
  it("propose la pièce suivante : devis → BC → facture, puis plus rien", () => {
    expect(nextChainKind("QUOTE")).toBe("PURCHASE_ORDER");
    expect(nextChainKind("PURCHASE_ORDER")).toBe("INVOICE");
    expect(nextChainKind("INVOICE")).toBeNull();
    expect(nextChainKind("CONTRACT")).toBeNull();
  });

  it("nomme les maillons manquants — ce qu'il reste à produire", () => {
    expect(missingKinds([d("q", "QUOTE")])).toEqual(["PURCHASE_ORDER", "INVOICE"]);
    expect(missingKinds([d("q", "QUOTE"), d("b", "PURCHASE_ORDER", "q"), d("f", "INVOICE", "b")])).toEqual([]);
  });
});

describe("Les délais — la question que pose la Direction", () => {
  it("compte en jours pleins, dans les deux sens", () => {
    expect(delayDays("2026-08-01", "2026-08-12")).toBe(11);
    expect(delayDays("2026-08-12", "2026-08-10")).toBe(-2);
    expect(delayDays(null, "2026-08-12")).toBeNull();
  });

  it("écrit un délai lisible — « +11 j » se lit, deux dates se calculent de tête et on ne le fait jamais", () => {
    expect(delayLabel(11)).toBe("+11 j");
    expect(delayLabel(0)).toBe("le jour même");
    expect(delayLabel(-2)).toBe("−2 j");
    expect(delayLabel(null)).toBeNull();
  });
});

describe("L'écart devis / facture — LE chiffre qu'on vérifie avant de payer", () => {
  it("mesure la dérive", () => {
    expect(amountDrift(100_000, 118_000)).toBe(18_000);
    expect(amountDrift(100_000, 90_000)).toBe(-10_000);
  });
  it("ne compare pas l'incomparable", () => {
    expect(amountDrift(null, 90_000)).toBeNull();
    expect(amountDrift(0, 90_000)).toBeNull();
  });
});
