import { describe, expect, it } from "vitest";
import { CATEGORIES_BV, ETAPES_BV, lignesBv, natureDuLibelle, prevoirBv75, totauxBv, type DossierBv, type OrdreBv } from "./bv";
import { BV_REQUEST_STEPS, BV_PAYMENT_STEPS, REG_STEPS } from "@/lib/regulatory-workflow";

/**
 * BUDGET REGULATORY — les BV 25 % / 75 % des dossiers d'enregistrement : leur nature, leur statut, leur place dans
 * l'enveloppe, et le 75 % attendu.
 */

const dossier = (id: string, extra: Partial<DossierBv> = {}): DossierBv => ({
  id, reference: `REG-${id}`, dci: "Paracétamol", nom: null, status: "IN_PREPARATION", workflow: null, ...extra,
});
const ordre = (id: string, productId: string, label: string, amount: number, extra: Partial<OrdreBv> = {}): OrdreBv => ({
  id, productId, label, amount, status: "PAID", paidDate: new Date("2027-03-10T00:00:00Z"), createdAt: new Date("2027-03-01T00:00:00Z"),
  budgetCategoryId: null, transactionCategoryId: null, ...extra,
});
const CATS = { bv25: "cat25", bv75: "cat75" };

describe("ce que sont les BV 25 % / 75 % dans le code", () => {
  it("ce sont les étapes du processus d'enregistrement — et la nature se lit sur le libellé de l'ordre", () => {
    expect(BV_REQUEST_STEPS[ETAPES_BV["25"].demande]).toBe("BV 25 %");
    expect(BV_REQUEST_STEPS[ETAPES_BV["75"].demande]).toBe("BV 75 %");
    expect(BV_PAYMENT_STEPS[ETAPES_BV["25"].demande]).toBe(ETAPES_BV["25"].paiement);
    expect(BV_PAYMENT_STEPS[ETAPES_BV["75"].demande]).toBe(ETAPES_BV["75"].paiement);
    // Le 75 % se paie AVANT le dépôt — pas à la décision.
    const rang = (k: string) => REG_STEPS.findIndex((s) => s.key === k);
    expect(rang("bv75_pay")).toBeLessThan(rang("depot"));
    expect(rang("bv25_pay")).toBeLessThan(rang("presub_req"));
  });

  it("la nature d'un ordre : « BV 25 % — … » / « BV 75 % — … » ; un libellé libre ne se devine pas", () => {
    expect(natureDuLibelle("BV 25 % — REG-2026-001 Paracétamol")).toBe("25");
    expect(natureDuLibelle("BV 75 % — REG-2026-001 Paracétamol 25 %")).toBe("75");
    expect(natureDuLibelle("BV1 — REG-2026-001")).toBeNull();
    expect(natureDuLibelle("BV d'enregistrement — REG")).toBeNull();
    expect(natureDuLibelle(null)).toBeNull();
  });

  it("deux catégories d'office, une par part", () => {
    expect(CATEGORIES_BV.map((c) => c.nature)).toEqual(["25", "75"]);
    expect(new Set(CATEGORIES_BV.map((c) => c.cle)).size).toBe(2);
  });
});

describe("les BV, dossier par dossier", () => {
  it("payé rangé ici, demandé, ou payé ailleurs (à ranger)", () => {
    const lignes = lignesBv({
      dossiers: [dossier("a"), dossier("b"), dossier("c")],
      ordres: [
        ordre("o1", "a", "BV 25 % — REG-a", 100_000, { transactionCategoryId: "cat25" }),
        ordre("o2", "a", "BV 75 % — REG-a", 300_000, { status: "PENDING", paidDate: null, budgetCategoryId: "cat75" }),
        ordre("o3", "b", "BV 25 % — REG-b", 80_000, { transactionCategoryId: "autre" }),
        ordre("o4", "c", "BV 25 % — REG-c", 50_000, { status: "CANCELLED" }),
      ],
      saisies: [],
      categories: CATS,
    });
    expect(lignes.map((l) => l.dossierId)).toEqual(["a", "b"]);
    const [a, b] = lignes;
    expect(a.bv25).toMatchObject({ statut: "PAYE", paye: 100_000, demande: 0, dansEnveloppe: 100_000, aImputer: [] });
    expect(a.bv75).toMatchObject({ statut: "DEMANDE", paye: 0, demande: 300_000, aImputer: [] });
    expect(a.prevision75).toBe(0);
    expect(b.bv25).toMatchObject({ statut: "PAYE", dansEnveloppe: 0, aImputer: [{ orderId: "o3", montant: 80_000, paye: true }] });
    // 25 % connu, 75 % pas encore demandé : 3 × 80 000.
    expect(b.prevision75).toBe(240_000);
  });

  it("un BV saisi à la main compte dans l'enveloppe ; une étape « payée » sans montant le dit", () => {
    const [l] = lignesBv({
      dossiers: [dossier("a", { workflow: { bv75_pay: { status: "DONE", date: "2027-02-01" } } })],
      ordres: [],
      saisies: [{ id: "s1", productId: "a", categoryId: "cat25", amount: 120_000, date: new Date("2027-01-15T00:00:00Z") }],
      categories: CATS,
    });
    expect(l.bv25).toMatchObject({ statut: "PAYE", paye: 120_000, dansEnveloppe: 120_000 });
    expect(l.bv75).toMatchObject({ statut: "PAYE_SANS_MONTANT", paye: 0, date: "2027-02-01" });
    expect(l.prevision75).toBe(0);
  });

  it("sans catégorie BV dans l'enveloppe, rien n'est « à ranger » et rien n'est compté dedans", () => {
    const [l] = lignesBv({
      dossiers: [dossier("a")],
      ordres: [ordre("o1", "a", "BV 25 % — REG-a", 100_000, { transactionCategoryId: "x" })],
      saisies: [],
      categories: { bv25: null, bv75: null },
    });
    expect(l.bv25.aImputer).toEqual([]);
    expect(l.bv25.dansEnveloppe).toBe(0);
  });

  it("pas de 75 % attendu pour un dossier clos", () => {
    expect(prevoirBv75({ paye: 100, demande: 0 }, { statut: "A_VENIR" }, "DECISION_OBTAINED")).toBe(0);
    expect(prevoirBv75({ paye: 100, demande: 0 }, { statut: "A_VENIR" }, "AWAITING_BV_PAYMENT")).toBe(300);
    expect(prevoirBv75({ paye: 0, demande: 0 }, { statut: "A_VENIR" }, "IN_PREPARATION")).toBe(0);
  });

  it("les totaux additionnent les lignes", () => {
    const lignes = lignesBv({
      dossiers: [dossier("a"), dossier("b")],
      ordres: [
        ordre("o1", "a", "BV 25 % — a", 100, { transactionCategoryId: "cat25" }),
        ordre("o2", "b", "BV 75 % — b", 900, { status: "PENDING", paidDate: null }),
      ],
      saisies: [],
      categories: CATS,
    });
    expect(totauxBv(lignes)).toEqual({ paye25: 100, paye75: 0, demande: 900, prevision75: 300, dansEnveloppe: 100, aImputer: 1 });
  });
});
