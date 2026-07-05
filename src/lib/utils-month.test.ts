import { describe, it, expect } from "vitest";
import { formatMonth, nextMonthYm } from "@/lib/utils";

describe("Mois des notes de frais (formatMonth / nextMonthYm)", () => {
  it("formate un YYYY-MM en mois français", () => {
    expect(formatMonth("2026-07")).toBe("juillet 2026");
    expect(formatMonth("2026-01")).toBe("janvier 2026");
  });

  it("retourne — pour une valeur absente ou invalide", () => {
    expect(formatMonth(null)).toBe("—");
    expect(formatMonth("")).toBe("—");
    expect(formatMonth("2026-7")).toBe("—");
    expect(formatMonth("juillet")).toBe("—");
  });

  it("calcule le mois suivant, y compris au passage d'année", () => {
    expect(nextMonthYm("2026-07")).toBe("2026-08");
    expect(nextMonthYm("2026-12")).toBe("2027-01");
    expect(nextMonthYm("2026-01")).toBe("2026-02");
  });
});
