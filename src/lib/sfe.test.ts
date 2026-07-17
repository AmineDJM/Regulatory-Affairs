import { describe, it, expect } from "vitest";
import {
  repCapacity, positionWeight, assignmentEffort, fteFromEffort,
  panelRequiredVisits, fieldVisitsCapacity, DEFAULT_POSITION_WEIGHTS,
  type SfeConfig,
} from "./sfe";

const config: SfeConfig = {
  positionWeights: DEFAULT_POSITION_WEIGHTS,
  capacity: { daysPerMonth: 20, visitsPerDay: 7, fieldPct: 80 },
  frequencyByTier: { VERY_HIGH: 3, HIGH: 2, MEDIUM: 1, LOW: 1, VERY_LOW: 0 },
};

describe("sfe — capacité terrain", () => {
  it("capacité globale = jours × visites × %terrain", () => {
    expect(fieldVisitsCapacity(config.capacity)).toBe(112); // 20*7*0.8
  });

  it("repCapacity utilise le global sans surcharge", () => {
    expect(repCapacity(null, config)).toBe(112);
    expect(repCapacity({}, config)).toBe(112);
  });

  it("repCapacity applique les surcharges individuelles", () => {
    expect(repCapacity({ capDaysPerMonth: 22 }, config)).toBe(Math.round(22 * 7 * 0.8)); // 123
    expect(repCapacity({ capVisitsPerDay: 8, capFieldPct: 100 }, config)).toBe(20 * 8); // 160
  });
});

describe("sfe — poids des positions & FTE", () => {
  it("positionWeight respecte P1/P2/P3 et retombe sur défauts", () => {
    expect(positionWeight(1, config.positionWeights)).toBe(1);
    expect(positionWeight(2, config.positionWeights)).toBe(0.5);
    expect(positionWeight(3, config.positionWeights)).toBe(0.25);
    expect(positionWeight(1, {})).toBe(1); // fallback
    expect(positionWeight(9, config.positionWeights)).toBe(0);
  });

  it("assignmentEffort = visites × poids position", () => {
    expect(assignmentEffort(100, 1, config.positionWeights)).toBe(100);
    expect(assignmentEffort(100, 2, config.positionWeights)).toBe(50);
    expect(assignmentEffort(80, 3, config.positionWeights)).toBe(20);
  });

  it("fteFromEffort = effort / capacité (0 si capacité nulle)", () => {
    expect(fteFromEffort(112, 112)).toBe(1);
    expect(fteFromEffort(56, 112)).toBe(0.5);
    expect(fteFromEffort(50, 0)).toBe(0);
  });

  it("un KAM à pleine charge sur un P1 vaut ~1 ETP", () => {
    const cap = repCapacity(null, config); // 112
    const fte = fteFromEffort(assignmentEffort(cap, 1, config.positionWeights), cap);
    expect(fte).toBeCloseTo(1, 5);
  });
});

describe("sfe — tournée assistée (fréquence par palier)", () => {
  it("panelRequiredVisits = Σ effectif(palier) × fréquence(palier)", () => {
    const panel = { VERY_HIGH: 10, HIGH: 20, MEDIUM: 30, LOW: 5, VERY_LOW: 100 };
    // 10*3 + 20*2 + 30*1 + 5*1 + 100*0 = 30+40+30+5+0
    expect(panelRequiredVisits(panel, config.frequencyByTier)).toBe(105);
  });

  it("panel vide → 0 visite cible", () => {
    expect(panelRequiredVisits({}, config.frequencyByTier)).toBe(0);
  });
});
