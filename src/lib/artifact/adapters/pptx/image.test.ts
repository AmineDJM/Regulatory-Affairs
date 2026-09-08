import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { cheminRels } from "@/lib/artifact/adapters/pptx/media";
import { pngUni, pptxDiapos } from "@/lib/artifact/adapters/fixtures";
import { cibleIndex, cibleTexte, commande } from "@/lib/artifact/commands/ir";
import { compilerCommandes } from "@/lib/artifact/commands/compile";
import type { PptxModel } from "@/lib/artifact/object-model/model";
import type { RessourceBinaire } from "@/lib/artifact/adapters/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE IMAGE SUR UNE DIAPOSITIVE — et le piège propre à PowerPoint.
 *
 * Word n'a qu'un fichier de relations ; PowerPoint en a UN PAR DIAPOSITIVE. Écrire la relation
 * dans le mauvais fichier ne casse RIEN de visible : le zip est valide, le XML est valide, et
 * PowerPoint affiche un cadre VIDE — ce qu'on découvre en présentant devant quelqu'un. Ces
 * tests vérifient donc que la relation atterrit dans `_rels` de LA diapositive visée.
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

async function deck(n = 4) {
  const avant = await pptxDiapos(n);
  const doc = await adaptateurPptx.ouvrir(avant);
  doc.fournirRessources?.(ressources());
  return { avant, doc };
}

describe("poser une image sur une diapositive", () => {
  it("la relation va dans les rels de LA diapositive visée, pas d'une autre", async () => {
    const { doc } = await deck(4);
    const effet = doc.appliquer(commande("pptx.inserer_image", {
      diapo: 3, imageSource: REF, largeurCm: 8,
    }));
    expect(effet.ok, effet.motif ?? "").toBe(true);

    const p = pieces(await doc.serialiser());
    const relsDiapo3 = p.get(cheminRels("ppt/slides/slide3.xml")) ?? "";
    expect(relsDiapo3).toContain("relationships/image");
    expect(relsDiapo3).toContain("../media/");

    // Les AUTRES diapositives ne portent aucune relation d'image : l'empreinte ne dépasse pas
    // la demande.
    for (const n of [1, 2, 4]) {
      expect(p.get(cheminRels(`ppt/slides/slide${n}.xml`)) ?? "", `diapo ${n} touchée`)
        .not.toContain("relationships/image");
    }
  });

  it("l'image devient une FORME de la diapositive, avec sa place et sa taille", async () => {
    const { doc } = await deck(2);
    doc.appliquer(commande("pptx.inserer_image", { diapo: 1, imageSource: REF, largeurCm: 10 }));
    const m = doc.modele() as PptxModel;
    const images = m.slides[0].shapes.filter((s) => s.role === "picture");
    expect(images).toHaveLength(1);
    expect(images[0].widthCm).toBeCloseTo(10, 1);
    // 600 × 300 → rapport 2 : 10 cm de large font 5 cm de haut.
    expect(images[0].heightCm).toBeCloseTo(5, 1);
    // CENTRÉE, faute de position demandée : un coin par défaut recouvre le titre une fois sur deux.
    expect(images[0].xCm).toBeCloseTo((m.slideWidthCm - 10) / 2, 1);
  });

  it("une image trop grande est BORNÉE à la diapositive — sinon elle est coupée à la projection", async () => {
    const { doc } = await deck(1);
    doc.fournirRessources?.(ressources(pngUni(4000, 3000), "affiche.png"));
    doc.appliquer(commande("pptx.inserer_image", { diapo: 1, imageSource: REF }));
    const m = doc.modele() as PptxModel;
    const img = m.slides[0].shapes.find((s) => s.role === "picture")!;
    expect(img.widthCm).toBeLessThanOrEqual(m.slideWidthCm + 0.01);
    expect(img.heightCm).toBeLessThanOrEqual(m.slideHeightCm + 0.01);
  });

  it("le reste de la présentation est INTACT, pièce par pièce", async () => {
    const { avant, doc } = await deck(3);
    doc.appliquer(commande("pptx.inserer_image", { diapo: 2, imageSource: REF, largeurCm: 6 }));
    const apres = await doc.serialiser();

    const a = pieces(avant);
    const b = pieces(apres);
    const nouvelles = [...b.keys()].filter((k) => !a.has(k));
    expect(nouvelles.filter((k) => k.startsWith("ppt/media/"))).toHaveLength(1);

    for (const [nom, contenu] of a) {
      if (nom === "ppt/slides/slide2.xml") continue;
      if (nom === cheminRels("ppt/slides/slide2.xml")) continue;
      if (nom === "[Content_Types].xml") continue;
      expect(b.get(nom), `${nom} a été réécrit alors qu'on n'y touchait pas`).toBe(contenu);
    }
  });

  it("la présentation reste OUVRABLE", async () => {
    const { doc } = await deck(2);
    doc.appliquer(commande("pptx.inserer_image", { diapo: 1, imageSource: REF, largeurCm: 6 }));
    const v = await doc.valider();
    expect(v.problemes).toEqual([]);
  });
});

describe("ce que PowerPoint refuse", () => {
  it("une diapositive qui n'existe pas est refusée AVANT de toucher au fichier", async () => {
    const { avant, doc } = await deck(2);
    const effet = doc.appliquer(commande("pptx.inserer_image", { diapo: 9, imageSource: REF }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("2 diapositives");
    expect(pieces(await doc.serialiser()).size).toBe(pieces(avant).size);
  });

  it("sans numéro de diapositive, le compilateur refuse : « mets le logo » ne dit pas OÙ", () => {
    const r = compilerCommandes([commande("pptx.inserer_image", { imageSource: REF })], "PPTX");
    expect(r.commandes).toHaveLength(0);
    expect(r.refus[0].motif).toContain("QUELLE diapositive");
  });

  it("remplacer une forme qui n'est PAS une image dit ce qu'elle est", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : glisser un `a:blip` dans un cadre de graphique. PowerPoint
     * « répare » la diapositive à l'ouverture — en perdant le graphique. On refuse, et l'on
     * nomme ce qu'on a trouvé à la place.
     */
    const { doc } = await deck(2);
    const effet = doc.appliquer(commande("pptx.remplacer_image", {
      diapo: 1, cible: cibleIndex(1), imageSource: REF,
    }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toMatch(/n'est pas une image/);
  });
});

describe("remplacer une image de diapositive", () => {
  it("garde la place et la taille, et ne change que les octets", async () => {
    const { doc } = await deck(2);
    doc.appliquer(commande("pptx.inserer_image", { diapo: 1, imageSource: REF, largeurCm: 8 }));
    const avantM = doc.modele() as PptxModel;
    const img = avantM.slides[0].shapes.find((s) => s.role === "picture")!;
    const rIdAvant = /r:embed="(rId\d+)"/.exec(pieces(await doc.serialiser()).get("ppt/slides/slide1.xml") ?? "")?.[1];
    expect(rIdAvant).toBeTruthy();

    doc.fournirRessources?.(new Map([["neuf", { octets: pngUni(300, 150), nom: "logo-2027.png" }]]));
    const effet = doc.appliquer(commande("pptx.remplacer_image", {
      diapo: 1, cible: cibleTexte("logo"), imageSource: "neuf",
    }));
    expect(effet.ok, effet.motif ?? "").toBe(true);

    const apresM = doc.modele() as PptxModel;
    const img2 = apresM.slides[0].shapes.find((s) => s.role === "picture")!;
    expect(img2.widthCm).toBeCloseTo(img.widthCm, 3);
    expect(img2.xCm).toBeCloseTo(img.xCm, 3);
    const rIdApres = /r:embed="(rId\d+)"/.exec(pieces(await doc.serialiser()).get("ppt/slides/slide1.xml") ?? "")?.[1];
    expect(rIdApres).not.toBe(rIdAvant);
  });
});
