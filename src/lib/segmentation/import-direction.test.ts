import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { lireClasseur, proposerRegles, reglesDuTexte, methodeDuFichier, statutDe, capaciteDesFeuilles, type Feuilles } from "./lecture-classeur";
import { lireRegles, affiniteAffichee, type Lettre, type Regles } from "./regles";
import { segmenterPraticien } from "./moteur";
import { lettreProvisoire } from "./charge";
import { lireFeuilles, plageUtile } from "./feuilles";
import {
  cleSoupleEtablissement, indexerEtablissementsSouple, wilayaDeLEtablissement, specialitesDuFichier, buDuFichier, annuaireDeLaBu,
  planDeLettre, ajusterDecisions, memeReponse, motifLettreFichier, compterLettres, typeDEtablissementSouple,
} from "./plan-import";

/**
 * L'IMPORT DU CLASSEUR DE LA DIRECTION « EN UNE FOIS » — les parties pures, sur un classeur SYNTHÉTIQUE qui a la forme
 * du vrai (préambule de règles, compteurs, en-tête à retours à la ligne, « % » = Q2 ÷ Q1, feuilles annexes) et aucune
 * de ses lignes : les noms sont inventés.
 */

const ENTETE = [
  "Region", "CDR", "Specialité", "Nom", "Prenom", "Grade", "Statut",
  "Question 1\r\nCombien de patients vous consultez \r\npar semaine  pour HIV",
  "Question 2\r\nSur 10 Patients  Consultés combien sont mis sous raltegravir", "%", "Potentiel",
];
const pctDe = (q1: number | null, q2: number | null) => (q1 && q2 !== null ? q2 / q1 : null);
const ligne = (region: string, cdr: string, spe: string, nom: string, prenom: string, grade: string, statut: string, q1: number | null, q2: number | null, lettre: string) =>
  [region, cdr, spe, nom, prenom, grade, statut, q1, q2, pctDe(q1, q2), lettre];

const PF: unknown[][] = [
  ["Le decideur est defini par la lettre (H) et devra etre visité a la frequence la plus elevée  "],
  ["A partir de 22 Patients Par Semaine  soit 90 Patients Par Mois le Médecin est considéré comme haut Potentiel "],
  ["En 2026 la Rx du Raltégravir Vs All ARV est en Moyenne de 7,21% , pour un ration > a 10% nous pouvons considérer que le médecin possède une Affinité au produit "],
  ["Exception pour le PF de L’Ouest ou ce ratio a été revu à la baisse du fait d’un PF Réduit "],
  [" NA : Pour Non Applicable"],
  [null, null, 3, 4, 2, 5, 14],
  [null, null, 0.2, 0.3, 0.1, 0.4],
  ENTETE,
  ligne("Centre", "CHU Alpha", "Infectiologie", "Alpha", "Un", "Prof chef de service", "Decideur", null, null, "H"),
  ligne("Centre", "CHU Alpha", "Infectiologie", "Beta", "Deux", "Maitre Assistant", "Décideur", 0, 0, "H"),
  ligne("Centre", "EHS El Kettar", "Infectiologie", "Gamma", "Trois", "Assistant", "Influenceur", 30, 4, "A"),
  ligne("Centre", "EHS El Kettar", "Infectiologie", "Delta", "Quatre", "Assistant", "Prescripteur", 30, 3, "B"),
  ligne("Est", "CHU Setif", "Infectiologie", "Epsilon", "Cinq", "Résidente 3ème année", "prescripteur", 10, 2, "C"),
  ligne("Est", "CHU Setif", "Infectiologie", "Zeta", "Six", "Résident 1ère année", "Prescripteur", 10, 1, "D"),
  ligne("Est", "CHU Setif", "Infectiologie", "Eta", "Sept", "Résident 2ème année", "Prescripteur", 0, 0, "NA"),
  ligne("Est", "CHU Setif", "Pharmacie Hospitalière", "Theta", "Huit", "Pharmacien", "Réfèrent", null, null, "NA"),
  ligne("Ouest", "CHU d'Oran", "Pharmacie hospitalière", "Iota", "Neuf", "Pharmacien", "Referent", 0, null, "NA"),
  ligne("Ouest", "CHU d'Oran", "Infectiologie", "Kappa", "Dix", "KOL", "Influenceur", 10, 1, "A"),
  ligne("Ouest", "CHU de Sidi-Bel-Abbès", "Infectiologie", "Lambda", "Onze", "Assistant", "Prescripteur", 12, 3, "A"),
  ligne("Ouest", "CHU de Sidi-Bel-Abbès", "Infectiologie", "Mu", "Douze", "Assistant", "Prescripteur", 30, 3, "B"),
  [],
  [],
];
const CLASSEUR: Feuilles = {
  Glossaire: [[null, "Définition des statuts et du Potentiel "], [null, " NA : Pour Non Applicable, il s'agit de résidents, Pharmaciens ou autres qui ne consultent pas"]],
  "PF Final": PF,
  "V2 PF KAM": [
    ["Moyenne \r\nContacts/ Jour", 7, "Nombre de Contacts\r\n/ Cycle de 20 Jours ", 140],
    [null, null, "Centre ", null, null, null, 127],
    [null, null, null, null, "Nombre", "Frequence", "Nombre de \r\nContacts / Mois"],
    [null, null, " H, A & B", "In", 39, 2, 78],
    [null, null, null, "Out", 18, 2, 36],
    [null, null, "C & D", "In", 3, 1, 3],
    [null, null, null, "Out", 10, 1, 10],
    [null, null, "Ouest", null, null, null, 88],
    [null, null, " H, A & B", "In", 15, 3, 45],
    [null, null, null, "Out", 17, 2, 34],
    [null, null, "C & D", "In", null, 1, 0],
    [null, null, null, "Out", 9, 1, 9],
  ],
  Feuil6: [[null, null, null, "Decideur"], [null, null, null, "Influenceur"], [null, null, null, "Réfèrent"], [null, null, null, "Prescripteur"]],
};
const RAL = "prod-raltegravir";
const T0 = new Date("2026-10-08T09:00:00Z");

function lettresDu(regles: Regles): { ligne: number; zone: string | null; fichier: string | null; calculee: Lettre }[] {
  return lireClasseur(CLASSEUR)!.lignes.map((l) => ({
    ligne: l.ligne, zone: l.zone, fichier: l.segmentFichier,
    calculee: segmenterPraticien({
      doctorId: String(l.ligne), statut: l.statut, zone: l.zone, derogations: [],
      observations: l.potentiel !== null || l.sur10 !== null ? [{ productId: RAL, potentiel: l.potentiel, prescriptionsSur10: l.sur10, observeLe: T0 }] : [],
    }, regles, T0).lettreCalculee,
  }));
}

describe("le classeur de la Direction se LIT tel quel", () => {
  const lecture = lireClasseur(CLASSEUR)!;
  it("trouve la feuille des praticiens (pas le glossaire ni les listes), saute le préambule, garde la ligne Excel", () => {
    expect(lecture.feuille).toBe("PF Final");
    expect(lecture.lignes).toHaveLength(12);
    expect(lecture.lignes[0].ligne).toBe(9);
    expect(lecture.produitMentionne).toBe("raltegravir");
    expect(lecture.metrique).toBe("patients HIV / semaine");
    const champs = Object.fromEntries(lecture.entete.filter((c) => c.texte).map((c) => [c.texte.split(" ")[0], c.champ]));
    expect(champs).toMatchObject({ Region: "zone", CDR: "etablissement", Nom: "nom", Statut: "statut", "%": "pourcentage", Potentiel: "segment" });
    expect(lecture.entete.find((c) => /Question 1/.test(c.texte))?.champ).toBe("potentiel");
    expect(lecture.entete.find((c) => /Question 2/.test(c.texte))?.champ).toBe("sur10");
  });
  it("les statuts s'écrivent de toutes les façons", () => {
    for (const [brut, s] of [["Decideur", "DECIDEUR"], ["Décideur", "DECIDEUR"], ["DECIDEUR", "DECIDEUR"], ["Réfèrent", "REFERENT"], ["Referent", "REFERENT"], ["référent", "REFERENT"], ["Influenceur", "INFLUENCEUR"], ["prescripteur", "PRESCRIPTEUR"]] as const) expect(statutDe(brut)).toBe(s);
    expect(lecture.anomalies).toEqual([]);
  });
  it("les règles écrites : seuil 22, ratio STRICTEMENT > 10 % (même écrit « ration »), moyenne 7,21 % en 2026, NA = non applicable, exception Ouest", () => {
    expect(reglesDuTexte(lecture.texte)).toEqual({
      seuilPotentiel: 22, seuilAffinite: 0.1, comparaisonAffinite: ">", zonesEnException: ["Ouest"],
      reference: { valeur: 0.0721, annee: 2026 }, naNonApplicable: true,
    });
  });
  it("la colonne « % » est une FORMULE Q2 ÷ Q1 : la méthode d'affinité s'en déduit", () => {
    expect(methodeDuFichier(lecture.lignes).methode).toBe("RATIO_FICHIER");
  });
  it("capacité et grille lues dans la feuille des KAM", () => {
    expect(capaciteDesFeuilles(CLASSEUR)).toEqual({ contactsParJour: 7, joursParCycle: 20 });
  });
});

describe("la proposition de règles reproduit le fichier — les lettres posées à la main sont des ÉCARTS gardés", () => {
  const lecture = lireClasseur(CLASSEUR)!;
  const p = proposerRegles(lecture, CLASSEUR, RAL, { exceptionsDeduites: false, grille: true, secteurDeZone: (z) => (z === "Ouest" ? { id: "sect-ouest", nom: "Ouest" } : null) });
  const lu = lireRegles(p.contenu);
  it("règles lisibles : ratio Q2 ÷ Q1, 0 patient → NA, décideur → H, repère, grille et capacité", () => {
    expect(p.erreurs).toEqual([]);
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(lu.regles.produits[0]).toMatchObject({ seuilPotentiel: 22, seuilAffinite: 0.1, comparaisonAffinite: ">", methodeAffinite: "RATIO_FICHIER", reference: { valeur: 0.0721, annee: 2026 }, exceptions: [] });
    expect(lu.regles.ciblage.potentielNulNA).toBe(true);
    expect(lu.regles.h.statuts).toEqual(["DECIDEUR"]);
    expect(lu.regles.grille?.defaut).toEqual({ H_IN: 2, H_OUT: 2, AB_IN: 2, AB_OUT: 2, CD_IN: 1, CD_OUT: 1 });
    expect(lu.regles.grille?.secteurs).toEqual([{ secteurId: "sect-ouest", nom: "Ouest", valeurs: { AB_IN: 3, H_IN: 3 } }]);
    expect(lu.regles.capacite).toEqual({ contactsParJour: 7, joursParCycle: 20 });
    expect(p.provenance.join(" ")).toMatch(/Exception Ouest annoncée .*gardées telles quelles/);
  });
  it("Centre et Est : le calcul donne EXACTEMENT les lettres du fichier ; Ouest : deux lettres à la main", () => {
    if (!lu.ok) throw new Error("règles");
    const r = lettresDu(lu.regles);
    const plans = r.map((x) => ({ ...x, plan: planDeLettre(x.fichier as never, x.calculee) }));
    const ecarts = plans.filter((x) => x.plan.action === "garder");
    expect(ecarts.map((x) => [x.zone, x.fichier, x.calculee])).toEqual([["Ouest", "A", "D"], ["Ouest", "A", "C"]]);
    expect(plans.filter((x) => x.plan.action === "signaler")).toEqual([]);
    // Après import : les lettres sont celles du fichier, une par une.
    const apres = plans.map((x) => (x.plan.action === "garder" ? x.plan.valeur : x.calculee));
    expect(apres).toEqual(r.map((x) => x.fichier));
    expect(compterLettres(apres)).toMatchObject({ H: 2, A: 3, B: 2, C: 1, D: 1, NA: 3, NC: 0 });
  });
  it("décideur → H même à 0 patient ; Q1 = 0 → NA ; Q1 vide → NA ; 3/30 = 10 % → B, 4/30 → A (strict)", () => {
    if (!lu.ok) throw new Error("règles");
    const de = (statut: "DECIDEUR" | "PRESCRIPTEUR" | "REFERENT", q1: number | null, q2: number | null) => segmenterPraticien({
      doctorId: "x", statut, zone: "Centre", derogations: [], observations: q1 !== null || q2 !== null ? [{ productId: RAL, potentiel: q1, prescriptionsSur10: q2, observeLe: T0 }] : [],
    }, lu.regles, T0);
    expect(de("DECIDEUR", 0, 0).lettre).toBe("H");
    expect(de("PRESCRIPTEUR", 0, 0).lettre).toBe("NA");
    expect(de("PRESCRIPTEUR", 0, 0).produits[0].pourquoi.join(" ")).toMatch(/non applicable/);
    expect(de("REFERENT", null, null).lettre).toBe("NA");
    expect(de("PRESCRIPTEUR", 30, 3).lettre).toBe("B");
    expect(de("PRESCRIPTEUR", 30, 4).lettre).toBe("A");
    expect(de("PRESCRIPTEUR", 10, 2).lettre).toBe("C");
    expect(de("PRESCRIPTEUR", 10, 1).lettre).toBe("D");
  });
});

describe("la lettre du fichier fait foi — décisions motivées, jamais effacées", () => {
  it("plan d'une ligne", () => {
    expect(planDeLettre(null, "A")).toEqual({ action: "aucune" });
    expect(planDeLettre("A", "A")).toEqual({ action: "calcul" });
    expect(planDeLettre("A", "D")).toEqual({ action: "garder", valeur: "A", calculee: "D" });
    expect(planDeLettre("H", "B")).toEqual({ action: "garder", valeur: "H", calculee: "B" });
    expect(planDeLettre("NA", "NC")).toEqual({ action: "calcul" });
    expect(planDeLettre("NA", "B")).toEqual({ action: "signaler", calculee: "B" });
  });
  it("une décision qui dit déjà la lettre est gardée ; une contraire est levée ; rien n'est touché sans lettre", () => {
    const enVigueur = [{ id: "d1", nature: "SEGMENT", valeur: "A" }, { id: "d2", nature: "CIBLAGE", valeur: "NON_CIBLE" }];
    expect(ajusterDecisions({ action: "garder", valeur: "A", calculee: "D" }, enVigueur)).toEqual({ lever: ["d2"], poser: null });
    expect(ajusterDecisions({ action: "garder", valeur: "B", calculee: "D" }, enVigueur)).toEqual({ lever: ["d1", "d2"], poser: "B" });
    expect(ajusterDecisions({ action: "calcul" }, enVigueur)).toEqual({ lever: ["d1", "d2"], poser: null });
    expect(ajusterDecisions({ action: "aucune" }, enVigueur)).toEqual({ lever: [], poser: null });
    expect(ajusterDecisions({ action: "garder", valeur: "A", calculee: "D" }, [])).toEqual({ lever: [], poser: "A" });
  });
  it("le motif nomme le fichier et la date ; une réponse identique n'est pas une nouvelle réponse", () => {
    expect(motifLettreFichier("Segmentation.xlsx", T0)).toBe("Lettre du fichier importé (Segmentation.xlsx, 08/10/2026)");
    expect(memeReponse(3, 3)).toBe(true);
    expect(memeReponse(null, null)).toBe(true);
    expect(memeReponse(3, 4)).toBe(false);
    expect(memeReponse(null, 0)).toBe(false);
  });
});

describe("annuaires reliés — établissements, wilayas, spécialités, BU, annuaire", () => {
  it("« CHU d'Oran » ≡ « CHU Oran » ; « CHU de Sidi-Bel-Abbès » ≡ « CHU Sidi Bel Abbes »", () => {
    expect(cleSoupleEtablissement("CHU d'Oran")).toBe(cleSoupleEtablissement("CHU Oran"));
    expect(cleSoupleEtablissement("CHU d’Oran")).toBe("chu oran");
    expect(cleSoupleEtablissement("CHU de Sidi-Bel-Abbès")).toBe(cleSoupleEtablissement("chu sidi bel abbes"));
    expect(cleSoupleEtablissement("CHU de Tlemcen")).toBe("chu tlemcen");
  });
  it("rattachement : exact d'abord, puis souple s'il n'en désigne qu'UN actif ; plusieurs = à trancher", () => {
    const trouver = indexerEtablissementsSouple([
      { id: "oran", name: "CHU Oran", isActive: true },
      { id: "sba", name: "CHU Sidi Bel Abbes", isActive: true },
      { id: "tlm-ferme", name: "CHU Tlemcen", isActive: false },
      { id: "c1", name: "EPH Centre", isActive: true },
      { id: "c2", name: "EPH du Centre", isActive: true },
    ]);
    expect(trouver("CHU d'Oran")).toMatchObject({ statut: "trouve", etablissement: { id: "oran" } });
    expect(trouver("CHU de Sidi-Bel-Abbès")).toMatchObject({ statut: "trouve", etablissement: { id: "sba" } });
    expect(trouver("chu oran")).toMatchObject({ statut: "trouve", etablissement: { id: "oran" } });
    expect(trouver("CHU de Tlemcen").statut).toBe("inconnu");
    expect(trouver("EPH de Centre").statut).toBe("ambigu");
    expect(trouver("CHU Mostaganem").statut).toBe("inconnu");
  });
  it("la wilaya se lit dans le nom (ou une commune connue), sinon reste vide", () => {
    expect(wilayaDeLEtablissement("CHU d'Oran")).toBe("Oran");
    expect(wilayaDeLEtablissement("CHU de Sidi-Bel-Abbès")).toBe("Sidi Bel Abbès");
    expect(wilayaDeLEtablissement("CHU Setif")).toBe("Sétif");
    expect(wilayaDeLEtablissement("EPH BOUFARIK")).toBe("Blida");
    expect(wilayaDeLEtablissement("EHS EL KETTAR")).toBe("Alger");
    expect(wilayaDeLEtablissement("ONUSIDA")).toBeNull();
    expect(typeDEtablissementSouple("EHS EL KETTAR")).toBe("EHS");
    expect(typeDEtablissementSouple("ONUSIDA")).toBe("AUTRE");
  });
  it("« Pharmacie Hospitalière » et « Pharmacie hospitalière » sont UNE spécialité (l'écriture la plus fréquente)", () => {
    const m = specialitesDuFichier(["Pharmacie Hospitalière", "Pharmacie hospitalière", "Pharmacie Hospitalière", "Infectiologie", " Infectiologie ", "INFECTIOLOGIE", null]);
    expect([...m.values()]).toEqual(["Pharmacie Hospitalière", "Infectiologie"]);
    expect([...specialitesDuFichier(["Pharmacie Hospitalière", "Pharmacie hospitalière"]).values()]).toEqual(["Pharmacie hospitalière"]);
  });
  it("la BU se reconnaît à la spécialité dominante du fichier (casse et accents mis à part)", () => {
    const bus = [{ id: "onco", name: "Oncologie", specialites: [] }, { id: "infh", name: "INFECTIOLOGIE / HÉMATOLOGIE", specialites: [] }];
    expect(buDuFichier(bus, ["Infectiologie", "Infectiologie", "Pharmacie hospitalière"])).toBe("infh");
    expect(buDuFichier([{ id: "x", name: "Specialty Care", specialites: ["Infectiologie"] }], ["Infectiologie"])).toBe("x");
    expect(buDuFichier(bus, ["Cardiologie"])).toBeNull();
  });
  it("l'annuaire de la BU : celui qui porte son nom, ou le radical de sa spécialité — sinon aucun (il sera créé)", () => {
    expect(annuaireDeLaBu([{ id: "a", name: "BU Infectiologie / hématologie" }, { id: "b", name: "Infectiologues" }], "Infectiologie / hématologie")).toBe("a");
    expect(annuaireDeLaBu([{ id: "b", name: "Infectiologues" }, { id: "c", name: "Cardiologues Centre" }], "Infectiologie / hématologie")).toBe("b");
    expect(annuaireDeLaBu([{ id: "c", name: "Cardiologues Centre" }], "Infectiologie / hématologie")).toBeNull();
  });
});

describe("l'écran dit la même chose que le moteur — « % » = Q2 ÷ Q1 pour le classeur", () => {
  it("affinité affichée selon la méthode", () => {
    expect(affiniteAffichee(30, 3, "RATIO_FICHIER")).toBeCloseTo(0.1);
    expect(affiniteAffichee(0, 3, "RATIO_FICHIER")).toBeNull();
    expect(affiniteAffichee(30, null, "RATIO_FICHIER")).toBeNull();
    expect(affiniteAffichee(30, 3, "SUR_10")).toBeCloseTo(0.3);
  });
  it("lettre provisoire : ratio, 0 patient = NA", () => {
    const base = { statut: "PRESCRIPTEUR" as const, hStatuts: ["DECIDEUR" as const], seuilPotentiel: 22, seuilAffinite: 0.1, comparaison: ">" as const, potentielNulNonCible: true, methode: "RATIO_FICHIER" as const, potentielNulNA: true };
    expect(lettreProvisoire({ ...base, q1: 30, q2: 3 })).toBe("B");
    expect(lettreProvisoire({ ...base, q1: 30, q2: 4 })).toBe("A");
    expect(lettreProvisoire({ ...base, q1: 0, q2: 0 })).toBe("NA");
    expect(lettreProvisoire({ ...base, q1: 0, q2: 0, potentielNulNA: false })).toBe("NC");
    expect(lettreProvisoire({ ...base, q1: 30, q2: 3, methode: "SUR_10" })).toBe("A");
  });
  it("lireRegles garde « 0 patient = NA »", () => {
    const lu = lireRegles({ produits: [{ productId: RAL, seuilPotentiel: 22, seuilAffinite: 0.1 }], ciblage: { potentielNulNA: true }, h: { statuts: ["DECIDEUR"], frequence: 2 } });
    expect(lu.ok && lu.regles.ciblage.potentielNulNA).toBe(true);
  });
});

describe("un classeur qui déclare un million de lignes se lit sans s'arrêter", () => {
  it("la plage est recalculée sur les cellules remplies (A1:K1048165 → A1:K20)", () => {
    const ws = XLSX.utils.aoa_to_sheet(PF);
    ws["!ref"] = "A1:K1048165";
    expect(plageUtile(ws)).toBe("A1:K20");
    expect(plageUtile(XLSX.utils.aoa_to_sheet([]))).toBeNull();
  });
  it("lu depuis le fichier, le classeur garde la numérotation Excel", () => {
    const wb = XLSX.utils.book_new();
    for (const [n, rows] of Object.entries(CLASSEUR)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n);
    const f = lireFeuilles(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
    expect(f["PF Final"]).toHaveLength(20);
    const lecture = lireClasseur(f)!;
    expect(lecture.feuille).toBe("PF Final");
    expect(lecture.lignes).toHaveLength(12);
    expect(lecture.lignes[0].ligne).toBe(9);
  });
});
