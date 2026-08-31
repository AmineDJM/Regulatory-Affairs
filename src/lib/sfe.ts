import { prisma } from "@/lib/prisma";
import { hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";

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

// ─────────────────────── Phase 2/3 — hiérarchie, affectations & FTE ───────────────────────

/** Positions de détail possibles (rang du produit dans la mallette). */
export const POSITIONS = [1, 2, 3] as const;
/** Paliers de potentiel (ordre d'affichage), alignés sur `SegmentLevel`. */
export const TIERS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"] as const;
export const TIER_LABELS: Record<string, string> = {
  VERY_HIGH: "Très fort", HIGH: "Fort", MEDIUM: "Moyen", LOW: "Faible", VERY_LOW: "Très faible",
};

/** Surcharge de capacité individuelle d'un KAM (null = valeur globale). */
export interface RepCapacityOverride {
  capDaysPerMonth?: number | null;
  capVisitsPerDay?: number | null;
  capFieldPct?: number | null;
}

/** Capacité terrain nette d'un KAM (visites/mois), en tenant compte de sa surcharge individuelle. */
export function repCapacity(override: RepCapacityOverride | null | undefined, config: SfeConfig): number {
  const days = override?.capDaysPerMonth ?? config.capacity.daysPerMonth;
  const visits = override?.capVisitsPerDay ?? config.capacity.visitsPerDay;
  const pct = override?.capFieldPct ?? config.capacity.fieldPct;
  return Math.round(days * visits * (pct / 100));
}

/** Poids d'une position de détail (P1/P2/P3) selon le paramétrage. */
export function positionWeight(position: number, weights: Record<string, number>): number {
  const fallback: Record<string, number> = DEFAULT_POSITION_WEIGHTS;
  return weights[String(position)] ?? fallback[String(position)] ?? 0;
}

/** Effort pondéré d'une affectation = visites prévues × poids de la position (en « visites-équivalent »). */
export function assignmentEffort(plannedVisits: number, position: number, weights: Record<string, number>): number {
  return (plannedVisits || 0) * positionWeight(position, weights);
}

/** FTE dérivé d'un effort pondéré rapporté à la capacité (part d'un ETP terrain). */
export function fteFromEffort(effort: number, capacity: number): number {
  return capacity > 0 ? effort / capacity : 0;
}

/** Visites cibles d'un panel selon la fréquence par palier : Σ fréquence(potentiel) sur les praticiens. */
export function panelRequiredVisits(countByTier: Record<string, number>, freqByTier: Record<string, number>): number {
  return TIERS.reduce((s, t) => s + (countByTier[t] ?? 0) * (freqByTier[t] ?? 0), 0);
}

/**
 * Portée d'accès à la force de vente (profondeur hiérarchique) :
 *  - `all` : configurateur (Direction / Manager promo / Super Admin) ou vue globale → tous les KAM ;
 *  - `team` : superviseur national → uniquement les KAM de ses équipes ;
 *  - `self` : KAM → uniquement lui-même.
 */
export interface RepScope {
  mode: "all" | "team" | "self";
  canConfigure: boolean;
  isSupervisor: boolean;
  buIds: string[]; // BU supervisées (pour team/all)
  repIds: string[] | null; // null = tous ; sinon liste explicite
}

export async function resolveRepScope(user: SessionUser): Promise<RepScope> {
  const canConfigure = userCan(user, "SALES_PLANNING", "UPDATE") || hasGlobalView(user);
  // LA BU EST L'ÉQUIPE. On est superviseur parce qu'on supervise une BU — plus par un objet
  // « équipe » posé entre les deux, qui redisait la même chose et pouvait la contredire.
  const supervisees = await prisma.businessUnit.findMany({ where: { supervisorId: user.id }, select: { id: true } });
  const buIds = supervisees.map((b) => b.id);
  const isSupervisor = buIds.length > 0;

  if (canConfigure) return { mode: "all", canConfigure: true, isSupervisor, buIds, repIds: null };
  if (isSupervisor) {
    const members = await prisma.salesRepProfile.findMany({ where: { businessUnitId: { in: buIds } }, select: { repId: true } });
    const repIds = Array.from(new Set([...members.map((m) => m.repId), user.id]));
    return { mode: "team", canConfigure: false, isSupervisor: true, buIds, repIds };
  }
  return { mode: "self", canConfigure: false, isSupervisor: false, buIds: [], repIds: [user.id] };
}

/** Le user peut-il éditer les affectations de ce KAM ? Configurateur, superviseur du KAM, ou lui-même. */
export async function canEditRep(user: SessionUser, repId: string): Promise<boolean> {
  if (userCan(user, "SALES_PLANNING", "UPDATE") || hasGlobalView(user)) return true;
  if (repId === user.id) return true;
  const prof = await prisma.salesRepProfile.findUnique({ where: { repId }, select: { businessUnit: { select: { supervisorId: true } } } });
  return prof?.businessUnit?.supervisorId === user.id;
}
