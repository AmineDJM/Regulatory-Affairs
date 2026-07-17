import { prisma } from "@/lib/prisma";

/**
 * Force de vente & prévisions (SFE) — valeurs par défaut **100% configurables** (SfeSettings)
 * et helpers de calcul FTE. Tout est paramétrable par la Direction / le Super Admin.
 */

export const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

/** Poids par défaut des positions de détail (P1/P2/P3). Configurable. */
export const DEFAULT_POSITION_WEIGHTS: Record<string, number> = { "1": 1, "2": 0.5, "3": 0.25 };
/** Capacité terrain par défaut d'un délégué (par mois). Configurable. */
export const DEFAULT_CAPACITY = { daysPerMonth: 20, visitsPerDay: 7, fieldPct: 80 };
/** Fréquence cible par défaut selon le palier de potentiel (visites/cycle). Configurable. */
export const DEFAULT_FREQUENCY_BY_TIER: Record<string, number> = {
  VERY_HIGH: 3, HIGH: 2, MEDIUM: 1, LOW: 1, VERY_LOW: 0,
};

export interface SfeConfig {
  positionWeights: Record<string, number>;
  capacity: { daysPerMonth: number; visitsPerDay: number; fieldPct: number };
  frequencyByTier: Record<string, number>;
}

/** Paramètres SFE effectifs (base fusionnée avec les valeurs par défaut). */
export async function getSfeConfig(): Promise<SfeConfig> {
  const row = await prisma.sfeSettings.findUnique({ where: { id: "global" } }).catch(() => null);
  const pw = (row?.positionWeights as Record<string, number> | null) ?? null;
  const cap = (row?.capacity as Partial<SfeConfig["capacity"]> | null) ?? null;
  const freq = (row?.frequencyByTier as Record<string, number> | null) ?? null;
  return {
    positionWeights: pw && Object.keys(pw).length ? pw : DEFAULT_POSITION_WEIGHTS,
    capacity: { ...DEFAULT_CAPACITY, ...(cap ?? {}) },
    frequencyByTier: freq && Object.keys(freq).length ? freq : DEFAULT_FREQUENCY_BY_TIER,
  };
}

/** Nombre de visites terrain qu'un délégué peut faire dans le cycle (capacité nette terrain). */
export function fieldVisitsCapacity(cap: SfeConfig["capacity"]): number {
  return Math.round(cap.daysPerMonth * cap.visitsPerDay * (cap.fieldPct / 100));
}
