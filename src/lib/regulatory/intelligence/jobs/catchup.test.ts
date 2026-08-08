import { describe, it, expect } from "vitest";
import { shouldCatchUpAi, batchStillFresh, BATCH_FRESH_MS, type AiCatchupState } from "./catchup";

/**
 * Le rattrapage relance des analyses PAYANTES sur des dossiers existants. Deux erreurs seraient
 * graves et opposées : ne rien rattraper (le dossier garde l'air propre sans revue de fond), ou
 * rattraper en boucle (une facture qui court toute seule). Ces tests figent la frontière.
 */
const base: AiCatchupState = {
  deterministicDone: true,
  aiFindings: 0,
  aiJobActive: false,
  freshBatchInFlight: false,
  alreadyCaughtUp: false,
};

describe("shouldCatchUpAi", () => {
  it("rattrape une version dont la revue de fond n'a jamais rien livré", () => {
    expect(shouldCatchUpAi(base)).toBe(true);
  });

  it("ne rattrape JAMAIS deux fois — pas de boucle payante", () => {
    expect(shouldCatchUpAi({ ...base, alreadyCaughtUp: true })).toBe(false);
  });

  it("ne double pas un travail en cours (job de revue en file)", () => {
    expect(shouldCatchUpAi({ ...base, aiJobActive: true })).toBe(false);
  });

  it("laisse livrer un lot différé encore en vol", () => {
    expect(shouldCatchUpAi({ ...base, freshBatchInFlight: true })).toBe(false);
  });

  it("laisse le pipeline finir : pas de rattrapage avant le bilan déterministe", () => {
    expect(shouldCatchUpAi({ ...base, deterministicDone: false })).toBe(false);
  });

  it("ne touche pas une version qui a DÉJÀ des constats de fond", () => {
    expect(shouldCatchUpAi({ ...base, aiFindings: 12 })).toBe(false);
  });
});

describe("batchStillFresh", () => {
  const now = Date.now();

  it("un lot déposé il y a 2 h va encore livrer", () => {
    expect(batchStillFresh(new Date(now - 2 * 3600_000), now)).toBe(true);
  });

  it("un lot déposé il y a 30 h ne reviendra plus — on rattrape", () => {
    expect(batchStillFresh(new Date(now - 30 * 3600_000), now)).toBe(false);
  });

  it("la frontière est bien à 26 h (au-delà de la promesse des 24 h)", () => {
    expect(batchStillFresh(new Date(now - BATCH_FRESH_MS + 60_000), now)).toBe(true);
    expect(batchStillFresh(new Date(now - BATCH_FRESH_MS - 60_000), now)).toBe(false);
  });
});
