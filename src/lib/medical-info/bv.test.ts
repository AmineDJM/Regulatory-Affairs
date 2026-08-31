import { describe, it, expect } from "vitest";
import {
  bvCanDeliver, bvCanRequest, bvMessage, bvStage, bvStageLabel, bvUnlocksAuthorities, type BvInput,
} from "./bv";

const vide: BvInput = { requestId: null, centralStatus: null, orderStatus: null, deliveredAt: null, skippedAt: null };
const demande = (centralStatus: string, orderStatus = "PENDING"): BvInput =>
  ({ ...vide, requestId: "pr1", centralStatus, orderStatus });

describe("le bon de versement — l'état, et qui doit agir", () => {
  it("rien demandé : la déclaration reste FERMÉE et l'écran dit le geste à faire", () => {
    expect(bvStage(vide)).toBe("A_DEMANDER");
    expect(bvUnlocksAuthorities(vide)).toBe(false);
    expect(bvCanRequest(vide)).toBe(true);
    expect(bvMessage("A_DEMANDER")).toMatch(/demand/i);
  });

  it("le circuit se lit dans l'ordre : centre → Finances → réglé", () => {
    expect(bvStage(demande("AWAITING"))).toBe("AU_CENTRE");
    expect(bvStage(demande("APPROVED"))).toBe("AUX_FINANCES");
    expect(bvStage(demande("APPROVED", "PAID"))).toBe("PAYE");
  });

  it("LE PAIEMENT N'OUVRE PAS LA DÉCLARATION — c'est la REMISE du bon qui l'ouvre", () => {
    // « Payé » ne veut pas dire « le PRIM a le papier en main », et c'est le papier qu'on dépose
    // au guichet. Déduire l'un de l'autre débloquerait un geste que le pharmacien ne peut pas
    // encore faire.
    const paye = demande("APPROVED", "PAID");
    expect(bvUnlocksAuthorities(paye)).toBe(false);
    expect(bvCanDeliver(paye)).toBe(true);

    const remis = { ...paye, deliveredAt: new Date() };
    expect(bvStage(remis)).toBe("REMIS");
    expect(bvUnlocksAuthorities(remis)).toBe(true);
    // On ne remet pas deux fois.
    expect(bvCanDeliver(remis)).toBe(false);
  });

  it("on ne remet pas un bon qui n'est pas réglé", () => {
    expect(bvCanDeliver(demande("AWAITING"))).toBe(false);
    expect(bvCanDeliver(demande("APPROVED"))).toBe(false);
    expect(bvCanDeliver(vide)).toBe(false);
  });

  it("le centre qui rend la main, et celui qui refuse, ne se confondent pas", () => {
    expect(bvStage(demande("CHANGES_REQUESTED"))).toBe("RENVOYE");
    expect(bvStage(demande("INFO_REQUESTED"))).toBe("RENVOYE");
    expect(bvStage(demande("REFUSED"))).toBe("REFUSE");
    // Un refus n'enferme pas : on redemande avec ce que le centre attend.
    expect(bvCanRequest(demande("REFUSED"))).toBe(true);
    // Une demande EN COURS ne se double pas.
    expect(bvCanRequest(demande("AWAITING"))).toBe(false);
    expect(bvCanRequest(demande("APPROVED", "PAID"))).toBe(false);
  });

  it("« SANS BV » ouvre la déclaration — sinon un dossier sans taxe resterait bloqué à vie", () => {
    const sans = { ...vide, skippedAt: new Date() };
    expect(bvStage(sans)).toBe("SANS_BV");
    expect(bvUnlocksAuthorities(sans)).toBe(true);
    expect(bvCanRequest(sans)).toBe(false);
  });

  it("LES DEUX ISSUES PRIMENT : un bon remis ne se rouvre pas si le circuit bouge encore", () => {
    const remisMaisRefuse = { ...demande("REFUSED"), deliveredAt: new Date() };
    expect(bvStage(remisMaisRefuse)).toBe("REMIS");
    const sansMaisAuCentre = { ...demande("AWAITING"), skippedAt: new Date() };
    expect(bvStage(sansMaisAuCentre)).toBe("SANS_BV");
  });

  it("chaque état porte un libellé ET un message qui NOMME qui doit agir", () => {
    const etats = ["A_DEMANDER", "AU_CENTRE", "RENVOYE", "REFUSE", "AUX_FINANCES", "PAYE", "REMIS", "SANS_BV"] as const;
    for (const s of etats) {
      expect(bvStageLabel(s).length, s).toBeGreaterThan(0);
      expect(bvMessage(s).length, s).toBeGreaterThan(30);
    }
    // Les deux états d'attente disent QUI attend : « en attente » sans nom fait relancer la
    // mauvaise personne, ou personne.
    expect(bvMessage("AU_CENTRE")).toMatch(/centre de paiement/i);
    expect(bvMessage("PAYE")).toMatch(/finances/i);
  });
});
