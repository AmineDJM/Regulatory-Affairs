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
  catchupCount: 0,
  lastReviewFailed: false,
};

describe("shouldCatchUpAi", () => {
  it("rattrape une version dont la revue de fond n'a jamais rien livré", () => {
    expect(shouldCatchUpAi(base)).toBe(true);
  });

  it("ne rattrape pas deux fois un dossier légitimement sans constat — pas de boucle payante", () => {
    expect(shouldCatchUpAi({ ...base, catchupCount: 1 })).toBe(false);
  });

  /**
   * La distinction qui compte : « aucun constat » et « l'analyse n'a jamais eu lieu » produisent
   * le même écran vide, mais pas la même conduite. Quand une panne a fait échouer la revue, la
   * corriger doit suffire à réparer les dossiers qu'elle a laissés — sans un clic par dossier.
   */
  it("accorde une SECONDE chance quand la revue a échoué techniquement", () => {
    expect(shouldCatchUpAi({ ...base, catchupCount: 1, lastReviewFailed: true })).toBe(true);
  });

  it("mais s'arrête là : une panne durable ne doit pas boucler", () => {
    expect(shouldCatchUpAi({ ...base, catchupCount: 2, lastReviewFailed: true })).toBe(false);
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
