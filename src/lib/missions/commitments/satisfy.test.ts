import { describe, expect, it } from "vitest";
import { delaiRelance, doitRelancer, relancesDeduites, tientLaPromesse, type Engagement } from "./satisfy";
import { conduire, facteursRelance, type Facteurs } from "./proactivity";
import type { FaitObserve } from "@/lib/missions/events/match";

const engagement = (extra: Partial<Engagement> = {}): Engagement => ({
  id: "e1", who: "Redouane", personId: null, what: "envoyer son contrat",
  relatedRef: null, missionId: "m1", stepKey: "attente", ...extra,
});

const fait = (extra: Partial<FaitObserve> = {}): FaitObserve => ({
  type: "DOCUMENT_UPLOADED", actorId: null, relatedRefs: [], payload: {}, ...extra,
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §86 — L'ERREUR QUI RUINE LA CONFIANCE : relancer quelqu'un pour une chose déjà faite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("un engagement se satisfait tout seul", () => {
  it("le dépôt du document par la bonne personne tient la promesse", () => {
    expect(tientLaPromesse(engagement(), fait({ actorId: "redouane" }))).toBe(true);
    expect(tientLaPromesse(engagement(), fait({ payload: { from: "redouane@adventum.dz" } }))).toBe(true);
  });

  it("plusieurs familles de faits peuvent tenir la MÊME promesse", () => {
    for (const type of ["DOCUMENT_UPLOADED", "EMAIL_RECEIVED", "TASK_COMPLETED", "CONTRACT_SIGNED"]) {
      expect(tientLaPromesse(engagement(), fait({ type, actorId: "redouane" })), type).toBe(true);
    }
  });

  it("un fait qui ne PROUVE rien ne tient pas de promesse", () => {
    // Ouvrir un écran n'est pas déposer un contrat.
    expect(tientLaPromesse(engagement(), fait({ type: "RECORD_VIEWED", actorId: "redouane" }))).toBe(false);
    expect(tientLaPromesse(engagement(), fait({ type: "SEARCH_RUN", actorId: "redouane" }))).toBe(false);
  });

  it("le fait doit venir de la BONNE personne", () => {
    expect(tientLaPromesse(engagement(), fait({ actorId: "khaled" }))).toBe(false);
    expect(tientLaPromesse(engagement(), fait({}))).toBe(false);
  });

  it("l'identité canonique prime sur le libellé libre", () => {
    const e = engagement({ who: "Le fournisseur Untel", personId: "emp-42" });
    expect(tientLaPromesse(e, fait({ actorId: "emp-42" }))).toBe(true);
    // Le libellé libre ne sert plus de repli dès qu'une identité canonique existe.
    expect(tientLaPromesse(e, fait({ actorId: "Le fournisseur Untel" }))).toBe(false);
  });

  it("le libellé libre SERT de repli quand l'engageant n'a pas de compte", () => {
    const e = engagement({ who: "imprimerie-atlas", personId: null });
    expect(tientLaPromesse(e, fait({ payload: { sender: "contact@imprimerie-atlas.dz" } }))).toBe(true);
  });

  it("UN DÉPÔT NE SATISFAIT PAS TOUTES LES PROMESSES D'UNE PERSONNE À LA FOIS", () => {
    const contrat = engagement({ relatedRef: "EMPLOYEE:e-42" });
    // Redouane dépose quelque chose, mais pas sur l'entité promise.
    expect(tientLaPromesse(contrat, fait({ actorId: "redouane", relatedRefs: ["INVOICE:i-9"] }))).toBe(false);
    expect(tientLaPromesse(contrat, fait({ actorId: "redouane", relatedRefs: ["EMPLOYEE:e-42"] }))).toBe(true);
  });

  it("sans entité nommée, l'engagement accepte tout fait de la bonne personne", () => {
    expect(tientLaPromesse(engagement({ relatedRef: null }), fait({ actorId: "redouane" }))).toBe(true);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §103 — RELANCER SANS HARCELER.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("la relance intelligente", () => {
  const t0 = new Date("2026-03-01T09:00:00Z");
  const j = (n: number) => new Date(t0.getTime() + n * 24 * 3600 * 1000);
  const ouvert = (extra: Partial<Parameters<typeof doitRelancer>[0]> = {}) => ({
    status: "OPEN", dueAt: t0, promisedAt: null, lastNudgeAt: null, relances: 0, ...extra,
  });

  it("on ne relance PAS un engagement déjà tenu", () => {
    expect(doitRelancer(ouvert({ status: "DONE" }), j(30)).relancer).toBe(false);
  });

  it("on ne relance PAS avant l'échéance", () => {
    const d = doitRelancer(ouvert(), j(-1));
    expect(d.relancer).toBe(false);
    expect(d.raison).toMatch(/pas passée/);
  });

  it("on ne relance PAS ce qu'on n'a jamais daté", () => {
    const d = doitRelancer(ouvert({ dueAt: null, promisedAt: null }), j(30));
    expect(d.relancer).toBe(false);
    expect(d.raison).toMatch(/aucune échéance/);
  });

  it("l'échéance passée et aucun rappel récent : on relance", () => {
    expect(doitRelancer(ouvert(), j(1)).relancer).toBe(true);
  });

  it("DEUX RELANCES LE MÊME JOUR SONT DU HARCÈLEMENT", () => {
    const d = doitRelancer(ouvert({ lastNudgeAt: j(1) }), j(1.5));
    expect(d.relancer).toBe(false);
    expect(d.raison).toMatch(/on attend 1 jour/);
  });

  it("le délai entre deux rappels CROÎT — insister au même rythme fait filtrer", () => {
    expect(delaiRelance(0)).toBe(1);
    expect(delaiRelance(1)).toBe(3);
    expect(delaiRelance(3)).toBe(7);
    // Et il est BORNÉ : au-delà, ce n'est plus de la patience, c'est de l'abandon déguisé.
    expect(delaiRelance(20)).toBe(14);
    expect(delaiRelance(100)).toBe(14);
  });

  it("une quatrième relance attend une semaine, pas un jour", () => {
    const e = ouvert({ lastNudgeAt: j(7), relances: 3 });
    expect(doitRelancer(e, j(10)).relancer).toBe(false);
    expect(doitRelancer(e, j(15)).relancer).toBe(true);
  });

  /**
   * L'ÉCART EST UN CUMUL, PAS UN INTERVALLE.
   *
   * Les rappels s'espacent de 1, 3, 5, 7… jours ; après k rappels, l'écart depuis l'échéance
   * vaut donc 1+3+5+… = k². Le nombre de rappels est la RACINE de l'écart.
   *
   * Ce cas encodait auparavant `j(7) ⇒ 4`, c'est-à-dire l'inversion d'un seul intervalle. Le
   * commentaire de la fonction disait pourtant « 7 ⇒ 3 », et c'est lui qui avait raison : à
   * 19 jours d'écart, l'ancienne formule déduisait DIX rappels d'un seul, et l'espacement
   * sautait aussitôt à son maximum. Un engagement en retard de trois semaines recevait donc son
   * premier rappel, puis plus rien pendant quinze jours.
   */
  it("le nombre de relances se DÉDUIT de l'écart CUMULÉ, sans compteur à tenir à jour", () => {
    expect(relancesDeduites(t0, null)).toBe(0);
    expect(relancesDeduites(null, j(5))).toBe(0);
    expect(relancesDeduites(t0, t0)).toBe(0);
    expect(relancesDeduites(t0, j(1))).toBe(1);
    expect(relancesDeduites(t0, j(3))).toBe(2);
    expect(relancesDeduites(t0, j(7))).toBe(3);
    expect(relancesDeduites(t0, j(13))).toBe(4);
    // Un premier rappel arrivé TRÈS tard ne vaut pas dix rappels.
    expect(relancesDeduites(t0, j(19))).toBe(4);
    // Au-delà de 49 jours, `delaiRelance` plafonne : le cumul redevient linéaire.
    expect(relancesDeduites(t0, j(49))).toBe(7);
    expect(relancesDeduites(t0, j(63))).toBe(8);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §88-89 — PROPOSER SANS ENVAHIR.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("proactivité raisonnée", () => {
  const f = (extra: Partial<Facteurs> = {}): Facteurs => ({
    impact: 0.6, urgence: 0.6, confiance: 0.9, reversible: 1, coutAttention: 0.2, ...extra,
  });

  it("UNE CONFIANCE FAIBLE FAIT TAIRE, quel que soit l'enjeu", () => {
    const d = conduire(f({ impact: 1, urgence: 1, confiance: 0.3 }));
    expect(d.conduite).toBe("SE_TAIRE");
    expect(d.raison).toMatch(/pas assez sûre/);
  });

  it("réversible, interne, utile : Adam FAIT puis annonce", () => {
    expect(conduire(f({ impact: 0.9, urgence: 0.9, confiance: 1 })).conduite).toBe("AGIR");
  });

  it("UN EFFET EXTERNE NE FRANCHIT JAMAIS le seuil de l'action autonome", () => {
    const facteurs = f({ impact: 1, urgence: 1, confiance: 1 });
    expect(conduire(facteurs).conduite).toBe("AGIR");
    expect(conduire(facteurs, { effetExterne: true }).conduite).toBe("PROPOSER");
  });

  it("une action irréversible se propose, elle ne se prend pas", () => {
    expect(conduire(f({ impact: 1, urgence: 1, confiance: 1, reversible: 0.2 })).conduite).toBe("PROPOSER");
  });

  it("un enjeu faible ne mérite pas d'interrompre", () => {
    const d = conduire(f({ impact: 0.05, urgence: 0.05, confiance: 0.9, reversible: 0.2 }));
    expect(d.conduite).toBe("SE_TAIRE");
    expect(d.raison).toMatch(/trop faible/);
  });

  it("un coût d'attention élevé fait renoncer, et le DIT", () => {
    const d = conduire(f({ impact: 0.4, urgence: 0.2, confiance: 0.9, reversible: 0.3, coutAttention: 1 }));
    expect(d.conduite).toBe("SE_TAIRE");
    expect(d.raison).toMatch(/temps de lecture/);
  });

  it("les facteurs sont bornés : une note absurde ne fait pas exploser le score", () => {
    const d = conduire({ impact: 99, urgence: -5, confiance: 42, reversible: 7, coutAttention: -3 });
    expect(d.score).toBeLessThanOrEqual(1);
    expect(d.score).toBeGreaterThanOrEqual(0);
  });

  it("une relance d'engagement explicite en retard vaut au moins une proposition", () => {
    const d = conduire(facteursRelance({
      joursDeRetard: 7, montantDZD: 4_000_000, relancesDeja: 0, engagementExplicite: true,
    }));
    expect(d.conduite).not.toBe("SE_TAIRE");
  });

  it("une promesse SUPPOSÉE ne déclenche rien — on ne relance pas sur une impression", () => {
    const d = conduire(facteursRelance({
      joursDeRetard: 30, montantDZD: 10_000_000, relancesDeja: 0, engagementExplicite: false,
    }));
    expect(d.conduite).toBe("SE_TAIRE");
  });

  it("plus on a déjà relancé, moins la relance suivante s'impose", () => {
    const base = { joursDeRetard: 7, montantDZD: 500_000, engagementExplicite: true };
    const premiere = conduire(facteursRelance({ ...base, relancesDeja: 0 }));
    const cinquieme = conduire(facteursRelance({ ...base, relancesDeja: 4 }));
    expect(cinquieme.score).toBeLessThan(premiere.score);
  });
});
