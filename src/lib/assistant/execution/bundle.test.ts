import { describe, it, expect, vi } from "vitest";
import {
  executeBundle,
  referencesPrevious,
  bundleMessage,
  type BundleItem,
  type RunOne,
} from "./bundle";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE LOT D'EXÉCUTION — ce que ces tests protègent.
 *
 * C'est le code le plus dangereux du produit : il enchaîne des MUTATIONS. Les tests portent donc
 * moins sur « ça marche » que sur les trois refus :
 *
 *   • une action CRITIQUE ne s'enchaîne jamais, et son refus se DIT ;
 *   • un échec n'entraîne pas ce qui est indépendant…
 *   • …mais entraîne ce qui en dépend, plutôt que de le faire tourner sur un état inexistant ;
 *   • et rien n'est jamais annoncé comme fait quand ça ne l'est pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const item = (over: Partial<BundleItem> & { intentId: string }): BundleItem => ({
  title: `Action ${over.intentId}`,
  level: "NORMAL",
  dependsOnPrevious: false,
  ...over,
});

const ok = (message = "Fait.") => ({ ok: true, message });
const ko = (error = "Refusé.") => ({ ok: false, error });

describe("détection de dépendance — on relit la convention existante, on n'en invente pas une seconde", () => {
  it("repère « $prev » à la racine", () => {
    expect(referencesPrevious({ taskId: "$prev.id" })).toBe(true);
  });

  it("le repère IMBRIQUÉ — un payload est rarement plat", () => {
    expect(referencesPrevious({ a: { b: [{ c: "voir $prev.reference" }] } })).toBe(true);
  });

  it("ne voit pas de dépendance là où il n'y en a pas", () => {
    expect(referencesPrevious({ titre: "Relancer Nadia", montant: 1500 })).toBe(false);
    expect(referencesPrevious(null)).toBe(false);
    expect(referencesPrevious("previsionnel")).toBe(false); // « prev » sans le « $ »
  });
});

describe("le chemin nominal", () => {
  it("exécute tout, dans l'ordre proposé", async () => {
    const seen: string[] = [];
    const run: RunOne = async (id) => { seen.push(id); return ok(); };
    const r = await executeBundle([item({ intentId: "a" }), item({ intentId: "b" }), item({ intentId: "c" })], run);

    expect(seen).toEqual(["a", "b", "c"]); // l'ordre EST l'information de dépendance
    expect(r.ok).toBe(true);
    expect(r.executed).toBe(3);
    expect(r.message).toContain("3 actions sont faites");
  });

  /** L'idempotence du garde remonte telle quelle : un rejeu n'est pas une seconde exécution. */
  it("une action déjà exécutée compte comme faite, sans être relancée", async () => {
    const r = await executeBundle([item({ intentId: "a" })], async () => ({ ok: true, alreadyExecuted: true, message: "Déjà exécutée." }));
    expect(r.outcomes[0].status).toBe("already");
    expect(r.ok).toBe(true);
  });
});

describe("règle 1 — une action CRITIQUE ne s'enchaîne jamais", () => {
  it("elle est refusée sans être exécutée", async () => {
    const run = vi.fn<RunOne>(async () => ok());
    const r = await executeBundle([item({ intentId: "danger", level: "CRITICAL" })], run);

    expect(run).not.toHaveBeenCalled();
    expect(r.outcomes[0].status).toBe("refused");
    expect(r.ok).toBe(false);
  });

  /** Un lot qui tait ce qu'il n'a pas fait est pire qu'un lot qui échoue. */
  it("son refus est DIT dans le compte rendu, pas passé sous silence", async () => {
    const r = await executeBundle(
      [item({ intentId: "a" }), item({ intentId: "paie", title: "Modifier le salaire", level: "CRITICAL" })],
      async () => ok(),
    );
    expect(r.message).toContain("Modifier le salaire");
    expect(r.message).toMatch(/critique/i);
    expect(r.held).toBe(1);
  });

  it("les actions NORMALES du même lot passent quand même", async () => {
    const r = await executeBundle(
      [item({ intentId: "a" }), item({ intentId: "crit", level: "CRITICAL" }), item({ intentId: "b" })],
      async () => ok(),
    );
    expect(r.executed).toBe(2);
    expect(r.outcomes.map((o) => o.status)).toEqual(["executed", "refused", "executed"]);
  });
});

describe("règles 2 et 3 — l'échec s'arrête là où commence la dépendance", () => {
  /** Si le mail ne part pas, le rappel de vendredi n'a aucune raison de tomber avec lui. */
  it("un échec n'entraîne PAS ce qui est indépendant", async () => {
    const r = await executeBundle(
      [item({ intentId: "mail" }), item({ intentId: "rappel" })],
      async (id) => (id === "mail" ? ko("boîte indisponible") : ok()),
    );
    expect(r.outcomes.map((o) => o.status)).toEqual(["failed", "executed"]);
    expect(r.executed).toBe(1);
    expect(r.failed).toBe(1);
  });

  /** Exécuter une étape sur un état qui n'existe pas est pire que ne pas l'exécuter. */
  it("un échec entraîne CE QUI EN DÉPEND, sans le tenter", async () => {
    const run = vi.fn<RunOne>(async (id: string) => (id === "creer" ? ko() : ok()));
    const r = await executeBundle(
      [item({ intentId: "creer" }), item({ intentId: "lier", dependsOnPrevious: true })],
      run,
    );
    expect(run).toHaveBeenCalledTimes(1); // « lier » n'a jamais été tenté
    expect(r.outcomes[1].status).toBe("skipped");
    expect(r.message).toMatch(/non tentée/i);
  });

  it("une CRITIQUE refusée bloque aussi ce qui dépendait d'elle", async () => {
    const r = await executeBundle(
      [item({ intentId: "crit", level: "CRITICAL" }), item({ intentId: "suite", dependsOnPrevious: true })],
      async () => ok(),
    );
    expect(r.outcomes.map((o) => o.status)).toEqual(["refused", "skipped"]);
  });

  it("après une réussite, la dépendance suivante repart normalement", async () => {
    const r = await executeBundle(
      [item({ intentId: "a" }), item({ intentId: "b", dependsOnPrevious: true })],
      async () => ok(),
    );
    expect(r.outcomes.map((o) => o.status)).toEqual(["executed", "executed"]);
  });
});

describe("le compte rendu ne ment jamais", () => {
  it("un lot à moitié fait n'est PAS « ok »", async () => {
    const r = await executeBundle(
      [item({ intentId: "a" }), item({ intentId: "b" })],
      async (id) => (id === "b" ? ko() : ok()),
    );
    expect(r.ok).toBe(false);
    expect(r.message).toContain("1 sur 2");
  });

  it("un lot entièrement raté le dit franchement", async () => {
    const r = await executeBundle([item({ intentId: "a" }), item({ intentId: "b" })], async () => ko("refusé"));
    expect(r.message).toContain("Rien n'a été exécuté");
  });

  it("chaque échec nomme SON action et SA raison", async () => {
    const r = await executeBundle(
      [item({ intentId: "x", title: "Envoyer le mail à Amine" })],
      async () => ko("boîte non configurée"),
    );
    expect(r.message).toContain("Envoyer le mail à Amine");
    expect(r.message).toContain("boîte non configurée");
  });

  /** Un intent inconnu (expiré, ou d'un autre compte) ne doit surtout pas passer pour un succès. */
  it("un intent introuvable est un ÉCHEC, jamais un silence", async () => {
    const r = await executeBundle([item({ intentId: "fantome" })], async () => null);
    expect(r.outcomes[0].status).toBe("failed");
    expect(r.ok).toBe(false);
  });

  it("une exception de l'exécuteur devient un échec nommé, pas un plantage du lot", async () => {
    const r = await executeBundle(
      [item({ intentId: "boom" }), item({ intentId: "ok" })],
      async (id) => { if (id === "boom") throw new Error("réseau"); return ok(); },
    );
    expect(r.outcomes[0].status).toBe("failed");
    expect(r.outcomes[1].status).toBe("executed"); // le lot continue
  });

  it("un lot vide ne prétend pas avoir travaillé", async () => {
    const r = await executeBundle([], async () => ok());
    expect(r.ok).toBe(false);
    expect(bundleMessage([])).toBe("Rien à exécuter.");
  });
});
