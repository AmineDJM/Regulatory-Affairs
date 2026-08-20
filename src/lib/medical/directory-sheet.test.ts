import { describe, it, expect } from "vitest";
import {
  normalizeHeader, matchColumn, mapHeaderRow, titleFrom, sectorFrom, levelFrom,
  parseDirectoryRow, parseDirectorySheet, directoryHeaderRow, DIRECTORY_COLUMNS,
} from "./directory-sheet";

describe("Reconnaître les colonnes d'un fichier qu'on n'a pas écrit", () => {
  it("efface accents, casse et ponctuation avant de comparer", () => {
    expect(normalizeHeader("N° Tél.")).toBe("n tel");
    expect(normalizeHeader("  SPÉCIALITÉ  ")).toBe("specialite");
    expect(normalizeHeader(null)).toBe("");
  });

  it("retrouve nos colonnes sous les noms qu'emploient les vrais fichiers", () => {
    expect(matchColumn("NOM ET PRENOM")).toBe("name");
    expect(matchColumn("Médecin")).toBe("name");
    // La WILAYA a désormais sa propre colonne : elle était un alias de « Ville », et un fichier
    // portant les deux perdait la wilaya — donc le comptage par territoire.
    expect(matchColumn("Wilaya")).toBe("wilaya");
    expect(matchColumn("Ville")).toBe("city");
    expect(matchColumn("Prénom")).toBe("firstName");
    expect(matchColumn("Adresse")).toBe("address");
    expect(matchColumn("Code postal")).toBe("postalCode");
    expect(matchColumn("N° Tél.")).toBe("phone");
    expect(matchColumn("Courriel")).toBe("email");
    expect(matchColumn("Hôpital")).toBe("institution");
    expect(matchColumn("Visiteur médical")).toBe("delegate");
  });

  it("rend null sur un en-tête inconnu plutôt que de deviner", () => {
    expect(matchColumn("Chiffre d'affaires 2025")).toBeNull();
    expect(matchColumn("")).toBeNull();
  });

  it("ne confond pas « nom du service » avec la colonne Nom", () => {
    // Le repli partiel exige le mot canonique ENTIER, et pas sur trois lettres.
    expect(matchColumn("Nom du service")).not.toBe("name");
  });

  it("ne prend une cible qu'une fois : la seconde colonne homonyme part en non reconnue", () => {
    // « Nom » et « Nom complet » sont maintenant DEUX colonnes distinctes (nom de famille et
    // nom complet) : les deux sont exploitées, ce qui est le but. Le doublon se teste donc sur
    // deux écritures de la MÊME cible.
    const r = mapHeaderRow(["Ville", "Commune", "Nom"]);
    expect(r.mapping).toEqual(["city", null, "lastName"]);
    expect(r.unknown).toEqual([{ index: 1, header: "Commune" }]);
  });

  it("RESTITUE les en-têtes non reconnus — une colonne perdue en silence est un piège", () => {
    const r = mapHeaderRow(["Nom", "Score interne", "Ville"]);
    expect(r.unknown).toEqual([{ index: 1, header: "Score interne" }]);
    expect(r.matched).toEqual(["lastName", "city"]);
  });
});

describe("Reconnaître les VALEURS telles qu'on les écrit vraiment", () => {
  it("le grade, quelle qu'en soit l'écriture", () => {
    expect(titleFrom("Pr")).toBe("PROFESSEUR");
    expect(titleFrom("professeur")).toBe("PROFESSEUR");
    expect(titleFrom("Maître de conférences")).toBe("MAITRE_CONFERENCES");
    expect(titleFrom("praticien spécialiste")).toBe("PRATICIEN_SPECIALISTE");
    expect(titleFrom("Résident")).toBe("RESIDENT");
    expect(titleFrom("Pharmacien d'officine")).toBe("PHARMACIEN");
    expect(titleFrom("MG")).toBe("GENERALISTE");
  });

  it("« Dr » seul ne fabrique pas un grade : c'est une civilité", () => {
    expect(titleFrom("Dr")).toBe("AUTRE");
    expect(titleFrom("")).toBe("AUTRE");
  });

  it("le secteur, depuis le mot employé sur le terrain", () => {
    expect(sectorFrom("CHU Mustapha")).toBe("HOSPITAL");
    expect(sectorFrom("cabinet privé")).toBe("LIBERAL");
    expect(sectorFrom("Hôpital + cabinet")).toBe("BOTH");
    expect(sectorFrom("mixte")).toBe("BOTH");
  });

  it("les niveaux, en toutes lettres comme en notes", () => {
    expect(levelFrom("Très haut")).toBe("VERY_HIGH");
    expect(levelFrom("élevé")).toBe("HIGH");
    expect(levelFrom("faible")).toBe("LOW");
    expect(levelFrom("très faible")).toBe("VERY_LOW");
    expect(levelFrom("")).toBe("MEDIUM");
    expect(levelFrom("n'importe quoi")).toBe("MEDIUM");
  });
});

describe("Restructurer une ligne à NOTRE format", () => {
  const headers = ["NOM ET PRENOM", "Qualité", "Spécialité", "Hôpital", "Wilaya", "N° Tél.", "Influence"];
  const { mapping } = mapHeaderRow(headers);

  it("remplit ce qui est présent et laisse le reste vide, sans inventer", () => {
    const row = parseDirectoryRow(
      ["MOUFFOK Amina", "Professeur", "Cardiologie", "CHU Mustapha", "Alger", "0550 11 22 33", "Très haut"],
      mapping,
    );
    expect(row).toEqual({
      name: "MOUFFOK Amina",
      // Le nom complet est SÉPARÉ : l'écran a deux colonnes, et les laisser vides afficherait un
      // annuaire à moitié vide alors que l'information est là.
      lastName: "MOUFFOK", firstName: "Amina",
      title: "PROFESSEUR", specialty: "Cardiologie",
      sector: "HOSPITAL", institution: "CHU Mustapha",
      address: null, city: null, wilaya: "Alger", postalCode: null, region: null,
      phone: "0550 11 22 33", email: null,
      influence: "VERY_HIGH", potential: "MEDIUM", affinity: "MEDIUM",
      targetProducts: null, delegate: null, comments: null,
    });
  });

  it("déduit le secteur de l'établissement quand la colonne manque", () => {
    expect(parseDirectoryRow(["X", "", "", "Cabinet privé", "", "", ""], mapping)?.sector).toBe("LIBERAL");
  });

  it("REFUSE une ligne sans nom — une fiche sans nom n'est pas une fiche", () => {
    expect(parseDirectoryRow(["", "Pr", "Cardio"], mapping)).toBeNull();
    expect(parseDirectoryRow(["   ", "Pr"], mapping)).toBeNull();
  });
});

describe("Lire une feuille entière, et dire ce qui a été écarté", () => {
  const sheet = [
    ["NOM ET PRENOM", "Qualité", "Wilaya", "Score maison"],
    ["MOUFFOK Amina", "Pr", "Alger", "12"],
    ["", "Dr", "Oran", "8"], // sans nom → écartée
    ["", "", "", ""], // ligne vide → ni importée ni comptée comme rejet
    ["BENALI Karim", "Résident", "Oran", "3"],
  ];

  it("importe ce qui est exploitable", () => {
    const r = parseDirectorySheet(sheet);
    expect(r.rows.map((x) => x.name)).toEqual(["MOUFFOK Amina", "BENALI Karim"]);
    expect(r.rows[1].title).toBe("RESIDENT");
    expect(r.rows[0].wilaya).toBe("Alger");
  });

  it("COMPTE ce qui a été écarté — « 312 importées » sans le reste fabrique un annuaire troué", () => {
    expect(parseDirectorySheet(sheet).skipped).toBe(1);
  });

  it("signale la colonne qu'elle n'a pas su lire", () => {
    expect(parseDirectorySheet(sheet).unknown).toEqual([{ index: 3, header: "Score maison" }]);
  });

  it("une feuille vide ne casse rien", () => {
    expect(parseDirectorySheet([])).toEqual({ rows: [], skipped: 0, matched: [], unknown: [] });
  });
});

describe("Le classeur exporté se réimporte tel quel", () => {
  it("chaque en-tête exporté est reconnu par l'import", () => {
    // C'est la garantie qui rend le tableur utilisable comme outil de correction en masse :
    // on exporte, on corrige 200 lignes dans Excel, on réimporte.
    for (const header of directoryHeaderRow()) {
      expect(matchColumn(header), header).not.toBeNull();
    }
  });

  it("l'ordre des colonnes exportées est celui de l'annuaire", () => {
    expect(directoryHeaderRow()).toHaveLength(DIRECTORY_COLUMNS.length);
    expect(directoryHeaderRow()[0]).toBe("Nom complet");
  });

  it("un aller-retour complet conserve les valeurs", () => {
    // La ligne est construite DEPUIS les colonnes, jamais écrite à la main : une liste figée se
    // décale silencieusement dès qu'une colonne est ajoutée, et le test cesse alors de tester
    // ce qu'il annonce.
    const values: Partial<Record<string, string>> = {
      name: "MOUFFOK Amina", title: "Professeur", specialty: "Cardiologie",
      sector: "Hôpital / Public", institution: "CHU Mustapha", city: "Alger", region: "Centre",
      phone: "0550112233", email: "a.mouffok@chu.dz",
      influence: "Très haut", potential: "Haut", affinity: "Moyen",
      targetProducts: "Produit A", delegate: "K. Benali", comments: "KOL national",
    };
    const exported = [
      directoryHeaderRow(),
      DIRECTORY_COLUMNS.map((c) => values[c.key] ?? ""),
    ];
    const r = parseDirectorySheet(exported);
    expect(r.skipped).toBe(0);
    expect(r.unknown).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      name: "MOUFFOK Amina", title: "PROFESSEUR", sector: "HOSPITAL",
      influence: "VERY_HIGH", potential: "HIGH", affinity: "MEDIUM",
      city: "Alger", region: "Centre", email: "a.mouffok@chu.dz",
    });
  });
});
