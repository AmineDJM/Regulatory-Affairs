import { describe, expect, it } from "vitest";
import {
  articlesDeLaFiche, chiffresDuDossier, comparaisonDesDevis, friseDuDossier, meilleursPrix, ouEnEst, prochainGeste,
  type BcFaits, type FaitsDuDossier, type RegardFiche,
} from "./fiche";
import type { ArticleDemandeLu } from "./achats";
import type { DevisLu } from "./devis";
import { brouillonPromoEnJson, brouillonPromoNeuf, lireBrouillonPromo } from "./bc-brouillon-promo";

const article = (id: string, position: number, actions: ArticleDemandeLu["actions"], quantite: number | null = 500): ArticleDemandeLu => ({
  id, position, catalogueId: `cat-${id}`, reference: `CAT-${id}`, nom: `Article ${id}`, famille: "CONSOMMABLE", unite: "pièce",
  produits: [], quantite, actions, commentaire: null,
});

const devis = (id: string, fournisseur: string, lignes: Partial<DevisLu["lines"][number]>[], taxes: { tva?: number | null; taxe?: number | null } = {}): DevisLu => ({
  id, supplierId: `f-${id}`, supplierName: fournisseur, reference: null, tvaRate: taxes.tva ?? 19, extraTaxLabel: taxes.taxe ? "Taxe Pub" : null,
  extraTaxRate: taxes.taxe ?? null, announcedTotal: null, documentId: null,
  lines: lignes.map((l, i) => ({ id: `${id}-l${i}`, position: i, reference: "ligne", unit: null, quantity: 1, unitPrice: 0, selected: false, action: null, requestItemId: null, ...l })),
});

const faits = (p: Partial<FaitsDuDossier> = {}): FaitsDuDossier => ({
  etat: "IN_EXECUTION", annule: false, enCorrection: false, devisRecus: 2, lignesRetenues: 2, bcs: [],
  chantiers: { bc: false, paiement: false, visa: false }, ...p,
});

const bc = (p: Partial<BcFaits> = {}): BcFaits => ({
  quoteId: "q1", fournisseur: "INSIGNE", reference: null, brouillon: false, etape: null, montantBc: null,
  envoye: false, resteAFacturer: true, factures: [], ...p,
});

const REGARD: RegardFiche = {
  peutBasculer: false, peutTrancher: false, peutResoumettre: false, peutEnvoyerDevis: false, peutRetranscrire: false,
  peutChoisir: false, pilote: false, peutValiderBc: false, peutReceptionner: false,
};

describe("la frise en huit étapes", () => {
  it("place l'étape courante d'après l'état du circuit", () => {
    const etats = (f: FaitsDuDossier) => friseDuDossier(f).map((e) => e.etat);
    expect(etats(faits({ etat: "REVIEW_REQUEST", devisRecus: 0, lignesRetenues: 0 }))).toEqual(["ici", "avenir", "avenir", "avenir", "avenir", "avenir", "avenir", "avenir"]);
    expect(etats(faits({ etat: "QUOTE_REQUESTED" })).slice(0, 3)).toEqual(["fait", "ici", "avenir"]);
    expect(etats(faits({ etat: "REVIEW_MANAGER" })).slice(0, 4)).toEqual(["fait", "fait", "ici", "avenir"]);
    expect(etats(faits({ etat: "COMPLETED" }))).toEqual(Array(8).fill("fait"));
  });

  it("en exécution : les BC à signer gardent l'étape « Bons de commande », avec leur nombre", () => {
    const f = faits({ bcs: [bc({ etape: "A_SIGNER", reference: "040/DG/2026" }), bc({ quoteId: "q2", etape: "A_SIGNER" })] });
    const frise = friseDuDossier(f);
    expect(frise[3]).toMatchObject({ cle: "BC", etat: "ici", detail: "2 à signer" });
    expect(frise.slice(0, 3).every((e) => e.etat === "fait")).toBe(true);
    expect(frise.slice(4).every((e) => e.etat === "avenir")).toBe(true);
  });

  it("un aperçu à vérifier se dit, et une étape d'exécution faite reste faite même si une précédente ne l'est pas", () => {
    expect(friseDuDossier(faits({ bcs: [bc({ brouillon: true })] }))[3]?.detail).toBe("1 à vérifier");
    const f = faits({ chantiers: { bc: false, paiement: false, visa: true }, bcs: [bc({ etape: "SIGNE" })] });
    const frise = friseDuDossier(f);
    expect(frise[3]?.etat).toBe("ici");
    expect(frise[6]?.etat).toBe("fait");
  });

  it("un dossier refusé s'arrête (rouge) sur sa première étape non faite", () => {
    const frise = friseDuDossier(faits({ etat: "REFUSED", devisRecus: 2, lignesRetenues: 0 }));
    expect(frise.map((e) => e.etat).slice(0, 3)).toEqual(["fait", "arret", "avenir"]);
  });

  it("réception et paiement se constatent sur les factures", () => {
    const facture = { id: "f1", montant: 100, lignes: 2, enAttente: 0, paiementDemande: true, reglee: true, demandeIM: true };
    const f = faits({ bcs: [bc({ etape: "SIGNE", envoye: true, resteAFacturer: false, factures: [facture] })] });
    const frise = friseDuDossier(f);
    expect(frise.map((e) => e.etat)).toEqual(["fait", "fait", "fait", "fait", "fait", "fait", "fait", "ici"]);
    expect(frise[4]?.detail).toBe("2/2 reçues");
    expect(frise[5]?.detail).toBe("1/1 payée");
  });
});

describe("les cinq chiffres d'argent", () => {
  it("retenu TTC (chaque devis avec ses taxes), engagé (BC émis seulement), facturé, payé", () => {
    const d = [
      devis("a", "A", [{ quantity: 500, unitPrice: 785, selected: true }], { tva: 19, taxe: 2 }),
      devis("b", "B", [{ quantity: 2000, unitPrice: 35, selected: true }, { quantity: 1, unitPrice: 9999, selected: false }], { tva: 19 }),
    ];
    const c = chiffresDuDossier({
      budget: 600_000, devis: d,
      bcs: [
        bc({ etape: "A_SIGNER", montantBc: 474_925, factures: [{ id: "f", montant: 100_000, lignes: 1, enAttente: 0, paiementDemande: true, reglee: true, demandeIM: false }] }),
        bc({ quoteId: "q2", brouillon: true, montantBc: null }),
      ],
    });
    expect(c.budget).toBe(600_000);
    expect(c.retenu).toBe(474_925 + 83_300);
    expect(c.engage).toBe(474_925);
    expect(c.facture).toBe(100_000);
    expect(c.paye).toBe(100_000);
  });

  it("rien de retenu : le retenu est inconnu, pas zéro", () => {
    expect(chiffresDuDossier({ budget: null, devis: [devis("a", "A", [{ quantity: 1, unitPrice: 10 }])], bcs: [] }).retenu).toBeNull();
  });
});

describe("les prestations de chaque article", () => {
  it("vert si une ligne retenue la chiffre, chiffrée sans être retenue, orange si aucun devis", () => {
    const a = article("1", 0, ["CONCEPTION", "IMPRESSION", "ACHAT"]);
    const d = [
      devis("a", "INSIGNE", [{ requestItemId: "1", action: "CONCEPTION", quantity: 500, unitPrice: 785, selected: true }]),
      devis("b", "Print", [{ requestItemId: "1", action: "IMPRESSION", quantity: 500, unitPrice: 50, selected: false }]),
    ];
    const [l] = articlesDeLaFiche([a], d);
    expect(l?.prestations).toEqual([
      { action: "CONCEPTION", etat: "retenue", demandee: true },
      { action: "IMPRESSION", etat: "chiffree", demandee: true },
      { action: "ACHAT", etat: "manquante", demandee: true },
    ]);
    expect(l?.fournisseurs).toEqual(["INSIGNE"]);
    expect(l?.coutHT).toBe(392_500);
    expect(l?.coutUnitaire).toBe(785);
  });

  it("sans quantité, pas de coût unitaire ; une prestation retenue non demandée se montre aussi", () => {
    const a = article("1", 0, ["CONCEPTION"], null);
    const [l] = articlesDeLaFiche([a], [devis("a", "A", [{ requestItemId: "1", action: "LIVRAISON", quantity: 1, unitPrice: 5000, selected: true }])]);
    expect(l?.coutUnitaire).toBeNull();
    expect(l?.prestations.map((p) => [p.action, p.etat, p.demandee])).toEqual([["CONCEPTION", "manquante", true], ["LIVRAISON", "retenue", false]]);
  });
});

describe("les devis côte à côte", () => {
  it("une rangée par article × prestation, une rangée « non chiffrée », puis le hors demande ; le meilleur prix", () => {
    const a = article("1", 0, ["CONCEPTION", "IMPRESSION"]);
    const d = [
      devis("a", "A", [
        { requestItemId: "1", action: "CONCEPTION", quantity: 500, unitPrice: 900 },
        { reference: "Livraison express", action: "LIVRAISON", quantity: 1, unitPrice: 3000 },
      ]),
      devis("b", "B", [{ requestItemId: "1", action: "CONCEPTION", quantity: 500, unitPrice: 785, selected: true }]),
    ];
    const r = comparaisonDesDevis([a], d);
    expect(r.map((x) => x.cle)).toEqual(["1|CONCEPTION", "1|manque", "hors|livraison express|LIVRAISON"]);
    expect(r[0]?.meilleurs).toEqual(["b"]);
    expect(r[0]?.cellules.b?.[0]).toMatchObject({ quantite: 500, prixUnitaire: 785, totalHT: 392_500, retenue: true });
    expect(r[1]?.manquantes).toEqual(["IMPRESSION"]);
    expect(r[2]).toMatchObject({ horsDemande: true, libelle: "Livraison express", meilleurs: ["a"] });
  });

  it("une ligne rattachée à un article disparu est hors demande ; égalité : les deux sont meilleurs", () => {
    const d = [devis("a", "A", [{ requestItemId: "parti", reference: "Stylo", quantity: 10, unitPrice: 5 }]), devis("b", "B", [{ reference: "stylo", quantity: 20, unitPrice: 5 }])];
    const r = comparaisonDesDevis([], d);
    expect(r).toHaveLength(1);
    expect(r[0]?.meilleurs.sort()).toEqual(["a", "b"]);
  });

  it("meilleursPrix compare le prix unitaire, pas le total", () => {
    const l = (q: number, pu: number) => ({ id: "x", reference: "x", quantite: q, prixUnitaire: pu, totalHT: q * pu, retenue: false });
    expect(meilleursPrix({ a: [l(1000, 10)], b: [l(10, 12)], c: [] })).toEqual(["a"]);
    expect(meilleursPrix({ a: [], b: [] })).toEqual([]);
  });
});

describe("ce qu'il reste à faire — où, chez qui, et le geste utile", () => {
  const noms = { chezEtape: "Nadia", demandeur: "Sonia Hamidi", libelleEtat: "—" };

  it("la pastille dit l'état et chez qui, la même pour tous", () => {
    expect(ouEnEst(faits({ etat: "REVIEW_MANAGER" }), noms)).toMatchObject({ etat: "Validation Direction Marketing", chez: "Nadia" });
    expect(ouEnEst(faits({ bcs: [bc({ etape: "A_SIGNER" })] }), noms)).toMatchObject({ etat: "Signature des BC", chez: "les Finances" });
    expect(ouEnEst(faits({ bcs: [bc({ brouillon: true })] }), noms)).toMatchObject({ etat: "BC à vérifier", chez: "Sonia Hamidi" });
    expect(ouEnEst(faits({ etat: "COMPLETED" }), noms)).toMatchObject({ etat: "Terminé", chez: null });
    expect(ouEnEst(faits({ annule: true }), noms).etat).toBe("Annulé");
  });

  it("le demandeur valide l'aperçu ; l'assistante, qui pilote sans valider, ne se le voit pas proposer", () => {
    const f = faits({ bcs: [bc({ brouillon: true })] });
    expect(prochainGeste(f, { ...REGARD, pilote: true, peutValiderBc: true })).toMatchObject({ cle: "VERIFIER_BC", quoteId: "q1" });
    expect(prochainGeste(f, { ...REGARD, pilote: true })).toBeNull();
  });

  it("chez les Finances : rien à faire pour le demandeur (en attente)", () => {
    expect(prochainGeste(faits({ bcs: [bc({ etape: "A_SIGNER" })] }), { ...REGARD, pilote: true, peutValiderBc: true })).toBeNull();
  });

  it("l'ordre de l'exécution : préparer, envoyer, réceptionner, payer, viser, facturer, clore", () => {
    const pilote = { ...REGARD, pilote: true, peutReceptionner: true };
    expect(prochainGeste(faits({ bcs: [bc()] }), pilote)?.cle).toBe("PREPARER_BC");
    expect(prochainGeste(faits({ bcs: [bc({ etape: "SIGNE" })] }), pilote)?.cle).toBe("ENVOYER_BC");
    const facture = { id: "f", montant: 1, lignes: 1, enAttente: 1, paiementDemande: false, reglee: false, demandeIM: false };
    expect(prochainGeste(faits({ bcs: [bc({ etape: "SIGNE", envoye: true, factures: [facture] })] }), pilote)?.cle).toBe("RECEPTIONNER");
    expect(prochainGeste(faits({ bcs: [bc({ etape: "SIGNE", envoye: true, factures: [{ ...facture, enAttente: 0 }] })] }), pilote)?.cle).toBe("DEMANDER_PAIEMENT");
    expect(prochainGeste(faits({ bcs: [bc({ etape: "SIGNE", envoye: true, factures: [{ ...facture, enAttente: 0, paiementDemande: true }] })] }), pilote)?.cle).toBe("ADRESSER_IM");
    expect(prochainGeste(faits({ bcs: [bc({ etape: "SIGNE", envoye: true })] }), pilote)?.cle).toBe("DEPOSER_FACTURE");
    expect(prochainGeste(faits({ chantiers: { bc: true, paiement: true, visa: true }, bcs: [bc({ etape: "SIGNE", envoye: true, resteAFacturer: false })] }), pilote)?.cle).toBe("CLORE");
  });

  it("les étapes de validation : le geste n'est offert qu'à qui peut trancher", () => {
    expect(prochainGeste(faits({ etat: "REVIEW_REQUEST" }), { ...REGARD, peutTrancher: true })?.cle).toBe("VALIDER_ETAPE");
    expect(prochainGeste(faits({ etat: "REVIEW_REQUEST" }), REGARD)).toBeNull();
    expect(prochainGeste(faits({ etat: "REVIEW_REQUESTER" }), { ...REGARD, peutChoisir: true })?.cle).toBe("CHOISIR_LIGNES");
    expect(prochainGeste(faits({ etat: "REVIEW_REQUEST", enCorrection: true }), { ...REGARD, peutResoumettre: true })?.cle).toBe("RESOUMETTRE");
    expect(prochainGeste(faits({ etat: null }), { ...REGARD, peutBasculer: true })?.cle).toBe("BASCULER");
  });
});

describe("l'aperçu du BC d'un devis promotionnel", () => {
  it("garde la taxe : celle du devis (absente), aucune (null), ou la sienne — et jamais de lignes corrigées", () => {
    const base = { promoMaterialId: "pm", par: "u", parNom: "Sonia", livraison: { adresse: "Siège", delai: null }, notes: null };
    for (const taxe of [undefined, null, { libelle: "Taxe Pub", taux: 0.02 }] as const) {
      const b = brouillonPromoNeuf({ ...base, taxe });
      const relu = lireBrouillonPromo(JSON.parse(JSON.stringify(brouillonPromoEnJson(b))));
      expect(relu?.taxe).toEqual(taxe);
      expect(relu?.livraison).toEqual({ adresse: "Siège", date: null, delai: null });
      expect(relu?.lignes).toBeNull();
    }
    expect(lireBrouillonPromo(null)).toBeNull();
    expect(lireBrouillonPromo({ itemId: "pm" })).toBeNull();
  });
});
