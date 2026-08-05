import { describe, expect, it } from "vitest";
import { rankToday } from "./today";
import type { ActionItem } from "./action-center";

/**
 * L'écran « Aujourd'hui » ne montre qu'UNE action en tête. Tout repose donc sur le
 * classement : si le mauvais élément remonte, l'écran ment. Ces tests figent les règles.
 */

const NOW = new Date("2026-08-05T09:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function item(over: Partial<ActionItem> & { key: string }): ActionItem {
  return {
    title: over.key, subtitle: "", module: "Test", href: "/x",
    kind: "task", priority: null, deadline: null, owner: "",
    statusLabel: null, statusTone: null,
    ...over,
  };
}

describe("Aujourd'hui — classement des actions", () => {
  it("ce qui est EN RETARD passe devant tout le reste", () => {
    const ranked = rankToday([
      item({ key: "today", deadline: day(0.2) }),
      item({ key: "late", deadline: day(-2) }),
      item({ key: "critique", priority: "CRITICAL" }),
    ], NOW);
    expect(ranked[0].key).toBe("late");
    expect(ranked[0].reason).toBe("overdue");
  });

  it("plus le retard dure, plus la ligne remonte", () => {
    const ranked = rankToday([
      item({ key: "hier", deadline: day(-1) }),
      item({ key: "depuis15j", deadline: day(-15) }),
    ], NOW);
    expect(ranked.map((r) => r.key)).toEqual(["depuis15j", "hier"]);
  });

  it("à échéance égale, une validation (qui bloque un collègue) passe avant une tâche perso", () => {
    const ranked = rankToday([
      item({ key: "matache", kind: "task", deadline: day(2) }),
      item({ key: "validation", kind: "validation", deadline: day(2) }),
    ], NOW);
    expect(ranked[0].key).toBe("validation");
  });

  it("sans échéance, une validation en attente reste signalée comme bloquante", () => {
    const [first] = rankToday([item({ key: "v", kind: "validation" })], NOW);
    expect(first.reason).toBe("blocking");
    expect(first.reasonLabel).toBe("Quelqu'un attend votre validation");
  });

  it("la priorité départage deux éléments par ailleurs identiques", () => {
    const ranked = rankToday([
      item({ key: "normale" }),
      item({ key: "haute", priority: "HIGH" }),
      item({ key: "critique", priority: "CRITICAL" }),
    ], NOW);
    expect(ranked.map((r) => r.key)).toEqual(["critique", "haute", "normale"]);
  });

  it("chaque ligne porte une raison lisible — jamais un classement muet", () => {
    const ranked = rankToday([
      item({ key: "a", deadline: day(-1) }),
      item({ key: "b", deadline: day(0.5) }),
      item({ key: "c", deadline: day(2) }),
      item({ key: "d" }),
    ], NOW);
    expect(ranked.map((r) => r.reason)).toEqual(["overdue", "today", "soon", "open"]);
    for (const r of ranked) expect(r.reasonLabel.length).toBeGreaterThan(0);
  });

  it("une liste vide reste vide (pas d'élément fantôme)", () => {
    expect(rankToday([], NOW)).toEqual([]);
  });
});
