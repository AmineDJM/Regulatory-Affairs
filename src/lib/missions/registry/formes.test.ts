import { describe, expect, it } from "vitest";
import {
  CHAMPS_MAX, cheminPlausible, direForme, formeDe, FORME_INCONNUE, OBSERVATIONS_MAX,
} from "@/lib/missions/registry/formes";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS TIENNENT.
 *
 * Trois invariants, et le premier est de sécurité :
 *
 *   1. UNE FORME NE PORTE JAMAIS UNE VALEUR. Elle part dans le prompt du planificateur ; un
 *      montant ou un nom de salarié qui s'y glisserait ferait fuiter par la description ce que
 *      les droits protègent dans les données.
 *   2. ZÉRO OBSERVATION N'EST PAS UNE FORME VIDE. On ne refuse jamais un plan sur une
 *      ignorance — `cheminPlausible` rend `null`, jamais `false`.
 *   3. LA LISTE PRINCIPALE EST LA PLUS FOURNIE, pas la première rencontrée. Un éventail déployé
 *      sur `alertes` au lieu de `resultats` ne produit rien, et c'est silencieux.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("la forme s'apprend des sorties réelles", () => {
  it("un objet rend ses champs, et distingue le constant de l'occasionnel", () => {
    const f = formeDe([
      { total: 3, resultats: [], couverture: "haute" },
      { total: 0, resultats: [] },
    ]);
    expect(f.nature).toBe("OBJET");
    const par = Object.fromEntries(f.champs.map((c) => [c.nom, c]));
    expect(par.total).toMatchObject({ type: "nombre", toujours: true });
    expect(par.resultats).toMatchObject({ type: "liste", toujours: true });
    // Vu une fois sur deux : le planificateur ne doit pas compter dessus.
    expect(par.couverture).toMatchObject({ type: "texte", toujours: false });
    expect(f.observations).toBe(2);
  });

  it("LE TEST QUI COMPTE : aucune VALEUR ne survit dans la forme", () => {
    // Des données piégées : un salaire, un nom, une adresse, un secret. Si l'une d'elles
    // apparaît dans la forme ou dans sa phrase, la description devient une fuite.
    const piege = [{
      salaire: 4_200_000,
      nomComplet: "Yassine Belkacem",
      email: "yassine.belkacem@adventum.dz",
      motDePasse: "hunter2",
      resultats: [{ reference: "REG-2026-9015", montantDzd: 17_400_000, titulaire: "Hetero Labs" }],
    }];
    const f = formeDe(piege);
    const texte = `${JSON.stringify(f)} ${direForme(f) ?? ""}`;
    for (const valeur of ["4200000", "Yassine", "Belkacem", "adventum.dz", "hunter2", "REG-2026-9015", "17400000", "Hetero"]) {
      expect(texte, `« ${valeur} » a fui dans la forme`).not.toContain(valeur);
    }
    // Les NOMS de champs, eux, sont bien là — c'est tout l'intérêt.
    expect(texte).toContain("salaire");
    expect(texte).toContain("montantDzd");
  });

  it("la liste principale est la PLUS FOURNIE, jamais la première venue", () => {
    const f = formeDe([{
      alertes: [{ niveau: "info" }],
      resultats: Array.from({ length: 12 }, (_, i) => ({ nom: `n${i}`, driveNodeId: `d${i}` })),
    }]);
    expect(f.liste?.chemin).toBe("resultats");
    expect(f.liste?.elements.map((c) => c.nom).sort()).toEqual(["driveNodeId", "nom"]);
  });

  it("une sortie qui EST une liste se déploie à la racine", () => {
    const f = formeDe([[{ titre: "a", statut: "TODO" }, { titre: "b", statut: "DONE" }]]);
    expect(f.nature).toBe("LISTE");
    expect(f.liste?.chemin).toBe("");
    expect(direForme(f)).toMatch(/LISTE à la racine/);
  });

  it("la plomberie interne (`_blocs`, `_provenance`) reste hors de la forme", () => {
    // Ces champs existent pour l'écran et l'audit. Les exposer inviterait une étape aval à s'en
    // servir comme d'un contrat, et ils changent sans préavis.
    const f = formeDe([{ resultats: [], _blocs: [{ kind: "table" }], _provenance: { outil: "x" } }]);
    expect(f.champs.map((c) => c.nom)).toEqual(["resultats"]);
  });

  it("une sortie nulle ne compte pas comme une observation", () => {
    // Sinon une étape aboutie sans résultat ferait passer tous les champs pour occasionnels.
    const f = formeDe([null, undefined, { total: 1 }]);
    expect(f.observations).toBe(1);
    expect(f.champs[0]).toMatchObject({ nom: "total", toujours: true });
  });

  it("les bornes tiennent : ni champ ni observation à l'infini", () => {
    const large = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`c${String(i).padStart(2, "0")}`, i]));
    expect(formeDe([large]).champs.length).toBe(CHAMPS_MAX);
    expect(formeDe(Array.from({ length: 500 }, () => ({ a: 1 }))).observations).toBe(OBSERVATIONS_MAX);
  });
});

describe("zéro observation n'est pas une forme vide", () => {
  it("rien d'observé rend une forme INCONNUE qui ne se dit pas", () => {
    expect(formeDe([])).toEqual(FORME_INCONNUE);
    expect(direForme(FORME_INCONNUE)).toBeNull();
  });

  it("LE TEST QUI COMPTE : on ne refuse JAMAIS un chemin sur une ignorance", () => {
    // `null` = « je ne sais pas ». Rendre `false` ici ferait refuser à la compilation des plans
    // parfaitement corrects, simplement parce que la capacité n'a jamais tourné — on aurait
    // échangé un défaut contre un pire, et sur toutes les capacités neuves.
    expect(cheminPlausible(FORME_INCONNUE, "resultats.0.id")).toBeNull();
  });
});

describe("le chemin plausible — refuser seulement ce qu'on SAIT faux", () => {
  const forme = formeDe([{
    total: 2,
    resultats: [{ nom: "a", driveNodeId: "d1", confiance: "HAUTE" }],
  }]);

  it("un champ racine connu passe, un champ racine absent est REFUSÉ", () => {
    expect(cheminPlausible(forme, "total")).toBe(true);
    expect(cheminPlausible(forme, "resultats")).toBe(true);
    // C'est exactement l'erreur du banc m6 : `.id` alors que la capacité rend `driveNodeId`.
    expect(cheminPlausible(forme, "identifiant")).toBe(false);
  });

  it("on descend dans la liste principale, et l'index ne gêne pas", () => {
    expect(cheminPlausible(forme, "resultats.0.driveNodeId")).toBe(true);
    expect(cheminPlausible(forme, "resultats.driveNodeId")).toBe(true);
    expect(cheminPlausible(forme, "resultats.0.id")).toBe(false);
  });

  it("hors de la liste principale, on s'abstient au lieu d'inventer une profondeur", () => {
    const f = formeDe([{ meta: { a: 1 }, resultats: [{ x: 1 }] }]);
    expect(cheminPlausible(f, "meta.a")).toBeNull();
  });
});

describe("mesure consignée — formes apprises", () => {
  it("les six formes écrites à la main se retrouvent par apprentissage", () => {
    // La preuve que l'apprentissage remplace la table : on rejoue des sorties du même dessin que
    // celles que `SORTIES` décrivait, et on vérifie qu'on retrouve le chemin d'éventail et
    // l'identifiant utile — sans que personne ne les ait écrits.
    const cas: [string, unknown[], string, string][] = [
      ["find_documents", [{ resultats: [{ nom: "a", driveNodeId: "d", confiance: "HAUTE" }], couverture: 1 }], "resultats", "driveNodeId"],
      ["search_everything", [{ resultats: [{ famille: "f", titre: "t", reference: "r" }], total: 1 }], "resultats", "reference"],
      ["directory_list", [{ salaries: [{ id: "1", nom: "n", emails: [] }], total: 1 }], "salaries", "nom"],
      ["gmail_search", [{ messages: [{ id: "1", filId: "f", de: "x", objet: "o" }] }], "messages", "filId"],
      ["search_drive", [{ items: [{ nom: "n", driveNodeId: "d", lien: "l" }], count: 1 }], "items", "driveNodeId"],
      ["list_my_tasks", [[{ titre: "t", statut: "TODO", priorite: "HIGH" }]], "", "statut"],
    ];
    const ok = cas.filter(([, sorties, chemin, champ]) => {
      const f = formeDe(sorties);
      return f.liste?.chemin === chemin && f.liste.elements.some((c) => c.nom === champ);
    }).length;
    consignerMesure("forme_sortie_apprise", { n: cas.length, ok },
      "lib/missions/registry/formes.test.ts",
      "les six formes jusque-là écrites à la main sont retrouvées par apprentissage, chemin d'éventail compris");
    expect(ok).toBe(cas.length);
  });
});
