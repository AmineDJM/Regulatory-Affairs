import { describe, expect, it } from "vitest";
import { libelleEtat, reconcile, type ExistingRisk, type ReconcileOp } from "./lifecycle-rules";

const NOW = new Date("2026-10-07T07:00:00Z");
const H = 3_600_000;
const e = (key: string, status: ExistingRisk["status"], extra: Partial<ExistingRisk> = {}): ExistingRisk => ({ key, status, snoozedUntil: null, resolvedAt: null, resolvedAuto: false, ...extra });
const opDe = (ops: ReconcileOp[], key: string) => ops.find((o) => o.key === key);

describe("reconcile — la vie d'un risque d'une heure à l'autre", () => {
  it("un risque inconnu est créé NOUVEAU, avec « Détecté » dans son histoire", () => {
    const ops = reconcile([], ["a"], NOW);
    expect(ops).toEqual([{ op: "create", key: "a", history: { at: NOW.toISOString(), kind: "apparu" } }]);
  });

  it("un risque nouveau ou pris en charge toujours vu est rafraîchi sans changer d'état", () => {
    const ops = reconcile([e("a", "NOUVEAU"), e("b", "PRIS_EN_CHARGE")], ["a", "b"], NOW);
    expect(opDe(ops, "a")).toEqual({ op: "refresh", key: "a", status: "NOUVEAU" });
    expect(opDe(ops, "b")).toEqual({ op: "refresh", key: "b", status: "PRIS_EN_CHARGE" });
  });

  it("auto-résolution : un risque ouvert que le détecteur ne voit plus est résolu", () => {
    const ops = reconcile([e("a", "NOUVEAU"), e("b", "PRIS_EN_CHARGE"), e("c", "IGNORE", { snoozedUntil: new Date(NOW.getTime() + 48 * H) })], [], NOW);
    expect(ops.map((o) => [o.key, o.op])).toEqual([["a", "resolve"], ["b", "resolve"], ["c", "resolve"]]);
    expect((opDe(ops, "a") as { history: { kind: string } }).history.kind).toBe("resolu_auto");
  });

  it("un risque déjà résolu et toujours absent n'est pas touché", () => {
    expect(reconcile([e("a", "RESOLU", { resolvedAt: NOW, resolvedAuto: true })], [], NOW)).toEqual([]);
  });

  it("réouverture : un risque résolu automatiquement qui réapparaît redevient NOUVEAU", () => {
    const ops = reconcile([e("a", "RESOLU", { resolvedAuto: true, resolvedAt: new Date(NOW.getTime() - H) })], ["a"], NOW);
    expect(opDe(ops, "a")).toMatchObject({ op: "refresh", status: "NOUVEAU", reopen: true, history: { kind: "reapparu" } });
  });

  it("résolu par une personne : délai de grâce, puis réouverture si le détecteur le voit toujours", () => {
    const recent = reconcile([e("a", "RESOLU", { resolvedAt: new Date(NOW.getTime() - 2 * H) })], ["a"], NOW);
    expect(opDe(recent, "a")).toEqual({ op: "refresh", key: "a", status: "RESOLU" });
    const ancien = reconcile([e("a", "RESOLU", { resolvedAt: new Date(NOW.getTime() - 30 * H) })], ["a"], NOW);
    expect(opDe(ancien, "a")).toMatchObject({ status: "NOUVEAU", reopen: true });
    const grace0 = reconcile([e("a", "RESOLU", { resolvedAt: new Date(NOW.getTime() - 2 * H) })], ["a"], NOW, { graceMs: H });
    expect(opDe(grace0, "a")).toMatchObject({ status: "NOUVEAU", reopen: true });
  });

  it("ignoré : reste ignoré jusqu'à sa date, puis redevient NOUVEAU s'il est toujours vu", () => {
    const avant = reconcile([e("a", "IGNORE", { snoozedUntil: new Date(NOW.getTime() + H) })], ["a"], NOW);
    expect(opDe(avant, "a")).toEqual({ op: "refresh", key: "a", status: "IGNORE" });
    const apres = reconcile([e("a", "IGNORE", { snoozedUntil: new Date(NOW.getTime() - H) })], ["a"], NOW);
    expect(opDe(apres, "a")).toMatchObject({ status: "NOUVEAU", clearSnooze: true, history: { kind: "reveil" } });
    const sansDate = reconcile([e("a", "IGNORE")], ["a"], NOW);
    expect(opDe(sansDate, "a")).toMatchObject({ status: "NOUVEAU" });
  });

  it("un même passage mêle créations, rafraîchissements et résolutions", () => {
    const ops = reconcile([e("vieux", "NOUVEAU"), e("garde", "PRIS_EN_CHARGE")], ["garde", "neuf"], NOW);
    expect(ops.map((o) => `${o.key}:${o.op}`).sort()).toEqual(["garde:refresh", "neuf:create", "vieux:resolve"]);
  });
});

describe("libelleEtat", () => {
  it("dit l'état comme la colonne « État »", () => {
    expect(libelleEtat({ status: "NOUVEAU", snoozedUntil: null })).toBe("nouveau");
    expect(libelleEtat({ status: "PRIS_EN_CHARGE", snoozedUntil: null, taskId: "t" })).toBe("pris en charge — tâche créée");
    expect(libelleEtat({ status: "PRIS_EN_CHARGE", snoozedUntil: null })).toBe("pris en charge");
    expect(libelleEtat({ status: "IGNORE", snoozedUntil: "2026-10-15T12:00:00Z" })).toBe("ignoré jusqu'au 15 oct.");
  });
});
