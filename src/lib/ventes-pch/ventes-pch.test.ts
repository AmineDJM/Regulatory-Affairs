import { describe, it, expect } from "vitest";
import { detecterEntete, lireDate, classerLigne, quantiteNonServie, periodeDuFichier, lireVentes, lireReceptions, codeDr, libellePeriode } from "./lecture";
import { moisSelonChoix, lireChoixPeriode } from "./calculs";
import { cleClient, presentationPch, presentationProduit, clePresentation, moleculeDe, fournisseurCorrespond, memeMarche } from "./normalisation";
import { indexEtablissementsPch, indexProduitsPch, decisionPoste, proposerFournisseurs, type ProduitRef } from "./correspondance";
import {
  planRemplacement, partDeMarche, evolution, chaineContrat, periodeDe, periodePrecedente, moisManquants, decalerMois,
  serieSurMois, coutDeReference, valeurAuCout, partsFournisseurs, nonServiSignificatif,
} from "./calculs";

describe("Produits 360 — les calculs PCH d'un produit", () => {
  it("série mensuelle : les mois demandés, dans l'ordre, cumulés ; un mois absent vaut 0", () => {
    expect(serieSurMois(["2026-04", "2026-05", "2026-06"], [{ mois: "2026-06", qte: 5 }, { mois: "2026-04", qte: 2 }, { mois: "2026-06", qte: 1 }, { mois: "2025-12", qte: 9 }])).toEqual([2, 0, 6]);
  });
  it("valeur au coût PCH : quantité × coût de référence ; coût inconnu → null", () => {
    expect(coutDeReference(12_000, 100)).toBe(120);
    expect(coutDeReference(0, 100)).toBeNull();
    expect(coutDeReference(500, 0)).toBeNull();
    expect(valeurAuCout(30, 120.4)).toBe(3612);
    expect(valeurAuCout(30, null)).toBeNull();
  });
  it("parts des fournisseurs : triées, part sur le total, les nôtres marquées", () => {
    const p = partsFournisseurs([{ fournisseur: "B", qte: 100, nous: false }, { fournisseur: "NOUS", qte: 300, nous: true }]);
    expect(p.map((x) => [x.fournisseur, x.partPct, x.nous])).toEqual([["NOUS", 75, true], ["B", 25, false]]);
    expect(partsFournisseurs([{ fournisseur: "A", qte: 0, nous: false }])[0].partPct).toBeNull();
  });
  it("demande non servie significative : 3 établissements, ou 10 % de la demande", () => {
    expect(nonServiSignificatif({ nonServi: 0, livre: 0, etablissements: 5 })).toBe(false);
    expect(nonServiSignificatif({ nonServi: 10, livre: 10_000, etablissements: 3 })).toBe(true);
    expect(nonServiSignificatif({ nonServi: 10, livre: 10_000, etablissements: 1 })).toBe(false);
    expect(nonServiSignificatif({ nonServi: 20, livre: 180, etablissements: 1 })).toBe(true);
  });
});

/**
 * VENTES PCH — les parties PURES, sur des fixtures SYNTHÉTIQUES (aucune ligne des vrais fichiers de la PCH n'entre
 * dans le dépôt) : en-têtes, DR et période, dates jj/mm/aa, non servi / retour, clients, produits, remplacement par
 * DR × mois, fichier annuel de réceptions, part de marché, chaîne d'un contrat.
 */

const ENTETE_VENTES = ["ANNEXE", "FAMILLE", "CLASSE", "CLIENT", "POSTE", "DCI", "UC", "LOT", "DDP", "QTÉ_COMMANDÉE", "QTÉ_LIVRÉE", "COUT_ACHAT", "PRIX_VENTE", "DATEFACT"];
const ENTETE_RECEPTIONS = ["GAMME", "DESI_CLASSE", "CODE_FOUR", "NOM_FOUR", "NUM_BR", "CODE_PRO", "DESI_PRO", "CODE_COND", "QTE", "ROUND(P.COUT_UNIT_ACHAT,2)", "CODE_MON", "DATESTOCKAGE", "TYPE_RECEP", "AVOIRNO"];

describe("lecture — en-têtes, dates, statuts", () => {
  it("reconnaît la nature par l'en-tête, même sous une ligne de titre", () => {
    expect(detecterEntete([ENTETE_VENTES])?.nature).toBe("VENTES_DR");
    expect(detecterEntete([["Etat des ventes"], ENTETE_VENTES])).toMatchObject({ nature: "VENTES_DR", ligne: 1 });
    const r = detecterEntete([ENTETE_RECEPTIONS]);
    expect(r?.nature).toBe("RECEPTIONS");
    if (r?.nature === "RECEPTIONS") expect(r.index.COUT_UNIT).toBe(9);
    expect(detecterEntete([["Nom", "Prénom", "Quantité"]])).toBeNull();
  });

  it("lit jj/mm/aa, les numéros de série Excel, et refuse d'inventer", () => {
    expect(lireDate("31/05/26")).toBe("2026-05-31");
    expect(lireDate("04/05/2026")).toBe("2026-05-04");
    expect(lireDate(45663)).toBe("2025-01-06");
    expect(lireDate(new Date("2025-01-05T23:00:00.000Z"))).toBe("2025-01-06");
    expect(lireDate(" ")).toBeNull();
    expect(lireDate("31/02/26")).toBeNull();
    expect(lireDate(null)).toBeNull();
  });

  it("classe chaque ligne : non servie, partielle, retour, servie", () => {
    expect(classerLigne(40, 0)).toBe("NON_SERVIE");
    expect(classerLigne(40, 32)).toBe("PARTIELLE");
    expect(classerLigne(0, 150)).toBe("SERVIE");
    expect(classerLigne(10, -2)).toBe("RETOUR");
    expect(classerLigne(0, 0)).toBe("NULLE");
    expect(quantiteNonServie("NON_SERVIE", 40)).toBe(40);
    expect(quantiteNonServie("PARTIELLE", 40)).toBe(0);
  });

  it("lit la DR et la période dans le fichier ; les lignes non servies (sans date) prennent le mois du fichier", () => {
    const rows = [
      ENTETE_VENTES,
      ["DRBe", "MED", "INFECTIOLOGIE", "MSPRH/E.P.H GDYEL", 1001, "MOLECULEX 50MG COMP", "B/30      ", "L1", "12/28", 20, 20, 1000, 1100, "12/05/26"],
      ["DRBe", "MED", "INFECTIOLOGIE", "MSPRH/E.P.H GDYEL", 1001, "MOLECULEX 50MG COMP", "B/30      ", " ", null, 60, 0, 0, 0, " "],
      ["DRBe", "MED", "INFECTIOLOGIE", "CLINIQUE TEST", 1002, "AUTREMOL 10MG INJ", "B/1", "L2", "01/27", 0, -3, 500, 550, "20/05/26"],
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    ];
    const e = detecterEntete(rows);
    if (e?.nature !== "VENTES_DR") throw new Error("nature");
    const { lignes, ignorees } = lireVentes(rows, e);
    expect(ignorees).toBe(0);
    expect(lignes.map((l) => l.statut)).toEqual(["SERVIE", "NON_SERVIE", "RETOUR"]);
    expect(lignes[0]).toMatchObject({ dr: "DRBE", poste: 1001, uc: "B/30", dateFacture: "2026-05-12", coutAchat: 1000 });
    expect(lignes[1].dateFacture).toBeNull();
    const p = periodeDuFichier(lignes.map((l) => l.dateFacture));
    expect(p).toMatchObject({ debut: "2026-05", fin: "2026-05", annuel: false, moisSansDate: "2026-05" });
    expect(libellePeriode(p!)).toBe("mai 2026");
    expect(codeDr(" DRTAM ")).toBe("DRTAM");
  });

  it("un fichier de réceptions sur douze mois est ANNUEL ; sans aucune date, pas de période", () => {
    const rows: unknown[][] = [ENTETE_RECEPTIONS];
    for (let m = 1; m <= 12; m++) rows.push(["MED", "ONCO", 1, "LABO A", `0000${m}/2025`, 2001, "MOLECULEY 100MG INJ", "B/1", 10, 12.5, "USD", `15/${String(m).padStart(2, "0")}/2025`, "FO", ""]);
    const e = detecterEntete(rows);
    if (e?.nature !== "RECEPTIONS") throw new Error("nature");
    const { lignes } = lireReceptions(rows, e);
    expect(lignes[0]).toMatchObject({ fournisseur: "LABO A", codePro: 2001, qte: 10, coutUnit: 12.5, devise: "USD", type: "FO" });
    const p = periodeDuFichier(lignes.map((l) => l.dateStockage))!;
    expect(p.annuel).toBe(true);
    expect(libellePeriode(p)).toBe("année 2025");
    expect(periodeDuFichier([null, null])).toBeNull();
  });
});

describe("normalisation — clients et présentations", () => {
  it("ramène les écritures de la PCH et de l'annuaire à la même clé", () => {
    expect(cleClient("MSPRH/E.P.H GDYEL")).toBe(cleClient("EPH Gdyel"));
    expect(cleClient("MSPRH/ETAB PUB HOSPITA AIN SALAH")).toBe(cleClient("EPH Ain-Salah"));
    expect(cleClient("MSPRH/ETAB PUB SANTE PROX AIN GUEZZAM")).toBe(cleClient("EPSP d'Ain Guezzam"));
    expect(cleClient("E.H.S CAC TLEMCEN")).toBe(cleClient("EHS CAC Tlemcen"));
    expect(cleClient("MSPRH/C.H.U ORAN")).toBe(cleClient("Centre Hospitalo-Universitaire d'Oran"));
    expect(cleClient("EPH Gdyel")).not.toBe(cleClient("EPH Gdyel Est"));
  });

  it("lit molécule, première dose et famille de forme d'un libellé PCH", () => {
    expect(clePresentation(presentationPch("RALTEGRAVIR COMP/GLES 400MG"))).toBe("RALTEGRAVIR|400MG|ORAL_SOLIDE");
    expect(clePresentation(presentationPch("SUNITINIB MALATE 12.5MG GLES"))).toBe("SUNITINIB|12.5MG|ORAL_SOLIDE");
    expect(clePresentation(presentationPch("PEMBROLIZUMAB SOL P/PERF 100MG/4ML"))).toBe("PEMBROLIZUMAB|100MG|PARENTERAL");
    expect(presentationPch("DOLUTEGRAVIR+LAMIVUDINE COMP 50MG/300MG").molecule).toBe(moleculeDe("Dolutégravir + Lamivudine"));
    expect(presentationPch("ACIDE X 1G INJ").dose).toBe("1000MG");
  });

  it("lit nos produits dans la même langue (dosage du catalogue, forme du menu des dossiers)", () => {
    expect(presentationProduit({ dci: "Dolutégravir", dosage: "50", dosageUnit: "mg", form: "COMPRIME_PELLICULE" })).toEqual(presentationPch("DOLUTEGRAVIR COMP 50MG"));
    expect(presentationProduit({ dci: "Dolutégravir + Lamivudine", dosage: "50/300", dosageUnit: "mg", form: "Comprimé pelliculé" }).dose).toBe("50MG");
    // Un dosage sans unité ne se compare pas : la dose reste illisible.
    expect(presentationProduit({ dci: "Nilotinib", dosage: "200", dosageUnit: null, form: "GELULE" }).dose).toBeNull();
    expect(memeMarche(presentationPch("NILOTINIB 200MG GELULE"), presentationPch("NILOTINIB COMP 200MG"))).toBe(true);
    expect(memeMarche(presentationPch("NILOTINIB 200MG GELULE"), presentationPch("NILOTINIB 150MG GELULE"))).toBe(false);
  });

  it("rapproche un fournisseur PCH d'un laboratoire par ses mots distinctifs", () => {
    expect(fournisseurCorrespond("SD PHARMACEUTICALS", "SD Pharmaceuticals Ltd")).toBe(true);
    expect(fournisseurCorrespond("SARL HIKMA PHARMA ALGERIA", "Hikma")).toBe(true);
    expect(fournisseurCorrespond("AT PHARMA S.P.A", "AT Pharma SpA")).toBe(true);
    expect(fournisseurCorrespond("SARL ORION LAB", "Hikma")).toBe(false);
    expect(fournisseurCorrespond("PHARMA", "Pharma")).toBe(false);
  });
});

describe("correspondance — établissements, produits, postes, fournisseurs", () => {
  it("un établissement se rattache s'il est UNIQUE ; la mémoire l'emporte ; homonymes → ambigu", () => {
    const etabs = [
      { id: "e1", name: "EPH Gdyel", isActive: true, wilaya: "Oran" },
      { id: "e2", name: "EPH Bordj", isActive: true, wilaya: "A" },
      { id: "e3", name: "E.P.H Bordj", isActive: true, wilaya: "B" },
      { id: "e4", name: "EPH Ferme", isActive: false },
    ];
    const r = indexEtablissementsPch(etabs, new Map([[cleClient("CLINIQUE X"), "e2"]]));
    expect(r("MSPRH/E.P.H GDYEL")).toMatchObject({ institutionId: "e1", statut: "NOM" });
    expect(r("MSPRH/ETAB PUB HOSPITA BORDJ")).toMatchObject({ institutionId: null, statut: "AMBIGU", candidats: ["e2", "e3"] });
    expect(r("Clinique X")).toMatchObject({ institutionId: "e2", statut: "MEMOIRE" });
    expect(r("EPH FERME").statut).toBe("INCONNU");
  });

  const produits: ProduitRef[] = [
    { id: "p-dolu", nom: "Dolutégravir 50 mg", dci: "Dolutégravir", dosage: "50", dosageUnit: "mg", form: "COMPRIME_PELLICULE", packaging: "B/30" },
    { id: "p-nilo30", nom: "Nilotinib 200 B/28", dci: "Nilotinib", dosage: "200", dosageUnit: "mg", form: "GELULE", packaging: "B/28" },
    { id: "p-nilo112", nom: "Nilotinib 200 B/112", dci: "Nilotinib", dosage: "200", dosageUnit: "mg", form: "GELULE", packaging: "B/112" },
    { id: "p-palbo", nom: "Palbociclib 125", dci: "Palbociclib", dosage: "125", dosageUnit: "mg", form: "GELULE", packaging: "B/21" },
  ];

  it("un poste désigne UN de nos produits par sa présentation ; l'UC départage deux boîtes", () => {
    const r = indexProduitsPch(produits, new Map());
    expect(r(9667, "DOLUTEGRAVIR COMP 50MG", "B/60")).toMatchObject({ productId: "p-dolu", statut: "IDENTITE" });
    expect(r(9322, "NILOTINIB 200MG GELULE", "B/28")).toMatchObject({ productId: "p-nilo30", statut: "IDENTITE" });
    expect(r(9322, "NILOTINIB 200MG GELULE", "B/1")).toMatchObject({ productId: null, statut: "AMBIGU" });
    expect(r(9629, "PALBOCICLIB GLES 75MG", "B/21")).toMatchObject({ productId: null, statut: "MOLECULE", candidats: ["p-palbo"] });
    expect(r(5110, "COLISTINE INJ 1 000 000UI", "B/10")).toMatchObject({ productId: null, statut: "MARCHE" });
    const avecMemoire = indexProduitsPch(produits, new Map([[9629, "p-palbo"]]));
    expect(avecMemoire(9629, "PALBOCICLIB GLES 75MG", "B/21")).toMatchObject({ productId: "p-palbo", statut: "MEMOIRE" });
  });

  it("le produit d'un poste : la main d'abord, puis un seul produit sûr, puis l'ancien rattachement s'il reste candidat", () => {
    const r = indexProduitsPch(produits, new Map());
    const sur = r(9667, "DOLUTEGRAVIR COMP 50MG", "B/30");
    const ambigu = r(9322, "NILOTINIB 200MG GELULE", "B/1");
    expect(decisionPoste({ productId: "p-palbo", manuel: true }, [sur])).toMatchObject({ productId: "p-palbo", statut: "MEMOIRE" });
    expect(decisionPoste(undefined, [sur])).toMatchObject({ productId: "p-dolu", statut: "IDENTITE" });
    expect(decisionPoste({ productId: "p-nilo112", manuel: false }, [ambigu])).toMatchObject({ productId: "p-nilo112" });
    expect(decisionPoste(undefined, [ambigu])).toMatchObject({ productId: null, statut: "AMBIGU" });
    // Deux libellés du même poste dans deux DR : l'un illisible, l'autre sûr → le sûr l'emporte.
    expect(decisionPoste(undefined, [r(9667, "DOLUTEGRAVIR", null), sur]).productId).toBe("p-dolu");
  });

  it("propose nos fournisseurs d'après les laboratoires des dossiers — jamais une annexe ni un retour", () => {
    expect(proposerFournisseurs(["SD PHARMACEUTICALS", "ANNEXE ALGER", "EVA PHARMA FOR PHARMACEUTICAL AND MEDICAL APPLIANCES S.A.E."], ["SD Pharmaceuticals Ltd", null])).toEqual(["SD PHARMACEUTICALS"]);
    expect(proposerFournisseurs(["Retour Client", "HETERO LABS LTD"], ["Hetero Labs"])).toEqual(["HETERO LABS LTD"]);
    expect(proposerFournisseurs(["SARL ORION LAB"], [])).toEqual([]);
  });
});

describe("calculs — remplacement, part de marché, contrat, périodes", () => {
  const existants = [
    { id: "i-dro-mai", empreinte: "a", tranches: [{ source: "DRO", mois: "2026-05" }] },
    { id: "i-dra-mai", empreinte: "b", tranches: [{ source: "DRA", mois: "2026-05" }] },
    { id: "i-rec-mars", empreinte: "c", tranches: [{ source: "RECEPTIONS", mois: "2025-03" }] },
    { id: "i-rec-hiver", empreinte: "d", tranches: [{ source: "RECEPTIONS", mois: "2024-12" }, { source: "RECEPTIONS", mois: "2025-01" }] },
  ];

  it("le même fichier ne fait rien", () => {
    expect(planRemplacement("a", [{ source: "DRO", mois: "2026-05" }], existants)).toEqual({ deja: true, importId: "i-dro-mai" });
  });

  it("un fichier plus récent de la même DR et du même mois remplace CE mois, pas celui d'une autre DR", () => {
    const p = planRemplacement("z", [{ source: "DRO", mois: "2026-05" }], existants);
    expect(p).toEqual({ deja: false, tranchesRemplacees: [{ source: "DRO", mois: "2026-05" }], importsRemplaces: ["i-dro-mai"], importsEntames: [] });
    const juin = planRemplacement("y", [{ source: "DRO", mois: "2026-06" }], existants);
    expect(juin).toMatchObject({ deja: false, tranchesRemplacees: [], importsRemplaces: [] });
  });

  it("un fichier annuel de réceptions remplace l'année : l'import de mars disparaît, celui à cheval est entamé", () => {
    const annee = Array.from({ length: 12 }, (_, i) => ({ source: "RECEPTIONS", mois: `2025-${String(i + 1).padStart(2, "0")}` }));
    const p = planRemplacement("x", annee, existants);
    if (p.deja) throw new Error("deja");
    expect(p.importsRemplaces).toEqual(["i-rec-mars"]);
    expect(p.importsEntames).toEqual(["i-rec-hiver"]);
    expect(p.tranchesRemplacees.map((t) => t.mois).sort()).toEqual(["2025-01", "2025-03"]);
  });

  it("part de marché, évolution : un dénominateur nul ne fabrique pas de pourcentage", () => {
    expect(partDeMarche(31667, 31667)).toBe(100);
    expect(partDeMarche(6461, 10885)).toBe(59.4);
    expect(partDeMarche(5, 0)).toBeNull();
    expect(evolution(120, 100)).toBe(20);
    expect(evolution(80, 100)).toBe(-20);
    expect(evolution(10, 0)).toBeNull();
  });

  it("la chaîne d'un contrat : AO 30 000 → BC 8 000 + 5 000 + 10 000 ; au-delà de l'AO, l'avenant", () => {
    expect(chaineContrat(30000, 23000, 18000)).toMatchObject({ reste: 7000, depassement: 0, avenant: false, pctCommande: 76.7, pctLivre: 60 });
    expect(chaineContrat(30000, 35000, 30000)).toMatchObject({ reste: 0, depassement: 5000, avenant: true });
    expect(chaineContrat(30000, 20000, 0, true).avenant).toBe(true);
    expect(chaineContrat(0, 100, 0).pctCommande).toBeNull();
  });

  it("périodes : mois, trimestre, année, 12 mois — et la précédente de même longueur", () => {
    expect(periodeDe("trimestre", "2026-05")).toMatchObject({ debut: "2026-04", fin: "2026-06", libelle: "T2 2026" });
    expect(periodePrecedente(periodeDe("trimestre", "2026-05"))).toMatchObject({ debut: "2026-01", fin: "2026-03" });
    expect(periodePrecedente(periodeDe("mois", "2026-01"))).toMatchObject({ debut: "2025-12", fin: "2025-12" });
    expect(periodeDe("12m", "2026-05")).toMatchObject({ debut: "2025-06", fin: "2026-05" });
    expect(periodePrecedente(periodeDe("12m", "2026-05"))).toMatchObject({ debut: "2024-06", fin: "2025-05" });
    expect(periodePrecedente(periodeDe("annee", "2026-05"))).toMatchObject({ debut: "2025-01", fin: "2025-12" });
    expect(decalerMois("2026-01", -1)).toBe("2025-12");
  });

  it("fraîcheur : un mois manquant se voit", () => {
    expect(moisManquants(["2026-02", "2026-05"], "2026-02", "2026-05")).toEqual(["2026-03", "2026-04"]);
  });
});

describe("période choisie par fichier (10/2026)", () => {
  it("un mois choisi regroupe toutes les lignes ; « annuel » garde le mois de chaque ligne sous l'année choisie", () => {
    expect(moisSelonChoix("2026-03", { annee: 2026, mois: 5 })).toBe("2026-05");
    expect(moisSelonChoix("2025-03", { annee: 2026, mois: null })).toBe("2026-03");
    expect(moisSelonChoix("2026-03", null)).toBe("2026-03");
  });
  it("lit un choix de formulaire, ou le refuse", () => {
    expect(lireChoixPeriode("2026", "5")).toEqual({ annee: 2026, mois: 5 });
    expect(lireChoixPeriode(2026, "annuel")).toEqual({ annee: 2026, mois: null });
    expect(lireChoixPeriode("abc", "5")).toBeNull();
    expect(lireChoixPeriode("2026", "13")).toBeNull();
  });
});