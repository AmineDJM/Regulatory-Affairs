import { PRODUCTION_SAFETY_PHRASE, WRITE_MODES, type RunConfig, type TestRunMode } from "./types";

/**
 * Gardes de sûreté (§1, §11-12). Par défaut, la production est en LECTURE SEULE : toute
 * exécution qui crée des données synthétiques y exige une confirmation explicite + une
 * phrase de sécurité. Hors production, `SAFE_SYNTHETIC_TEST` est autorisé.
 */

export function resolveEnvironment(): "production" | "staging" | "development" {
  const explicit = (process.env.TEST_CENTER_ENV || "").toLowerCase();
  if (explicit === "production" || explicit === "staging" || explicit === "development") return explicit;
  if (process.env.RENDER === "true" || process.env.NODE_ENV === "production") {
    return process.env.STAGING === "true" ? "staging" : "production";
  }
  return "development";
}

export interface GuardResult { ok: boolean; environment: string; error?: string }

/** Autorise (ou non) un mode dans l'environnement courant, avec les gardes production. */
export function guardMode(mode: TestRunMode, config: RunConfig): GuardResult {
  const environment = resolveEnvironment();
  const writes = WRITE_MODES.includes(mode);

  if (environment === "production" && writes) {
    if (!config.productionConfirmed) {
      return { ok: false, environment, error: "En production, un test avec création de données exige une confirmation explicite (productionConfirmed)." };
    }
    if (config.safetyPhrase !== PRODUCTION_SAFETY_PHRASE) {
      return { ok: false, environment, error: `Phrase de sécurité invalide. Saisir exactement : « ${PRODUCTION_SAFETY_PHRASE} ».` };
    }
  }
  return { ok: true, environment };
}
