import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  ARBORESCENCE_DOSSIER, FICHIERS_MODELES, MODELE_COURRIER_RESERVES,
  cheminDrivePourDepot, cyclesDeLaFrise, moduleDuDepot, natureDesReserves, nomDepotReponses, nomDossierDrive,
} from "./arborescence-dossier";

/**
 * LE DOSSIER DRIVE D'UN PRODUIT REGULATORY (Direction, 06/10) — l'arborescence est celle du modèle
 * remis par la Direction (« Exemple structuration dossier.zip », dossier « Etanercept »), au caractère
 * près ; et chaque dépôt se range là où le modèle le met.
 */

/** Le listing du ZIP modèle, sous « Etanercept/ » — dossiers (« / » final) et fichiers, dans l'ordre. */
const LISTING_MODELE = [
  "1- Pre-soumission/",
  "1- Pre-soumission/Draft/",
  "1- Pre-soumission/Soumission/",
  "2- Enregistrement/",
  "2- Enregistrement/Depot 0 -dossier recu (dirty file)/",
  "2- Enregistrement/Depot 0 -dossier recu (dirty file)/Audit CTD-deficiencies/",
  "2- Enregistrement/Depot 0 -dossier recu (dirty file)/Audit CTD-deficiencies/Query 1/",
  "2- Enregistrement/Depot 0 -dossier recu (dirty file)/Audit CTD-deficiencies/Query 2/",
  "2- Enregistrement/Depot 0 -dossier recu (dirty file)/Trackers/",
  "2- Enregistrement/Depot 1 initial/",
  "2- Enregistrement/Depot 1 initial/ANPP/",
  "2- Enregistrement/Depot 1 initial/ANPP/Module 1/",
  "2- Enregistrement/Depot 1 initial/ANPP/Module 2/",
  "2- Enregistrement/Depot 1 initial/ANPP/Module 3/",
  "2- Enregistrement/Depot 1 initial/ANPP/Module 4/",
  "2- Enregistrement/Depot 1 initial/ANPP/Module 5/",
  "2- Enregistrement/Depot 1 initial/Draft/",
  "2- Enregistrement/Depot 1 initial/Draft/Documents administratifs/",
  "2- Enregistrement/Depot 1 initial/Draft/Documents administratifs/Detenteur/",
  "2- Enregistrement/Depot 1 initial/Draft/Documents administratifs/Exploitant/",
  "2- Enregistrement/Depot 1 initial/Draft/Documents administratifs/Fabricant API-PF/",
  "2- Enregistrement/Depot 1 initial/Draft/Draft courriers/",
  "2- Enregistrement/Depot 1 initial/Draft/Formulaires et fiches/",
  "2- Enregistrement/Depot 1 initial/Draft/RCP et maquettes/",
  "2- Enregistrement/Depot 1 initial/Draft/RCP et maquettes/1- Pays d'origine/",
  "2- Enregistrement/Depot 1 initial/Draft/RCP et maquettes/2- Algerie/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/1- Reserves recues ANPP/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Query 1/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Query 2/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Query 3/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Tracker/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/1- Traitement des reserves/Tracker/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/2- Draft/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/2- Draft/Courrier de reponse aux reserves.docx",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/3- Depot ANPP/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/3- Depot ANPP/Module 3/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques/3- Depot ANPP/Module 5/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/1- Traitement des reserves/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/1- Traitement des reserves/1-Reserves recues ANPP/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/1- Traitement des reserves/2-Retour Detenteur-Fabricant/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/1- Traitement des reserves/2-Retour Detenteur-Fabricant/Query 1/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/1- Traitement des reserves/Tracker/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/2- Draft/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/2- Draft/Courrier de reponse aux reserves.docx",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/3- Depot ANPP/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires/3- Depot ANPP/Module 1/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses prix/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses prix/Demande de baisse de prix/",
  "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses prix/Reponse/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/1- Reserves recues ANPP/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Query 1/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Query 2/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Query 3/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/2- Retour Detenteur-Fabricant/Tracker/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/1- Traitement des reserves/Tracker/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/2- Draft/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/2- Draft/Courrier de reponse aux reserves.docx",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/3- Depot ANPP/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/3- Depot ANPP/Module 3/",
  "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques/3- Depot ANPP/Module 5/",
  "3-DE et attestation de prix/",
];

const DEPOT2_SCI = "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves scientifiques";
const DEPOT2_TEC = "2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses aux reserves technico-reglementaires";
const DEPOT3_SCI = "2- Enregistrement/Depot 3 (Reponses aux reserves 2/Reponses aux reserves scientifiques";
const ANPP = "2- Enregistrement/Depot 1 initial/ANPP";
const chemin = (d: Parameters<typeof cheminDrivePourDepot>[0]) => cheminDrivePourDepot(d).join("/");

describe("l'arborescence est EXACTEMENT celle du modèle", () => {
  it("mêmes dossiers, même ordre, noms au caractère près", () => {
    const dossiersModele = LISTING_MODELE.filter((l) => l.endsWith("/")).map((l) => l.slice(0, -1));
    expect([...ARBORESCENCE_DOSSIER]).toEqual(dossiersModele);
    expect(new Set(ARBORESCENCE_DOSSIER).size).toBe(ARBORESCENCE_DOSSIER.length);
  });
  it("le courrier modèle est posé dans chaque « 2- Draft » des réponses, et seulement là", () => {
    const fichiersModele = LISTING_MODELE.filter((l) => !l.endsWith("/"));
    expect(FICHIERS_MODELES.map((f) => `${f.dossier}/${f.nom}`)).toEqual(fichiersModele);
    for (const f of FICHIERS_MODELES) expect(ARBORESCENCE_DOSSIER).toContain(f.dossier);
  });
  it("chaque dossier a son parent avant lui", () => {
    ARBORESCENCE_DOSSIER.forEach((p, i) => {
      const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : null;
      if (parent) expect(ARBORESCENCE_DOSSIER.indexOf(parent)).toBeLessThan(i);
    });
  });
  it("le courrier modèle est un .docx valide, versionné dans le dépôt", () => {
    const p = `src/lib/regulatory/drive-modele/${MODELE_COURRIER_RESERVES}`;
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p).subarray(0, 2).toString("latin1")).toBe("PK"); // une archive OOXML, pas un fichier vide
  });
});

describe("le nom du dossier produit : molécule + dosage", () => {
  it("simple, lisible, unité ajoutée une seule fois", () => {
    expect(nomDossierDrive("ETANERCEPT", "50", "mg")).toBe("Etanercept 50 mg");
    expect(nomDossierDrive("ETANERCEPT", "50 mg", "mg")).toBe("Etanercept 50 mg");
    expect(nomDossierDrive("AMLODIPINE + VALSARTAN", "5/80", "mg")).toBe("Amlodipine + Valsartan 5-80 mg");
    expect(nomDossierDrive("ACIDE ACÉTYLSALICYLIQUE", "100", null)).toBe("Acide acétylsalicylique 100");
    expect(nomDossierDrive("VITAMINE B12", null, null)).toBe("Vitamine B12");
    expect(nomDossierDrive("", null, null)).toBe("Produit sans nom");
  });
});

describe("où se range un dépôt", () => {
  it("la CTD initiale va dans le dépôt initial ANPP, module retrouvé, sous-dossiers gardés", () => {
    expect(chemin({ stepKey: "ctd", category: "CTD_FULL", folder: "CTD Etanercept/Module 3/3.2.P", name: "a.pdf" })).toBe(`${ANPP}/Module 3/3.2.P`);
    expect(chemin({ stepKey: "ctd", category: "CTD_FULL", folder: "m1/eu", name: "a.pdf" })).toBe(`${ANPP}/Module 1/eu`);
    expect(chemin({ stepKey: "ctd", category: "CTD_FULL", folder: null, name: "ctd.zip" })).toBe(ANPP);
    expect(chemin({ stepKey: "ctd", category: "MODULE_2", folder: null, name: "qos.pdf" })).toBe(`${ANPP}/Module 2`);
    expect(chemin({ stepKey: "ctd", category: "OTHER", folder: null, name: "mail.pdf" })).toBe("2- Enregistrement/Depot 0 -dossier recu (dirty file)");
  });
  it("les réserves de la frise : cycle → Dépôt 2, 3… ; nature → scientifique, technico, prix", () => {
    const frise = (kind: string, label: string, cycle: number) => ({ kind, label, cycle });
    expect(chemin({ stepKey: "s1", category: "OTHER", frise: frise("ANPP_RESERVES", "Réserves ANPP 1", 1) }))
      .toBe(`${DEPOT2_SCI}/1- Traitement des reserves/1- Reserves recues ANPP`);
    expect(chemin({ stepKey: "s2", category: "OTHER", frise: frise("ANPP_RESERVES", "Réserves technico-réglementaires", 1) }))
      .toBe(`${DEPOT2_TEC}/1- Traitement des reserves/1-Reserves recues ANPP`);
    expect(chemin({ stepKey: "s3", category: "OTHER", frise: frise("ANPP_RESERVES", "Réserves ANPP 2", 2) }))
      .toBe(`${DEPOT3_SCI}/1- Traitement des reserves/1- Reserves recues ANPP`);
    expect(chemin({ stepKey: "s4", category: "MODULE_3", folder: "Module 3/3.2.S", frise: frise("ANPP_RESPONSE", "Réponse", 1) }))
      .toBe(`${DEPOT2_SCI}/3- Depot ANPP/Module 3/3.2.S`);
    expect(chemin({ stepKey: "s5", category: "OTHER", frise: frise("ANPP_RESPONSE", "Réponse technico-réglementaire", 1) }))
      .toBe(`${DEPOT2_TEC}/3- Depot ANPP/Module 1`);
    expect(chemin({ stepKey: "s6", category: "OTHER", frise: frise("ANPP_RESERVES", "Demande de baisse de prix", 1) }))
      .toBe("2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses prix/Demande de baisse de prix");
    expect(chemin({ stepKey: "s7", category: "OTHER", frise: frise("ANPP_RESPONSE", "Réponse prix", 1) }))
      .toBe("2- Enregistrement/Depot 2 (reponses aux reserves 1)/Reponses prix/Reponse");
    expect(chemin({ stepKey: "s8", category: "OTHER", frise: frise("DECISION", "DE", 2) })).toBe("3-DE et attestation de prix");
    expect(chemin({ stepKey: "s9", category: "CTD_FULL", folder: "Module 5", frise: frise("CTD_VERSION", "CTD v2", 1) }))
      .toBe(`${DEPOT2_SCI}/3- Depot ANPP/Module 5`);
  });
  it("les étapes du processus officiel", () => {
    expect(chemin({ stepKey: "presub_req", category: "OTHER" })).toBe("1- Pre-soumission/Soumission");
    expect(chemin({ stepKey: "presub_checklist", category: "SUPPORTING_DOC" })).toBe("1- Pre-soumission/Draft");
    expect(chemin({ stepKey: "modules345", category: "OTHER" })).toBe("2- Enregistrement/Depot 0 -dossier recu (dirty file)/Audit CTD-deficiencies");
    expect(chemin({ stepKey: "module1", category: "GMP_CERTIFICATE" })).toBe("2- Enregistrement/Depot 1 initial/Draft/Documents administratifs/Fabricant API-PF");
    expect(chemin({ stepKey: "module1", category: "OTHER" })).toBe("2- Enregistrement/Depot 1 initial/Draft/Documents administratifs");
    expect(chemin({ stepKey: "depot", category: "SUBMISSION_LETTER" })).toBe(`${ANPP}/Module 1`);
    expect(chemin({ stepKey: "evaluation", category: "OTHER", name: "reserves.pdf" })).toBe(`${DEPOT2_SCI}/1- Traitement des reserves/1- Reserves recues ANPP`);
    expect(chemin({ stepKey: "reponses_depot", category: "OTHER", cycles: 2 })).toBe(`${DEPOT3_SCI}/3- Depot ANPP`);
    expect(chemin({ stepKey: "decision", category: "OTHER" })).toBe("3-DE et attestation de prix");
  });
  it("sans étape : la catégorie, sinon la racine du dossier produit", () => {
    expect(chemin({ stepKey: null, category: "QUERY_RECEIVED", cycles: 0 })).toBe(`${DEPOT2_SCI}/1- Traitement des reserves/1- Reserves recues ANPP`);
    expect(chemin({ stepKey: null, category: "QUERY_RESPONSE", cycles: 2 })).toBe(`${DEPOT3_SCI}/3- Depot ANPP`);
    expect(chemin({ stepKey: null, category: "REGISTRATION_DECISION" })).toBe("3-DE et attestation de prix");
    expect(chemin({ stepKey: null, category: "CPP" })).toBe("2- Enregistrement/Depot 1 initial/Draft/Documents administratifs/Detenteur");
    expect(chemin({ stepKey: null, category: "MODULE_4" })).toBe(`${ANPP}/Module 4`);
    expect(chemin({ stepKey: null, category: "OTHER" })).toBe("");
    expect(chemin({ stepKey: "inconnue", category: "OTHER", folder: "Divers/2026" })).toBe("Divers/2026");
  });
  it("un chemin d'origine ne s'échappe jamais du dossier produit", () => {
    expect(chemin({ stepKey: null, category: "OTHER", folder: "../../x/./y" })).toBe("x/y");
  });
});

describe("briques", () => {
  it("le module d'une pièce : dossier d'origine d'abord, sinon catégorie", () => {
    expect(moduleDuDepot("OTHER", "CTD/Module 3/3.2.P")).toEqual({ module: 3, suite: ["3.2.P"] });
    expect(moduleDuDepot("MODULE_5", "Etudes")).toEqual({ module: 5, suite: ["Etudes"] });
    expect(moduleDuDepot("OTHER", "Modules annexes")).toEqual({ module: null, suite: ["Modules annexes"] });
  });
  it("la nature des réserves", () => {
    expect(natureDesReserves("Réserves ANPP 1")).toBe("SCIENTIFIQUE");
    expect(natureDesReserves("Réserves technico-réglementaires")).toBe("TECHNICO");
    expect(natureDesReserves("Demande de baisse de prix")).toBe("PRIX");
  });
  it("le nom du dépôt de chaque cycle — les deux premiers au nom exact du modèle", () => {
    expect(nomDepotReponses(1)).toBe("Depot 2 (reponses aux reserves 1)");
    expect(nomDepotReponses(2)).toBe("Depot 3 (Reponses aux reserves 2");
    expect(nomDepotReponses(3)).toBe("Depot 4 (reponses aux reserves 3)");
  });
  it("les cycles de la frise suivent l'ordre, pas la création", () => {
    const { parEtape, total } = cyclesDeLaFrise([
      { id: "r2", kind: "ANPP_RESERVES", order: 3 },
      { id: "r1", kind: "ANPP_RESERVES", order: 0 },
      { id: "p1", kind: "ANPP_RESPONSE", order: 1 },
      { id: "p2", kind: "ANPP_RESPONSE", order: 4 },
    ]);
    expect(total).toBe(2);
    expect(parEtape.get("r1")).toBe(1);
    expect(parEtape.get("p1")).toBe(1);
    expect(parEtape.get("r2")).toBe(2);
    expect(parEtape.get("p2")).toBe(2);
  });
});
