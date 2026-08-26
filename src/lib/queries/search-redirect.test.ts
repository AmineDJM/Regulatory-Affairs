import { describe, it, expect } from "vitest";
import { emptySearchHint, emptySearchNote } from "./search-redirect";

/**
 * LE BANC DE L'AIGUILLAGE, écrit à partir d'un ÉCHEC RÉEL.
 *
 * Le premier cas ci-dessous est la phrase exacte du PDG en production. Adam a appelé la recherche
 * fédérée deux fois, obtenu zéro résultat, lu « essayer un synonyme (nom commercial ↔ DCI) », et
 * renoncé — alors qu'un outil d'annuaire existait, lui était ouvert, et rendait exactement le
 * tableau demandé.
 *
 * La leçon tient en une ligne : **un outil qui échoue doit indiquer la sortie**. Une note qui dit
 * « réessaie autrement » sur une requête qui n'était pas de son ressort produit une boucle, puis
 * un abandon.
 */

describe("le cas de production", () => {
  it("« les adresses mail des salariés » renvoie vers l'annuaire, pas vers les molécules", () => {
    const hint = emptySearchHint("les adresses mail des salariés");
    expect(hint).toContain("directory_list");
    // Le conseil sur les dénominations pharmaceutiques n'a rien à faire ici.
    expect(hint).not.toMatch(/DCI|nom commercial/);
  });

  it("la note complète dit ce qui a échoué ET où aller", () => {
    const note = emptySearchNote("adresses mail des salariés");
    expect(note).toContain("Aucun résultat");
    expect(note).toContain("directory_list");
  });
});

describe("chaque famille a sa sortie", () => {
  const cas: [string, RegExp][] = [
    ["le numéro de l'imprimeur", /directory_/],
    ["comment joindre Deepak", /directory_/],
    ["les coordonnées de Raihana", /directory_/],
    ["la liste des salariés", /directory_list|read_hr_overview/],
    ["combien de collaborateurs au réglementaire", /directory_list|read_hr_overview/],
    ["le contrat Pharmagene", /find_documents|gdrive_search/],
    ["mon prochain rendez-vous", /read_calendar|gcal_search/],
    ["le dossier Raltegravir", /regulatory_portfolio|inspect_record/],
    ["le montant des factures", /read_finances|read_budget|finance_totals/],
  ];

  it.each(cas)("« %s » → %s", (query, attendu) => {
    expect(emptySearchHint(query)).toMatch(attendu);
  });
});

describe("le conseil sur les dénominations survit là où il a un sens", () => {
  it("une requête réglementaire garde le conseil nom commercial ↔ DCI", () => {
    // Ce conseil est bon — il était juste servi à tout le monde.
    expect(emptySearchHint("dossier Raltegravir")).toMatch(/DCI/);
  });

  it("mais une requête sur des personnes ne le reçoit jamais", () => {
    for (const q of ["les mails des salariés", "le téléphone de Khaled", "la liste du personnel"]) {
      expect(emptySearchHint(q)).not.toMatch(/DCI/);
    }
  });
});

describe("on ne rend jamais un cul-de-sac", () => {
  it("une requête inclassable reçoit quand même des pistes nommées", () => {
    const hint = emptySearchHint("le truc de l'autre fois");
    expect(hint.length).toBeGreaterThan(30);
    expect(hint).toMatch(/directory_lookup|find_documents|regulatory_portfolio/);
  });

  it("même sur une requête vide", () => {
    expect(emptySearchHint("")).toMatch(/directory_lookup|find_documents/);
    expect(emptySearchHint("   ")).toMatch(/directory_lookup|find_documents/);
  });
});

describe("l'ordre des familles est délibéré", () => {
  it("« adresses mail des salariés » touche COORDONNÉES et RH — les coordonnées gagnent", () => {
    // L'outil RH rendrait un effectif ; c'est l'annuaire qui porte les adresses.
    expect(emptySearchHint("les adresses mail des salariés")).toContain("COORDONNÉES");
  });
});
