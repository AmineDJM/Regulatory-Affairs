/**
 * Seuils de déclenchement du Risk Radar — ajustables par le Super Admin.
 * Lecture côté serveur ; valeurs par défaut si la ligne n'existe pas encore.
 */
import { prisma } from "@/lib/prisma";

export interface RiskThresholds {
  pchCautionWarnDays: number;
  congressStaleDays: number;
  sponsoringStaleDays: number;
  expenseStaleDays: number;
  budgetWarnPct: number;
  kolVisitStaleDays: number;
  medicalInfoStaleDays: number;
  silentSupplierDays: number;
  stockLowThreshold: number;
  deliveryGraceDays: number;
  eventHorizonDays: number;
  eventMinAttendance: number;
}

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  pchCautionWarnDays: 30,
  congressStaleDays: 4,
  sponsoringStaleDays: 4,
  expenseStaleDays: 7,
  budgetWarnPct: 85,
  kolVisitStaleDays: 60,
  medicalInfoStaleDays: 5,
  silentSupplierDays: 14,
  stockLowThreshold: 10,
  deliveryGraceDays: 3,
  eventHorizonDays: 7,
  eventMinAttendance: 5,
};

export interface ThresholdField {
  key: keyof RiskThresholds;
  label: string;
  help: string;
  min: number;
  max: number;
  suffix: string;
}

/** Métadonnées pour le formulaire de réglage (rendu générique). */
export const THRESHOLD_FIELDS: ThresholdField[] = [
  { key: "pchCautionWarnDays", label: "Caution PCH — alerte avant échéance", help: "Alerter quand l'échéance approche.", min: 1, max: 120, suffix: "j" },
  { key: "stockLowThreshold", label: "Stock PCH bas — seuil", help: "Stock net ≤ ce seuil = alerte (≤ 0 = rupture).", min: 0, max: 1000, suffix: "u" },
  { key: "deliveryGraceDays", label: "Livraison — tolérance de retard", help: "Jours après l'arrivée estimée avant alerte.", min: 0, max: 60, suffix: "j" },
  { key: "eventHorizonDays", label: "Événements — horizon", help: "Vérifier la présence des événements à venir sous X jours.", min: 1, max: 60, suffix: "j" },
  { key: "eventMinAttendance", label: "Événements — présence minimale", help: "En dessous de ce nombre d'inscrits = alerte.", min: 1, max: 500, suffix: "p" },
  { key: "budgetWarnPct", label: "Budget — seuil d'alerte", help: "Consommation au-delà de ce % = à surveiller.", min: 50, max: 100, suffix: "%" },
  { key: "congressStaleDays", label: "Congrès bloqué — délai", help: "Sans évolution au-delà de X jours = alerte.", min: 1, max: 60, suffix: "j" },
  { key: "sponsoringStaleDays", label: "Sponsoring bloqué — délai", help: "Sans évolution au-delà de X jours = alerte.", min: 1, max: 60, suffix: "j" },
  { key: "expenseStaleDays", label: "Ordre de dépense non réglé — délai", help: "Non réglé au-delà de X jours = alerte.", min: 1, max: 90, suffix: "j" },
  { key: "medicalInfoStaleDays", label: "Information médicale — délai", help: "Déclaration en attente au-delà de X jours.", min: 1, max: 60, suffix: "j" },
  { key: "kolVisitStaleDays", label: "Médecin KOL non visité — délai", help: "Non visité depuis plus de X jours = alerte.", min: 7, max: 365, suffix: "j" },
  { key: "silentSupplierDays", label: "Fournisseur silencieux — délai", help: "Sans mise à jour portail au-delà de X jours.", min: 1, max: 120, suffix: "j" },
];

/** Lit les seuils (frais ; valeurs par défaut si absent ou en cas de souci BDD). */
export async function getRiskThresholds(): Promise<RiskThresholds> {
  try {
    const row = await prisma.riskSetting.findUnique({ where: { id: "global" } });
    if (!row) return DEFAULT_THRESHOLDS;
    return {
      pchCautionWarnDays: row.pchCautionWarnDays,
      congressStaleDays: row.congressStaleDays,
      sponsoringStaleDays: row.sponsoringStaleDays,
      expenseStaleDays: row.expenseStaleDays,
      budgetWarnPct: row.budgetWarnPct,
      kolVisitStaleDays: row.kolVisitStaleDays,
      medicalInfoStaleDays: row.medicalInfoStaleDays,
      silentSupplierDays: row.silentSupplierDays,
      stockLowThreshold: row.stockLowThreshold,
      deliveryGraceDays: row.deliveryGraceDays,
      eventHorizonDays: row.eventHorizonDays,
      eventMinAttendance: row.eventMinAttendance,
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}
