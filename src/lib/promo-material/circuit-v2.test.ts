import { describe, expect, it } from "vitest";
import {
  validateurDeLaDemande, directriceMarketingDe, estCheffeMarketing, cheffesMarketing, chaineUtile,
  type Personne,
} from "./validateurs";
import {
  totalLigneHT, totauxDuDevis, totauxDeLaSelection, ecartDeRetranscription, manquesDeRetranscription,
  lignesDuBonDeCommande, type DevisLu,
} from "./devis";
import { verdictBonsDeCommande, verdictPaiements, verdictVisas, type BCDuDevis } from "./execution";
import {
  etapesDuDossier, initialStep, nextStep, canValidate, progress, waitingOn, libelleEtape, libelleCourt,
  demandeLesDevis, retranscritLesDevis, choisitLesLignes, piloteLExecution,
  type ContexteCircuit, type Acteur,
} from "./circuit";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CIRCUIT 2 DU MATÉRIEL PROMOTIONNEL — la règle pure (§118.152), sans base.
 *
 * Chaque cas nomme la phrase de la Direction qu'il tient. Les cas de flux (actions, base, droits)
 * vivent dans `actions/promo-circuit-v2-flow.test.ts` ; ceux-ci disent ce que la règle DÉCIDE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const P = (userId: string, role: string | null, extra: Partial<Personne> = {}): Personne => ({ userId, role, secondaryRole: null, actif: true, ...extra });

describe("qui valide la demande — « la directrice marketing pour le marketing, sinon le N+1, jusqu'au directeur des opérations »", () => {
  const directrice = P("dir-mkt", "PRODUCT_MANAGER");
  const opsDir = P("ops", "DIRECTION");
  const dg = P("dg", "GENERAL_MANAGER");

  it("un membre de la Direction Marketing → SA directrice (la première porteuse du rôle au-dessus de lui)", () => {
    const v = validateurDeLaDemande(P("chef-produit", "MEDICAL_PROMOTION_MANAGER"), [directrice, opsDir]);
    expect(v).toMatchObject({ kind: "PERSONNE", userId: "dir-mkt", qualite: "DIRECTRICE_MARKETING" });
  });

  it("un membre qui porte AUSSI le rôle Direction Marketing, sous une directrice → la directrice, pas lui-même", () => {
    const v = validateurDeLaDemande(P("adjointe", "PRODUCT_MANAGER"), [directrice, opsDir]);
    expect(v).toMatchObject({ kind: "PERSONNE", userId: "dir-mkt" });
  });

  it("la directrice marketing elle-même → aucune validation (« validé direct »)", () => {
    const v = validateurDeLaDemande(directrice, [opsDir, dg]);
    expect(v.kind).toBe("AUCUNE");
    expect(estCheffeMarketing(directrice, [opsDir, dg])).toBe(true);
  });

  it("un KAM → son N+1 (le superviseur national)", () => {
    const v = validateurDeLaDemande(P("kam", "MEDICAL_DELEGATE"), [P("ns", "NATIONAL_SALES"), opsDir]);
    expect(v).toMatchObject({ kind: "PERSONNE", userId: "ns", qualite: "N_PLUS_1" });
  });

  it("un N+1 AU plafond (le directeur des opérations) valide — « jusqu'au maximum le directeur des opérations »", () => {
    const v = validateurDeLaDemande(P("resp", "SALES_USER"), [opsDir, dg]);
    expect(v).toMatchObject({ kind: "PERSONNE", userId: "ops", qualite: "N_PLUS_1" });
  });

  it("un N+1 AU-DESSUS du plafond (le DG) → la Direction des opérations valide, pas le DG", () => {
    const v = validateurDeLaDemande(P("resp", "SALES_USER"), [dg]);
    expect(v.kind).toBe("PLAFOND");
  });

  it("le directeur des opérations lui-même → « il ne faut pas que le N+1 valide »", () => {
    expect(validateurDeLaDemande(opsDir, [dg]).kind).toBe("AUCUNE");
    expect(validateurDeLaDemande(P("od", "OPERATIONS_DIRECTOR"), [dg]).kind).toBe("AUCUNE");
  });

  it("un N+1 inactif est sauté : la demande va au suivant, jamais dans une boîte que personne ne lit", () => {
    const v = validateurDeLaDemande(P("kam", "MEDICAL_DELEGATE"), [P("ns", "NATIONAL_SALES", { actif: false }), P("ns2", "NATIONAL_SALES")]);
    expect(v).toMatchObject({ kind: "PERSONNE", userId: "ns2" });
  });

  it("aucun N+1 lisible → le plafond (et non « personne »)", () => {
    expect(validateurDeLaDemande(P("isolé", "SALES_USER"), []).kind).toBe("PLAFOND");
  });

  it("la chaîne s'arrête AU plafond : une porteuse du rôle au-dessus n'est pas « la directrice »", () => {
    expect(chaineUtile([opsDir, P("pm-haut", "PRODUCT_MANAGER")]).map((p) => p.userId)).toEqual(["ops"]);
    expect(directriceMarketingDe([opsDir, P("pm-haut", "PRODUCT_MANAGER")])).toBeNull();
  });

  it("les cheffes : les porteuses sans porteuse au-dessus ; une hiérarchie qui boucle retombe sur toutes", () => {
    const cheffe = { personne: directrice, chaine: [opsDir] };
    const adjointe = { personne: P("adj", "PRODUCT_MANAGER"), chaine: [directrice, opsDir] };
    expect(cheffesMarketing([cheffe, adjointe])).toEqual(["dir-mkt"]);
    const a = { personne: P("a", "PRODUCT_MANAGER"), chaine: [P("b", "PRODUCT_MANAGER")] };
    const b = { personne: P("b", "PRODUCT_MANAGER"), chaine: [P("a", "PRODUCT_MANAGER")] };
    expect(cheffesMarketing([a, b]).sort()).toEqual(["a", "b"]);
  });
});

const devis = (id: string, lignes: [string, number, number, boolean?][], extra: Partial<DevisLu> = {}): DevisLu => ({
  id, supplierId: `f-${id}`, supplierName: `Agence ${id}`, reference: `D-${id}`, tvaRate: 19, extraTaxLabel: null, extraTaxRate: null,
  announcedTotal: null, documentId: `scan-${id}`,
  lines: lignes.map(([reference, quantity, unitPrice, selected], i) => ({ id: `${id}-${i}`, position: i, reference, unit: "pièce", quantity, unitPrice, selected: Boolean(selected) })),
  ...extra,
});

describe("les devis retranscrits — « référence, unité, prix unitaire et prix total pour chaque référence »", () => {
  it("un total se CALCULE, en centimes — jamais de 0,30000000000000004", () => {
    expect(totalLigneHT({ quantity: 3, unitPrice: 0.1 })).toBe(0.3);
    const t = totauxDuDevis(devis("A", [["Présentoir", 3, 0.1], ["Kakemono", 1, 0.2]]));
    expect(t.ht).toBe(0.5);
  });

  it("la Taxe Pub est HORS base de TVA (la maison, §118.135)", () => {
    const t = totauxDuDevis(devis("A", [["Stand", 1, 794_500]], { extraTaxLabel: "Taxe Pub", extraTaxRate: 2 }));
    expect(t).toMatchObject({ ht: 794_500, tva: 150_955, taxe: 15_890, ttc: 961_345 });
  });

  it("« des lignes de plusieurs devis » : chaque devis garde SA TVA — un devis exonéré n'en paie pas", () => {
    const s = totauxDeLaSelection([
      devis("A", [["Présentoir", 10, 1000, true], ["Roll-up", 2, 5000]]),
      devis("B", [["Brochures", 1000, 10, true]], { tvaRate: 0 }),
    ]);
    expect(s).toMatchObject({ lignes: 2, devis: 2, ht: 20_000, tva: 1_900, ttc: 21_900 });
  });

  it("l'écart entre le total imprimé et les lignes est DIT — au-delà d'un dinar de tolérance", () => {
    expect(ecartDeRetranscription(devis("A", [["X", 2, 500]], { announcedTotal: 1000.5 }))).toBeNull();
    expect(ecartDeRetranscription(devis("A", [["X", 2, 500]], { announcedTotal: 10_000 }))).toMatchObject({ calcule: 1000, annonce: 10_000 });
  });

  it("la retranscription dit TOUT ce qui manque, en une fois", () => {
    const m = manquesDeRetranscription([devis("A", [["", 0, 10]], { supplierId: null, documentId: null, announcedTotal: 99 })]);
    expect(m.join(" | ")).toMatch(/annuaire/);
    expect(m.join(" | ")).toMatch(/scan/);
    expect(m.join(" | ")).toMatch(/quantité nulle/);
    expect(m.join(" | ")).toMatch(/annonce/);
    expect(manquesDeRetranscription([])).toEqual(["aucun devis n'est retranscrit"]);
    expect(manquesDeRetranscription([devis("A", [["X", 1, 10]])])).toEqual([]);
  });

  it("le BC ne porte QUE les lignes retenues, dans l'ordre du devis", () => {
    const d = devis("A", [["Premier", 1, 10, true], ["Deuxième", 2, 20], ["Troisième", 3, 30, true]]);
    expect(lignesDuBonDeCommande(d).map((l) => l.designation)).toEqual(["Premier", "Troisième"]);
  });
});

const bcd = (fournisseur: string, over: Partial<BCDuDevis> = {}): BCDuDevis => ({
  quoteId: fournisseur, fournisseur, lignesRetenues: 1, bc: { id: `bc-${fournisseur}`, reference: `BC-${fournisseur}`, etape: "SIGNE", montant: 1000 }, factures: [], ...over,
});
const facture = (ref: string, over: Partial<BCDuDevis["factures"][number]> = {}) => ({
  id: ref, reference: ref, montant: 1000, reglee: true, etatReglement: "réglé", paiementDemande: true, demandeInfoMedicale: { reference: `IM-${ref}`, nature: "Demande de visa publicitaire" }, ...over,
});

describe("les chantiers — chacun se CONSTATE sur ses pièces, et dit ce qui manque", () => {
  it("BC : un par devis retenu, et SIGNÉ ; un devis sans ligne retenue n'en attend pas", () => {
    expect(verdictBonsDeCommande([bcd("A"), bcd("B", { lignesRetenues: 0, bc: null })]).ok).toBe(true);
    const v = verdictBonsDeCommande([bcd("A", { bc: null }), bcd("B", { bc: { id: "b", reference: "BC-B", etape: "A_SIGNER", montant: 1 } })]);
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.raison).toMatch(/à générer pour A/); expect(v.raison).toMatch(/BC-B/); }
  });

  it("factures et paiements : « elle se doit de uploader la facture pour demander un paiement » — une facture par BC, toutes réglées", () => {
    expect(verdictPaiements([bcd("A", { factures: [] })]).ok).toBe(false);
    expect(verdictPaiements([bcd("A", { factures: [facture("F1", { reglee: false, etatReglement: "au centre de paiement" })] })]).ok).toBe(false);
    expect(verdictPaiements([bcd("A", { factures: [facture("F1")] })]).ok).toBe(true);
  });

  it("visa ou déclaration : « une fois qu'il y a un paiement … associée à chaque fois »", () => {
    expect(verdictVisas([bcd("A", { factures: [facture("F1", { paiementDemande: false, demandeInfoMedicale: null })] })]).ok).toBe(false);
    const sans = verdictVisas([bcd("A", { factures: [facture("F1"), facture("F2", { demandeInfoMedicale: null })] })]);
    expect(sans.ok).toBe(false);
    if (!sans.ok) expect(sans.raison).toMatch(/F2/);
    expect(verdictVisas([bcd("A", { factures: [facture("F1")] })]).ok).toBe(true);
  });
});

const ctx = (over: Partial<ContexteCircuit> = {}): ContexteCircuit => ({
  version: 2, demandeurEstDirectionMarketing: false, validationDemande: true, montant: 100_000, seuilDg: 1_000_000, ...over,
});

describe("le circuit 2 — ses étapes, et qui fait quoi", () => {
  it("la frise d'un KAM : validation de la demande, devis, choix, Direction Marketing, exécution — sans le DG sous le seuil", () => {
    expect(etapesDuDossier(ctx())).toEqual(["REVIEW_REQUEST", "QUOTE_TO_REQUEST", "QUOTE_REQUESTED", "REVIEW_REQUESTER", "REVIEW_MANAGER", "IN_EXECUTION", "COMPLETED"]);
  });

  it("« si le montant total dépasse le seuil d'Ad&Pro, il faut une validation du directeur général » — et un montant INCONNU ouvre la porte", () => {
    expect(etapesDuDossier(ctx({ montant: 1_200_000 }))).toContain("REVIEW_DG");
    expect(etapesDuDossier(ctx({ montant: null }))).toContain("REVIEW_DG");
    expect(etapesDuDossier(ctx({ montant: 1_000_000 }))).not.toContain("REVIEW_DG");
  });

  it("la directrice marketing qui demande : ni validation de la demande, ni étape Direction Marketing", () => {
    const c = ctx({ demandeurEstDirectionMarketing: true, validationDemande: false });
    expect(initialStep({ ctx: c })).toBe("QUOTE_TO_REQUEST");
    expect(nextStep("REVIEW_REQUESTER", c)).toBe("IN_EXECUTION");
  });

  it("le circuit 2 n'a plus d'étape PDG ni de validation information médicale ; le circuit 1 les garde (§118.142)", () => {
    expect(etapesDuDossier(ctx())).not.toContain("REVIEW_EXECUTIVE");
    expect(etapesDuDossier(ctx())).not.toContain("REVIEW_MEDICAL_INFO");
    const v1 = { ...ctx(), version: 1 as const };
    expect(etapesDuDossier(v1)).toContain("REVIEW_EXECUTIVE");
    expect(etapesDuDossier(v1)).not.toContain("REVIEW_REQUEST");
  });

  it("le validateur figé tranche la demande ; le demandeur jamais ; sans validateur nommé, la Direction des opérations", () => {
    const dossier = { requesterId: "kam", requestValidatorId: "ns" };
    expect(canValidate({ id: "ns", role: "NATIONAL_SALES" }, "REVIEW_REQUEST", dossier)).toBe(true);
    expect(canValidate({ id: "autre-ns", role: "NATIONAL_SALES" }, "REVIEW_REQUEST", dossier)).toBe(false);
    expect(canValidate({ id: "kam", role: "DIRECTION" }, "REVIEW_REQUEST", dossier)).toBe(false);
    expect(canValidate({ id: "ops", role: "DIRECTION" }, "REVIEW_REQUEST", { requesterId: "kam", requestValidatorId: null })).toBe(true);
  });

  it("à l'étape Direction Marketing : la liste nommée (directrice ou cheffes) — pas toute porteuse du rôle", () => {
    const dossier = { requesterId: "kam", validateursMarketing: ["cheffe"] };
    expect(canValidate({ id: "cheffe", role: "PRODUCT_MANAGER" }, "REVIEW_MANAGER", dossier)).toBe(true);
    expect(canValidate({ id: "adjointe", role: "PRODUCT_MANAGER" }, "REVIEW_MANAGER", dossier)).toBe(false);
  });

  it("demander les devis et les retranscrire ne sont pas des validations", () => {
    expect(canValidate({ id: "x", role: "SUPER_ADMIN" }, "QUOTE_TO_REQUEST", { requesterId: "kam" })).toBe(false);
    expect(canValidate({ id: "x", role: "SUPER_ADMIN" }, "QUOTE_REQUESTED", { requesterId: "kam" })).toBe(false);
  });

  it("les quatre règles d'acteur — et celui qui recopie les prix n'est pas celui qui les retient", () => {
    const a = (id: string, role: string, vueGlobale = false, secondaryRole: string | null = null): Acteur => ({ id, role, vueGlobale, secondaryRole });
    const pm = { requesterId: "kam", assistantId: "asst" };
    expect(demandeLesDevis(a("kam", "MEDICAL_DELEGATE"), pm)).toBe(true);
    expect(demandeLesDevis(a("asst", "DIRECTION_ASSISTANT"), pm)).toBe(false);
    expect(retranscritLesDevis(a("asst", "DIRECTION_ASSISTANT"), pm)).toBe(true);
    expect(retranscritLesDevis(a("autre", "SALES_USER", false, "DIRECTION_ASSISTANT"), pm)).toBe(true);
    expect(retranscritLesDevis(a("kam", "DIRECTION_ASSISTANT"), pm)).toBe(false);
    expect(retranscritLesDevis(a("kam", "SUPER_ADMIN", true), pm)).toBe(true);
    expect(choisitLesLignes(a("kam", "MEDICAL_DELEGATE"), pm)).toBe(true);
    expect(choisitLesLignes(a("asst", "DIRECTION_ASSISTANT"), pm)).toBe(false);
    expect(piloteLExecution(a("asst", "DIRECTION_ASSISTANT"), pm)).toBe(true);
    expect(piloteLExecution(a("fin", "FINANCE_BUDGET_MANAGER"), pm)).toBe(false);
  });

  it("la barre compte les étapes de CE dossier (pas la colonne entière) et l'attente se dit au circuit 2", () => {
    const c = ctx();
    expect(progress("REVIEW_MANAGER", [], c)).toEqual({ step: 5, total: 7 });
    expect(waitingOn("QUOTE_REQUESTED", [], 2)).toMatch(/assistante de direction/);
    expect(waitingOn("QUOTE_TO_REQUEST", [], 2)).toMatch(/demander les devis/);
    expect(libelleEtape("REVIEW_REQUESTER", 2)).toMatch(/lignes/);
    expect(libelleEtape("REVIEW_REQUESTER", 1)).toBe("Validation du demandeur");
    expect(libelleCourt("QUOTE_REQUESTED", 2)).toBe("Retranscription des devis");
  });
});
