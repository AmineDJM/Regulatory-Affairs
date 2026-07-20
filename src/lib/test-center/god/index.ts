import type { FindingInput } from "../types";
import { runProperties, type PropertiesReport } from "./properties";
import { runMetamorphic, type MetamorphicReport } from "./metamorphic";
import { runMutationTesting, type MutationReport } from "./mutation";
import { runFuzzing, type FuzzReport } from "./fuzz";
import { runFlakyDetection, type FlakyReport } from "./flaky";
import { demonstrateMinimization, type MinimalScenario } from "./minimize";
import { timeTravelAccrual, type TimeTravelReport } from "./time-travel";

/**
 * GOD MODE — validation du testeur lui-même (§27). Le Test Center ne teste pas seulement la
 * plateforme : il DÉMONTRE que ses propres tests sont efficaces (property-based, mutation testing,
 * métamorphique, fuzzing, détection d'instabilité, réduction de scénario, time-travel). Tout est
 * PUR (aucune écriture) → exécutable dans n'importe quel mode.
 */

export interface GodReport {
  properties: PropertiesReport;
  metamorphic: MetamorphicReport;
  mutation: MutationReport;
  fuzz: FuzzReport;
  flaky: FlakyReport;
  minimization: MinimalScenario;
  timeTravel: TimeTravelReport;
  findings: FindingInput[];
  blockingFailures: number;
  selfValidationOk: boolean;
}

export function godModeSelfValidation(): GodReport {
  const properties = runProperties();
  const metamorphic = runMetamorphic();
  const mutation = runMutationTesting();
  const fuzz = runFuzzing();
  const flaky = runFlakyDetection();
  const minimization = demonstrateMinimization();
  const timeTravel = timeTravelAccrual();

  const findings = [
    ...properties.findings, ...metamorphic.findings, ...mutation.findings,
    ...fuzz.findings, ...flaky.findings, ...timeTravel.findings,
  ];

  let blockingFailures = properties.failed + metamorphic.failed + flaky.flakyCount;
  if (mutation.survived > 0) blockingFailures += 1;
  if (fuzz.crashes > 0) blockingFailures += 1;
  if (fuzz.securityBreaches > 0) blockingFailures += 1;
  if (!timeTravel.ok) blockingFailures += 1;

  // Le minimiseur DOIT trouver et réduire son contre-exemple témoin, sinon le §34 n'est pas prouvé.
  const minimizerProven = minimization.found && Number(minimization.minimal) <= Number(minimization.original);
  const selfValidationOk = blockingFailures === 0 && mutation.killRate === 1 && minimizerProven;

  return { properties, metamorphic, mutation, fuzz, flaky, minimization, timeTravel, findings, blockingFailures, selfValidationOk };
}
