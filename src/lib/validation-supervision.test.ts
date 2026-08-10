import { describe, it, expect } from "vitest";
import {
  urgencyOf, sortByUrgency, supervisionCounters, filterSupervised, daysSince, daysLeft,
  STALLED_DAYS, type SupervisedRow,
} from "./validation-supervision";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const row = (over: Partial<SupervisedRow> = {}): SupervisedRow => ({
  id: "r1", reference: "VAL-2026-001", title: "Courrier à signer", module: "Secrétariat",
  requester: "Radia", amount: null, priority: "MEDIUM", createdAt: daysAgo(1), deadline: null,
  blockingValidator: null, blockingStepId: null, blockingOrder: null, ...over,
});

describe("daysSince / daysLeft", () => {
  it("comptent en jours entiers, dans le bon sens", () => {
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
    expect(daysLeft(inDays(2), NOW)).toBe(2);
    expect(daysLeft(daysAgo(2), NOW)).toBeLessThan(0);
  });

  it("ne produisent pas de NaN sur une date illisible", () => {
    expect(daysSince("pas une date", NOW)).toBe(0);
    expect(daysLeft("", NOW)).toBe(0);
  });
});

describe("urgencyOf", () => {
  it("met le retard avant tout", () => {
    expect(urgencyOf(row({ deadline: daysAgo(1) }), NOW)).toBe("OVERDUE");
  });

  it("signale l'échéance proche tant qu'elle est encore rattrapable", () => {
    expect(urgencyOf(row({ deadline: inDays(2) }), NOW)).toBe("DUE_SOON");
    expect(urgencyOf(row({ deadline: inDays(30) }), NOW)).toBe("NORMAL");
  });

  it("repère l'ENLISEMENT : pas d'échéance, mais personne ne décide", () => {
    expect(urgencyOf(row({ createdAt: daysAgo(STALLED_DAYS) }), NOW)).toBe("STALLED");
    expect(urgencyOf(row({ createdAt: daysAgo(STALLED_DAYS - 1) }), NOW)).toBe("NORMAL");
  });

  it("le retard l'emporte sur l'enlisement (une demande peut être les deux)", () => {
    expect(urgencyOf(row({ createdAt: daysAgo(30), deadline: daysAgo(2) }), NOW)).toBe("OVERDUE");
  });
});

describe("sortByUrgency", () => {
  it("classe retard → échéance proche → enlisée → normale", () => {
    const rows = [
      row({ id: "normal" }),
      row({ id: "stalled", createdAt: daysAgo(10) }),
      row({ id: "overdue", deadline: daysAgo(1) }),
      row({ id: "soon", deadline: inDays(1) }),
    ];
    expect(sortByUrgency(rows, NOW).map((r) => r.id)).toEqual(["overdue", "soon", "stalled", "normal"]);
  });

  it("à urgence égale, la PLUS VIEILLE passe devant (l'inverse de l'ordre chronologique naïf)", () => {
    const rows = [
      row({ id: "recent", createdAt: daysAgo(1) }),
      row({ id: "ancienne", createdAt: daysAgo(4) }),
    ];
    expect(sortByUrgency(rows, NOW).map((r) => r.id)).toEqual(["ancienne", "recent"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const rows = [row({ id: "a" }), row({ id: "b", deadline: daysAgo(1) })];
    sortByUrgency(rows, NOW);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("supervisionCounters", () => {
  it("compte chaque demande dans UNE seule catégorie et cumule les montants", () => {
    const rows = [
      row({ deadline: daysAgo(1), amount: 1000 }),
      row({ deadline: inDays(1), amount: 2000 }),
      row({ createdAt: daysAgo(20), amount: 500 }),
      row({ amount: null }),
    ];
    const c = supervisionCounters(rows, NOW);
    expect(c).toEqual({ total: 4, overdue: 1, dueSoon: 1, stalled: 1, amountPending: 3500 });
  });

  it("rend des zéros sur une liste vide", () => {
    expect(supervisionCounters([], NOW)).toEqual({ total: 0, overdue: 0, dueSoon: 0, stalled: 0, amountPending: 0 });
  });
});

describe("filterSupervised", () => {
  const rows = [
    row({ id: "a", reference: "VAL-1", title: "Paiement prestataire", blockingValidator: "Karim" }),
    row({ id: "b", reference: "VAL-2", title: "Courrier", module: "Regulatory", deadline: daysAgo(1) }),
  ];

  it("filtre par urgence", () => {
    expect(filterSupervised(rows, NOW, "OVERDUE", "").map((r) => r.id)).toEqual(["b"]);
    expect(filterSupervised(rows, NOW, "ALL", "").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("cherche aussi sur LE VALIDATEUR QUI BLOQUE — « qu'est-ce qui attend Karim ? »", () => {
    expect(filterSupervised(rows, NOW, "ALL", "karim").map((r) => r.id)).toEqual(["a"]);
  });

  it("cherche sur la référence, l'objet, le module et le demandeur", () => {
    expect(filterSupervised(rows, NOW, "ALL", "val-2").map((r) => r.id)).toEqual(["b"]);
    expect(filterSupervised(rows, NOW, "ALL", "prestataire").map((r) => r.id)).toEqual(["a"]);
    expect(filterSupervised(rows, NOW, "ALL", "regulatory").map((r) => r.id)).toEqual(["b"]);
    expect(filterSupervised(rows, NOW, "ALL", "radia").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("ignore la casse et les espaces autour", () => {
    expect(filterSupervised(rows, NOW, "ALL", "  COURRIER ").map((r) => r.id)).toEqual(["b"]);
  });
});
