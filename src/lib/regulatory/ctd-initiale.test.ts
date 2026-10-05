import { describe, expect, it } from "vitest";
import { REG_STEPS } from "@/lib/regulatory-workflow";
import {
  CTD_INITIALE_CATEGORIE, CTD_INITIALE_ETAPE, CTD_INITIALE_LIBELLE,
  arborescenceCtd, cheminRenomme, cheminSur, dossierApresRenommage, dossierDeDestination, dossiersDeLaCtd,
  estCtdInitiale, refusDepotCtd, refusRenommageDossier, resumeCtd,
} from "./ctd-initiale";

/**
 * LA CTD INITIALE — les règles pures (§118.213). Ce que la CTD EST (un fait, pas un nom), ce qui est
 * refusé et pourquoi, l'arborescence, la destination, le renommage d'un dossier.
 */

const CTD = { entityType: "REGULATORY_PRODUCT", stepKey: CTD_INITIALE_ETAPE, category: CTD_INITIALE_CATEGORIE };

describe("ce qui fait qu'un document EST la CTD initiale", () => {
  it("l'étape est la PREMIÈRE du processus officiel, lue dans REG_STEPS — jamais recopiée", () => {
    expect(CTD_INITIALE_ETAPE).toBe(REG_STEPS[0].key);
    expect(REG_STEPS[0].n).toBe(1);
  });

  it("les trois conditions sont nécessaires — chacune retirée seule fait tomber", () => {
    expect(estCtdInitiale(CTD)).toBe(true);
    expect(estCtdInitiale({ ...CTD, entityType: "SPONSORING" })).toBe(false); // une autre fiche
    expect(estCtdInitiale({ ...CTD, stepKey: "presub_checklist" })).toBe(false); // une autre étape
    expect(estCtdInitiale({ ...CTD, stepKey: null })).toBe(false); // une pièce non rattachée
    expect(estCtdInitiale({ ...CTD, category: "MODULE_3" })).toBe(false); // une autre catégorie
    expect(estCtdInitiale({ ...CTD, category: "OTHER" })).toBe(false);
  });

  it("le libellé d'affichage n'entre PAS dans la reconnaissance", () => {
    expect(CTD_INITIALE_LIBELLE).toBe("CTD initiale");
    // Un document qui s'appelle « CTD initiale » mais n'est ni à l'étape 1 ni « CTD complet » n'en est pas une.
    expect(estCtdInitiale({ ...CTD, stepKey: null })).toBe(false);
  });
});

describe("un dépôt qui vise la CTD le dit — et la marque ne sert pas à faire passer une pièce ailleurs", () => {
  it("cible CTD SANS marque : refus qui nomme les deux gestes", () => {
    const r = refusDepotCtd(CTD, false);
    expect(r).toMatch(/Ajouter à la CTD/);
    expect(r).toMatch(/Remplacer la CTD/);
  });
  it("cible CTD AVEC marque : accepté", () => {
    expect(refusDepotCtd(CTD, true)).toBeNull();
  });
  it("une autre cible sans marque : rien à dire (le téléverseur ordinaire n'est pas touché)", () => {
    expect(refusDepotCtd({ ...CTD, category: "MODULE_1" }, false)).toBeNull();
    expect(refusDepotCtd({ ...CTD, stepKey: null }, false)).toBeNull();
    expect(refusDepotCtd({ entityType: "SPONSORING", stepKey: null, category: "OTHER" }, false)).toBeNull();
  });
  it("la marque sur une autre cible : refusée, elle nomme la cible attendue", () => {
    for (const c of [{ ...CTD, category: "OTHER" }, { ...CTD, stepKey: "sample" }, { ...CTD, entityType: "SPONSORING" }, { ...CTD, stepKey: null }]) {
      expect(refusDepotCtd(c, true), JSON.stringify(c)).toMatch(/étape 1/);
    }
  });
});

describe("chemins : UNE règle pour le navigateur et le serveur", () => {
  it("jamais de « .. », jamais de chemin absolu, séparateur « / », borné, null quand il ne reste rien", () => {
    expect(cheminSur("/CTD\\Module 3/./x/")).toBe("CTD/Module 3/x");
    expect(cheminSur("../../etc")).toBe("etc");
    expect(cheminSur("..")).toBeNull();
    expect(cheminSur("   ")).toBeNull();
    expect(cheminSur(null)).toBeNull();
    expect(cheminSur("a".repeat(600))!.length).toBe(500);
  });

  it("la destination joint le dossier choisi au dossier d'origine du fichier déposé", () => {
    expect(dossierDeDestination("Compléments", "CTD/Module 1")).toBe("Compléments/CTD/Module 1");
    expect(dossierDeDestination("Compléments", null)).toBe("Compléments");
    expect(dossierDeDestination(null, "CTD/Module 1")).toBe("CTD/Module 1");
    expect(dossierDeDestination(null, null)).toBeNull();
    expect(dossierDeDestination("", "")).toBeNull();
    // Une destination forgée ne sort pas de la CTD : « .. » est retiré.
    expect(dossierDeDestination("../autre", "x")).toBe("autre/x");
  });
});

const doc = (name: string, folder: string | null, sizeBytes: number | null = 100) => ({ name, folder, sizeBytes });

describe("l'arborescence de la CTD", () => {
  const docs = [
    doc("index.xml", "CTD/Module 1", 10), doc("lettre.pdf", "CTD/Module 1", 20), doc("index.xml", "CTD/Module 2", 5),
    doc("m3.pdf", "CTD/Module 3/3.2.P", 40), doc("lisezmoi.txt", null, 1), doc("archive.zip", null, 1000),
  ];

  it("le compte et le poids remontent à TOUS les ancêtres", () => {
    const a = arborescenceCtd(docs);
    expect(a.nbFichiers).toBe(6);
    expect(a.octets).toBe(10 + 20 + 5 + 40 + 1 + 1000);
    expect(a.fichiers.map((f) => f.name)).toEqual(["archive.zip", "lisezmoi.txt"]);
    const ctd = a.dossiers.find((d) => d.nom === "CTD")!;
    expect(ctd.nbFichiers).toBe(4);
    expect(ctd.fichiers).toHaveLength(0); // aucun fichier directement dans « CTD »
    expect(ctd.dossiers.map((d) => d.nom)).toEqual(["Module 1", "Module 2", "Module 3"]);
    const m3 = ctd.dossiers.find((d) => d.nom === "Module 3")!;
    expect(m3.nbFichiers).toBe(1);
    expect(m3.dossiers[0].chemin).toBe("CTD/Module 3/3.2.P");
  });

  it("un poids absent compte zéro — jamais NaN", () => {
    expect(arborescenceCtd([doc("a", "x", null), doc("b", "x", 7)]).octets).toBe(7);
  });

  it("les dossiers à choisir comme destination incluent les préfixes", () => {
    expect(dossiersDeLaCtd(docs)).toEqual(["CTD", "CTD/Module 1", "CTD/Module 2", "CTD/Module 3", "CTD/Module 3/3.2.P"]);
  });

  it("le résumé dit fichiers, dossiers, octets, archives .zip", () => {
    expect(resumeCtd(docs)).toEqual({ fichiers: 6, dossiers: 5, octets: 1076, archives: 1 });
    expect(resumeCtd([])).toEqual({ fichiers: 0, dossiers: 0, octets: 0, archives: 0 });
  });
});

describe("renommer un dossier de la CTD", () => {
  const existants = ["CTD", "CTD/Module 1", "CTD/Module 10", "CTD/Module 2"];

  it("renomme le DERNIER segment, le parent reste", () => {
    expect(cheminRenomme("CTD/Module 1", "Module 1 corrigé")).toBe("CTD/Module 1 corrigé");
    expect(cheminRenomme("CTD", "Dossier")).toBe("Dossier");
  });

  it("les descendants suivent — et « Module 10 » n'est PAS un descendant de « Module 1 »", () => {
    expect(dossierApresRenommage("CTD/Module 1", "CTD/Module 1", "CTD/X")).toBe("CTD/X");
    expect(dossierApresRenommage("CTD/Module 1/sous", "CTD/Module 1", "CTD/X")).toBe("CTD/X/sous");
    expect(dossierApresRenommage("CTD/Module 10", "CTD/Module 1", "CTD/X")).toBe("CTD/Module 10");
    expect(dossierApresRenommage("CTD/Module 10/a", "CTD/Module 1", "CTD/X")).toBe("CTD/Module 10/a");
    expect(dossierApresRenommage(null, "CTD/Module 1", "CTD/X")).toBeNull();
  });

  it("refus qui nomme la cause", () => {
    expect(refusRenommageDossier("CTD/Module 1", "  ", existants)).toMatch(/vide/);
    expect(refusRenommageDossier("CTD/Module 1", "a/b", existants)).toMatch(/« \/ »/);
    expect(refusRenommageDossier("CTD/Module 1", "Module 2", existants)).toMatch(/existe déjà/);
    expect(refusRenommageDossier("", "x", existants)).toMatch(/introuvable/);
  });

  it("un nom identique n'est pas un conflit avec soi-même", () => {
    expect(refusRenommageDossier("CTD/Module 1", "Module 1", existants)).toBeNull();
    expect(refusRenommageDossier("CTD/Module 1", "Nouveau", existants)).toBeNull();
  });
});
