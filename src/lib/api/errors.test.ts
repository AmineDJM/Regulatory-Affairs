import { describe, it, expect } from "vitest";
import { ApiError, errors, fromActionResult, API_ERROR_CODES } from "./errors";

describe("erreurs de l'API", () => {
  it("porte un code STABLE et le bon statut HTTP", () => {
    expect(new ApiError("NOT_FOUND", "x").status).toBe(404);
    expect(new ApiError("MISSING_SCOPE", "x").status).toBe(403);
    expect(Object.keys(API_ERROR_CODES).length).toBeGreaterThan(10);
  });

  it("dit QUELLE portée manque, pas seulement qu'il en manque une", () => {
    const e = errors.missingScope(["erp.write", "erp.read"], ["erp.read"]);
    expect(e.message).toContain("erp.write");
    expect(e.message).not.toContain("erp.read»");
  });

  it("un objet hors portée répond « introuvable » — la réponse ne révèle pas son existence", () => {
    expect(errors.notFound("Dossier").status).toBe(404);
    expect(errors.notFound().body().error.hint).toMatch(/ne révèle pas/i);
  });

  it("distingue un refus de DROIT d'une donnée invalide — les suites ne sont pas les mêmes", () => {
    expect(fromActionResult({ ok: false, error: "Non autorisé." }).code).toBe("FORBIDDEN");
    expect(fromActionResult({ ok: false, error: "Réservé à la supervision Regulatory." }).code).toBe("FORBIDDEN");
    expect(fromActionResult({ ok: false, error: "Indiquez le montant." }).code).toBe("VALIDATION_FAILED");
  });

  it("joint l'identifiant de corrélation au corps, pour qu'un agent puisse le citer", () => {
    expect(errors.internal().body("corr-1").error.correlationId).toBe("corr-1");
  });

  it("un rejeu avec un contenu différent est un CONFLIT, pas un rejeu", () => {
    expect(errors.idempotencyMismatch().status).toBe(409);
  });
});
