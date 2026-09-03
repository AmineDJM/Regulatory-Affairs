import { describe, it, expect } from "vitest";
import {
  invoiceTally, natureFromParam, legalViewScope, legalWriteAllowed,
  type InvoiceTallyRow,
} from "./invoices";
// La NATURE et l'ÉTAT DE RÈGLEMENT sont du vocabulaire : ils vivent dans `lib/labels`, lisibles
// de tous — écran Legal, fiche marché, recherche, frise, Adam.
import { isInvoice, invoiceSettlementState, INVOICE_SETTLEMENT } from "@/lib/labels";

const row = (o: Partial<InvoiceTallyRow> = {}): InvoiceTallyRow => ({
  kind: "INVOICE", amount: 100_000, endDate: null, paidDate: null, expenseOrderId: null, status: "ACTIVE", ...o,
});

describe("une facture est un document légal de nature « facture »", () => {
  it("et rien d'autre ne l'est", () => {
    expect(isInvoice("INVOICE")).toBe(true);
    expect(isInvoice("CONTRACT")).toBe(false);
    expect(isInvoice("PURCHASE_ORDER")).toBe(false);
  });
});

describe("où en est le règlement", () => {
  it("À RÉGLER tant que rien n'est parti", () => {
    expect(invoiceSettlementState({ kind: "INVOICE", paidDate: null })).toBe("UNPAID");
  });

  // « Payée / à payer » ment sur le cas le plus fréquent : quelqu'un s'en occupe déjà, et la
  // relancer ferait un second ordre de dépense pour la même somme.
  it("EN RÈGLEMENT est un état à part entière — pas « à faire »", () => {
    expect(invoiceSettlementState({ kind: "INVOICE", paidDate: null, expenseOrderId: "od-1" })).toBe("IN_CIRCUIT");
  });

  it("RÉGLÉE l'emporte sur le circuit — sinon on relance un virement déjà parti", () => {
    expect(invoiceSettlementState({ kind: "INVOICE", paidDate: new Date("2026-03-02"), expenseOrderId: "od-1" })).toBe("PAID");
  });

  it("un contrat n'a pas d'état de règlement, et n'en affiche donc aucun", () => {
    expect(invoiceSettlementState({ kind: "CONTRACT", paidDate: null })).toBe("NOT_INVOICE");
    expect(INVOICE_SETTLEMENT.NOT_INVOICE).toBeUndefined();
    expect(INVOICE_SETTLEMENT.IN_CIRCUIT?.tone).toBe("info");
  });
});

describe("ce qui reste à payer, et combien", () => {
  const lignes = [
    row({ amount: 300_000 }),
    row({ amount: 120_000, expenseOrderId: "od-1" }),
    row({ amount: 90_000, paidDate: "2026-02-11" }),
    row({ amount: 500_000, status: "CANCELLED" }),
    row({ kind: "CONTRACT", amount: 9_000_000 }),
  ];

  it("LE TOTAL NE COMPTE QUE LES FACTURES — un contrat n'est pas une dette de ce mois-ci", () => {
    const t = invoiceTally(lignes);
    expect(t.unpaidTotal).toBe(420_000);
  });

  // Elle ne sera jamais payée : la laisser gonflerait une dette qui n'existe pas, et la compter
  // dans « combien de factures » ferait chercher une pièce qui n'a plus à être traitée.
  it("une facture ANNULÉE ne compte NULLE PART — ni au total, ni au décompte", () => {
    const t = invoiceTally(lignes);
    expect(t.count).toBe(3);
    expect(t.unpaid).toBe(2);
  });

  // Elle n'est pas payée : la sortir du reste à payer ferait clore un dossier ouvert.
  it("une facture EN RÈGLEMENT reste dans le reste à payer", () => {
    expect(invoiceTally([row({ amount: 120_000, expenseOrderId: "od-1" })]).unpaid).toBe(1);
  });

  it("l'échéance dépassée se compte sur les seules factures non réglées", () => {
    const t = invoiceTally(
      [
        row({ endDate: "2026-01-05" }),
        row({ endDate: "2026-01-05", paidDate: "2026-01-04" }),
        row({ endDate: "2026-12-31" }),
        row({ endDate: null }),
      ],
      new Date("2026-06-01"),
    );
    expect(t.overdue).toBe(1);
  });

  it("aucune facture : des zéros, pas des NaN", () => {
    expect(invoiceTally([])).toEqual({ count: 0, unpaid: 0, unpaidTotal: 0, overdue: 0 });
  });
});

describe("qui voit quoi, une fois les deux registres fondus", () => {
  it("LEGAL VOIT TOUT le registre", () => {
    expect(legalViewScope({ onLegal: true, onFinances: false })).toBe("ALL");
    expect(legalViewScope({ onLegal: true, onFinances: true })).toBe("ALL");
  });

  // Centraliser ne doit rien retirer à personne : la comptabilité venait lire ce qui reste
  // à payer, et le registre des engagements ne lui est pas ouvert pour autant.
  it("LA COMPTABILITÉ NE PERD PAS LES FACTURES — et ne gagne pas les baux", () => {
    expect(legalViewScope({ onLegal: false, onFinances: true })).toBe("INVOICES_ONLY");
  });

  it("ni l'un ni l'autre : rien", () => {
    expect(legalViewScope({ onLegal: false, onFinances: false })).toBe("NONE");
  });

  it("écrire : la comptabilité tient les factures, Legal tient le registre", () => {
    expect(legalWriteAllowed({ onLegal: false, onFinances: true, kind: "INVOICE" })).toBe(true);
    expect(legalWriteAllowed({ onLegal: false, onFinances: true, kind: "LEASE" })).toBe(false);
    expect(legalWriteAllowed({ onLegal: true, onFinances: false, kind: "LEASE" })).toBe(true);
    expect(legalWriteAllowed({ onLegal: false, onFinances: false, kind: "INVOICE" })).toBe(false);
  });
});

describe("la nature demandée par l'URL", () => {
  const NATURES = ["CONTRACT", "INVOICE", "PURCHASE_ORDER"];

  it("« les factures » est une VUE de la liste, pas un autre endroit", () => {
    expect(natureFromParam("INVOICE", NATURES)).toBe("INVOICE");
    expect(natureFromParam("invoice", NATURES)).toBe("INVOICE");
  });

  // Un lien mal recopié doit montrer les documents, pas faire croire qu'il n'y en a plus.
  it("une nature inconnue ne filtre RIEN plutôt que de vider la liste", () => {
    expect(natureFromParam("FACTURES", NATURES)).toBe("");
    expect(natureFromParam(null, NATURES)).toBe("");
    expect(natureFromParam(undefined, NATURES)).toBe("");
  });
});
