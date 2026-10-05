import { describe, expect, it } from "vitest";
import { auteursDAvis, etapeDeReprise, motifVisible, peutResoumettre, refusDuRenvoi, statutLegacyALEtape, type EtapeCircuit } from "./renvoi";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RÈGLES PURES DU RENVOI POUR CORRECTION (§118.186) — où la demande reprend, quel statut elle
 * porte, quel motif le demandeur lit, qui resoumet, qui apprend une modification.
 *
 * La colonne vertébrale du circuit d'aujourd'hui : préliminaire (National Sales) → porte du DG
 * (franchie sous le seuil) → Direction des opérations → Direction Marketing, qui tranche.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const E = (slug: string, position: number, legacyStatus: string | null, title = slug): EtapeCircuit => ({ slug, position, legacyStatus, title });
const PRELIM = E("preliminary", 0, "AWAITING_PRELIMINARY");
const DG = E("dg", 1, "PRELIMINARY_APPROVED");
const FINAL = E("final", 2, "PRELIMINARY_APPROVED");
const MARKETING = E("marketing", 3, "AWAITING_FINAL");
const ETAPES = [PRELIM, DG, FINAL, MARKETING];

describe("etapeDeReprise — l'étape qui a renvoyé, sauf porte rouverte par le montant", () => {
  it("sans porte franchie par le montant, la demande revient à l'étape qui l'a renvoyée", () => {
    expect(etapeDeReprise(ETAPES, MARKETING, new Set(), () => false, []).slug).toBe("marketing");
  });

  it("une porte franchie par le MONTANT et que le montant corrigé ne franchit plus se rouvre", () => {
    expect(etapeDeReprise(ETAPES, MARKETING, new Set(["dg"]), () => false, []).slug).toBe("dg");
  });

  it("une porte franchie par le montant et toujours franchissable ne rouvre rien", () => {
    expect(etapeDeReprise(ETAPES, MARKETING, new Set(["dg"]), () => true, []).slug).toBe("marketing");
  });

  it("une étape APPROUVÉE par une personne n'est jamais une reprise — seules les portes du montant le sont", () => {
    // `franchiesParMontant` ne contient pas « preliminary » : le National Sales a jugé la demande.
    expect(etapeDeReprise(ETAPES, MARKETING, new Set(["dg"]), (e) => e.slug !== "dg", []).slug).toBe("dg");
    expect(etapeDeReprise(ETAPES, MARKETING, new Set(), () => false, []).slug).toBe("marketing");
  });

  it("une étape HORS ROUTE ne se rouvre jamais, même franchie par le montant", () => {
    expect(etapeDeReprise(ETAPES, MARKETING, new Set(["final"]), () => false, ["final"]).slug).toBe("marketing");
  });

  it("une porte SITUÉE APRÈS l'étape qui a renvoyé n'est pas concernée — elle sera jugée en son temps", () => {
    expect(etapeDeReprise(ETAPES, PRELIM, new Set(["dg"]), () => false, []).slug).toBe("preliminary");
  });

  it("la PREMIÈRE porte à rouvrir l'emporte, dans l'ordre du circuit", () => {
    const deux = [PRELIM, DG, E("autre-porte", 2, null), MARKETING];
    expect(etapeDeReprise(deux, MARKETING, new Set(["dg", "autre-porte"]), () => false, []).slug).toBe("dg");
  });
});

describe("statutLegacyALEtape — le statut que porte une demande posée à cette étape", () => {
  it("le statut propre de l'étape", () => {
    expect(statutLegacyALEtape(ETAPES, MARKETING, [], "AWAITING_PRELIMINARY")).toBe("AWAITING_FINAL");
    expect(statutLegacyALEtape(ETAPES, DG, [], "AWAITING_PRELIMINARY")).toBe("PRELIMINARY_APPROVED");
  });

  it("une étape SANS statut propre hérite de la dernière étape qui en déclare un — jamais « À corriger »", () => {
    const sansStatut = E("custom", 2, null);
    expect(statutLegacyALEtape([PRELIM, DG, sansStatut, MARKETING], sansStatut, [], "AWAITING_PRELIMINARY")).toBe("PRELIMINARY_APPROVED");
  });

  it("aucune étape ne déclare de statut : le statut d'entrée", () => {
    const nues = [E("a", 0, null), E("b", 1, null)];
    expect(statutLegacyALEtape(nues, nues[1], [], "AWAITING_PRELIMINARY")).toBe("AWAITING_PRELIMINARY");
  });

  it("une étape hors route ne prête pas son statut", () => {
    const sansStatut = E("custom", 3, null);
    const etapes = [PRELIM, E("hors", 1, "PRELIMINARY_APPROVED"), sansStatut];
    expect(statutLegacyALEtape(etapes, sansStatut, ["hors"], "X")).toBe("AWAITING_PRELIMINARY");
  });
});

describe("motifVisible — ce que le demandeur lit", () => {
  const h = (action: string, note: string, stepTitle = "Direction Marketing") => ({ action, stepTitle, actorName: "Mme D.", note, createdAt: new Date("2026-10-03T10:00:00Z") });

  it("le DERNIER renvoi d'une demande à corriger", () => {
    const m = motifVisible("RETURNED", [h("RETURN", "ancien"), h("APPROVE", "ok"), h("RETURN", "joignez le devis")]);
    expect(m).toEqual({ nature: "RENVOI", etape: "Direction Marketing", auteur: "Mme D.", motif: "joignez le devis", le: "2026-10-03T10:00:00.000Z" });
  });

  it("le refus d'une demande refusée", () => {
    expect(motifVisible("REJECTED", [h("REJECT", "budget épuisé")])?.nature).toBe("REFUS");
  });

  it("rien sur une demande en cours ou relancée — un vieux motif ne s'affiche pas au-dessus d'une demande vivante", () => {
    expect(motifVisible("IN_PROGRESS", [h("RETURN", "corrigé depuis"), h("RESUBMIT", "fait")])).toBeNull();
    expect(motifVisible("IN_PROGRESS", [h("REJECT", "ancien cycle")])).toBeNull();
  });

  it("un avis défavorable intermédiaire n'est PAS un motif adressé au demandeur", () => {
    expect(motifVisible("RETURNED", [h("OPINION_AGAINST", "confidentiel")])).toBeNull();
  });
});

describe("refusDuRenvoi — les trois gardes, chacune avec son cas", () => {
  const ok = { pouvoirs: ["APPROVE", "REJECT", "COMMENT"], motif: "joignez le devis", demandeurId: "k" };
  it("le renvoi part quand les trois faits sont là", () => expect(refusDuRenvoi(ok)).toBeNull());
  it("une étape qui ne peut pas REFUSER ne renvoie pas — aucun pouvoir neuf", () => {
    expect(refusDuRenvoi({ ...ok, pouvoirs: ["APPROVE", "COMMENT"] })).toMatch(/elle ne peut pas refuser/);
  });
  it("sans motif, pas de renvoi", () => expect(refusDuRenvoi({ ...ok, motif: null })).toMatch(/motif du renvoi est obligatoire/));
  it("sans demandeur, personne à qui renvoyer", () => expect(refusDuRenvoi({ ...ok, demandeurId: null })).toMatch(/pas de demandeur/));
});

describe("peutResoumettre — le demandeur, ou la vue globale, et personne d'autre", () => {
  it("le demandeur", () => expect(peutResoumettre({ id: "k", vueGlobale: false }, "k")).toBe(true));
  it("la vue globale", () => expect(peutResoumettre({ id: "d", vueGlobale: true }, "k")).toBe(true));
  it("un validateur ne resoumet pas à la place du demandeur", () => expect(peutResoumettre({ id: "ns", vueGlobale: false }, "k")).toBe(false));
  it("une demande sans demandeur : seule la vue globale", () => {
    expect(peutResoumettre({ id: "x", vueGlobale: false }, null)).toBe(false);
    expect(peutResoumettre({ id: "x", vueGlobale: true }, null)).toBe(true);
  });
});

describe("auteursDAvis — qui apprend une modification faite après coup", () => {
  it("les personnes qui ont approuvé, émis un avis, sauté, renvoyé — une fois chacune", () => {
    const h = [
      { action: "CREATE", actorId: "k" }, { action: "APPROVE", actorId: "ns" }, { action: "AUTO_SKIP", actorId: "ns" },
      { action: "RETURN", actorId: "pm" }, { action: "RESUBMIT", actorId: "k" }, { action: "APPROVE", actorId: "ns" },
      { action: "COMMENT", actorId: "dg" }, { action: "OPINION_AGAINST", actorId: "dir" },
    ];
    expect(auteursDAvis(h, ["k"]).sort()).toEqual(["dir", "ns", "pm"]);
  });

  it("ni l'auteur de la modification, ni le demandeur, ni un franchissement automatique", () => {
    expect(auteursDAvis([{ action: "AUTO_SKIP", actorId: "ns" }, { action: "APPROVE", actorId: "moi" }], ["moi", null])).toEqual([]);
  });
});
