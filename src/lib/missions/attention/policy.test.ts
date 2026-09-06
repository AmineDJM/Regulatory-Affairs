import { describe, expect, it } from "vitest";
import { cadenceMs, canauxPour, classer, cleDe, composerMessage, corpsNeutrePour, dansLeSilence, lireCanal, lireHeuresSilence, PLAFOND_QUOTIDIEN } from "@/lib/missions/attention/policy";
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
    const rien = { connecteur: null, corpsNeutre: false, differe: false, canalIndisponible: null };
    expect(canauxPour("JOURNAL")).toEqual({ notification: true, push: false, insistant: false, email: false, ...rien });
    expect(canauxPour("INFO")).toEqual({ notification: true, push: true, insistant: false, email: false, ...rien });
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

describe("l'omnicanal (§37) — canal préféré, disponibilité, confidentialité ; l'arbitrage ne se laisse ni taire ni déplacer", () => {
  it("lit un canal sous toutes ses écritures, et une destination après les deux-points", () => {
    expect(lireCanal("Slack")).toEqual({ canal: "slack", destinataire: null });
    expect(lireCanal("slack:#direction")).toEqual({ canal: "slack", destinataire: "#direction" });
    expect(lireCanal("E-mail")).toEqual({ canal: "email", destinataire: null });
    expect(lireCanal("texto")).toEqual({ canal: "sms", destinataire: null });
    expect(lireCanal({ canal: "whatsapp", destinataire: "+213661000000" })).toEqual({ canal: "whatsapp", destinataire: "+213661000000" });
    expect(lireCanal("pigeon")).toBeNull();
  });
  it("lit des heures de silence, y compris une plage qui passe minuit", () => {
    expect(lireHeuresSilence("22h-7h")).toEqual({ de: 22, a: 7 });
    expect(lireHeuresSilence("de 22 h à 7 h")).toEqual({ de: 22, a: 7 });
    expect(lireHeuresSilence("22:00-07:00")).toEqual({ de: 22, a: 7 });
    expect(lireHeuresSilence({ de: 13, a: 14 })).toEqual({ de: 13, a: 14 });
    expect(lireHeuresSilence("toujours")).toBeNull();
    expect(dansLeSilence(23, { de: 22, a: 7 })).toBe(true);
    expect(dansLeSilence(3, { de: 22, a: 7 })).toBe(true);
    expect(dansLeSilence(7, { de: 22, a: 7 })).toBe(false);
    expect(dansLeSilence(12, { de: 22, a: 7 })).toBe(false);
    expect(dansLeSilence(13, { de: 13, a: 14 })).toBe(true);
  });
  it("le canal préféré : e-mail dès INFO ; ERP seul ferme l'e-mail ; un connecteur BRANCHÉ remplace l'e-mail, sauf pour l'arbitrage qui garde les deux", () => {
    expect(canauxPour("INFO", { canalPrefere: "email" }).email).toBe(true);
    expect(canauxPour("ATTENTION", { canalPrefere: "notification" }).email).toBe(false);
    expect(canauxPour("ARBITRAGE", { canalPrefere: "notification" })).toMatchObject({ push: true, insistant: true, email: false });
    const slack = canauxPour("ATTENTION", { canalPrefere: "slack", connecteurs: ["slack"] });
    expect(slack).toMatchObject({ connecteur: "slack", email: false, notification: true, canalIndisponible: null });
    const arbitrage = canauxPour("ARBITRAGE", { canalPrefere: "slack:#direction", connecteurs: ["slack"] });
    expect(arbitrage).toMatchObject({ connecteur: "slack", email: true, insistant: true });
    // Le journal ne sort jamais de l'ERP, quel que soit le canal préféré.
    expect(canauxPour("JOURNAL", { canalPrefere: "slack", connecteurs: ["slack"] }).connecteur).toBeNull();
  });
  it("un connecteur préféré NON branché laisse la table du niveau et le dit", () => {
    const c = canauxPour("ATTENTION", { canalPrefere: "whatsapp", connecteurs: [] });
    expect(c).toMatchObject({ connecteur: null, email: true, canalIndisponible: "whatsapp" });
  });
  it("les heures de silence retiennent le push et le message (et le disent), gardent la notification et l'e-mail, et n'atteignent pas l'arbitrage", () => {
    const nuit = { heuresSilence: { de: 22, a: 7 }, heure: 2 };
    expect(canauxPour("INFO", nuit)).toMatchObject({ notification: true, push: false, differe: true });
    expect(canauxPour("ATTENTION", { ...nuit, canalPrefere: "slack", connecteurs: ["slack"] })).toMatchObject({ push: false, connecteur: null, email: false, differe: true });
    expect(canauxPour("ARBITRAGE", { ...nuit, canalPrefere: "slack", connecteurs: ["slack"] })).toMatchObject({ push: true, connecteur: "slack", email: true, differe: false });
    expect(canauxPour("INFO", { heuresSilence: { de: 22, a: 7 }, heure: 10 })).toMatchObject({ push: true, differe: false });
  });
  it("la confidentialité : tout ce qui sort de l'ERP porte un corps neutre, la notification garde le détail", () => {
    expect(canauxPour("ATTENTION", { confidentiel: true })).toMatchObject({ email: true, corpsNeutre: true, notification: true });
    expect(canauxPour("INFO", { confidentiel: true })).toMatchObject({ email: false, corpsNeutre: false });
    expect(canauxPour("INFO", { confidentiel: true, canalPrefere: "sms", connecteurs: ["sms"] })).toMatchObject({ connecteur: "sms", corpsNeutre: true });
    const neutre = corpsNeutrePour("ARBITRAGE", "/missions/m1");
    expect(neutre).toMatch(/décision vous attend/);
    expect(neutre).toMatch(/confidentiel/);
    expect(neutre).not.toMatch(/salaire|Trastuzex/);
  });
});
