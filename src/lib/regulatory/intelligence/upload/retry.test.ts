import { describe, it, expect } from "vitest";
import { isRetryableHttpStatus, backoffMs, RETRYABLE_HTTP_STATUSES } from "./retry";

/**
 * Politique de retente d'upload — logique PURE (aucun réseau). Garantit qu'un échec transitoire
 * (5xx proxy) est réessayé et qu'une erreur métier (4xx) ne l'est PAS, et que le backoff croît puis
 * se plafonne (pas de martèlement ni d'attente infinie).
 */
describe("upload/retry — classification + backoff", () => {
  it("réessaie les 5xx transitoires, jamais les 4xx métier ni un succès", () => {
    for (const s of [500, 502, 503, 504, 507, 522, 524]) expect(isRetryableHttpStatus(s)).toBe(true);
    for (const s of [200, 201, 204, 400, 401, 403, 404, 409, 413, 422]) expect(isRetryableHttpStatus(s)).toBe(false);
    // Le jeu exposé et le prédicat sont cohérents.
    for (const s of RETRYABLE_HTTP_STATUSES) expect(isRetryableHttpStatus(s)).toBe(true);
  });

  it("backoff exponentiel croissant puis plafonné à 16 s", () => {
    expect(backoffMs(0)).toBe(500);
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(4)).toBe(8000);
    expect(backoffMs(5)).toBe(16000);
    expect(backoffMs(6)).toBe(16000); // plafond tenu
    expect(backoffMs(50)).toBe(16000);
    for (let a = 0; a < 40; a++) expect(backoffMs(a)).toBeLessThanOrEqual(16000);
  });
});
