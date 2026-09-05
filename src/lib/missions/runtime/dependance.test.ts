import { describe, expect, it } from "vitest";
import { dependanceSatisfaite } from "@/lib/missions/runtime/engine";

/**
 * UNE DÉPENDANCE MORTE NE RETIENT PAS UNE SYNTHÈSE QUI A DU MATÉRIAU — mais retient une
 * écriture, et retient une synthèse qui n'aurait RIEN à synthétiser.
 *
 * Le banc l'a montré : une lecture de pièces en échec définitif tenait en otage l'analyse,
 * l'accord et le contrôle d'une enquête de facture (sept lectures réussies à côté) ; la mission
 * finissait BLOQUÉE sans conclure. Et le sabotage inversé (`bypassed-dependency.test.ts`) tient
 * l'autre bord : « conclure malgré tout » à partir d'un amont mort et de rien d'autre, c'est
 * inventer — la mission doit passer BLOCKED et se replanifier.
 */
const morte = { status: "FAILED" as const, attempt: 2, maxAttempts: 2, contournee: false };
const vivante = { status: "FAILED" as const, attempt: 1, maxAttempts: 2, contournee: false };
const faite = { status: "DONE" as const, attempt: 1, maxAttempts: 2, contournee: false };

describe("dépendances — ce qui laisse passer", () => {
  it("une étape faite, sautée ou contournée laisse passer tout le monde, matériau ou pas", () => {
    for (const materiel of [true, false]) {
      expect(dependanceSatisfaite(faite, { nodeType: "CAPABILITY" }, materiel)).toBe(true);
      expect(dependanceSatisfaite({ ...faite, status: "SKIPPED" }, { nodeType: "CAPABILITY" }, materiel)).toBe(true);
      expect(dependanceSatisfaite({ ...vivante, contournee: true }, { nodeType: "CAPABILITY" }, materiel)).toBe(true);
    }
  });
  it("une étape morte laisse passer un worker, un contrôle, une jonction, un artefact QUI ONT DU MATÉRIAU — pas une capacité", () => {
    for (const nodeType of ["WORKER", "QA", "JOIN", "ARTIFACT"]) expect(dependanceSatisfaite(morte, { nodeType }, true)).toBe(true);
    expect(dependanceSatisfaite(morte, { nodeType: "CAPABILITY" }, true)).toBe(false);
    expect(dependanceSatisfaite(morte, { nodeType: "WAIT_EVENT" }, true)).toBe(false);
  });
  it("une étape morte RETIENT une synthèse qui n'a aucun autre amont abouti : sans matériau, on n'invente pas", () => {
    for (const nodeType of ["WORKER", "QA", "JOIN", "ARTIFACT"]) expect(dependanceSatisfaite(morte, { nodeType }, false)).toBe(false);
  });
  it("une étape en échec qui a encore des tentatives retient tout le monde", () => {
    expect(dependanceSatisfaite(vivante, { nodeType: "WORKER" }, true)).toBe(false);
    expect(dependanceSatisfaite({ ...vivante, status: "RUNNING" }, { nodeType: "WORKER" }, true)).toBe(false);
  });
});
