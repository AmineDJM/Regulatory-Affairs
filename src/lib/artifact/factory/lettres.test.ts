import { describe, expect, it } from "vitest";
import { montantEnLettres, nombreEnLettres } from "@/lib/artifact/factory/lettres";

describe("les nombres en lettres — l'usage bancaire algérien", () => {
  it.each([
    [0, "zéro"], [1, "un"], [17, "dix-sept"], [20, "vingt"], [21, "vingt et un"], [31, "trente et un"],
    [70, "soixante-dix"], [71, "soixante et onze"], [72, "soixante-douze"], [80, "quatre-vingts"], [81, "quatre-vingt-un"],
    [90, "quatre-vingt-dix"], [91, "quatre-vingt-onze"], [99, "quatre-vingt-dix-neuf"],
    [100, "cent"], [101, "cent un"], [180, "cent quatre-vingts"], [200, "deux cents"], [201, "deux cent un"], [999, "neuf cent quatre-vingt-dix-neuf"],
    [1000, "mille"], [1001, "mille un"], [1100, "mille cent"], [2000, "deux mille"], [80_000, "quatre-vingt mille"], [200_000, "deux cent mille"],
    [41_300, "quarante et un mille trois cents"], [1_000_000, "un million"], [2_000_000, "deux millions"], [1_000_000_000, "un milliard"],
    [1_234_567_891, "un milliard deux cent trente-quatre millions cinq cent soixante-sept mille huit cent quatre-vingt-onze"],
  ])("%d → %s", (n, attendu) => {
    expect(nombreEnLettres(n)).toBe(attendu);
  });

  it("refuse ce qui n'est pas un nombre écrivable", () => {
    expect(() => nombreEnLettres(-1)).toThrow();
    expect(() => nombreEnLettres(Number.NaN)).toThrow();
    expect(() => nombreEnLettres(1e12)).toThrow();
  });
});

describe("les montants en lettres", () => {
  it("écrit dinars et centimes, accordés", () => {
    expect(montantEnLettres(41_300.5)).toBe("quarante et un mille trois cents dinars algériens et cinquante centimes");
    expect(montantEnLettres(1)).toBe("un dinar algérien");
    expect(montantEnLettres(2)).toBe("deux dinars algériens");
    expect(montantEnLettres(0.01)).toBe("zéro dinar algérien et un centime");
    expect(montantEnLettres(1_000_000)).toBe("un million dinars algériens");
  });
  it("arrondit au centime avant d'écrire — jamais « et zéro centime »", () => {
    expect(montantEnLettres(12.999)).toBe("treize dinars algériens");
    expect(montantEnLettres(12.004)).toBe("douze dinars algériens");
  });
});
