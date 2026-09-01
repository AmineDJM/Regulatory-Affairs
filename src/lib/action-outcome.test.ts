import { describe, it, expect } from "vitest";
import { actionFailureMessage, ACTION_TIMEOUT_MS } from "./action-outcome";

describe("ce qu'on dit quand une action ne revient pas", () => {
  it("les deux causes se distinguent — « n'a pas répondu » n'est pas « a échoué »", () => {
    expect(actionFailureMessage("TIMEOUT")).toMatch(/n'a pas répondu/i);
    expect(actionFailureMessage("THROWN")).toMatch(/n'a pas abouti/i);
  });

  it("le message N'INVITE JAMAIS à réessayer — c'est ce réflexe qui fabrique les doublons", () => {
    // Plusieurs actions enregistrent D'ABORD puis font le lent (pièces, journal, notifications).
    // L'objet est donc souvent créé alors que l'écran n'a rien dit : « réessayez » serait le
    // pire conseil possible.
    for (const kind of ["TIMEOUT", "THROWN"] as const) {
      const m = actionFailureMessage(kind);
      expect(m, kind).not.toMatch(/réessay|recommenc(ez|er)\b(?!.*créerait)/i);
      expect(m, kind).toMatch(/vérifiez/i);
      expect(m, kind).toMatch(/doublon/i);
    }
  });

  it("le délai laisse passer un envoi lent mais valide", () => {
    // Assez long pour un lot de pièces jointes sur une connexion médiocre, assez court pour que
    // personne ne reste devant un écran qu'il croit cassé.
    expect(ACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(ACTION_TIMEOUT_MS).toBeLessThanOrEqual(90_000);
  });
});
