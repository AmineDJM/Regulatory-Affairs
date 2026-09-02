import { describe, it, expect } from "vitest";
import {
  slipStage, canRequestSlipPayment, canDeliverSlip, slipsSummary, canEditSlips,
  canRequestSlipsValidation, slipsMessage, slipsLotStage, SLIP_STAGE_LABEL,
  type SlipLike,
} from "./slips";

let n = 0;
const slip = (o: Partial<SlipLike> = {}): SlipLike => ({
  id: `s${++n}`, label: `Matériel ${n}`, amount: 10_000,
  requestId: null, centralStatus: null, orderStatus: null, deliveredAt: null,
  ...o,
});

describe("où en est UN bon de versement", () => {
  it("rien de demandé = quittance à demander", () => {
    expect(slipStage(slip())).toBe("A_DEMANDER");
  });

  it("suit le centre de paiement puis le règlement", () => {
    expect(slipStage(slip({ requestId: "p1", centralStatus: "AWAITING" }))).toBe("AU_CENTRE");
    expect(slipStage(slip({ requestId: "p1", centralStatus: "CHANGES_REQUESTED" }))).toBe("RENVOYE");
    expect(slipStage(slip({ requestId: "p1", centralStatus: "INFO_REQUESTED" }))).toBe("RENVOYE");
    expect(slipStage(slip({ requestId: "p1", centralStatus: "REFUSED" }))).toBe("REFUSE");
    expect(slipStage(slip({ requestId: "p1", centralStatus: "APPROVED", orderStatus: "PENDING" }))).toBe("AUX_FINANCES");
    expect(slipStage(slip({ requestId: "p1", centralStatus: "APPROVED", orderStatus: "PAID" }))).toBe("PAYE");
  });

  it("LA REMISE PRIME SUR TOUT — la quittance est en main, la question est close", () => {
    // « Payé » ne veut pas dire « le pharmacien a le papier » : c'est ce papier qu'on dépose.
    expect(slipStage(slip({ requestId: "p1", centralStatus: "REFUSED", deliveredAt: new Date() }))).toBe("REMIS");
  });
});

describe("demander le paiement d'un bon", () => {
  it("ouvert dès le lot validé", () => {
    expect(canRequestSlipPayment(slip())).toBe(true);
  });

  it("UN REFUS DU CENTRE ROUVRE CE BON, ET LUI SEUL", () => {
    // Renvoyer le pharmacien à la validation du lot lui ferait refaire signer cinq matériels
    // pour un montant à corriger sur un seul.
    expect(canRequestSlipPayment(slip({ requestId: "p1", centralStatus: "REFUSED" }))).toBe(true);
  });

  it("fermé pendant tout le reste du parcours", () => {
    for (const s of ["AWAITING", "CHANGES_REQUESTED", "APPROVED"]) {
      expect(canRequestSlipPayment(slip({ requestId: "p1", centralStatus: s })), s).toBe(false);
    }
    expect(canRequestSlipPayment(slip({ deliveredAt: new Date() }))).toBe(false);
  });

  it("les Finances remettent une quittance RÉGLÉE, et une seule fois", () => {
    expect(canDeliverSlip(slip({ requestId: "p1", centralStatus: "APPROVED", orderStatus: "PAID" }))).toBe(true);
    expect(canDeliverSlip(slip({ requestId: "p1", centralStatus: "APPROVED", orderStatus: "PENDING" }))).toBe(false);
    expect(canDeliverSlip(slip({ requestId: "p1", orderStatus: "PAID", deliveredAt: new Date() }))).toBe(false);
  });
});

describe("l'état du lot", () => {
  it("rien de demandé = à faire valider", () => {
    expect(slipsLotStage({ validationId: null, validationStatus: null })).toBe("A_DEMANDER");
  });

  it("suit la demande de validation, état par état", () => {
    expect(slipsLotStage({ validationId: "v", validationStatus: "PENDING" })).toBe("EN_VALIDATION");
    expect(slipsLotStage({ validationId: "v", validationStatus: "CHANGES_REQUESTED" })).toBe("VALIDATION_A_REVOIR");
    expect(slipsLotStage({ validationId: "v", validationStatus: "REJECTED" })).toBe("VALIDATION_REFUSEE");
    expect(slipsLotStage({ validationId: "v", validationStatus: "APPROVED" })).toBe("QUITTANCE_A_DEMANDER");
  });

  it("UN ÉTAT INCONNU NE DÉVERROUILLE RIEN — il reste « en validation »", () => {
    expect(slipsLotStage({ validationId: "v", validationStatus: "?" })).toBe("EN_VALIDATION");
  });
});

describe("le lot de bons", () => {
  it("SE MODIFIE TANT QU'IL N'EST PAS SIGNÉ, et plus après", () => {
    // Ajouter un sixième bon après la signature ferait payer un versement que personne n'a vu
    // passer ; en retirer un laisserait une signature portant sur autre chose que ce qui existe.
    expect(canEditSlips("A_DEMANDER")).toBe(true);
    expect(canEditSlips("VALIDATION_REFUSEE")).toBe(true);
    expect(canEditSlips("EN_VALIDATION")).toBe(false);
    expect(canEditSlips("QUITTANCE_A_DEMANDER")).toBe(false);
  });

  it("UNE LISTE VIDE NE PART PAS EN VALIDATION — ce serait faire signer une intention", () => {
    const r = canRequestSlipsValidation("A_DEMANDER", []);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/matériels/i);
  });

  it("part dès qu'un matériel est listé", () => {
    expect(canRequestSlipsValidation("A_DEMANDER", [slip()])).toEqual({ ok: true });
  });

  it("ne repart pas quand il est déjà soumis", () => {
    expect(canRequestSlipsValidation("EN_VALIDATION", [slip()]).ok).toBe(false);
  });
});

describe("la synthèse du lot", () => {
  it("ADDITIONNE LES MONTANTS ANNONCÉS et compte ce qui reste à faire", () => {
    const s = slipsSummary([
      slip({ amount: 12_000, deliveredAt: new Date() }),
      slip({ amount: 8_000, requestId: "p2", centralStatus: "AWAITING" }),
      slip({ amount: 5_000 }),
    ]);
    expect(s.count).toBe(3);
    expect(s.announced).toBe(25_000);
    expect(s.delivered).toBe(1);
    expect(s.toRequest).toBe(1);
    expect(s.allDelivered).toBe(false);
  });

  it("un montant absent ne casse pas le total", () => {
    expect(slipsSummary([slip({ amount: null }), slip({ amount: 3_000 })]).announced).toBe(3_000);
  });

  it("ZÉRO BON N'EST PAS « TOUT REMIS » — un dossier vide n'a rien versé", () => {
    expect(slipsSummary([]).allDelivered).toBe(false);
    expect(slipsSummary([slip({ deliveredAt: new Date() })]).allDelivered).toBe(true);
  });
});

describe("ce que l'écran dit du lot", () => {
  it("demande d'abord de SÉPARER, puis de faire valider", () => {
    expect(slipsMessage("A_DEMANDER", slipsSummary([]))).toMatch(/séparez/i);
    expect(slipsMessage("A_DEMANDER", slipsSummary([slip()]))).toMatch(/faites valider/i);
  });

  it("puis nomme ce qui reste à demander, bon par bon", () => {
    const s = slipsSummary([slip(), slip({ deliveredAt: new Date() })]);
    expect(slipsMessage("QUITTANCE_A_DEMANDER", s)).toMatch(/séparément/i);
    expect(slipsMessage("QUITTANCE_A_DEMANDER", slipsSummary([slip({ deliveredAt: new Date() })]))).toMatch(/remises/i);
  });

  it("chaque étape d'un bon porte un libellé lisible", () => {
    expect(SLIP_STAGE_LABEL.REMIS).toMatch(/remise/i);
    expect(SLIP_STAGE_LABEL.A_DEMANDER).toMatch(/à demander/i);
  });
});
