import { describe, it, expect } from "vitest";
import { cleDEtablissement, indexerEtablissements, serviceParNom, libelleEtablissement } from "./rattachement";
import { cleDeService, lireNomsDeServices, lireCouverture, branchesDesPraticiensCouverts, lienCouvre, libelleCouverture } from "./services";
import { champsAEcrire, parseDirectorySheet } from "@/lib/medical/directory-sheet";
import { fdCase } from "@/lib/actions/types";

/**
 * LES RÈGLES PURES DU LOT §118.172 — ce qu'un nom désigne, ce qu'un import écrit, ce qu'une case
 * cochée veut dire. Chacune a son cas qui la ferait tomber, écrit à côté d'elle (§118.17).
 */

describe("un nom ne rattache qu'à coup sûr", () => {
  const etabs = [
    { id: "chu", name: "CHU Mustapha", isActive: true, wilaya: "Alger" },
    { id: "b1", name: "EPH Bordj", isActive: true, wilaya: "Bordj Bou Arreridj" },
    { id: "b2", name: "EPH Bordj", isActive: true, wilaya: "Bordj Menaïel" },
    { id: "f", name: "Clinique Fermée", isActive: false, wilaya: null },
    { id: "h1", name: "Hôpital Vieux", isActive: false },
    { id: "h2", name: "Hôpital Vieux", isActive: false },
  ];
  const resoudre = indexerEtablissements(etabs);

  it("casse, accents et espaces mis à part — et RIEN d'autre", () => {
    expect(resoudre("chu  mustapha")).toEqual({ statut: "trouve", etablissement: etabs[0] });
    expect(resoudre(" CHU MUSTAPHA ")).toMatchObject({ statut: "trouve" });
    // La ponctuation reste un caractère : « C.H.U » n'est pas « CHU » pour ce module.
    expect(resoudre("C.H.U Mustapha")).toEqual({ statut: "inconnu" });
    // Pas de ressemblance : un mot de plus ou de moins ne désigne rien.
    expect(resoudre("CHU Mustapha Pacha")).toEqual({ statut: "inconnu" });
    expect(resoudre("Mustapha")).toEqual({ statut: "inconnu" });
  });

  it("deux homonymes actifs ne désignent personne — les candidats sont rendus", () => {
    const r = resoudre("eph bordj");
    expect(r.statut).toBe("ambigu");
    expect(r.statut === "ambigu" && r.candidats.map((c) => c.id)).toEqual(["b1", "b2"]);
    expect(r.statut === "ambigu" && r.candidats.map(libelleEtablissement)).toEqual(["EPH Bordj (Bordj Bou Arreridj)", "EPH Bordj (Bordj Menaïel)"]);
  });

  it("un seul désactivé se NOMME ; plusieurs désactivés ne désignent pas plus que plusieurs actifs", () => {
    expect(resoudre("clinique fermee")).toEqual({ statut: "inactif", etablissement: etabs[3] });
    expect(resoudre("Hôpital Vieux")).toEqual({ statut: "inconnu" });
  });

  it("un actif l'emporte sur un désactivé du même nom", () => {
    const r = indexerEtablissements([
      { id: "old", name: "EHS Ben Aknoun", isActive: false },
      { id: "new", name: "EHS Ben Aknoun", isActive: true },
    ])("ehs ben aknoun");
    expect(r).toMatchObject({ statut: "trouve", etablissement: { id: "new" } });
  });

  it("un nom vide n'est rien", () => {
    expect(resoudre("")).toEqual({ statut: "inconnu" });
    expect(resoudre(null)).toEqual({ statut: "inconnu" });
    expect(resoudre("   ")).toEqual({ statut: "inconnu" });
    expect(cleDEtablissement("  Hôpital   Été ")).toBe("hopital ete");
  });

  it("un service se retrouve par son nom dans SON établissement — jamais créé", () => {
    const services = [{ id: "s1", name: "Cardiologie" }, { id: "s2", name: "Pédiatrie" }];
    expect(serviceParNom(services, "PEDIATRIE", cleDeService)?.id).toBe("s2");
    expect(serviceParNom(services, "Cardio", cleDeService)).toBeNull();
    expect(serviceParNom(services, "", cleDeService)).toBeNull();
    expect(serviceParNom([], "Cardiologie", cleDeService)).toBeNull();
  });
});

describe("les noms de services saisis d'un trait", () => {
  it("virgules, points-virgules, retours à la ligne ; le tiret n'est PAS un séparateur", () => {
    const r = lireNomsDeServices("Cardiologie, Oncologie;Pneumologie\nGynécologie-obstétrique\n\n");
    expect(r.noms).toEqual(["Cardiologie", "Oncologie", "Pneumologie", "Gynécologie-obstétrique"]);
  });

  it("une répétition (casse, accents) est dite, pas recréée ; un nom trop long est dit, pas coupé", () => {
    const long = "x".repeat(81);
    const r = lireNomsDeServices(`Pédiatrie, pediatrie, ${long}`);
    expect(r.noms).toEqual(["Pédiatrie"]);
    expect(r.repetes).toEqual(["pediatrie"]);
    expect(r.tropLongs).toEqual([long]);
  });
});

describe("ce qu'un secteur couvre", () => {
  it("un champ absent garde la couverture ; une liste vide reste une liste vide", () => {
    expect(lireCouverture(undefined)).toEqual({ ok: true, parEtablissement: null });
    expect(lireCouverture("")).toEqual({ ok: true, parEtablissement: null });
    const r = lireCouverture(JSON.stringify({ e1: ["s1", "s1", ""], e2: [] }));
    expect(r.ok && [...r.parEtablissement!.entries()]).toEqual([["e1", ["s1"]], ["e2", []]]);
    expect(lireCouverture("{pas du json").ok).toBe(false);
    expect(lireCouverture(JSON.stringify(["e1"])).ok).toBe(false);
    expect(lireCouverture(JSON.stringify({ e1: "s1" })).ok).toBe(false);
  });

  it("tous les services couvrent tout l'établissement ; un lien restreint, ses services seulement", () => {
    const liens = [
      { institutionId: "e1", tousLesServices: true, serviceIds: [] },
      { institutionId: "e2", tousLesServices: false, serviceIds: ["s1", "s2"] },
      { institutionId: "e3", tousLesServices: false, serviceIds: [] },
    ];
    expect(branchesDesPraticiensCouverts(liens)).toEqual([{ institutionId: { in: ["e1"] } }, { serviceId: { in: ["s1", "s2"] } }]);
    expect(lienCouvre(liens[1], { institutionId: "e2", serviceId: "s1" })).toBe(true);
    // Un praticien SANS service, dans un établissement restreint, n'est pas couvert : on ne devine pas.
    expect(lienCouvre(liens[1], { institutionId: "e2", serviceId: null })).toBe(false);
    expect(lienCouvre(liens[0], { institutionId: "e1", serviceId: null })).toBe(true);
    // Un lien restreint qui n'a plus AUCUN service ne s'élargit jamais en « tous ».
    expect(lienCouvre(liens[2], { institutionId: "e3", serviceId: "x" })).toBe(false);
    expect(libelleCouverture("EPH", liens[2], () => null)).toContain("aucun service");
    expect(libelleCouverture("CHU", liens[0], () => null)).toBe("CHU (tous les services)");
    expect(branchesDesPraticiensCouverts([])).toEqual([]);
  });
});

describe("ce qu'un import ÉCRIT sur une fiche existante", () => {
  const fichier = (lignes: string[][]) => parseDirectorySheet(lignes);
  const existant = { lastName: "BENALI", firstName: "Karim", specialty: "Cardiologie", wilaya: "Oran" };

  it("une fiche NOUVELLE reçoit tout ce que la ligne porte", () => {
    const p = fichier([["Nom complet", "Téléphone"], ["BENALI Karim", "0550"]]);
    const c = champsAEcrire(p.rows[0], p.presents, null);
    expect(c.title).toBe("AUTRE");
    expect(c.phone).toBe("0550");
    expect(c.lastName).toBe("BENALI");
  });

  it("une fiche EXISTANTE ne reçoit QUE les colonnes du fichier", () => {
    const p = fichier([["Nom complet", "Téléphone"], ["BENALI Karim", "0550"]]);
    const c = champsAEcrire(p.rows[0], p.presents, existant);
    // Le défaut d'avant : grade « Autre », secteur « Libéral », potentiel « Moyen », e-mail vidé.
    expect(c).toEqual({ phone: "0550" });
  });

  it("une déduction COMPLÈTE un champ vide, elle ne remplace jamais une correction faite à la main", () => {
    const p = fichier([["Nom complet", "Code postal"], ["BEN AHMED Sofiane", "31000"]]);
    // Nom et prénom tirés du nom complet, wilaya tirée du code postal : rien de vide à compléter.
    expect(champsAEcrire(p.rows[0], p.presents, existant)).toEqual({ postalCode: "31000" });
    expect(champsAEcrire(p.rows[0], p.presents, { lastName: null, firstName: null, specialty: null, wilaya: null }))
      .toEqual({ postalCode: "31000", lastName: "BEN AHMED", firstName: "Sofiane", wilaya: "Oran" });
  });

  it("la wilaya de sa colonne remplace ; une cellule illisible n'efface pas une wilaya connue", () => {
    const p = fichier([["Nom", "Wilaya"], ["BENALI", "Alger"], ["BENALI", "Algr"]]);
    expect(champsAEcrire(p.rows[0], p.presents, existant).wilaya).toBe("Alger");
    expect("wilaya" in champsAEcrire(p.rows[1], p.presents, existant)).toBe(false);
  });

  it("le service ne remplit la spécialité que si elle est vide", () => {
    const p = fichier([["Nom", "Service"], ["BENALI", "Néphrologie"]]);
    expect("specialty" in champsAEcrire(p.rows[0], p.presents, existant)).toBe(false);
    expect(champsAEcrire(p.rows[0], p.presents, { ...existant, specialty: null }).specialty).toBe("Néphrologie");
  });

  it("une colonne PRÉSENTE et vide efface — c'est ce que le fichier dit", () => {
    const p = fichier([["Nom", "Mail"], ["BENALI", ""]]);
    expect(champsAEcrire(p.rows[0], p.presents, existant)).toEqual({ email: null, lastName: "BENALI" });
  });
});

describe("une case à cocher précédée de son témoin caché", () => {
  const f = (...vals: string[]) => { const x = new FormData(); for (const v of vals) x.append("isActive", v); return x; };

  it("cochée l'emporte sur le témoin, quel que soit l'ordre", () => {
    // Le défaut : `formData.get` rend la PREMIÈRE valeur — le témoin « off » — et la case cochée
    // ne réactivait jamais rien.
    expect(fdCase(f("off", "on"), "isActive")).toBe(true);
    expect(fdCase(f("on", "off"), "isActive")).toBe(true);
    expect(fdCase(f("0", "1"), "isActive")).toBe(true);
    expect(fdCase(f("false", "true"), "isActive")).toBe(true);
  });

  it("le témoin seul dit « décochée » ; rien du tout ne dit RIEN", () => {
    expect(fdCase(f("off"), "isActive")).toBe(false);
    expect(fdCase(f("0"), "isActive")).toBe(false);
    expect(fdCase(new FormData(), "isActive")).toBeUndefined();
    expect(fdCase(f("peut-être"), "isActive")).toBeUndefined();
  });
});
