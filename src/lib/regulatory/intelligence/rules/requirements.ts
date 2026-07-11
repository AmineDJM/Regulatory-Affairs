import type { RegProcedureType } from "@prisma/client";

/**
 * EXIGENCES DE COMPLÉTUDE CTD par type de procédure (Algérie/ANPP + socle ICH).
 * `required` = sections dont l'absence est un **bloqueur** (CRITICAL) ; `expected` =
 * attendues (MAJOR si absentes). Volontairement prudent : mieux vaut un manque signalé
 * qu'une fausse conformité. Le pharmacien reste seul juge de la levée d'une réserve.
 */

export interface Requirements {
  required: string[];
  expected: string[];
}

// Socle commun à un enregistrement de médicament (dossier CTD complet).
const BASE_REQUIRED = ["1.0", "1.2", "1.2.1", "1.3", "2.3", "3.2.S", "3.2.P", "3.2.P.5", "3.2.P.8"];
const BASE_EXPECTED = ["1.4", "1.5", "2.1", "3.2.P.3", "3.2.S.4"];

const PROFILES: Partial<Record<RegProcedureType, Requirements>> = {
  PRESUBMISSION: { required: ["1.2"], expected: ["1.3"] },
  INITIAL_REGISTRATION: { required: BASE_REQUIRED, expected: BASE_EXPECTED },
  IMPORTED: { required: [...BASE_REQUIRED, "1.4"], expected: BASE_EXPECTED },
  LOCAL_MANUFACTURING: { required: [...BASE_REQUIRED, "1.6"], expected: BASE_EXPECTED },
  GENERIC: { required: [...BASE_REQUIRED, "5.3"], expected: BASE_EXPECTED }, // bioéquivalence
  BIOSIMILAR: { required: [...BASE_REQUIRED, "4.2", "5.3"], expected: [...BASE_EXPECTED, "2.4", "2.5"] },
  NEW_ACTIVE_SUBSTANCE: { required: [...BASE_REQUIRED, "4.2", "5.3"], expected: [...BASE_EXPECTED, "2.4", "2.5", "2.6", "2.7"] },
  ADD_DOSAGE: { required: ["1.0", "1.2", "3.2.P", "3.2.P.5", "3.2.P.8"], expected: ["1.3", "2.3"] },
  ADD_PRESENTATION: { required: ["1.0", "1.2", "3.2.P", "3.2.P.8"], expected: ["1.3"] },
  EXTENSION_INDICATION: { required: ["1.0", "1.2", "1.3", "2.5", "5.3"], expected: ["2.7"] },
  VARIATION: { required: ["1.0", "1.2"], expected: ["1.3", "2.3", "3.2.P"] },
  RENEWAL: { required: ["1.0", "1.2", "1.3"], expected: ["2.3", "3.2.P.8"] },
  TRANSFER: { required: ["1.0", "1.2"], expected: ["1.4", "1.6"] },
  RESERVE_RESPONSE: { required: ["1.0"], expected: [] },
  SUPPLEMENT: { required: ["1.0", "1.2"], expected: [] },
  WITHDRAWAL: { required: ["1.0"], expected: [] },
  CESSATION: { required: ["1.0"], expected: [] },
  OTHER: { required: ["1.0", "1.2"], expected: [] },
};

export function requirementsFor(procedureType: RegProcedureType): Requirements {
  return PROFILES[procedureType] ?? { required: ["1.0", "1.2"], expected: [] };
}
