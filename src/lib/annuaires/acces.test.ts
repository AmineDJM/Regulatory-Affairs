import { describe, expect, it } from "vitest";
import {
  ANNUAIRES_ACCORDABLES, LECTURE_POUR_TOUS, LIBELLE_ANNUAIRE, annuaireDuPraticien, lireSections,
  ouvertParModule, ouvertParSection, peutAnnuaire, type AnnuaireAccordable, type FaitsAnnuaire, type GesteAnnuaire,
} from "./acces";
import { ANNUAIRES_TABS } from "@/lib/labels";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ACCÈS PAR ANNUAIRE — la règle pure (§118.147).
 *
 * « Quand je donne accès à ce module à un user, je dois pouvoir lui donner des accès PAR
 * annuaire. » Deux ouvertures, et chaque cas ci-dessous nomme la façon plausible de rater l'une
 * ou l'autre : fermer un annuaire qu'un rôle tenait (l'ouverture n'est pas ADDITIVE), en ouvrir un
 * qu'on n'a pas coché (la section déborde sur sa voisine), ou fabriquer un geste que l'annuaire n'a
 * pas (créer une PERSONNE depuis l'annuaire, qui n'en crée pas).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un acteur décrit par ses droits de module et ses annuaires cochés — rien d'autre. */
function faits(droits: Record<string, GesteAnnuaire[]>, sections: string[] = [], parRole = false): FaitsAnnuaire {
  return {
    peut: (module, geste) => (droits[module] ?? []).includes(geste),
    sections: new Set(sections),
    tientPersonnesParRole: parRole,
  };
}
const TOUT: GesteAnnuaire[] = ["VIEW", "CREATE", "UPDATE", "DELETE"];
/** Ce que tous les rôles tiennent (mesuré : les dix-neuf rôles portent l'espace de travail). */
const ORDINAIRE = { WORKSPACE: ["VIEW"] as GesteAnnuaire[] };

describe("lireSections — une clé inconnue est ÉCARTÉE, jamais interprétée", () => {
  it("garde les clés connues, dans l'ordre canonique, sans doublon", () => {
    expect(lireSections(["PARTENAIRES", "ETABLISSEMENTS", "PARTENAIRES"])).toEqual(["ETABLISSEMENTS", "PARTENAIRES"]);
  });

  it("écarte une faute de frappe et tout ce qui n'est pas une liste", () => {
    // Ce qui le ferait tomber : accepter « etablissements » (casse) ou « AUTRES » — un annuaire
    // non accordable ouvert par un formulaire forgé.
    expect(lireSections(["etablissements", "AUTRES", 3, null, "MEDECINS"])).toEqual(["MEDECINS"]);
    expect(lireSections("MEDECINS")).toEqual([]);
    expect(lireSections(undefined)).toEqual([]);
  });

  it("« Autres annuaires » n'est PAS accordable : ses référentiels ont leur propre module", () => {
    expect(ANNUAIRES_ACCORDABLES as readonly string[]).not.toContain("AUTRES");
  });
});

describe("le grade range un praticien dans son annuaire", () => {
  it("PHARMACIEN → pharmaciens ; tout autre grade, ou aucun, → médecins", () => {
    expect(annuaireDuPraticien("PHARMACIEN")).toBe("PHARMACIENS");
    expect(annuaireDuPraticien("PROFESSEUR")).toBe("MEDECINS");
    expect(annuaireDuPraticien(null)).toBe("MEDECINS");
    expect(annuaireDuPraticien(undefined)).toBe("MEDECINS");
  });
});

describe("l'ouverture par le MODULE — la règle d'avant, à l'identique", () => {
  it("médecins, pharmaciens, établissements suivent la Promotion médicale, geste par geste", () => {
    const delegue = faits({ ...ORDINAIRE, MEDICAL: ["VIEW", "CREATE", "UPDATE"] });
    for (const cle of ["MEDECINS", "PHARMACIENS", "ETABLISSEMENTS"] as const) {
      expect(ouvertParModule(delegue, cle, "UPDATE"), cle).toBe(true);
      expect(ouvertParModule(delegue, cle, "DELETE"), cle).toBe(false);
    }
    expect(ouvertParModule(faits(ORDINAIRE), "ETABLISSEMENTS", "VIEW")).toBe(false);
  });

  it("les partenaires se LISENT par l'espace de travail, s'écrivent par les Moyens généraux", () => {
    expect(ouvertParModule(faits(ORDINAIRE), "PARTENAIRES", "VIEW")).toBe(true);
    expect(ouvertParModule(faits(ORDINAIRE), "PARTENAIRES", "CREATE")).toBe(false);
    expect(ouvertParModule(faits({ ...ORDINAIRE, GENERAL_MEANS: ["VIEW", "CREATE"] }), "PARTENAIRES", "CREATE")).toBe(true);
    // L'espace de travail BLOQUÉ en prive, comme l'onglet d'avant : la règle ne lit pas plus large.
    expect(ouvertParModule(faits({}), "PARTENAIRES", "VIEW")).toBe(false);
  });

  it("les personnes : lues de tous, MODIFIÉES par rôle, Moyens généraux ou RH — jamais créées ni supprimées ici", () => {
    expect(ouvertParModule(faits(ORDINAIRE), "PERSONNES", "VIEW")).toBe(true);
    expect(ouvertParModule(faits(ORDINAIRE), "PERSONNES", "UPDATE")).toBe(false);
    expect(ouvertParModule(faits(ORDINAIRE, [], true), "PERSONNES", "UPDATE")).toBe(true);
    expect(ouvertParModule(faits({ ...ORDINAIRE, RH: ["VIEW", "UPDATE"] }), "PERSONNES", "UPDATE")).toBe(true);
    expect(ouvertParModule(faits({ ...ORDINAIRE, GENERAL_MEANS: ["VIEW", "UPDATE"] }), "PERSONNES", "UPDATE")).toBe(true);
    // L'identité vient du registre RH : l'annuaire ne crée ni ne supprime personne.
    expect(ouvertParModule(faits({ ...ORDINAIRE, RH: TOUT }, [], true), "PERSONNES", "CREATE")).toBe(false);
    expect(ouvertParModule(faits({ ...ORDINAIRE, RH: TOUT }, [], true), "PERSONNES", "DELETE")).toBe(false);
  });
});

describe("l'ouverture par la CONSOLE — l'annuaire coché, avec les gestes cochés", () => {
  it("un annuaire coché s'ouvre sans le module de son référentiel, avec les gestes de l'accès", () => {
    const assistante = faits({ ...ORDINAIRE, DIRECTORIES: ["VIEW", "UPDATE"] }, ["ETABLISSEMENTS"]);
    expect(peutAnnuaire(assistante, "ETABLISSEMENTS", "VIEW")).toBe(true);
    expect(peutAnnuaire(assistante, "ETABLISSEMENTS", "UPDATE")).toBe(true);
    // Le geste non coché reste fermé : cocher l'annuaire n'est pas cocher « Supprimer ».
    expect(peutAnnuaire(assistante, "ETABLISSEMENTS", "DELETE")).toBe(false);
  });

  it("la section ne DÉBORDE pas sur sa voisine — ni sur l'autre annuaire de praticiens", () => {
    // Ce qui le ferait tomber : juger les deux annuaires de praticiens sur une même case, ou
    // ouvrir tout le référentiel médical dès qu'une section est cochée.
    const medecins = faits({ ...ORDINAIRE, DIRECTORIES: TOUT }, ["MEDECINS"]);
    expect(peutAnnuaire(medecins, "MEDECINS", "DELETE")).toBe(true);
    expect(peutAnnuaire(medecins, "PHARMACIENS", "VIEW")).toBe(false);
    expect(peutAnnuaire(medecins, "ETABLISSEMENTS", "VIEW")).toBe(false);
  });

  it("sans le geste sur le module Annuaires, la case n'ouvre rien d'autre que la lecture", () => {
    const lecture = faits({ ...ORDINAIRE, DIRECTORIES: ["VIEW"] }, ["MEDECINS"]);
    expect(peutAnnuaire(lecture, "MEDECINS", "VIEW")).toBe(true);
    for (const g of ["CREATE", "UPDATE", "DELETE"] as const) expect(peutAnnuaire(lecture, "MEDECINS", g), g).toBe(false);
    // Et sans le module du tout (accès bloqué), la case cochée en base n'ouvre RIEN.
    expect(ouvertParSection(faits(ORDINAIRE, ["MEDECINS"]), "MEDECINS", "VIEW")).toBe(false);
  });

  it("cocher « Créer » ou « Supprimer » ne fabrique pas un geste que l'annuaire des personnes n'a pas", () => {
    const f = faits({ ...ORDINAIRE, DIRECTORIES: TOUT }, ["PERSONNES"]);
    expect(peutAnnuaire(f, "PERSONNES", "UPDATE")).toBe(true);
    expect(peutAnnuaire(f, "PERSONNES", "CREATE")).toBe(false);
    expect(peutAnnuaire(f, "PERSONNES", "DELETE")).toBe(false);
  });

  it("l'ouverture est ADDITIVE : une case oubliée ne retire jamais un annuaire que le rôle tient", () => {
    // Un délégué tient les praticiens par la Promotion médicale ; on ne lui coche que les
    // établissements. Ce qui le ferait tomber : que les sections REMPLACENT la règle du module.
    const delegue = faits({ ...ORDINAIRE, MEDICAL: ["VIEW", "UPDATE"], DIRECTORIES: ["VIEW"] }, ["ETABLISSEMENTS"]);
    expect(peutAnnuaire(delegue, "MEDECINS", "UPDATE")).toBe(true);
    expect(peutAnnuaire(delegue, "PHARMACIENS", "VIEW")).toBe(true);
  });
});

describe("ce que la CONSOLE dit, la règle le fait", () => {
  it("« lecture pour tous » est exactement ce que l'espace de travail ouvre déjà en lecture", () => {
    // La console affiche cette mention à côté de la case ; si la règle changeait sans elle, la
    // console mentirait sur ce qu'une case accorde. On la DÉRIVE ici au lieu de la croire.
    for (const cle of ANNUAIRES_ACCORDABLES) {
      expect(LECTURE_POUR_TOUS.has(cle), cle).toBe(ouvertParModule(faits(ORDINAIRE), cle, "VIEW"));
    }
  });

  it("chaque annuaire accordable a UN onglet et un libellé ; chaque onglet d'annuaire est accordable", () => {
    // Une case sans onglet ouvrirait un annuaire qu'aucun écran ne montre ; un onglet sans case
    // ne s'ouvrirait jamais à qui n'a pas le module de son référentiel (§118.50).
    const parOnglet = ANNUAIRES_TABS.map((t) => t.annuaire).filter(Boolean) as AnnuaireAccordable[];
    expect([...parOnglet].sort()).toEqual([...ANNUAIRES_ACCORDABLES].sort());
    for (const cle of ANNUAIRES_ACCORDABLES) expect(LIBELLE_ANNUAIRE[cle].length, cle).toBeGreaterThan(2);
    // « Autres annuaires » reste gardé par son seul module.
    expect(ANNUAIRES_TABS.find((t) => t.href === "/annuaires/autres")?.annuaire).toBeUndefined();
  });
});
