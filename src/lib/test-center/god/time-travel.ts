import { accrualStep } from "@/lib/scheduled";
import type { FindingInput } from "../types";

/**
 * Time Travel (§33). Simule le passage du temps **sans toucher l'horloge du serveur** : on rejoue
 * un job temporel (l'acquisition mensuelle de congés) sur une frise simulée, avec plusieurs « ticks »
 * par mois. Le moteur vérifie qu'un job temporel ne s'exécute **ni zéro ni plusieurs fois** par
 * période : chaque mois crédite exactement une fois (+2,5 j), les ticks redondants ne créditent rien.
 */

const ymAt = (idx0: number, k: number) => {
  const i = idx0 + k;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};

export interface TimeTravelReport {
  months: number; ticksPerMonth: number;
  expectedCredit: number; actualCredit: number;
  doubleCredits: number; missedCredits: number;
  ok: boolean; findings: FindingInput[];
}

export function timeTravelAccrual(startYm = "2026-01", months = 18, ticksPerMonth = 3): TimeTravelReport {
  const [sy, sm] = startYm.split("-").map(Number);
  const idx0 = sy * 12 + (sm - 1);

  let marker: string | null = null; // amorçage au premier tick
  let balance = 0, doubleCredits = 0, missedCredits = 0;

  for (let m = 0; m <= months; m++) {
    const ymM = ymAt(idx0, m);
    let monthCredit = 0;
    for (let t = 0; t < ticksPerMonth; t++) {
      const s = accrualStep(marker, ymM); // tick simulé « pendant » le mois ymM
      monthCredit += s.credit;
      balance += s.credit;
      marker = s.marker;
    }
    if (m >= 1) {
      if (monthCredit > 2.5 + 1e-9) doubleCredits++; // plus d'un mois crédité en un seul mois
      if (monthCredit < 2.5 - 1e-9) missedCredits++; // aucun crédit alors qu'un mois est passé
    } else if (monthCredit !== 0) {
      doubleCredits++; // le mois d'amorçage ne doit rien créditer
    }
  }

  const expectedCredit = months * 2.5;
  const ok = Math.abs(balance - expectedCredit) < 1e-9 && doubleCredits === 0 && missedCredits === 0;
  const findings: FindingInput[] = [];
  if (!ok) {
    findings.push({
      severity: "HIGH", category: "time-travel", module: "RH",
      title: "Acquisition de congés non idempotente dans le temps",
      detail: `Sur ${months} mois simulés (${ticksPerMonth} ticks/mois) : crédité=${balance}, attendu=${expectedCredit}, doubles=${doubleCredits}, manqués=${missedCredits}. Un job temporel doit s'exécuter exactement une fois par période.`,
      suggestion: "Vérifier le marqueur d'idempotence (leaveAccruedThrough) et la logique accrualStep.",
      confidence: "high",
    });
  }
  return { months, ticksPerMonth, expectedCredit, actualCredit: balance, doubleCredits, missedCredits, ok, findings };
}
