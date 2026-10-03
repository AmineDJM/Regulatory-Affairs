import { describe, expect, it } from "vitest";
import { refusDuStatutManuel, refusDeReouverture, STATUTS_MANUELS, estStatutManuel } from "./statut-manuel";

/** Ce qu'un gestionnaire pose à la main — et ce qui a son geste (§118.191, audit 360° R12). */
describe("Le statut à la main : seulement ce qui n'a pas d'autre geste", () => {
  const r = (courant: string, cible: string, motif: string | null = null) => refusDuStatutManuel({ courant, cible, motif });

  it("quatre statuts se posent à la main — et eux seuls", () => {
    expect([...STATUTS_MANUELS].sort()).toEqual(["AWAITING_DOCUMENT", "AWAITING_EXTERNAL", "BLOCKED", "IN_PROGRESS"]);
    for (const s of ["NEW", "DONE", "CANCELLED", "AWAITING_VALIDATION", "AWAITING_PAYMENT", "INVENTÉ"]) expect(estStatutManuel(s)).toBe(false);
  });

  it("terminer et annuler ont leur porte, et le refus la nomme", () => {
    expect(r("IN_PROGRESS", "DONE")).toMatch(/« Fin de la demande »/);
    expect(r("IN_PROGRESS", "CANCELLED")).toMatch(/« Annuler la demande »/);
  });

  it("une demande terminée se rouvre par son geste ; une annulée ne se rouvre pas", () => {
    expect(r("DONE", "IN_PROGRESS")).toMatch(/« Rouvrir »/);
    expect(r("CANCELLED", "IN_PROGRESS")).toMatch(/ne se rouvre pas/);
  });

  it("l'ÉTAT D'ABORD : une demande close refuse avant même de regarder la cible", () => {
    expect(r("CANCELLED", "DONE")).toMatch(/ne se rouvre pas/);
    expect(r("DONE", "BLOCKED")).toMatch(/« Rouvrir »/);
  });

  it("une demande qui attend une décision reprend quand la décision tombe", () => {
    expect(r("AWAITING_VALIDATION", "IN_PROGRESS")).toMatch(/attend une validation/);
    expect(r("AWAITING_PAYMENT", "BLOCKED", "x")).toMatch(/attend une approbation/);
  });

  it("une demande neuve se prend en charge — mais peut attendre un tiers ou être bloquée", () => {
    expect(r("NEW", "IN_PROGRESS")).toMatch(/Commencer le traitement/);
    expect(r("NEW", "AWAITING_EXTERNAL")).toBeNull();
    expect(r("NEW", "BLOCKED", "pièce manquante")).toBeNull();
  });

  it("bloquer exige son motif — et lui seul ; reprendre n'en exige pas", () => {
    expect(r("IN_PROGRESS", "BLOCKED")).toMatch(/Dites ce qui bloque/);
    expect(r("BLOCKED", "IN_PROGRESS")).toBeNull();
    expect(r("AWAITING_DOCUMENT", "IN_PROGRESS")).toBeNull();
  });

  it("le même état n'est pas un changement", () => {
    expect(r("BLOCKED", "BLOCKED", "x")).toBe("La demande est déjà dans cet état.");
  });
});

describe("Rouvrir : une demande terminée, avec son motif", () => {
  it("seulement terminée ; jamais annulée ; le motif après l'état", () => {
    expect(refusDeReouverture({ courant: "DONE", motif: "x" })).toBeNull();
    expect(refusDeReouverture({ courant: "CANCELLED", motif: null })).toMatch(/ne se rouvre pas/);
    expect(refusDeReouverture({ courant: "IN_PROGRESS", motif: null })).toBe("Seule une demande terminée se rouvre.");
    expect(refusDeReouverture({ courant: "DONE", motif: null })).toMatch(/Dites pourquoi/);
  });
});
