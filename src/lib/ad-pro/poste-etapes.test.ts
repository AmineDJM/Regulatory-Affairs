import { describe, it, expect } from "vitest";
import { faitsDuPoste, etapesDuPoste, prochainPas, type FaitsPoste, type RegardPoste } from "@/lib/ad-pro/poste-etapes";

/**
 * LE GESTE SUIVANT D'UN POSTE (§118.175) — un seul, ou ce qu'on attend et de qui.
 *
 * Chaque cas nomme la situation qui ferait tomber la règle (§118.17). Le banc de bout en bout
 * (`ad-pro-postes-flow.test.ts`) rejoue chaque geste rendu par la VRAIE action : ici, on tient
 * la CARTE ; là-bas, qu'elle ne propose rien que l'action refuserait.
 */

const poste = (p: Partial<FaitsPoste> = {}): FaitsPoste => ({
  kind: "STAND", status: "DRAFT", amountEstimated: null, amountGranted: null,
  budgetCategoryId: null, orderStage: "NONE", expenseOrderId: null, expenseOrderStatus: null, lignesStock: 0, ...p,
});
const regard = (r: Partial<RegardPoste> = {}): RegardPoste => ({
  canEdit: false, canAllocate: false, canViserBC: false, canEmettre: false, fige: false, operationDecidee: true, ...r,
});
const DEMANDEUR = regard({ canEdit: true });
const DIRECTION = regard({ canEdit: true, canAllocate: true });

describe("le geste suivant d'un poste", () => {
  it("un poste « Matériel du stock » : pas de frise d'argent, mais le même ACCORD — soumettre puis décider", () => {
    const vide = poste({ kind: "STOCK_MATERIAL" });
    expect(etapesDuPoste(vide)).toEqual([]);
    // Sans article, rien à soumettre — et la phrase dit le geste qui manque.
    expect(prochainPas(vide, DEMANDEUR)).toEqual({ geste: null, attente: "Ajoutez au moins un article du magasin pour soumettre ce poste." });
    expect(prochainPas(poste({ kind: "STOCK_MATERIAL", lignesStock: 2 }), DEMANDEUR).geste?.cle).toBe("SOUMETTRE");
    expect(prochainPas(poste({ kind: "STOCK_MATERIAL", status: "PENDING", lignesStock: 2 }), DIRECTION).geste?.cle).toBe("DECIDER");
    // Accordé : ni budget, ni BC — son bloc le confirme après l'événement.
    expect(prochainPas(poste({ kind: "STOCK_MATERIAL", status: "APPROVED", lignesStock: 2 }), DIRECTION)).toEqual({ geste: null, attente: null });
  });

  it("un sponsoring indirect non réparti : le SEUL geste est de le répartir — même chiffré", () => {
    const p = poste({ kind: "INDIRECT_SUPPORT", amountEstimated: 400_000 });
    expect(prochainPas(p, DEMANDEUR).geste?.cle).toBe("REPARTIR");
    // Sans ce cas, une règle qui proposerait « Soumettre » sur un poste chiffré passerait : or
    // `canSubmitItem` le refuse tant que la nature n'est pas dite.
    expect(prochainPas(p, DEMANDEUR).geste?.cle).not.toBe("SOUMETTRE");
    expect(prochainPas(p, regard()).attente).toMatch(/répartir/);
    expect(prochainPas(p, regard({ canEdit: true, fige: true })).geste).toBeNull();
  });

  it("un brouillon : chiffrer d'abord, puis soumettre — et qui ne peut pas le voit attendre le demandeur", () => {
    expect(prochainPas(poste(), DEMANDEUR).geste?.cle).toBe("CHIFFRER");
    expect(prochainPas(poste({ amountEstimated: 120_000 }), DEMANDEUR).geste).toEqual({ cle: "SOUMETTRE", libelle: "Soumettre à la Direction" });
    expect(prochainPas(poste({ status: "REVISION", amountEstimated: 120_000 }), DEMANDEUR).geste?.libelle).toBe("Resoumettre à la Direction");
    expect(prochainPas(poste({ amountEstimated: 120_000 }), regard()).attente).toMatch(/demandeur/);
  });

  it("en attente de la Direction : elle seule décide — et pas sur une demande clôturée", () => {
    const p = poste({ status: "PENDING", amountEstimated: 120_000 });
    expect(prochainPas(p, DIRECTION).geste?.cle).toBe("DECIDER");
    expect(prochainPas(p, DEMANDEUR)).toEqual({ geste: null, attente: "En attente de la décision de la Direction." });
    expect(prochainPas(p, regard({ canAllocate: true, fige: true })).geste).toBeNull();
  });

  it("accordé : montant, puis budget, puis bon de commande — dans cet ordre", () => {
    const sansMontant = poste({ status: "APPROVED", amountEstimated: 120_000 });
    expect(prochainPas(sansMontant, DIRECTION).geste?.cle).toBe("MONTANT");
    const sansBudget = poste({ status: "APPROVED", amountGranted: 120_000 });
    expect(prochainPas(sansBudget, DIRECTION).geste?.cle).toBe("BUDGET");
    expect(prochainPas(sansBudget, DEMANDEUR).attente).toMatch(/budget/);
    const pret = poste({ status: "APPROVED", amountGranted: 120_000, budgetCategoryId: "cat" });
    expect(prochainPas(pret, DEMANDEUR).geste?.cle).toBe("DEMANDER_BC");
    expect(prochainPas(pret, regard()).attente).toMatch(/demandeur/);
  });

  it("la demande du BC est un geste d'EXÉCUTION : elle reste offerte sur une demande clôturée (§118.151)", () => {
    const pret = poste({ status: "APPROVED", amountGranted: 120_000, budgetCategoryId: "cat" });
    expect(prochainPas(pret, regard({ canEdit: true, fige: true })).geste?.cle).toBe("DEMANDER_BC");
  });

  it("un BC refusé par le centre se redemande — le libellé le dit", () => {
    const p = poste({ status: "APPROVED", amountGranted: 120_000, budgetCategoryId: "cat", orderStage: "REFUSED" });
    expect(prochainPas(p, DEMANDEUR).geste?.libelle).toBe("Redemander l'émission du BC");
  });

  it("au centre puis aux Finances : chacun son geste, les autres attendent en le sachant", () => {
    const auCentre = poste({ status: "APPROVED", amountGranted: 120_000, budgetCategoryId: "cat", orderStage: "REQUESTED" });
    expect(prochainPas(auCentre, regard({ canViserBC: true })).geste?.cle).toBe("VISER_BC");
    expect(prochainPas(auCentre, DIRECTION).attente).toMatch(/centre de validation/);
    const vise = { ...auCentre, orderStage: "DIRECTION_OK" as const };
    expect(prochainPas(vise, regard({ canEmettre: true })).geste?.cle).toBe("EMETTRE_BC");
    expect(prochainPas(vise, DEMANDEUR).attente).toMatch(/Finances/);
  });

  it("un sponsoring DIRECT se verse sans BC — et jamais avant que l'opération soit accordée", () => {
    const p = poste({ kind: "ASSOCIATION_SUPPORT", status: "APPROVED", amountGranted: 300_000, budgetCategoryId: "cat" });
    expect(etapesDuPoste(p).map((e) => e.cle)).toEqual(["CHIFFRE", "DIRECTION", "BUDGET", "PAIEMENT"]);
    expect(prochainPas(p, regard({ canEmettre: true })).geste?.cle).toBe("EMETTRE_DIRECT");
    expect(prochainPas(p, regard({ canEmettre: true, operationDecidee: false })).geste).toBeNull();
    // Le cas qui a motivé ce lot : « Émettre l'ordre de dépense — L'opération n'a pas encore été
    // accordée » affiché sous un BROUILLON. Un brouillon ne propose qu'une chose : le chiffrer.
    expect(prochainPas(poste({ kind: "ASSOCIATION_SUPPORT" }), DIRECTION).geste?.cle).toBe("CHIFFRER");
  });

  it("l'ordre de dépense émis : le poste attend le centre de paiement, puis il est arrivé au bout", () => {
    const emis = poste({ status: "APPROVED", amountGranted: 1, budgetCategoryId: "c", orderStage: "ISSUED", expenseOrderId: "o", expenseOrderStatus: "PENDING" });
    expect(prochainPas(emis, DIRECTION)).toEqual({ geste: null, attente: "Ordre de dépense émis — au centre de paiement." });
    expect(prochainPas({ ...emis, expenseOrderStatus: "PAID" }, DIRECTION)).toEqual({ geste: null, attente: null });
    expect(etapesDuPoste({ ...emis, expenseOrderStatus: "PAID" }).every((e) => e.etat === "FAIT")).toBe(true);
  });

  it("la frise dit un refus là où il a eu lieu", () => {
    expect(etapesDuPoste(poste({ status: "REJECTED", amountEstimated: 5 })).find((e) => e.cle === "DIRECTION")?.etat).toBe("REFUSE");
    expect(etapesDuPoste(poste({ status: "APPROVED", amountGranted: 5, budgetCategoryId: "c", orderStage: "REFUSED" })).find((e) => e.cle === "BC")?.etat).toBe("REFUSE");
  });
});

describe("la traduction des faits d'un poste — une seule, lue par l'écran et par le banc (§118.175)", () => {
  it("garde ce qui DÉCIDE de l'étape : le BC sous le seuil, le statut de l'ordre, le nombre d'articles", () => {
    // Ce qui le ferait tomber : perdre `orderSansCentre` — l'écran dirait « validé » d'un BC
    // qu'aucun centre n'a vu (§118.149) — ou le statut de l'ordre, et la frise ne saurait plus dire « payé ».
    const f = faitsDuPoste({
      kind: "STAND", status: "APPROVED", amountEstimated: 10, amountGranted: 9, budgetCategoryId: "b",
      orderStage: "DIRECTION_OK", expenseOrderId: "e", expenseOrder: { status: "PAID" }, lignesStock: [{}, {}], orderSansCentre: true,
    });
    expect(f).toEqual({
      kind: "STAND", status: "APPROVED", amountEstimated: 10, amountGranted: 9, budgetCategoryId: "b",
      orderStage: "DIRECTION_OK", expenseOrderId: "e", expenseOrderStatus: "PAID", lignesStock: 2, orderSansCentre: true,
    });
    expect(faitsDuPoste({ ...f, expenseOrder: null, lignesStock: [] }).expenseOrderStatus).toBeNull();
  });
});
