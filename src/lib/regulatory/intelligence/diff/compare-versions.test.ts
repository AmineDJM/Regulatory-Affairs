import { describe, it, expect } from "vitest";
import { diffFiles, diffFacts, type DiffDoc, type DiffFact } from "./compare-versions";

const d = (path: string, sha: string, section: string | null = null): DiffDoc => ({ originalPath: path, originalFilename: path.split("/").pop()!, sha256: sha, ctdSection: section });
const f = (key: string, value: string | null): DiffFact => ({ factKey: key, label: key, value });

describe("diffFiles — inchangé/ajouté/supprimé/remplacé", () => {
  it("classe correctement les quatre cas", () => {
    const oldDocs = [d("m1/a.pdf", "h1"), d("m3/b.pdf", "h2"), d("m1/gone.pdf", "h3")];
    const newDocs = [d("m1/a.pdf", "h1"), d("m3/b.pdf", "hX"), d("m5/new.pdf", "h4")];
    const r = diffFiles(oldDocs, newDocs);
    const byPath = Object.fromEntries(r.map((e) => [e.path, e.status]));
    expect(byPath["m1/a.pdf"]).toBe("unchanged");
    expect(byPath["m3/b.pdf"]).toBe("replaced");
    expect(byPath["m5/new.pdf"]).toBe("added");
    expect(byPath["m1/gone.pdf"]).toBe("removed");
  });

  it("identité de chemin insensible à la casse et aux séparateurs", () => {
    const r = diffFiles([d("M1\\A.pdf", "h1")], [d("m1/a.pdf", "h1")]);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("unchanged");
  });

  it("remplacé expose les deux empreintes SHA", () => {
    const r = diffFiles([d("a.pdf", "old")], [d("a.pdf", "new")]);
    expect(r[0].status).toBe("replaced");
    expect(r[0].oldSha).toBe("old");
    expect(r[0].newSha).toBe("new");
  });

  it("tri : remplacés puis ajoutés puis supprimés puis inchangés", () => {
    const r = diffFiles([d("keep.pdf", "k"), d("del.pdf", "x")], [d("keep.pdf", "k"), d("rep.pdf", "1"), d("add.pdf", "2")]);
    // pas de 'rep.pdf' dans old → 'added' ; pas de replaced ici
    const statuses = r.map((e) => e.status);
    expect(statuses.indexOf("added")).toBeLessThan(statuses.indexOf("removed"));
    expect(statuses.indexOf("removed")).toBeLessThan(statuses.indexOf("unchanged"));
  });
});

describe("diffFacts — ajouté/supprimé/modifié (inchangés omis)", () => {
  it("détecte les changements de valeur canonique", () => {
    const oldF = [f("INN", "Amoxicilline"), f("STRENGTH", "500 mg"), f("MAH", "Ancien détenteur")];
    const newF = [f("INN", "Amoxicilline"), f("STRENGTH", "1 g"), f("SHELF_LIFE", "24 mois")];
    const r = diffFacts(oldF, newF);
    const byKey = Object.fromEntries(r.map((e) => [e.factKey, e]));
    expect(byKey["STRENGTH"].status).toBe("changed");
    expect(byKey["STRENGTH"].oldValue).toBe("500 mg");
    expect(byKey["STRENGTH"].newValue).toBe("1 g");
    expect(byKey["SHELF_LIFE"].status).toBe("added");
    expect(byKey["MAH"].status).toBe("removed");
    expect(byKey["INN"]).toBeUndefined(); // inchangé → omis
  });

  it("valeurs vides ignorées (pas de faux ajout/suppression)", () => {
    expect(diffFacts([], [f("X", "")])).toHaveLength(0);
    expect(diffFacts([f("Y", "")], [])).toHaveLength(0);
  });
});
