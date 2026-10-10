import { describe, expect, it } from "vitest";
import { BRIQUES, BRIQUE_PAR_ID } from "./briques";
import { validerDefinition } from "./definition";
import { delaisDeTraitement, executionDesMarches, mediane } from "./mesures";
import { propositionsDeSecours } from "./luna-pur";
import {
  entreePourLuna, historiqueSuffisant, justificationDeLaRegle, lireReponseCibles, nombresDuTexte, plageDeCible, statistiquesCible,
  type EntreeCible,
} from "./luna-cible";

const H = 3_600_000;

describe("briques « demandes traitées » et PCH", () => {
  it("elles sont au catalogue, avec leur unité, leur source et leur sens", () => {
    expect(BRIQUE_PAR_ID.DEMANDES_TRAITEES.unite).toBe("NOMBRE");
    expect(BRIQUE_PAR_ID.DEMANDES_TRAITEES.additive).toBe(true);
    expect(BRIQUE_PAR_ID.DELAI_DEMANDES.unite).toBe("HEURES");
    expect(BRIQUE_PAR_ID.DELAI_DEMANDES.additive).toBe(false);
    expect(BRIQUE_PAR_ID.LIVRE_PCH.parametres).toContain("buId");
    expect(BRIQUE_PAR_ID.NON_SERVI_PCH.parametres).toContain("buId");
    expect(BRIQUE_PAR_ID.EXECUTION_MARCHES.unite).toBe("POURCENT");
    expect(BRIQUE_PAR_ID.EXECUTION_MARCHES.additive).toBe(false);
    for (const id of ["DEMANDES_TRAITEES", "DELAI_DEMANDES", "LIVRE_PCH", "NON_SERVI_PCH", "EXECUTION_MARCHES"] as const) {
      expect(BRIQUES.some((b) => b.id === id), id).toBe(true);
    }
  });

  it("une définition les accepte, et garde le BU choisi pour une brique PCH seulement", () => {
    const pch = validerDefinition({ nom: "Livré PCH", nature: "CALCULE", numerateur: { brique: "LIVRE_PCH", buId: "bu1", heures: 48 }, sens: "PLUS_HAUT", periode: "MOIS" });
    expect(pch.ok).toBe(true);
    if (pch.ok) expect(pch.def.numerateur).toEqual({ brique: "LIVRE_PCH", buId: "bu1" });
    const demandes = validerDefinition({ nom: "Délai", nature: "CALCULE", numerateur: { brique: "DELAI_DEMANDES", buId: "bu1" }, sens: "PLUS_BAS", periode: "MOIS" });
    expect(demandes.ok).toBe(true);
    if (demandes.ok) {
      expect(demandes.def.unite).toBe("HEURES");
      expect(demandes.def.numerateur).toEqual({ brique: "DELAI_DEMANDES" });
    }
  });

  it("le délai de traitement ne compte que les demandes datées des deux bouts, dans l'ordre", () => {
    const d = delaisDeTraitement([
      { creeLe: new Date(0), traiteLe: new Date(4 * H) },
      { creeLe: new Date(0), traiteLe: null },                 // pas traitée : écartée
      { creeLe: new Date(10 * H), traiteLe: new Date(2 * H) }, // traitement avant le dépôt : donnée incohérente, écartée
      { creeLe: new Date(0), traiteLe: new Date(10 * H) },
    ]);
    expect(d).toEqual([4, 10]);
    expect(mediane(d)).toBe(7);
    expect(mediane(delaisDeTraitement([]))).toBeNull();
  });

  it("l'exécution des marchés plafonne le livré à l'attribué de chaque chaîne, et se tait sans attribué", () => {
    expect(executionDesMarches([{ attribue: 1000, livre: 400 }, { attribue: 500, livre: 700 }])).toEqual({ attribue: 1500, livre: 900, pct: 60 });
    expect(executionDesMarches([{ attribue: 0, livre: 50 }]).pct).toBeNull();
    expect(executionDesMarches([]).pct).toBeNull();
  });

  it("le repli sans IA reconnaît les demandes traitées et le non servi PCH", () => {
    const r = propositionsDeSecours("Je veux suivre les demandes support traitées par mon équipe et leur délai de traitement");
    expect(r.propositions.map((p) => p.def.numerateur?.brique)).toEqual(["DEMANDES_TRAITEES", "DELAI_DEMANDES"]);
    const ns = propositionsDeSecours("la demande non servie par la PCH dans le secteur");
    expect(ns.propositions[0]?.def.numerateur?.brique).toBe("NON_SERVI_PCH");
    expect(ns.propositions[0]?.def.sens).toBe("PLUS_BAS");
  });
});

describe("cible proposée par Luna — relecture stricte", () => {
  const entree = (over: Partial<EntreeCible> = {}): EntreeCible => ({
    nom: "Visites réalisées", unite: "NOMBRE", sens: "PLUS_HAUT", periode: "MOIS",
    historique: {
      mois: ["M-6 · avril", "M-5 · mai", "M-4 · juin", "M-3 · juillet", "M-2 · août", "M-1 · septembre"],
      equipe: [40, 44, 42, 48, 46, 50],
      personne: [38, 41, 40, 45, 44, 47],
    },
    ...over,
  });
  const bonne = { index: 0, cible: 50, justification: "L'équipe est passée de 40 à 50 visites sur six mois, et la personne a atteint 47 : 50 reste atteignable.", chiffresCites: [40, 50, 47] };

  it("les statistiques sont calculées par la plateforme, pas par Luna", () => {
    const s = statistiquesCible(entree().historique, "PLUS_HAUT");
    expect(s).toMatchObject({ moisAvecDonnee: 6, moyenneEquipe: 45, meilleurMoisEquipe: 50, dernierMoisEquipe: 50, moyennePersonne: 42.5, dernierMoisPersonne: 47 });
    expect(statistiquesCible({ mois: ["a"], equipe: [null], personne: null }, "PLUS_BAS").moyenneEquipe).toBeNull();
  });

  it("trois mois de données d'équipe au moins, sinon pas d'appel", () => {
    expect(historiqueSuffisant(entree().historique)).toBe(true);
    expect(historiqueSuffisant({ mois: ["a", "b", "c"], equipe: [10, null, 12], personne: null })).toBe(false);
    expect(entreePourLuna(2, entree()).index).toBe(2);
  });

  it("accepte une cible ancrée sur l'historique", () => {
    const r = lireReponseCibles({ propositions: [bonne] }, [entree()]);
    expect(r[0]).toEqual({ cible: 50, justification: bonne.justification, chiffres: [40, 50, 47] });
  });

  it("rejette un chiffre cité qui n'est pas dans l'historique fourni", () => {
    expect(lireReponseCibles({ propositions: [{ ...bonne, chiffresCites: [40, 61] }] }, [entree()])[0]).toBeNull();
  });

  it("rejette une justification qui emploie un chiffre étranger aux données", () => {
    const j = "Le marché progresse de 17 % par an, la cible de 50 visites est donc raisonnable pour l'équipe.";
    expect(lireReponseCibles({ propositions: [{ ...bonne, justification: j }] }, [entree()])[0]).toBeNull();
  });

  it("rejette une cible hors de la plage de l'historique (élargie de 20 % dans le sens de l'effort)", () => {
    const e = entree();
    expect(plageDeCible(e)).toEqual({ min: 38, max: 60 });
    expect(lireReponseCibles({ propositions: [{ ...bonne, cible: 90 }] }, [e])[0]).toBeNull();
    expect(lireReponseCibles({ propositions: [{ ...bonne, cible: 20 }] }, [e])[0]).toBeNull();
    expect(lireReponseCibles({ propositions: [{ ...bonne, cible: 58 }] }, [e])[0]?.cible).toBe(58);
  });

  it("un pourcentage reste entre 0 et 100 ; un délai (plus bas = mieux) vise sous l'habitude", () => {
    const pct = entree({ unite: "POURCENT", historique: { mois: ["a", "b", "c"], equipe: [90, 95, 98], personne: null } });
    expect(plageDeCible(pct)!.max).toBe(100);
    const delai = entree({ unite: "HEURES", sens: "PLUS_BAS", historique: { mois: ["a", "b", "c"], equipe: [30, 24, 20], personne: null } });
    expect(plageDeCible(delai)).toEqual({ min: 14, max: 30 });
    const j = "Le délai de l'équipe est passé de 30 à 20 heures : viser 18 poursuit cette baisse.";
    expect(lireReponseCibles({ propositions: [{ index: 0, cible: 18, justification: j, chiffresCites: [30, 20] }] }, [delai])[0]?.cible).toBe(18);
  });

  it("une réponse illisible, un index inconnu ou une cible nulle ne donnent rien — la règle fixe reprend", () => {
    expect(lireReponseCibles(null, [entree()])).toEqual([null]);
    expect(lireReponseCibles({ propositions: [{ ...bonne, index: 5 }] }, [entree()])).toEqual([null]);
    expect(lireReponseCibles({ propositions: [{ ...bonne, cible: null }] }, [entree()])).toEqual([null]);
    expect(lireReponseCibles({ propositions: [bonne] }, [null])).toEqual([null]);
  });

  it("lit les nombres d'un texte et dit la règle fixe quand elle s'applique", () => {
    expect(nombresDuTexte("de 72,5 à 80 %")).toEqual([72.5, 80]);
    expect(justificationDeLaRegle(45, 50, "PLUS_HAUT", 8)).toMatch(/moyenne de l'équipe \(45\) et le meilleur \(50\) sur 8 personnes/);
  });
});
