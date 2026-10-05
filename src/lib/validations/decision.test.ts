import { describe, expect, it } from "vitest";
import { issueDeLaDecision, motifExige, repriseApresCorrection, resoumissionSurPlace } from "./decision";

const e = (id: string, order: number, status: string) => ({ id, order, status });

describe("La décision d'une étape et la reprise d'une demande renvoyée — règles pures (audit 360°, R08)", () => {
  it("le motif est exigé pour renvoyer ou refuser, jamais pour valider", () => {
    expect(motifExige("APPROVED")).toBe(false);
    expect(motifExige("CHANGES_REQUESTED")).toBe(true);
    expect(motifExige("REJECTED")).toBe(true);
  });

  it("un refus ou un renvoi s'applique à toute la demande", () => {
    const d = { mode: "SEQUENTIAL", currentOrder: 1, steps: [e("a", 1, "REJECTED"), e("b", 2, "PENDING")] };
    expect(issueDeLaDecision(d, "a", "REJECTED").status).toBe("REJECTED");
    expect(issueDeLaDecision({ ...d, steps: [e("a", 1, "CHANGES_REQUESTED"), e("b", 2, "PENDING")] }, "a", "CHANGES_REQUESTED").status).toBe("CHANGES_REQUESTED");
  });

  it("séquentiel : un accord passe à l'étape suivante encore en attente, et valide au bout du circuit", () => {
    const d = { mode: "SEQUENTIAL", currentOrder: 1, steps: [e("a", 1, "APPROVED"), e("b", 2, "PENDING")] };
    expect(issueDeLaDecision(d, "a", "APPROVED")).toEqual({ status: "PENDING", currentOrder: 2, suivanteId: "b" });
    const fin = { mode: "SEQUENTIAL", currentOrder: 2, steps: [e("a", 1, "APPROVED"), e("b", 2, "APPROVED")] };
    expect(issueDeLaDecision(fin, "b", "APPROVED")).toEqual({ status: "APPROVED", currentOrder: 2, suivanteId: null });
  });

  it("parallèle : validée quand TOUTES les étapes le sont — lu sur les étapes relues, où l'autre accord est déjà là", () => {
    const enAttente = { mode: "PARALLEL", currentOrder: 1, steps: [e("a", 1, "APPROVED"), e("b", 1, "PENDING")] };
    expect(issueDeLaDecision(enAttente, "a", "APPROVED").status).toBe("PENDING");
    const relue = { mode: "PARALLEL", currentOrder: 1, steps: [e("a", 1, "APPROVED"), e("b", 1, "APPROVED")] };
    expect(issueDeLaDecision(relue, "b", "APPROVED").status).toBe("APPROVED");
  });

  it("la reprise rouvre l'étape qui a renvoyé, garde l'accord d'avant, et reprend là", () => {
    const d = { mode: "SEQUENTIAL", currentOrder: 2, steps: [e("a", 1, "APPROVED"), e("b", 2, "CHANGES_REQUESTED"), e("c", 3, "PENDING")] };
    expect(repriseApresCorrection(d, 100, 100)).toEqual({ aRouvrir: ["b"], currentOrder: 2, montantReleve: false });
  });

  it("un montant RELEVÉ rouvre aussi les accords déjà donnés ; une baisse non", () => {
    const d = { mode: "SEQUENTIAL", currentOrder: 2, steps: [e("a", 1, "APPROVED"), e("b", 2, "CHANGES_REQUESTED")] };
    expect(repriseApresCorrection(d, 100, 150)).toEqual({ aRouvrir: ["a", "b"], currentOrder: 1, montantReleve: true });
    expect(repriseApresCorrection(d, 100, 80).aRouvrir).toEqual(["b"]);
    expect(repriseApresCorrection(d, null, 150).montantReleve, "sans montant d'avant, rien ne se compare").toBe(false);
  });

  it("une demande ne se corrige sur elle-même que si rien d'autre ne la porte", () => {
    expect(resoumissionSurPlace({ entityType: null, documentId: null })).toBe(true);
    expect(resoumissionSurPlace({ entityType: "LEGAL_DOCUMENT", documentId: null })).toBe(false);
    expect(resoumissionSurPlace({ entityType: null, documentId: "doc" })).toBe(false);
  });
});
