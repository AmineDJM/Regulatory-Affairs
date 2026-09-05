import { describe, expect, it } from "vitest";
import { cadenceMs, canauxPour, classer, cleDe, composerMessage, PLAFOND_QUOTIDIEN } from "@/lib/missions/attention/policy";
import type { SignalAttention } from "@/lib/missions/ports";

const base = (kind: SignalAttention["kind"], extra: Partial<SignalAttention> = {}): SignalAttention => ({
  kind, missionId: "m1", ownerId: "u1", titre: "Dossier Trastuzex", planVersion: 1, ...extra,
});

describe("politique d'attention — la table agir / informer / arbitrer", () => {
  it("une mission finie avec effets informe ; sans effet ni livrable, une ligne au journal suffit", () => {
    expect(classer(base("MISSION_COMPLETED", { bilan: { faites: 4, total: 4, echouees: 0, effets: ["message à Raihana"] } }))).toBe("INFO");
    expect(classer(base("MISSION_COMPLETED", { bilan: { faites: 1, total: 1, echouees: 0 } }))).toBe("JOURNAL");
    expect(classer(base("MISSION_COMPLETED", { bilan: { faites: 3, total: 3, echouees: 0 } }))).toBe("INFO");
  });
  it("un blocage après recours, un échec de planification, un plafond : ATTENTION", () => {
    expect(classer(base("MISSION_BLOCKED"))).toBe("ATTENTION");
    expect(classer(base("PLANNING_FAILED"))).toBe("ATTENTION");
    expect(classer(base("BUDGET_HOLD"))).toBe("ATTENTION");
  });
  it("un accord sensible et une question au dirigeant sont des ARBITRAGES ; un accord interne réversible reste une ATTENTION", () => {
    expect(classer(base("APPROVAL_REQUIRED", { niveauApprobation: "SENSITIVE" }))).toBe("ARBITRAGE");
    expect(classer(base("APPROVAL_REQUIRED", { niveauApprobation: "CRITICAL" }))).toBe("ARBITRAGE");
    expect(classer(base("APPROVAL_REQUIRED", { niveauApprobation: "NORMAL" }))).toBe("ATTENTION");
    expect(classer(base("QUESTION"))).toBe("ARBITRAGE");
    expect(classer(base("PLAN_CHANGED"))).toBe("ARBITRAGE");
  });
  it("une attente échue reste au journal tant qu'Adam relance ; l'échelle épuisée remonte au dirigeant", () => {
    expect(classer(base("WAIT_OVERDUE", { attente: { jours: 3, relances: 1 } }))).toBe("JOURNAL");
    expect(classer(base("WAIT_OVERDUE", { attente: { jours: 9, relances: 3 } }))).toBe("ATTENTION");
  });
});

describe("politique d'attention — canaux, cadence, clé", () => {
  it("l'e-mail ne part qu'à partir d'ATTENTION, le push insistant aussi ; JOURNAL ne pousse pas", () => {
    expect(canauxPour("JOURNAL")).toEqual({ notification: true, push: false, insistant: false, email: false });
    expect(canauxPour("INFO")).toEqual({ notification: true, push: true, insistant: false, email: false });
    expect(canauxPour("ATTENTION").email).toBe(true);
    expect(canauxPour("ARBITRAGE").insistant).toBe(true);
    expect(canauxPour("SILENCE").notification).toBe(false);
  });
  it("une décision ne se redemande jamais d'elle-même ; une info se tait 24 h ; la clé porte la version du plan et l'étape", () => {
    expect(cadenceMs("ARBITRAGE")).toBe(Number.POSITIVE_INFINITY);
    expect(cadenceMs("INFO")).toBe(24 * 3600_000);
    expect(cleDe(base("APPROVAL_REQUIRED", { stepKey: "accord:envois", planVersion: 2 }))).toBe("APPROVAL_REQUIRED:m1:v2:accord:envois");
    expect(cleDe(base("MISSION_COMPLETED"))).toBe("MISSION_COMPLETED:m1:v1:-");
    expect(PLAFOND_QUOTIDIEN).toBeGreaterThan(5);
  });
});

describe("politique d'attention — la compression exécutive", () => {
  it("une mission terminée dit le résultat, les actions, les livrables et ce qui reste à surveiller, sous 700 caractères", () => {
    const m = composerMessage(base("MISSION_COMPLETED", {
      raison: "Les trois salariés ont reçu leur message et le récapitulatif est déposé.",
      bilan: { faites: 5, total: 5, echouees: 0, effets: ["3 messages envoyés"], livrables: ["Récapitulatif.xlsx"], aSurveiller: ["retour de Karim attendu le 12/09"] },
    }));
    expect(m.titre).toBe("Mission terminée — Dossier Trastuzex");
    expect(m.corps).toContain("Résultat :");
    expect(m.corps).toContain("Actions : 3 messages envoyés");
    expect(m.corps).toContain("Livrables : Récapitulatif.xlsx");
    expect(m.corps).toContain("À surveiller : retour de Karim");
    expect(m.corps.length).toBeLessThanOrEqual(700);
  });
  it("un blocage dit le problème, le contexte, la recommandation ; une question dit la décision demandée", () => {
    const b = composerMessage(base("MISSION_BLOCKED", { raison: "Le certificat GMP n'est disponible nulle part.", bilan: { faites: 4, total: 7, echouees: 1 }, decision: "demander le certificat au fabricant" }));
    expect(b.corps).toMatch(/Problème : Le certificat GMP/);
    expect(b.corps).toMatch(/Contexte : 4\/7 étapes faites, 1 en échec/);
    expect(b.corps).toMatch(/Recommandation : demander le certificat/);
    const q = composerMessage(base("QUESTION", { raison: "Deux fournisseurs répondent au nom « Hetero ».", decision: "lequel viser ?" }));
    expect(q.titre).toMatch(/^Une précision/);
    expect(q.corps).toContain("Décision demandée : lequel viser ?");
  });
  it("un texte long est borné, jamais tronqué au milieu d'un nombre de plus de 700 caractères", () => {
    const m = composerMessage(base("MISSION_COMPLETED", { raison: "x".repeat(2_000), bilan: { faites: 1, total: 1, echouees: 0 } }));
    expect(m.corps.length).toBe(700);
    expect(m.corps.endsWith("…")).toBe(true);
  });
});
