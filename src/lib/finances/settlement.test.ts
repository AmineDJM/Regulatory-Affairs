import { describe, it, expect } from "vitest";
import {
  PAYMENT_PATHS, paymentPath, nonSettlingPaths,
  invoiceDirection, invoiceSettlementLabel, settlementAction,
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
  it("porte le numéro quand il existe", () => {
    expect(invoiceSettlementLabel({ number: "F-2026-12", title: "Prestation" })).toBe("Facture F-2026-12 — Prestation");
  });

  it("reste lisible sans numéro", () => {
    expect(invoiceSettlementLabel({ number: null, title: "Prestation" })).toBe("Facture — Prestation");
    expect(invoiceSettlementLabel({ number: "   ", title: "Prestation" })).toBe("Facture — Prestation");
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
});
