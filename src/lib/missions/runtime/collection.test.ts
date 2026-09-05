import { describe, expect, it } from "vitest";
import { cheminsDeListes, expliquer, resoudreCollection } from "@/lib/missions/runtime/collection";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « IL A TROUVÉ UNDEFINED » — la phrase qui a coûté cent neuf secondes de modèle.
 *
 * ── LA CHAÎNE COMPLÈTE, RECONSTITUÉE DEPUIS UN RUN RÉEL ──────────────────────────────────
 *
 * `search_drive` ne trouve rien et répond en français. L'exécutant, qui ne peut pas en faire du
 * JSON, l'enveloppe en `{ texte: "Aucun fichier ni dossier ne contient…" }`. L'étape est DONE —
 * à raison : la recherche a tourné. L'éventail demande alors `resultats`, le chemin exact que la
 * capacité documente, et n'obtient rien.
 *
 * Le moteur écrivait « il a trouvé undefined ». Cette phrase partait telle quelle dans
 * `refusPrecedent`, le planificateur n'en tirait rien, et il récrivait la même recherche. Deux
 * fois. Le plan était juste ; le chemin était juste ; personne ne savait dire ce qui manquait.
 *
 * ── CE QUE CE FICHIER TIENT ──────────────────────────────────────────────────────────────
 *
 * Que chaque situation reçoive un nom DIFFÉRENT et une phrase EXPLOITABLE, et — le point qui
 * compte le plus — que la seule réparation autorisée reste strictement bornée : une liste
 * unique est une certitude, deux listes sont une ambiguïté, et une ambiguïté ne se tranche
 * jamais au premier venu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("le diagnostic d'une collection d'éventail", () => {
  it("le cas normal : le chemin demandé nomme bien une liste", () => {
    const c = resoudreCollection({ resultats: [1, 2, 3], tronque: false }, "resultats");
    expect(c.kind).toBe("LISTE");
    if (c.kind === "LISTE") expect(c.valeur).toEqual([1, 2, 3]);
  });

  it("un chemin IMBRIQUÉ se lit aussi", () => {
    const c = resoudreCollection({ data: { rows: ["a"] } }, "data.rows");
    expect(c.kind).toBe("LISTE");
  });

  it("une liste VIDE reste une liste — c'est une réponse, pas une absence", () => {
    // Le déploiement à zéro élément est un cas légitime que le moteur sait traiter. Le confondre
    // avec « rien trouvé » ferait échouer une étape qui a parfaitement répondu.
    const c = resoudreCollection({ resultats: [] }, "resultats");
    expect(c.kind).toBe("LISTE");
    if (c.kind === "LISTE") expect(c.valeur).toEqual([]);
  });

  it("LE CAS DU RUN RÉEL : l'amont a répondu en TEXTE, et la phrase le dit", () => {
    const amont = { texte: "Aucun fichier ni dossier ne contient « contrat » dans le Drive visible." };
    const c = resoudreCollection(amont, "resultats");
    expect(c.kind).toBe("TEXTE");

    const phrase = expliquer(c, "drive:rechercher-contrats", "resultats");
    // La phrase doit contenir CE QUE LA CAPACITÉ A DIT : c'est elle qui apprend au planificateur
    // que la recherche a été faite et n'a rien donné.
    expect(phrase).toContain("Aucun fichier ni dossier ne contient");
    expect(phrase).toMatch(/répondu en texte/);
    expect(phrase).toMatch(/inutile de refaire la même recherche/);
    // Et surtout, elle ne dit plus « undefined ».
    expect(phrase).not.toContain("undefined");
  });

  it("un texte n'est JAMAIS transformé en liste vide", () => {
    // Ce serait la faute la plus coûteuse du lot : affirmer une absence qu'on n'a pas vérifiée,
    // et laisser la mission conclure « zéro » là où la vérité est « je ne sais pas ».
    const c = resoudreCollection({ texte: "Donnez au moins deux caractères du nom." }, "resultats");
    expect(c.kind).not.toBe("LISTE");
    expect(c.kind).not.toBe("CORRIGEE");
  });

  it("le chemin existe mais ne contient PAS une liste — et le type est nommé", () => {
    const c = resoudreCollection({ resultats: 42 }, "resultats");
    expect(c.kind).toBe("MAUVAIS_TYPE");
    expect(expliquer(c, "amont", "resultats")).toContain("un nombre");
  });

  it("une structure SANS aucune liste nomme les champs qu'elle a", () => {
    const c = resoudreCollection({ total: 3, statut: "ok" }, "resultats");
    expect(c.kind).toBe("ABSENTE");
    const phrase = expliquer(c, "amont", "resultats");
    expect(phrase).toContain("total");
    expect(phrase).toContain("statut");
  });

  it("l'amont n'a rien produit du tout", () => {
    expect(resoudreCollection(null, "x").kind).toBe("VIDE");
    expect(resoudreCollection(undefined, "x").kind).toBe("VIDE");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SEULE RÉPARATION AUTORISÉE — et la borne qui l'empêche de devenir une devinette.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("la correction de chemin", () => {
  it("UNE seule liste dans le résultat : c'est elle, et on le DIT", () => {
    // Le planificateur a écrit « resultats », la capacité produit « documents ». Il n'y a rien à
    // arbitrer : une seule liste existe. Replanifier pour cela coûterait cinquante secondes de
    // modèle pour obtenir un plan identique à un mot près.
    const c = resoudreCollection({ documents: [{ id: "a" }, { id: "b" }], tronque: false }, "resultats");
    expect(c.kind).toBe("CORRIGEE");
    if (c.kind === "CORRIGEE") {
      expect(c.chemin).toBe("documents");
      expect(c.valeur).toHaveLength(2);
    }
    const phrase = expliquer(c, "amont", "resultats");
    // La correction n'est pas silencieuse : le journal doit porter les DEUX chemins.
    expect(phrase).toContain("resultats");
    expect(phrase).toContain("documents");
  });

  it("une liste unique IMBRIQUÉE est trouvée aussi", () => {
    const c = resoudreCollection({ data: { rows: [1] } }, "resultats");
    expect(c.kind).toBe("CORRIGEE");
    if (c.kind === "CORRIGEE") expect(c.chemin).toBe("data.rows");
  });

  it("LE CONTRE-EXEMPLE — deux listes ne se tranchent JAMAIS au premier venu", () => {
    // C'est la borne de toute la mécanique. Un éventail décide combien d'étapes filles naissent
    // et avec quelles données ; se tromper de liste enverrait N actions sur les mauvaises. Le
    // refus est ici la bonne réponse, et il NOMME les candidates pour que le plan suivant tranche.
    const c = resoudreCollection({ fichiers: [1, 2], dossiers: [3] }, "resultats");
    expect(c.kind).toBe("AMBIGU");
    if (c.kind === "AMBIGU") expect(c.chemins).toEqual(["fichiers", "dossiers"]);

    const phrase = expliquer(c, "amont", "resultats");
    expect(phrase).toContain("fichiers");
    expect(phrase).toContain("dossiers");
    expect(phrase).toMatch(/ne se devine pas/);
  });

  it("trois listes ne sont pas moins ambiguës que deux", () => {
    const c = resoudreCollection({ a: [1], b: [2], c: [3] }, "absent");
    expect(c.kind).toBe("AMBIGU");
  });

  it("la correction ne s'applique QUE si le chemin demandé est absent", () => {
    // Le chemin existe et contient autre chose qu'une liste : ce n'est pas un lapsus de nommage,
    // c'est un désaccord de type. Aller chercher ailleurs masquerait le vrai problème.
    const c = resoudreCollection({ resultats: "trois", documents: [1] }, "resultats");
    expect(c.kind).toBe("MAUVAIS_TYPE");
  });
});

describe("le recensement des listes", () => {
  it("descend de deux niveaux, et pas trois", () => {
    // Deux niveaux couvrent `{ data: { rows: [] } }`, la forme courante. Plus loin, on
    // n'inspecterait plus la FORME d'un résultat mais ses entrailles — et une liste trouvée à
    // quatre niveaux de profondeur n'est pas « la liste que l'étape a produite ».
    expect(cheminsDeListes({ a: [1] })).toEqual(["a"]);
    expect(cheminsDeListes({ a: { b: [1] } })).toEqual(["a.b"]);
    expect(cheminsDeListes({ a: { b: { c: [1] } } })).toEqual([]);
  });

  it("l'ordre est stable — deux appels rendent la même chose", () => {
    const v = { z: [1], a: [2], m: [3] };
    expect(cheminsDeListes(v)).toEqual(cheminsDeListes(v));
    // L'ordre est celui de l'objet, pas un tri : c'est ce qui rend le message reproductible.
    expect(cheminsDeListes(v)).toEqual(["z", "a", "m"]);
  });

  it("un tableau au sommet n'est pas un objet à parcourir", () => {
    expect(cheminsDeListes([1, 2, 3])).toEqual([]);
  });
});

describe("collection — plusieurs listes ne sont pas toujours une ambiguïté", () => {
  it("la liste d'enregistrements du premier niveau l'emporte sur la métadonnée imbriquée", () => {
    const amont = { resultats: [{ id: "a", nom: "Contrat" }, { id: "b", nom: "Facture" }], couverture: { sourcesInterrogees: ["drive", "legal"] }, total: 2 };
    const c = resoudreCollection(amont, "documents");
    expect(c.kind).toBe("CORRIGEE");
    if (c.kind === "CORRIGEE") { expect(c.chemin).toBe("resultats"); expect(c.valeur).toHaveLength(2); }
  });
  it("à même profondeur, les objets l'emportent sur les étiquettes ; deux listes d'objets restent ambiguës", () => {
    const c1 = resoudreCollection({ tags: ["x", "y"], lignes: [{ id: 1 }] }, "items");
    expect(c1.kind).toBe("CORRIGEE");
    if (c1.kind === "CORRIGEE") expect(c1.chemin).toBe("lignes");
    const c2 = resoudreCollection({ a: [{ id: 1 }], b: [{ id: 2 }] }, "items");
    expect(c2.kind).toBe("AMBIGU");
  });
});

describe("une liste À LA RACINE est une collection", () => {
  it("le tableau lui-même est la liste : chemin vide → LISTE, chemin écrit → CORRIGEE vers la racine, jamais ABSENTE", () => {
    const taches = [{ titre: "a" }, { titre: "b" }];
    expect(resoudreCollection(taches, "")).toEqual({ kind: "LISTE", valeur: taches });
    expect(resoudreCollection(taches, "items")).toEqual({ kind: "CORRIGEE", valeur: taches, chemin: "." });
    expect(resoudreCollection([], "taches")).toEqual({ kind: "CORRIGEE", valeur: [], chemin: "." });
  });
});
