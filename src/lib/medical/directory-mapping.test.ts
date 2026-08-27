import { describe, expect, it } from "vitest";
import {
  proposeMapping, validateMapping, applyMapping, targetsFor,
  columnKeyFrom, uniqueColumnKey, stdFieldOf, customKeyOf,
  toCanonicalRow, canonicalHeaderRow, STD, CUS, type CustomColumn,
} from "./directory-mapping";
import { parseDirectorySheet } from "./directory-sheet";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CORRESPONDANCE DES COLONNES — ce que ces tests protègent.
 *
 * Le défaut d'origine n'était pas une erreur de reconnaissance : c'était que les colonnes NON
 * reconnues étaient annoncées puis jetées. Le fichier disait « Colonne 3 », l'import répondait
 * « colonne non reconnue : Colonne 3 » et perdait son contenu. Ces tests figent le contraire :
 * toute colonne du fichier est rattachable, et rien ne se perd sans qu'on l'ait décidé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const COLONNES: CustomColumn[] = [
  { key: "c_dernier_congres", label: "Dernier congrès", kind: "TEXT" },
  { key: "c_statut", label: "Statut", kind: "CHOICE", options: "Actif|Inactif" },
];

describe("la proposition — reconnaître, et surtout DIRE d'où vient la reconnaissance", () => {
  it("un en-tête canonique est reconnu comme exact", () => {
    const p = proposeMapping(["Nom complet", "Téléphone"], [], []);
    expect(p[0]).toMatchObject({ target: `${STD}name`, origin: "exact" });
    expect(p[1]).toMatchObject({ target: `${STD}phone`, origin: "exact" });
  });

  it("un alias est reconnu, mais annoncé comme alias", () => {
    // La nuance compte à l'écran : « c'est écrit dessus » et « on a deviné » ne se relisent pas
    // avec la même attention.
    const p = proposeMapping(["N° Tél.", "Praticien"], [], []);
    expect(p[0]).toMatchObject({ target: `${STD}phone`, origin: "alias" });
    expect(p[1]).toMatchObject({ target: `${STD}name`, origin: "alias" });
  });

  it("une colonne inconnue n'est PAS devinée — elle est proposée à ne pas importer", () => {
    // Deviner mettrait des numéros dans « Commentaires » sans que personne s'en aperçoive.
    const p = proposeMapping(["Colonne 3", "Champ libre 2"], [], []);
    expect(p[0]).toMatchObject({ target: null, origin: "aucune" });
    expect(p[1]).toMatchObject({ target: null, origin: "aucune" });
    // …mais elle reste LÀ, avec son nom : c'est ce qui la rend rattachable à l'écran.
    expect(p[0].header).toBe("Colonne 3");
  });

  it("une colonne SUR MESURE de l'annuaire est retrouvée par son libellé", () => {
    // C'est ce qui fait qu'un fichier récurrent se réimporte tout seul au deuxième passage.
    const p = proposeMapping(["Nom complet", "Dernier congrès"], [], COLONNES);
    expect(p[1]).toMatchObject({ target: `${CUS}c_dernier_congres`, origin: "exact" });
  });

  it("la colonne sur mesure l'emporte sur le tronc commun quand les deux collent", () => {
    // Quelqu'un a créé « Contact » DANS cet annuaire : c'est celle-là qu'il veut, pas l'alias
    // « Contact → Téléphone » du tronc commun.
    const p = proposeMapping(["Contact"], [], [{ key: "c_contact", label: "Contact", kind: "TEXT" }]);
    expect(p[0].target).toBe(`${CUS}c_contact`);
  });

  it("une même cible ne se prend qu'une fois — la seconde reste à décider", () => {
    const p = proposeMapping(["Téléphone", "Tel"], [], []);
    expect(p[0].target).toBe(`${STD}phone`);
    expect(p[1].target).toBeNull();
  });

  it("un échantillon de valeurs accompagne chaque colonne", () => {
    // Juger une correspondance sans voir une valeur, c'est juger le nom de la colonne seul —
    // or c'est précisément le nom qui est trompeur dans les fichiers reçus.
    const p = proposeMapping(
      ["Nom complet", "Colonne 3"],
      [["Dr Benali", "0551 22 33 44"], ["Dr Cherif", "0770 11 22 33"]],
      [],
    );
    expect(p[1].sample).toEqual(["0551 22 33 44", "0770 11 22 33"]);
  });
});

describe("la validation — refuser en NOMMANT le problème", () => {
  it("deux colonnes vers la même cible sont refusées", () => {
    const pbs = validateMapping([`${STD}name`, `${STD}phone`, `${STD}phone`]);
    expect(pbs.some((p) => p.kind === "doublon")).toBe(true);
    // Le message doit dire LESQUELLES : « il y a un doublon » n'aide personne à le corriger.
    expect(pbs.find((p) => p.kind === "doublon")?.message).toContain("2 et 3");
  });

  it("aucune colonne de nom = refus, dit AVANT d'écrire", () => {
    const pbs = validateMapping([`${STD}phone`, `${STD}city`]);
    expect(pbs.some((p) => p.kind === "sans-nom")).toBe(true);
  });

  it("le nom de famille seul suffit — on n'exige pas le nom complet", () => {
    expect(validateMapping([`${STD}lastName`, `${STD}firstName`])).toEqual([]);
  });

  it("une correspondance saine ne remonte aucun problème", () => {
    expect(validateMapping([`${STD}name`, `${STD}phone`, `${CUS}c_statut`, null])).toEqual([]);
  });
});

describe("l'application — ce qui part en standard, ce qui part en sur-mesure", () => {
  it("les colonnes du tronc commun et les colonnes propres sont séparées", () => {
    const { standard, custom } = applyMapping(
      ["Dr Benali", "0551223344", "Alger 2026"],
      [`${STD}name`, `${STD}phone`, `${CUS}c_dernier_congres`],
    );
    expect(standard).toEqual({ name: "Dr Benali", phone: "0551223344" });
    expect(custom).toEqual({ c_dernier_congres: "Alger 2026" });
  });

  it("une colonne écartée ne laisse aucune trace", () => {
    const { standard, custom } = applyMapping(["Dr Benali", "à ignorer"], [`${STD}name`, null]);
    expect(standard).toEqual({ name: "Dr Benali" });
    expect(custom).toEqual({});
  });

  it("une cellule VIDE n'écrase pas une valeur déjà saisie", () => {
    // Un réimport partiel ne doit pas vider les colonnes que le fichier ne porte pas — sinon
    // corriger deux lignes coûte la perte de tout le reste.
    const { custom } = applyMapping(["Dr Benali", "   "], [`${STD}name`, `${CUS}c_statut`]);
    expect(custom).toEqual({});
  });
});

describe("le pont vers le parseur existant", () => {
  it("une ligne remise en forme canonique traverse `parseDirectorySheet` sans rien perdre", () => {
    // LA RAISON D'ÊTRE DU PONT : la reconnaissance des grades, secteurs et wilayas est déjà
    // écrite et testée. En réécrire une seconde version pour le chemin « avec correspondance »
    // aurait produit deux comportements qui divergent à la première correction.
    const { standard } = applyMapping(
      ["Benali", "Ahmed", "Professeur", "CHU Mustapha", "Alger"],
      [`${STD}lastName`, `${STD}firstName`, `${STD}title`, `${STD}institution`, `${STD}wilaya`],
    );
    const feuille = [canonicalHeaderRow(), toCanonicalRow(standard)];
    const parsed = parseDirectorySheet(feuille);

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].lastName).toBe("Benali");
    expect(parsed.rows[0].firstName).toBe("Ahmed");
    expect(parsed.rows[0].title).toBe("PROFESSEUR");
    expect(parsed.rows[0].wilaya).toBe("Alger");
  });
});

describe("les clés de colonne — figées, sans collision", () => {
  it("la clé est dérivée du libellé, préfixée pour ne jamais heurter le tronc commun", () => {
    expect(columnKeyFrom("Dernier congrès")).toBe("c_dernier_congres");
    // `phone` sur mesure et `phone` standard ne doivent pas désigner la même chose.
    expect(columnKeyFrom("Téléphone")).toBe("c_telephone");
    expect(stdFieldOf(`${STD}phone`)).toBe("phone");
    expect(customKeyOf(`${CUS}c_telephone`)).toBe("c_telephone");
  });

  it("un libellé vide ne produit jamais une clé vide", () => {
    expect(columnKeyFrom("   ")).toMatch(/^c_/);
    expect(columnKeyFrom("!!!")).toMatch(/^c_/);
  });

  it("deux colonnes de même libellé reçoivent des clés distinctes", () => {
    const k1 = uniqueColumnKey("Statut", []);
    const k2 = uniqueColumnKey("Statut", [k1]);
    expect(k1).toBe("c_statut");
    expect(k2).toBe("c_statut_2");
  });

  it("renommer le libellé NE change PAS la clé — les valeurs saisies survivent", () => {
    // C'est tout l'intérêt de figer la clé : le libellé est de l'affichage, la clé est l'identité.
    const cle = columnKeyFrom("Congrès");
    const colonne: CustomColumn = { key: cle, label: "Dernier congrès en date", kind: "TEXT" };
    expect(targetsFor([colonne])[targetsFor([colonne]).length - 1]).toMatchObject({
      id: `${CUS}${cle}`,
      label: "Dernier congrès en date",
    });
  });
});

describe("les cibles offertes", () => {
  it("le tronc commun ET les colonnes propres sont proposés", () => {
    const t = targetsFor(COLONNES);
    expect(t.some((x) => x.id === `${STD}name`)).toBe(true);
    expect(t.some((x) => x.id === `${CUS}c_dernier_congres`)).toBe(true);
  });

  it("les options d'une colonne à choix sont découpées", () => {
    const t = targetsFor(COLONNES).find((x) => x.id === `${CUS}c_statut`);
    expect(t?.kind).toBe("CHOICE");
    expect(t?.options).toEqual(["Actif", "Inactif"]);
  });
});
