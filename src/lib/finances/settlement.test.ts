import { describe, it, expect } from "vitest";
import {
  PAYMENT_PATHS, paymentPath, nonSettlingPaths, horsCentre,
  invoiceDirection, invoiceSettlementLabel, settlementAction, canSendToSettlement,
} from "./settlement";

describe("PAYMENT_PATHS — le registre qu'on relit avant d'ajouter un geste d'argent", () => {
  it("chaque chemin porte une clé unique", () => {
    const keys = PAYMENT_PATHS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Un chemin sans justification est un chemin qu'on ne peut pas discuter en revue.
  it("chaque chemin dit POURQUOI, en une phrase non vide", () => {
    for (const p of PAYMENT_PATHS) {
      expect(p.why.trim().length, p.key).toBeGreaterThan(20);
      expect(p.label.trim().length, p.key).toBeGreaterThan(0);
      expect(p.module.trim().length, p.key).toBeGreaterThan(0);
    }
  });

  it("les chemins de règlement connus sont tous inscrits", () => {
    for (const key of ["expense-order", "payment-request", "payroll", "finance-direct", "invoice", "petty-cash-allotment"]) {
      expect(paymentPath(key)?.settles, key).toBe(true);
    }
  });

  // La seule exception, et elle est arithmétique : l'argent est déjà sorti à la remise.
  it("un SEUL chemin ne solde pas — l'achat sur caisse d'avance", () => {
    const none = nonSettlingPaths();
    expect(none.map((p) => p.key)).toEqual(["petty-cash-expense"]);
    expect(none[0].why).toContain("deux fois");
  });

  it("une clé inconnue ne rend rien plutôt qu'un chemin par défaut", () => {
    expect(paymentPath("inexistant")).toBeUndefined();
  });

  // « Concernant les paiements, c'est clair, tous passent par le centre de paiements »
  // (Direction, 09/2026). Chaque chemin dit s'il y passe — et un chemin qui n'y passe pas dit
  // POURQUOI, sans quoi l'exception redevient invisible (§118.148).
  it("chaque chemin dit s'il passe par le CENTRE, et pourquoi quand ce n'est pas le cas", () => {
    for (const p of PAYMENT_PATHS) {
      expect(["AUTORISE", "ENREGISTRE", "HORS_CENTRE"], p.key).toContain(p.centre);
      expect(p.centreWhy.trim().length, p.key).toBeGreaterThan(20);
    }
  });

  it("les exceptions à la règle de la Direction sont NOMMÉES — et ce sont exactement celles qu'on a mesurées", () => {
    // Si ce cas tombe, c'est qu'un chemin a changé de camp : soit la Direction a tranché (et le
    // registre doit le dire), soit un nouveau décaissement échappe au centre sans décision.
    expect(horsCentre().map((p) => p.key).sort()).toEqual(["payroll", "petty-cash-allotment", "petty-cash-top-up"]);
    for (const p of horsCentre()) expect(p.centreWhy, p.key).toMatch(/Direction/);
  });

  it("les règlements décidés dans l'ERP passent par le centre : ordre, demande, facture", () => {
    for (const key of ["expense-order", "payment-request", "invoice-settlement"]) {
      expect(paymentPath(key)?.centre, key).toBe("AUTORISE");
    }
  });

  it("la rallonge de caisse s'écrit au livre comme la remise qu'elle complète", () => {
    expect(paymentPath("petty-cash-top-up")?.settles).toBe(true);
  });
});

describe("invoiceDirection — on ne devine jamais le sens", () => {
  it("« IN » pour une facture émise", () => {
    expect(invoiceDirection("IN")).toBe("IN");
  });

  // Une écriture posée à l'envers est pire qu'une écriture absente : elle se voit moins.
  it("tout le reste vaut « OUT » — y compris l'absence de valeur", () => {
    expect(invoiceDirection("OUT")).toBe("OUT");
    expect(invoiceDirection(null)).toBe("OUT");
    expect(invoiceDirection(undefined)).toBe("OUT");
    expect(invoiceDirection("n'importe quoi")).toBe("OUT");
  });
});

describe("invoiceSettlementLabel", () => {
  it("porte la référence quand elle existe", () => {
    expect(invoiceSettlementLabel({ reference: "F-2026-12", title: "Prestation" })).toBe("Facture F-2026-12 — Prestation");
  });

  it("reste lisible sans référence", () => {
    expect(invoiceSettlementLabel({ reference: null, title: "Prestation" })).toBe("Facture — Prestation");
    expect(invoiceSettlementLabel({ reference: "   ", title: "Prestation" })).toBe("Facture — Prestation");
  });
});

describe("settlementAction", () => {
  const D = new Date("2026-08-20");

  it("crée l'écriture au premier marquage", () => {
    expect(settlementAction({ paidDate: D, transactionId: null })).toBe("CREATE");
  });

  it("retire l'écriture quand on dé-marque le règlement", () => {
    expect(settlementAction({ paidDate: null, transactionId: "tx-1" })).toBe("REMOVE");
  });

  // Ré-enregistrer une facture déjà réglée ne doit pas doubler son écriture.
  it("ne fait rien si l'état est déjà cohérent", () => {
    expect(settlementAction({ paidDate: D, transactionId: "tx-1" })).toBe("NOOP");
    expect(settlementAction({ paidDate: null, transactionId: null })).toBe("NOOP");
  });

  // LE DÉFAUT QU'ON FERME : deux chemins vers l'argent sur la même pièce, donc deux écritures
  // pour un seul décaissement — et un total du mois qui gonfle sans que rien ne le signale.
  it("UNE FACTURE PARTIE AU CIRCUIT NE S'ÉCRIT PAS UNE SECONDE FOIS", () => {
    expect(settlementAction({ paidDate: D, transactionId: null, expenseOrderId: "od-1" })).toBe("NOOP");
  });

  it("mais une écriture directe posée AVANT l'envoi reste défaisable", () => {
    // Sans cela elle resterait au livre, sans plus rien pour la corriger.
    expect(settlementAction({ paidDate: null, transactionId: "tx-1", expenseOrderId: "od-1" })).toBe("REMOVE");
  });
});

describe("canSendToSettlement — l'autre bout du même verrou", () => {
  const D2 = new Date("2026-08-20");
  const base = { kind: "INVOICE", amount: 120_000 as number | null, paidDate: null as Date | null, expenseOrderId: null as string | null };

  it("une facture montée et non réglée part au règlement", () => {
    expect(canSendToSettlement(base).ok).toBe(true);
  });

  it("un contrat ne s'envoie pas au règlement", () => {
    const r = canSendToSettlement({ ...base, kind: "CONTRACT" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/facture/i);
  });

  it("DÉJÀ PARTIE : on ne l'envoie pas deux fois", () => {
    const r = canSendToSettlement({ ...base, expenseOrderId: "od-1" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/déjà partie/);
  });

  // Le double comptage se referme des DEUX côtés : le circuit refuse ce que le direct a soldé.
  it("DÉJÀ RÉGLÉE EN DIRECT : l'envoyer décaisserait une seconde fois", () => {
    const r = canSendToSettlement({ ...base, paidDate: D2 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/seconde fois/);
  });

  it("sans montant, il n'y a rien à faire payer", () => {
    expect(canSendToSettlement({ ...base, amount: null }).ok).toBe(false);
    expect(canSendToSettlement({ ...base, amount: 0 }).ok).toBe(false);
  });

  // LA FACTURE QUI DÉCOULE D'UN BC (§118.148) : payer l'exécution d'une commande que la société
  // n'a pas engagée est le contournement exact que la porte du BC existe pour fermer.
  it("un BC amont EN ATTENTE de son centre bloque l'envoi, en nommant le BC et le centre", () => {
    const r = canSendToSettlement({ ...base, bc: { reference: "BC-77", porte: { centre: "AD_PRO", etat: "EN_ATTENTE", source: "DOCUMENT" } } });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("BC-77");
    expect(r.ok === false && r.error).toContain("centre de validation Ad & Pro");
  });
  it("un BC amont REFUSÉ bloque aussi — un refus ne se contourne pas par la facture", () => {
    expect(canSendToSettlement({ ...base, bc: { reference: "BC-78", porte: { centre: "VALIDATION", etat: "REFUSE", source: "DOCUMENT" } } }).ok).toBe(false);
  });
  it("un BC amont VALIDÉ laisse partir la facture", () => {
    expect(canSendToSettlement({ ...base, bc: { reference: "BC-79", porte: { centre: "VALIDATION", etat: "VALIDE", source: "DOCUMENT" } } }).ok).toBe(true);
  });
  it("un BC amont SANS porte (antérieur à la règle) ne bloque rien — sinon tout le registre gèlerait", () => {
    expect(canSendToSettlement({ ...base, bc: { reference: "BC-80", porte: null } }).ok).toBe(true);
  });
});
