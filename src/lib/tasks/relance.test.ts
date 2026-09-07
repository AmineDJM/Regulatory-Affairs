import { describe, it, expect } from "vitest";
import {
  peutRelancer, relanceOuverte, prochaineRelance, relanceTitre, taskActions,
  RELANCE_DELAI_MS,
} from "./request-flow";

const T0 = Date.parse("2026-09-01T08:00:00Z");
const demande = (over: Record<string, unknown> = {}) => ({
  status: "REQUESTED",
  requestedAt: new Date(T0).toISOString(),
  createdById: "amine",
  assignedToId: "raihana",
  ...over,
});

describe("relancer une demande — qui, et quand", () => {
  it("le demandeur peut relancer une fois le délai écoulé", () => {
    expect(peutRelancer(demande(), "amine", T0 + RELANCE_DELAI_MS + 1)).toEqual({ ok: true });
  });

  it("refuse AVANT le délai, et dit dans combien de temps", () => {
    const v = peutRelancer(demande(), "amine", T0 + 60_000);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.raison).toContain("4 h");
  });

  it("le délai court aussi depuis la DERNIÈRE relance, pas seulement depuis la demande", () => {
    const t = demande({ lastNudgeAt: new Date(T0 + 10 * 3_600_000).toISOString(), nudgeCount: 1 });
    // Douze heures après la demande, mais deux heures seulement après la relance.
    expect(peutRelancer(t, "amine", T0 + 12 * 3_600_000).ok).toBe(false);
    expect(peutRelancer(t, "amine", T0 + 15 * 3_600_000).ok).toBe(true);
  });

  it("le destinataire ne se relance pas lui-même, et un tiers ne relance pas à la place du demandeur", () => {
    const tard = T0 + RELANCE_DELAI_MS + 1;
    expect(peutRelancer(demande(), "raihana", tard).ok).toBe(false);
    expect(peutRelancer(demande(), "yacine", tard).ok).toBe(false);
    // Une demande qu'on s'est faite à soi-même n'a personne à relancer.
    expect(peutRelancer(demande({ assignedToId: "amine" }), "amine", tard).ok).toBe(false);
  });

  it("une demande CLOSE ne se relance plus — il n'y a plus personne à rappeler", () => {
    const tard = T0 + RELANCE_DELAI_MS + 1;
    for (const status of ["DONE", "DECLINED", "CANCELLED"]) {
      expect(relanceOuverte(demande({ status }))).toBe(false);
      expect(peutRelancer(demande({ status }), "amine", tard).ok).toBe(false);
    }
    // Acceptée et en cours : le travail se fait toujours attendre, la relance a un sens.
    expect(relanceOuverte(demande({ status: "IN_PROGRESS" }))).toBe(true);
    expect(peutRelancer(demande({ status: "IN_PROGRESS" }), "amine", tard)).toEqual({ ok: true });
  });

  it("une tâche ORDINAIRE (qu'on s'est donnée) n'a pas de relance", () => {
    const todo = { status: "TODO", createdById: "amine", assignedToId: "amine" };
    expect(relanceOuverte(todo)).toBe(false);
    expect(taskActions(todo, "amine")).not.toContain("relance");
  });

  it("le bouton s'affiche AU DEMANDEUR même trop tôt — c'est le serveur qui explique le refus", () => {
    const t = demande();
    expect(taskActions(t, "amine")).toContain("relance");
    // …et jamais au destinataire, qui a déjà « Accepter / Refuser ».
    expect(taskActions(t, "raihana")).not.toContain("relance");
  });

  it("sans horodatage de demande, aucun délai à attendre", () => {
    const t = { status: "IN_PROGRESS", requestedAt: new Date(T0).toISOString(), createdById: "a", assignedToId: "b" };
    expect(prochaineRelance(t)).toBe(T0 + RELANCE_DELAI_MS);
    expect(prochaineRelance({ status: "TODO" })).toBeNull();
  });

  it("le rang se dit tel quel — « 3ᵉ relance » n'est pas « relance »", () => {
    expect(relanceTitre(1)).toBe("Relance : votre demande attend");
    expect(relanceTitre(3)).toBe("3ᵉ relance : votre demande attend");
  });
});
