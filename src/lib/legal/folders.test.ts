import { describe, it, expect } from "vitest";
import {
  buildFolderTree, flattenFolders, folderPath, subtreeIds, canReparent,
  deletionSummary, indentedLabel, type FolderLite,
} from "./folders";

const F = (id: string, name: string, parentId: string | null = null): FolderLite => ({ id, name, parentId });

const SAMPLE: FolderLite[] = [
  F("baux", "Baux"),
  F("assur", "Assurances"),
  F("presta", "Prestataires"),
  F("p26", "2026", "presta"),
  F("p25", "2025", "presta"),
  F("p26q1", "T1", "p26"),
];

describe("buildFolderTree — l'armoire, dans l'ordre où on la lit", () => {
  it("range les enfants sous leur parent, alphabétiquement à chaque niveau", () => {
    const tree = buildFolderTree(SAMPLE);
    expect(tree.map((n) => n.name)).toEqual(["Assurances", "Baux", "Prestataires"]);
    const presta = tree.find((n) => n.id === "presta")!;
    expect(presta.children.map((c) => c.name)).toEqual(["2025", "2026"]);
  });

  it("porte la profondeur, pour l'indentation", () => {
    const flat = flattenFolders(buildFolderTree(SAMPLE));
    expect(flat.find((n) => n.id === "p26q1")!.depth).toBe(2);
  });

  // Le faire disparaître avec son parent cacherait son contenu sans que rien ne le signale, et
  // l'on chercherait un contrat qui n'apparaît nulle part.
  it("remonte à la racine un dossier dont le parent est absent de la liste", () => {
    const tree = buildFolderTree([F("orphan", "Orphelin", "disparu")]);
    expect(tree.map((n) => n.id)).toEqual(["orphan"]);
  });

  it("une armoire vide n'est pas une erreur", () => {
    expect(buildFolderTree([])).toEqual([]);
  });
});

describe("flattenFolders — parents avant enfants", () => {
  it("rend l'ordre d'un menu déroulant", () => {
    const flat = flattenFolders(buildFolderTree(SAMPLE)).map((n) => n.id);
    expect(flat.indexOf("presta")).toBeLessThan(flat.indexOf("p26"));
    expect(flat.indexOf("p26")).toBeLessThan(flat.indexOf("p26q1"));
  });
});

describe("folderPath — le fil d'Ariane", () => {
  it("remonte de la racine au dossier courant", () => {
    expect(folderPath(SAMPLE, "p26q1").map((f) => f.name)).toEqual(["Prestataires", "2026", "T1"]);
  });

  it("aucun dossier = aucun chemin", () => {
    expect(folderPath(SAMPLE, null)).toEqual([]);
  });

  // Une donnée abîmée doit rendre un chemin tronqué, pas figer la page.
  it("ne boucle pas sur un dossier devenu son propre ancêtre", () => {
    const cyclic = [F("a", "A", "b"), F("b", "B", "a")];
    expect(folderPath(cyclic, "a").length).toBeLessThanOrEqual(2);
  });
});

describe("subtreeIds — le dossier et tout ce qu'il contient", () => {
  it("descend sur plusieurs niveaux", () => {
    expect(subtreeIds(SAMPLE, "presta").sort()).toEqual(["p25", "p26", "p26q1", "presta"]);
  });

  it("une feuille se contient elle-même", () => {
    expect(subtreeIds(SAMPLE, "baux")).toEqual(["baux"]);
  });
});

describe("canReparent — pas de boucle dans l'armoire", () => {
  it("un dossier peut remonter à la racine", () => {
    expect(canReparent(SAMPLE, "p26", null)).toBe(true);
  });

  it("un dossier peut rejoindre un dossier étranger", () => {
    expect(canReparent(SAMPLE, "p26", "baux")).toBe(true);
  });

  // Créer une boucle ferait disparaître le dossier — et tout ce qu'il contient — de l'arbre.
  it("jamais dans lui-même ni dans sa propre descendance", () => {
    expect(canReparent(SAMPLE, "presta", "presta")).toBe(false);
    expect(canReparent(SAMPLE, "presta", "p26q1")).toBe(false);
  });
});

describe("deletionSummary — ce que la suppression emporte, dit avant de cliquer", () => {
  // Ranger un engagement dans un dossier ne doit pas offrir un moyen de le faire disparaître.
  it("dit que les documents sont DÉCLASSÉS, pas supprimés", () => {
    const s = deletionSummary({ subfolders: 0, documents: 12 });
    expect(s).toContain("non classés");
    expect(s).toContain("aucun n'est supprimé");
  });

  it("annonce les sous-dossiers emportés", () => {
    expect(deletionSummary({ subfolders: 3, documents: 0 })).toContain("3 sous-dossier");
  });

  it("dit aussi quand le dossier est vide", () => {
    expect(deletionSummary({ subfolders: 0, documents: 0 })).toContain("aucun document");
  });
});

describe("indentedLabel", () => {
  it("montre la hiérarchie dans un menu à plat", () => {
    const flat = flattenFolders(buildFolderTree(SAMPLE));
    expect(indentedLabel(flat.find((n) => n.id === "presta")!)).toBe("Prestataires");
    expect(indentedLabel(flat.find((n) => n.id === "p26")!)).toContain("└ 2026");
  });
});
