import { describe, it, expect } from "vitest";
import { ANNUAIRE_COLUMNS } from "./directory-grid";
import { DIRECTORY_COLUMNS, parseDirectorySheet, splitFullName, titleFrom } from "./directory-sheet";
import { DOCTOR_TITLE } from "@/lib/labels";

/**
 * GARDE-FOU DE L'IMPORT : la GRILLE et l'IMPORT décrivent le même annuaire.
 *
 * Deux listes de colonnes cohabitent — celle de l'écran (`directory-grid`) et celle de la
 * reconnaissance de fichiers (`directory-sheet`). Elles avaient divergé en silence : l'écran
 * affichait Nom, Prénom, Adresse, Wilaya, Code postal, et l'import ne savait lire AUCUN de ces
 * cinq champs. Le fichier les contenait, l'import annonçait « 312 lignes importées », et
 * l'annuaire s'affichait à moitié vide.
 *
 * Rien dans le typecheck ne pouvait le voir : ce sont deux ensembles de chaînes indépendants.
 * Ce test les confronte.
 */
describe("Annuaire — tout ce que l'écran affiche doit pouvoir s'importer", () => {
  const importable = new Set(DIRECTORY_COLUMNS.map((c) => c.key as string));

  it("aucune colonne de la grille n'est absente de l'import", () => {
    const missing = ANNUAIRE_COLUMNS.map((c) => c.field as string).filter((f) => !importable.has(f));
    expect(
      missing,
      `Ces colonnes s'affichent à l'écran mais l'import ne sait pas les lire : elles resteront\n` +
        `vides après un import, même si le fichier les contient.\n\n  ${missing.join(", ")}\n`,
    ).toEqual([]);
  });

  it("un fichier aux en-têtes de NOTRE export se relit intégralement", () => {
    // Le cas le plus fréquent, et celui qui était cassé : on exporte l'annuaire, on le corrige
    // dans un tableur, on le réimporte.
    const headers = ANNUAIRE_COLUMNS.map((c) => c.header);
    // Plus de « Ville » dans la feuille (décision de la Direction, 09/2026) : la wilaya est le
    // seul découpage, et c'est elle que l'export porte et que l'import relit.
    const row = [
      "BENALI", "Karim", "12 rue Didouche Mourad", "Alger",
      "HIGH", "16000", "0550 12 34 56", "Cardiologie", "CHU Mustapha", "Cardiologie A", "Chef de service",
      "k.benali@chu.dz", "HOSPITAL",
    ];
    // L'en-tête et la ligne doivent avoir la même largeur : sinon la ligne de ce banc glisse d'une
    // colonne dès qu'on en ajoute une à l'export, et l'assertion du grade lit l'établissement.
    expect(row).toHaveLength(headers.length);
    const parsed = parseDirectorySheet([headers, row]);

    expect(parsed.rows).toHaveLength(1);
    const r = parsed.rows[0];
    expect(r.lastName).toBe("BENALI");
    expect(r.firstName).toBe("Karim");
    expect(r.address).toBe("12 rue Didouche Mourad");
    expect(r.city).toBeNull();
    expect(r.wilaya).toBe("Alger");
    expect(r.postalCode).toBe("16000");
    expect(r.phone).toBe("0550 12 34 56");
    expect(r.specialty).toBe("Cardiologie");
    // L'établissement et le service (§118.172) : relus pour être RATTACHÉS par l'import.
    expect(r.institution).toBe("CHU Mustapha");
    expect(r.service).toBe("Cardiologie A");
    expect(r.title).toBe("CHEF_DE_SERVICE");
    expect(r.email).toBe("k.benali@chu.dz");
  });

  it("« Service » a sa propre colonne ; un fichier qui n'a qu'elle remplit AUSSI la spécialité", () => {
    const seul = parseDirectorySheet([["Nom", "Service"], ["BENALI", "Néphrologie"]]);
    expect(seul.rows[0].service).toBe("Néphrologie");
    expect(seul.rows[0].specialty).toBe("Néphrologie");
    // Un fichier qui A une colonne de spécialité a parlé, même vide : on ne la remplit pas à sa place.
    const deux = parseDirectorySheet([["Nom", "Spécialité", "Service"], ["BENALI", "", "Néphrologie"]]);
    expect(deux.rows[0].service).toBe("Néphrologie");
    expect(deux.rows[0].specialty).toBeNull();
    // Et une correspondance tranchée à l'écran dit ce que le fichier porte — la feuille canonique
    // reconstruite a toutes les colonnes, elle ne le dit plus.
    const canonique = parseDirectorySheet(
      [DIRECTORY_COLUMNS.map((c) => c.header), DIRECTORY_COLUMNS.map((c) => (c.key === "lastName" ? "BENALI" : c.key === "service" ? "Néphrologie" : ""))],
      new Set(["lastName", "service"] as const),
    );
    expect(canonique.rows[0].specialty).toBe("Néphrologie");
    expect([...canonique.presents].sort()).toEqual(["lastName", "service"]);
  });

  it("aucune colonne de notre export n'est rendue « non reconnue »", () => {
    const headers = ANNUAIRE_COLUMNS.map((c) => c.header);
    const parsed = parseDirectorySheet([headers, headers.map(() => "x")]);
    expect(parsed.unknown.map((u) => u.header)).toEqual([]);
  });

  it("la wilaya se déduit quand le fichier ne la nomme pas", () => {
    const parsed = parseDirectorySheet([
      ["Nom", "Prénom", "Adresse", "Code postal"],
      ["MEZIANE", "Sofiane", "Cité 500 logements", "31000"],
    ]);
    expect(parsed.rows[0].wilaya).toBe("Oran");
  });

  it("un fichier étranger avec une seule colonne de nom remplit quand même nom ET prénom", () => {
    const parsed = parseDirectorySheet([
      ["Nom et prénom", "Tél", "Ville"],
      ["HADDAD Amine", "0661 00 11 22", "Constantine"],
    ]);
    const r = parsed.rows[0];
    expect(r.name).toBe("HADDAD Amine");
    expect(r.lastName).toBe("HADDAD");
    expect(r.firstName).toBe("Amine");
    expect(r.phone).toBe("0661 00 11 22");
    expect(r.wilaya).toBe("Constantine");
  });
});

describe("splitFullName — le nom de famille est celui en MAJUSCULES", () => {
  it("sépare sur la casse quand elle est parlante", () => {
    expect(splitFullName("BENALI Karim")).toEqual({ lastName: "BENALI", firstName: "Karim" });
    expect(splitFullName("Karim BENALI")).toEqual({ lastName: "BENALI", firstName: "Karim" });
    expect(splitFullName("BEN AHMED Sofiane")).toEqual({ lastName: "BEN AHMED", firstName: "Sofiane" });
  });

  // Une heuristique, corrigeable dans la grille : mieux vaut un prénom parfois à replacer
  // qu'une colonne entièrement vide.
  it("retombe sur « le premier mot est le nom » quand rien n'est en majuscules", () => {
    expect(splitFullName("Benali Karim")).toEqual({ lastName: "Benali", firstName: "Karim" });
  });

  it("un nom seul reste un nom", () => {
    expect(splitFullName("Benali")).toEqual({ lastName: "Benali", firstName: "" });
    expect(splitFullName("  ")).toEqual({ lastName: "", firstName: "" });
  });
});

describe("titleFrom — « Chef de service » est un grade à part entière", () => {
  it("le reconnaît, écrit de plusieurs façons", () => {
    expect(titleFrom("Chef de service")).toBe("CHEF_DE_SERVICE");
    expect(titleFrom("CHEF SERVICE")).toBe("CHEF_DE_SERVICE");
    expect(titleFrom("Pr, chef de service")).toBe("PROFESSEUR"); // « Pr » reste prioritaire
  });

  // Un chef de service EST un spécialiste : sans la priorité, la fonction disparaîtrait au
  // profit du grade, et l'on ne saurait plus qui dirige le service.
  it("ne se fait pas absorber par « praticien spécialiste »", () => {
    expect(titleFrom("Chef de service, praticien spécialiste")).toBe("CHEF_DE_SERVICE");
  });

  it("figure bien dans les libellés de l'écran", () => {
    expect(DOCTOR_TITLE.CHEF_DE_SERVICE).toBe("Chef de service");
  });
});
