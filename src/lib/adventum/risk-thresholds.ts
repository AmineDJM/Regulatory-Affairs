/**
 * Seuils de déclenchement du Risk Radar — la part PURE (types, valeurs par défaut, champs du formulaire).
 * Sans import : l'écran de réglage (client) la lit sans tirer la base dans le navigateur.
 */

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
  recruitmentUnpublishedDays: number;
  fieldCoverageMinPct: number;
  adproCdMaxPct: number;
  bcUnsignedDays: number;
  tourPlanLeadDays: number;
  aiCostDriftPct: number;
  processStuckDays: number;
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
  recruitmentUnpublishedDays: 3,
  fieldCoverageMinPct: 50,
  adproCdMaxPct: 25,
  bcUnsignedDays: 5,
  tourPlanLeadDays: 3,
  aiCostDriftPct: 50,
  processStuckDays: 14,
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
  { key: "bcUnsignedDays", label: "BC non signé — délai", help: "Bon de commande dans le circuit, non signé au-delà de X jours.", min: 1, max: 60, suffix: "j" },
  { key: "recruitmentUnpublishedDays", label: "Recrutement non diffusé — délai", help: "Validé, publié sur aucun canal au-delà de X jours.", min: 1, max: 60, suffix: "j" },
  { key: "tourPlanLeadDays", label: "Plan de tournée — avance", help: "Non validé X jours avant le début de sa période.", min: 0, max: 30, suffix: "j" },
  { key: "fieldCoverageMinPct", label: "Couverture des cibles H·A·B — minimum", help: "Sous ce %, à mi-cycle ou après.", min: 5, max: 100, suffix: "%" },
  { key: "adproCdMaxPct", label: "Ad & Pro sur médecins C/D — maximum", help: "Part du budget congrès et événements sur des C et D.", min: 5, max: 100, suffix: "%" },
  { key: "aiCostDriftPct", label: "Coût IA — dérive", help: "Coût des dernières 24 h au-dessus de la moyenne des 7 jours de X %.", min: 10, max: 500, suffix: "%" },
  { key: "processStuckDays", label: "Process — dossier bloqué", help: "À une étape sans délai fixé, au-delà de X jours.", min: 2, max: 120, suffix: "j" },
];
