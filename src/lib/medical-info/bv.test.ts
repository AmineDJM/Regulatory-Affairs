import { describe, it, expect } from "vitest";
import {
  bvCanDeliver, bvCanRequest, bvCanRequestQuittance, bvMessage, bvStage, bvStageLabel,
  bvUnlocksAuthorities, type BvInput,
} from "./bv";

const vide: BvInput = {
  validationId: null, validationStatus: null,
  requestId: null, centralStatus: null, orderStatus: null,
  deliveredAt: null, skippedAt: null,
};
/** Le BON demandé, dans l'état de sa validation. */
const bon = (validationStatus: string): BvInput => ({ ...vide, validationId: "v1", validationStatus });
/** Le bon ACCORDÉ, et la quittance demandée, dans l'état de son circuit de paiement. */
const quittance = (centralStatus: string, orderStatus = "PENDING"): BvInput =>
  ({ ...bon("APPROVED"), requestId: "pr1", centralStatus, orderStatus });

describe("premier temps — le bon est ACCORDÉ avant qu'aucun argent ne soit engagé", () => {
  it("rien demandé : la déclaration reste FERMÉE et l'écran dit le geste à faire", () => {
    expect(bvStage(vide)).toBe("A_DEMANDER");
    expect(bvUnlocksAuthorities(vide)).toBe(false);
    expect(bvCanRequest(vide)).toBe(true);
    expect(bvCanRequestQuittance(vide)).toBe(false);
    expect(bvMessage("A_DEMANDER")).toMatch(/demand/i);
  });

  it("la validation se lit dans ses quatre issues", () => {
    expect(bvStage(bon("PENDING"))).toBe("EN_VALIDATION");
    expect(bvStage(bon("CHANGES_REQUESTED"))).toBe("VALIDATION_A_REVOIR");
    expect(bvStage(bon("REJECTED"))).toBe("VALIDATION_REFUSEE");
    expect(bvStage(bon("APPROVED"))).toBe("QUITTANCE_A_DEMANDER");
  });

  it("AUCUNE QUITTANCE TANT QUE LE BON N'EST PAS ACCORDÉ — c'est la raison d'être de la marche", () => {
    // Sans cette garde, on engagerait l'argent avant que quiconque ait dit que le versement
    // est dû, et le centre de PAIEMENT se retrouverait à trancher une question de fond.
    for (const etat of ["PENDING", "CHANGES_REQUESTED", "REJECTED"]) {
      expect(bvCanRequestQuittance(bon(etat)), etat).toBe(false);
    }
    expect(bvCanRequestQuittance(bon("APPROVED"))).toBe(true);
  });

  it("un REFUS de principe rouvre la demande de bon ; une demande en cours ne se double pas", () => {
    expect(bvCanRequest(bon("REJECTED"))).toBe(true);
    expect(bvCanRequest(bon("PENDING"))).toBe(false);
    // « À revoir » se reprend DANS son circuit : en ouvrir une seconde laisserait deux
    // demandes vivantes pour un seul bon.
    expect(bvCanRequest(bon("CHANGES_REQUESTED"))).toBe(false);
    expect(bvCanRequest(bon("APPROVED"))).toBe(false);
  });
});

describe("second temps — la quittance suit le circuit commun", () => {
  it("centre de paiement → Finances → réglé", () => {
    expect(bvStage(quittance("AWAITING"))).toBe("AU_CENTRE");
    expect(bvStage(quittance("APPROVED"))).toBe("AUX_FINANCES");
    expect(bvStage(quittance("APPROVED", "PAID"))).toBe("PAYE");
  });

  it("LE PAIEMENT N'OUVRE PAS LA DÉCLARATION — c'est la REMISE de la quittance qui l'ouvre", () => {
    // « Payé » ne veut pas dire « le PRIM a le papier en main », et c'est le papier qu'on dépose
    // au guichet. Déduire l'un de l'autre débloquerait un geste qu'il ne peut pas encore faire.
    const paye = quittance("APPROVED", "PAID");
    expect(bvUnlocksAuthorities(paye)).toBe(false);
    expect(bvCanDeliver(paye)).toBe(true);

    const remis = { ...paye, deliveredAt: new Date() };
    expect(bvStage(remis)).toBe("REMIS");
    expect(bvUnlocksAuthorities(remis)).toBe(true);
    expect(bvCanDeliver(remis)).toBe(false); // on ne remet pas deux fois
  });

  it("on ne remet pas une quittance qui n'est pas réglée", () => {
    expect(bvCanDeliver(quittance("AWAITING"))).toBe(false);
    expect(bvCanDeliver(quittance("APPROVED"))).toBe(false);
    expect(bvCanDeliver(vide)).toBe(false);
  });

  it("le centre qui rend la main, et celui qui refuse, ne se confondent pas", () => {
    expect(bvStage(quittance("CHANGES_REQUESTED"))).toBe("RENVOYE");
    expect(bvStage(quittance("INFO_REQUESTED"))).toBe("RENVOYE");
    expect(bvStage(quittance("REFUSED"))).toBe("REFUSE");
  });

  it("un refus du centre rouvre LA QUITTANCE, pas les trois signatures", () => {
    // Le bon reste accordé : ce qui a été refusé, c'est ce règlement-ci. Renvoyer le pharmacien
    // à la première marche lui ferait refaire trois signatures pour un montant à corriger.
    const refuse = quittance("REFUSED");
    expect(bvCanRequestQuittance(refuse)).toBe(true);
    expect(bvCanRequest(refuse)).toBe(false);
  });
});

describe("les deux issues, et les dossiers d'avant", () => {
  it("« SANS BV » ouvre la déclaration — sinon un dossier sans taxe resterait bloqué à vie", () => {
    const sans = { ...vide, skippedAt: new Date() };
    expect(bvStage(sans)).toBe("SANS_BV");
    expect(bvUnlocksAuthorities(sans)).toBe(true);
    expect(bvCanRequest(sans)).toBe(false);
    expect(bvCanRequestQuittance(sans)).toBe(false);
  });

  it("LES DEUX ISSUES PRIMENT : une quittance remise ne se rouvre pas si le circuit bouge encore", () => {
    const remisMaisRefuse = { ...quittance("REFUSED"), deliveredAt: new Date() };
    expect(bvStage(remisMaisRefuse)).toBe("REMIS");
    const sansMaisAuCentre = { ...quittance("AWAITING"), skippedAt: new Date() };
    expect(bvStage(sansMaisAuCentre)).toBe("SANS_BV");
  });

  it("UN DOSSIER D'AVANT LA VALIDATION reprend où il en est, il ne recommence pas", () => {
    // Ceux ouverts avant que cette marche existe ont une demande de paiement et AUCUNE
    // validation. Les renvoyer à « à demander » leur ferait refaire un circuit déjà instruit,
    // et invaliderait des autorisations réellement données.
    const ancien: BvInput = { ...vide, requestId: "pr-vieux", centralStatus: "APPROVED", orderStatus: "PAID" };
    expect(bvStage(ancien)).toBe("PAYE");
    expect(bvCanDeliver(ancien)).toBe(true);
  });
});

describe("ce que l'écran dit", () => {
  it("chaque état porte un libellé ET un message qui NOMME qui doit agir", () => {
    const etats = [
      "A_DEMANDER", "EN_VALIDATION", "VALIDATION_A_REVOIR", "VALIDATION_REFUSEE",
      "QUITTANCE_A_DEMANDER", "AU_CENTRE", "RENVOYE", "REFUSE", "AUX_FINANCES", "PAYE",
      "REMIS", "SANS_BV",
    ] as const;
    for (const s of etats) {
      expect(bvStageLabel(s).length, s).toBeGreaterThan(0);
      expect(bvMessage(s).length, s).toBeGreaterThan(30);
    }
    // Les états d'attente disent QUI attend : « en attente » sans nom fait relancer la mauvaise
    // personne, ou personne.
    expect(bvMessage("EN_VALIDATION")).toMatch(/chef de produit/i);
    expect(bvMessage("AU_CENTRE")).toMatch(/centre de paiement/i);
    expect(bvMessage("PAYE")).toMatch(/finances/i);
  });
});
