import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurXlsx } from "@/lib/artifact/adapters/xlsx/adapter";
import { pngUni, xlsxAvecTableau, xlsxVentes } from "@/lib/artifact/adapters/fixtures";
import { cibleIndex, cibleTexte, commande } from "@/lib/artifact/commands/ir";
import { compilerCommandes } from "@/lib/artifact/commands/compile";
import type { XlsxModel } from "@/lib/artifact/object-model/model";
import type { RessourceBinaire } from "@/lib/artifact/adapters/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE IMAGE DANS UN CLASSEUR — et les trois pièges propres à Excel.
 *
 *   1. LA PLACE DE `<drawing>`. Le schéma d'une feuille est une SÉQUENCE : `tableParts` et
 *      `extLst` doivent rester APRÈS. Ajouter la balise « à la fin » d'une feuille qui porte un
 *      tableau structuré produit un classeur qu'Excel « répare » en perdant le tableau — sans
 *      erreur à l'écriture, sans erreur au test unitaire, et découvert par le destinataire.
 *   2. UN SEUL DESSIN PAR FEUILLE. Une feuille ne renvoie qu'à UNE partie dessin. Une seconde
 *      image doit ajouter un ancrage dans celle qui existe ; en créer une seconde ferait
 *      disparaître la première image, silencieusement.
 *   3. LA RELATION VIT DANS LE DESSIN, pas dans la feuille. Une image dont le `r:embed` pointe
 *      dans les relations de la FEUILLE s'affiche comme un cadre vide.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const REF = "drive-logo";
const LOGO = pngUni(600, 300);

function ressources(octets = LOGO, nom = "logo Adventum.png"): Map<string, RessourceBinaire> {
  return new Map<string, RessourceBinaire>([[REF, { octets, nom }]]);
}

function pieces(octets: Buffer): Map<string, string> {
  const zip = new PizZip(octets);
  const out = new Map<string, string>();
  for (const nom of Object.keys(zip.files)) {
    const f = zip.files[nom];
    if (!f.dir) out.set(nom, f.asText());
  }
  return out;
}

async function classeur(octets?: Buffer) {
  const avant = octets ?? await xlsxVentes();
  const doc = await adaptateurXlsx.ouvrir(avant);
  doc.fournirRessources?.(ressources());
  return { avant, doc };
}

describe("poser une image sur une feuille", () => {
  it("les six pièces sont là, et la relation d'image vit dans le DESSIN", async () => {
    const { doc } = await classeur();
    const effet = doc.appliquer(commande("xlsx.inserer_image", {
      feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 6,
    }));
    expect(effet.ok, effet.motif ?? "").toBe(true);

    const p = pieces(await doc.serialiser());
    expect([...p.keys()].filter((k) => k.startsWith("xl/media/"))).toHaveLength(1);
    expect(p.get("[Content_Types].xml")).toContain('Extension="png"');
    expect(p.get("[Content_Types].xml")).toContain("drawing+xml");
    expect(p.has("xl/drawings/drawing1.xml")).toBe(true);
    // La relation vers les OCTETS appartient au dessin…
    expect(p.get("xl/drawings/_rels/drawing1.xml.rels") ?? "").toContain("../media/image1.png");
    // …et la feuille ne connaît que le DESSIN.
    const relsFeuille = p.get("xl/worksheets/_rels/sheet1.xml.rels") ?? "";
    expect(relsFeuille).toContain("../drawings/drawing1.xml");
    expect(relsFeuille, "la feuille pointe directement les octets — l'image s'affichera vide")
      .not.toContain("../media/");
    expect(p.get("xl/worksheets/sheet1.xml") ?? "").toContain("<drawing");
  });

  it("l'ancrage est la CELLULE demandée, en numérotation humaine", async () => {
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "C4", imageSource: REF, largeurCm: 6 }));
    const dessin = pieces(await doc.serialiser()).get("xl/drawings/drawing1.xml") ?? "";
    // C4 : troisième colonne, quatrième ligne — 0-indexées dans le fichier (§104.4).
    expect(dessin).toMatch(/<xdr:col>2<\/xdr:col>/);
    expect(dessin).toMatch(/<xdr:row>3<\/xdr:row>/);

    const m = doc.modele() as XlsxModel;
    expect(m.sheets[0].images).toHaveLength(1);
    expect(m.sheets[0].images[0].anchorRef).toBe("C4");
    expect(m.sheets[0].images[0].widthCm).toBeCloseTo(6, 1);
    // 600 × 300 → rapport 2 : 6 cm de large font 3 cm de haut.
    expect(m.sheets[0].images[0].heightCm).toBeCloseTo(3, 1);
  });

  it("sans taille demandée, l'image est bornée à la ZONE D'IMPRESSION déclarée", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : poser la taille naturelle. Une capture de 1920 px fait
     * 50 cm ; à l'écran, une feuille n'a pas de bord et rien ne se voit — mais le classeur
     * s'imprime, et l'image sort de la page. La borne vient du fichier lui-même
     * (`pageSetup` + `pageMargins`), pas d'un nombre choisi au hasard.
     */
    const { doc } = await classeur(await xlsxAvecTableau());
    doc.fournirRessources?.(ressources(pngUni(4000, 2000), "affiche.png"));
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Suivi", imageSource: REF }));
    const img = (doc.modele() as XlsxModel).sheets[0].images[0];
    // A4 portrait, marges 0,7 pouce de chaque côté : 21 − 2 × 1,778 = 17,44 cm.
    expect(img.widthCm).toBeCloseTo(17.44, 1);
    expect(img.heightCm).toBeCloseTo(8.72, 1);
  });

  it("une feuille qui porte un TABLEAU STRUCTURÉ le garde — `<drawing>` s'insère avant", async () => {
    const { doc } = await classeur(await xlsxAvecTableau());
    const effet = doc.appliquer(commande("xlsx.inserer_image", {
      feuille: "Suivi", plage: "D2", imageSource: REF, largeurCm: 5,
    }));
    expect(effet.ok, effet.motif ?? "").toBe(true);

    const xml = pieces(await doc.serialiser()).get("xl/worksheets/sheet1.xml") ?? "";
    expect(xml).toContain("<tableParts");
    expect(xml.indexOf("<drawing"), "drawing après tableParts : Excel « répare » et perd le tableau")
      .toBeLessThan(xml.indexOf("<tableParts"));
    // Et l'ordre du schéma tient aussi du côté gauche : `<drawing>` reste après `pageSetup`.
    expect(xml.indexOf("<pageSetup")).toBeLessThan(xml.indexOf("<drawing"));
    expect(p1SansImage(xml)).toBe(true);
  });

  it("une SECONDE image se pose dans le MÊME dessin — jamais dans un second", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : `prochainDessin` appelé sans regarder ce que la feuille
     * référence déjà. Le second `<drawing r:id>` remplacerait le premier, et l'image posée
     * hier disparaîtrait à l'insertion d'aujourd'hui — sans erreur, sans trace.
     */
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 4 }));
    doc.fournirRessources?.(ressources(pngUni(200, 200), "cachet.png"));
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E10", imageSource: REF, largeurCm: 3 }));

    const p = pieces(await doc.serialiser());
    expect([...p.keys()].filter((k) => k.startsWith("xl/drawings/drawing"))).toHaveLength(1);
    expect([...p.keys()].filter((k) => k.startsWith("xl/media/"))).toHaveLength(2);
    const xml = p.get("xl/worksheets/sheet1.xml") ?? "";
    expect(xml.match(/<drawing /g) ?? []).toHaveLength(1);

    const m = doc.modele() as XlsxModel;
    expect(m.sheets[0].images.map((i) => i.anchorRef)).toEqual(["E2", "E10"]);
  });

  it("les AUTRES feuilles ne sont pas touchées", async () => {
    const { avant, doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 5 }));
    const a = pieces(avant);
    const b = pieces(await doc.serialiser());
    expect(b.get("xl/worksheets/sheet2.xml")).toBe(a.get("xl/worksheets/sheet2.xml"));
    expect((doc.modele() as XlsxModel).sheets[1].images).toHaveLength(0);
  });

  it("le reste du classeur est INTACT, pièce par pièce", async () => {
    const { avant, doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 5 }));
    const a = pieces(avant);
    const b = pieces(await doc.serialiser());
    /**
     * LA LISTE EST COURTE EXPRÈS. Poser une image touche la feuille visée, ses relations et la
     * table des types — rien d'autre. Y ajouter `xl/workbook.xml` ou `xl/styles.xml` « parce
     * qu'ils sont resérialisés » désarmerait le test : c'est justement une resérialisation qui
     * PERD ce qu'elle ne modélise pas, et c'est le défaut que ce fichier existe pour attraper.
     */
    const touchees = new Set([
      "xl/worksheets/sheet1.xml", "xl/worksheets/_rels/sheet1.xml.rels", "[Content_Types].xml",
    ]);
    for (const [nom, contenu] of a) {
      if (touchees.has(nom)) continue;
      expect(b.get(nom), `${nom} a été réécrit alors qu'on n'y touchait pas`).toBe(contenu);
    }
    // Les cellules, elles, doivent être rigoureusement les mêmes.
    const m = doc.modele() as XlsxModel;
    expect(m.sheets[0].cells.find((c) => c.ref === "C6")?.formula).toBe("=SUM(C2:C5)");
    expect(m.sheets[0].cells.find((c) => c.ref === "A2")?.value).toBe("Amoxival");
  });

  it("le classeur reste OUVRABLE", async () => {
    const { doc } = await classeur(await xlsxAvecTableau());
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Suivi", plage: "D2", imageSource: REF, largeurCm: 5 }));
    expect((await doc.valider()).problemes).toEqual([]);
  });
});

/** Le `sheet1.xml` ne doit contenir AUCUN `a:blip` : l'image vit dans le dessin, pas dans la feuille. */
function p1SansImage(xml: string): boolean {
  return !xml.includes("a:blip") && !xml.includes("xdr:pic");
}

describe("ce qu'Excel refuse", () => {
  it("une source illisible est nommée, et rien n'est posé", async () => {
    const { avant, doc } = await classeur();
    const effet = doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", imageSource: "inconnue" }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("inconnue");
    expect(pieces(await doc.serialiser()).size).toBe(pieces(avant).size);
  });

  it("un fichier qui n'est pas une image dit les formats acceptés", async () => {
    const { doc } = await classeur();
    doc.fournirRessources?.(ressources(Buffer.from("Ceci est un texte, pas une image"), "note.txt"));
    const effet = doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", imageSource: REF }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("PNG");
  });

  it("sans source, le compilateur refuse AVANT de toucher au fichier", () => {
    const r = compilerCommandes([commande("xlsx.inserer_image", { feuille: "Ventes", plage: "B2" })], "XLSX");
    expect(r.commandes).toHaveLength(0);
    expect(r.refus[0].motif).toContain("QUELLE image");
  });

  it("une cellule d'ancrage absurde est refusée, et le refus dit ce qui est attendu", () => {
    const r = compilerCommandes([commande("xlsx.inserer_image", { plage: "quelque part", imageSource: REF })], "XLSX");
    expect(r.commandes).toHaveLength(0);
    expect(r.refus[0].motif).toContain("B2");
  });

  it("remplacer sans dire QUOI est refusé par le compilateur", () => {
    const r = compilerCommandes([commande("xlsx.remplacer_image", { feuille: "Ventes", imageSource: REF })], "XLSX");
    expect(r.commandes).toHaveLength(0);
    expect(r.refus[0].motif).toContain("QUELLE image");
  });

  it("une feuille sans aucune image le dit — jamais « c'est fait »", async () => {
    const { doc } = await classeur();
    const effet = doc.appliquer(commande("xlsx.remplacer_image", {
      feuille: "Ventes", cible: cibleIndex(1), imageSource: REF,
    }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("aucune image");
  });

  it("deux images pour une même désignation : on rend les CANDIDATS, on ne choisit pas", async () => {
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 4 }));
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E12", imageSource: REF, largeurCm: 4 }));
    const effet = doc.appliquer(commande("xlsx.supprimer_image", { feuille: "Ventes", cible: cibleTexte("logo") }));
    expect(effet.ok).toBe(false);
    expect(effet.candidats).toHaveLength(2);
    expect(effet.candidats.map((c) => c.libelle)).toEqual([
      "logo Adventum.png (E2)", "logo Adventum.png (E12)",
    ]);
  });
});

describe("remplacer et supprimer une image de feuille", () => {
  it("remplacer garde la cellule et la taille, et ne change que les octets", async () => {
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 8 }));
    const avantImg = (doc.modele() as XlsxModel).sheets[0].images[0];
    const rIdAvant = /r:embed="(rId\d+)"/.exec(pieces(await doc.serialiser()).get("xl/drawings/drawing1.xml") ?? "")?.[1];

    doc.fournirRessources?.(new Map([["neuf", { octets: pngUni(400, 200), nom: "logo-2027.png" }]]));
    const effet = doc.appliquer(commande("xlsx.remplacer_image", {
      feuille: "Ventes", cible: cibleIndex(1), imageSource: "neuf",
    }));
    expect(effet.ok, effet.motif ?? "").toBe(true);

    const apresImg = (doc.modele() as XlsxModel).sheets[0].images[0];
    expect(apresImg.anchorRef).toBe(avantImg.anchorRef);
    expect(apresImg.widthCm).toBeCloseTo(avantImg.widthCm, 3);
    expect(apresImg.heightCm).toBeCloseTo(avantImg.heightCm, 3);
    const p = pieces(await doc.serialiser());
    const rIdApres = /r:embed="(rId\d+)"/.exec(p.get("xl/drawings/drawing1.xml") ?? "")?.[1];
    expect(rIdApres).not.toBe(rIdAvant);
    expect([...p.keys()].filter((k) => k.startsWith("xl/media/"))).toHaveLength(2);
  });

  it("remplacer par une image d'un AUTRE rapport le dit au lieu de le corriger en silence", async () => {
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 8 }));
    doc.fournirRessources?.(new Map([["carre", { octets: pngUni(300, 300), nom: "cachet.png" }]]));
    const effet = doc.appliquer(commande("xlsx.remplacer_image", {
      feuille: "Ventes", cible: cibleIndex(1), imageSource: "carre",
    }));
    expect(effet.ok).toBe(true);
    expect(effet.resume).toMatch(/proportions/);
  });

  it("supprimer retire l'ANCRAGE entier, et la feuille cesse de renvoyer au dessin", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : retirer le seul `xdr:pic`. L'ancrage vide reste un objet
     * pour Excel, qui « répare » le classeur à l'ouverture — un avertissement rouge sur un
     * fichier qu'on vient d'envoyer.
     */
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 5 }));
    const effet = doc.appliquer(commande("xlsx.supprimer_image", { feuille: "Ventes", cible: cibleIndex(1) }));
    expect(effet.ok, effet.motif ?? "").toBe(true);
    expect(effet.resume).toContain("E2");

    const p = pieces(await doc.serialiser());
    const dessin = p.get("xl/drawings/drawing1.xml") ?? "";
    expect(dessin).not.toContain("xdr:pic");
    expect(dessin).not.toContain("xdr:oneCellAnchor");
    expect(p.get("xl/worksheets/sheet1.xml") ?? "").not.toContain("<drawing");
    expect((doc.modele() as XlsxModel).sheets[0].images).toHaveLength(0);
    expect((await doc.valider()).problemes).toEqual([]);
  });

  it("supprimer UNE image sur deux laisse l'autre en place", async () => {
    const { doc } = await classeur();
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: REF, largeurCm: 4 }));
    doc.fournirRessources?.(new Map([["cachet", { octets: pngUni(200, 200), nom: "cachet.png" }]]));
    doc.appliquer(commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E12", imageSource: "cachet", largeurCm: 3 }));

    const effet = doc.appliquer(commande("xlsx.supprimer_image", { feuille: "Ventes", cible: cibleTexte("cachet") }));
    expect(effet.ok, effet.motif ?? "").toBe(true);
    const restantes = (doc.modele() as XlsxModel).sheets[0].images;
    expect(restantes).toHaveLength(1);
    expect(restantes[0].name).toBe("logo Adventum.png");
    expect(restantes[0].anchorRef).toBe("E2");
    expect(pieces(await doc.serialiser()).get("xl/worksheets/sheet1.xml") ?? "").toContain("<drawing");
  });
});
