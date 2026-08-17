import { describe, it, expect } from "vitest";
import { parseClipboard, serializeClipboard, clipboardLabel, canPasteInto, clipShortcut, type Clipboard } from "./clipboard";

const clip = (over: Partial<Clipboard> = {}): Clipboard =>
  ({ mode: "copy", ids: ["a"], names: ["Facture.pdf"], fromFolderId: null, ...over });

describe("Le presse-papiers survit au changement de dossier", () => {
  it("un aller-retour rend exactement ce qu'on a copié", () => {
    const c = clip({ ids: ["a", "b"], names: ["A", "B"], fromFolderId: "f1", mode: "cut" });
    expect(parseClipboard(serializeClipboard(c))).toEqual(c);
  });

  it("une valeur abîmée rend null au lieu de faire tomber l'écran", () => {
    // Autre version de l'app, écriture concurrente : le Drive doit s'ouvrir quand même.
    expect(parseClipboard("pas du json")).toBeNull();
    expect(parseClipboard(null)).toBeNull();
    expect(parseClipboard("{}")).toBeNull();
    expect(parseClipboard('{"mode":"copy","ids":[]}')).toBeNull();
    expect(parseClipboard('{"mode":"bizarre","ids":["a"]}')).toBeNull();
  });

  it("les identifiants non textuels sont écartés, pas acceptés en silence", () => {
    expect(parseClipboard('{"mode":"copy","ids":["a",null,3,""],"names":[]}')?.ids).toEqual(["a"]);
  });
});

describe("Ce que la barre d'état écrit", () => {
  it("nomme ce qu'on a pris, plutôt que de le compter", () => {
    expect(clipboardLabel(clip({ ids: ["a"], names: ["Facture.pdf"] }))).toBe("Facture.pdf à copier");
  });

  it("compte le reste au-delà de trois noms", () => {
    const c = clip({ ids: ["a", "b", "c", "d", "e"], names: ["A", "B", "C", "D", "E"] });
    expect(clipboardLabel(c)).toBe("A, B, C + 2 autre(s) à copier");
  });

  it("distingue couper de copier — ce ne sont pas les mêmes conséquences", () => {
    expect(clipboardLabel(clip({ mode: "cut" }))).toContain("à déplacer");
  });

  it("sait se passer des noms", () => {
    expect(clipboardLabel(clip({ ids: ["a", "b"], names: [] }))).toBe("2 élément(s) à copier");
  });
});

describe("Où peut-on coller", () => {
  it("dans un autre dossier, oui", () => {
    expect(canPasteInto(clip({ fromFolderId: "f1" }), { folderId: "f2", ancestorIds: [] })).toEqual({ ok: true });
  });

  it("couper puis coller au MÊME endroit ne ferait rien — on le dit", () => {
    const r = canPasteInto(clip({ mode: "cut", fromFolderId: "f1" }), { folderId: "f1", ancestorIds: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("déjà ici");
  });

  it("COPIER au même endroit reste permis — c'est un duplicata, pas un non-geste", () => {
    expect(canPasteInto(clip({ mode: "copy", fromFolderId: "f1" }), { folderId: "f1", ancestorIds: [] }).ok).toBe(true);
  });

  it("un dossier ne se colle pas dans lui-même", () => {
    expect(canPasteInto(clip({ ids: ["dossier"] }), { folderId: "dossier", ancestorIds: [] }).ok).toBe(false);
  });

  it("ni dans un de ses sous-dossiers — la boucle serait sans fin", () => {
    const r = canPasteInto(clip({ ids: ["parent"] }), { folderId: "enfant", ancestorIds: ["parent", "racine"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("sous-dossier");
  });

  it("un presse-papiers vide se refuse poliment", () => {
    expect(canPasteInto(null, { folderId: null, ancestorIds: [] }).ok).toBe(false);
  });
});

describe("Les raccourcis", () => {
  it("reconnaît Ctrl+C / Ctrl+X / Ctrl+V", () => {
    expect(clipShortcut({ key: "c", ctrlKey: true, metaKey: false })).toBe("copy");
    expect(clipShortcut({ key: "x", ctrlKey: true, metaKey: false })).toBe("cut");
    expect(clipShortcut({ key: "v", ctrlKey: true, metaKey: false })).toBe("paste");
  });

  it("marche aussi au ⌘ du Mac", () => {
    expect(clipShortcut({ key: "C", ctrlKey: false, metaKey: true })).toBe("copy");
  });

  it("une touche seule n'est pas un geste — sinon taper « c » copierait", () => {
    expect(clipShortcut({ key: "c", ctrlKey: false, metaKey: false })).toBeNull();
    expect(clipShortcut({ key: "a", ctrlKey: true, metaKey: false })).toBeNull();
  });
});
