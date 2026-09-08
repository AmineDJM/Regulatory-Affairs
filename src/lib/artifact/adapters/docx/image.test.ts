import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { docxDeParagraphes, pngUni } from "@/lib/artifact/adapters/fixtures";
import { cibleIndex, cibleTexte, commande } from "@/lib/artifact/commands/ir";
import { compilerCommandes } from "@/lib/artifact/commands/compile";
import type { DocxModel } from "@/lib/artifact/object-model/model";
import type { RessourceBinaire } from "@/lib/artifact/adapters/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * POSER UNE IMAGE DANS UN VRAI `.docx` — les quatre endroits, et ce qui se passe quand un
 * seul manque.
 *
 * ── POURQUOI CES TESTS REGARDENT LE ZIP, ET PAS SEULEMENT LE MODÈLE ─────────────────────
 *
 * Parce qu'un document dont le modèle annonce une image et dont `[Content_Types].xml` ne
 * déclare pas le type PNG est un fichier que Word ouvre en annonçant « document endommagé ».
 * Le modèle serait juste, le test au vert, et le fichier inutilisable chez le destinataire.
 * On vérifie donc les OCTETS : la partie média, le type déclaré, la relation, et le lien du
 * dessin vers cette relation.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const REF = "drive-node-logo";
const LOGO = pngUni(300, 150);

function ressources(octets = LOGO, nom = "logo-adventum.png"): Map<string, RessourceBinaire> {
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

async function docAvecImage() {
  const avant = await docxDeParagraphes(["Contrat de consulting", "Article 1", "Article 2"], {
    premierEstTitre: true,
  });
  const doc = await adaptateurDocx.ouvrir(avant);
  doc.fournirRessources?.(ressources());
  return { avant, doc };
}

describe("insérer une image dans un Word", () => {
  it("pose les QUATRE pièces : les octets, le type, la relation, et le dessin qui les relie", async () => {
    const { doc } = await docAvecImage();
    const effet = doc.appliquer(commande("docx.inserer_image", { imageSource: REF, largeurCm: 6 }));
    expect(effet.ok, effet.motif ?? "").toBe(true);

    const apres = await doc.serialiser();
    const p = pieces(apres);

    // 1. les OCTETS
    const media = [...p.keys()].filter((k) => k.startsWith("word/media/"));
    expect(media).toHaveLength(1);
    expect(new PizZip(apres).file(media[0])!.asUint8Array().length).toBe(LOGO.length);

    // 2. le TYPE — sans lui, Word annonce un document endommagé
    expect(p.get("[Content_Types].xml")).toContain('Extension="png"');
    expect(p.get("[Content_Types].xml")).toContain('ContentType="image/png"');

    // 3. la RELATION
    const rels = p.get("word/_rels/document.xml.rels") ?? "";
    expect(rels).toContain("relationships/image");
    expect(rels).toContain('Target="media/image1.png"');
    const rId = /Id="(rId\d+)"[^>]*relationships\/image/.exec(rels)?.[1]
      ?? /relationships\/image[^>]*Id="(rId\d+)"/.exec(rels)?.[1]
      ?? /<Relationship Id="(rId\d+)"[^>]*Type="[^"]*relationships\/image"/.exec(rels)?.[1];
    expect(rId, "aucune relation d'image dans les rels").toBeTruthy();

    // 4. le DESSIN, qui pointe vers CETTE relation — et pas vers un `rId` inventé
    const document = p.get("word/document.xml") ?? "";
    expect(document).toContain("<w:drawing>");
    expect(document).toContain(`r:embed="${rId}"`);
  });

  it("la taille respecte le RAPPORT de l'image : une largeur suffit", async () => {
    const { doc } = await docAvecImage();
    doc.appliquer(commande("docx.inserer_image", { imageSource: REF, largeurCm: 6 }));
    const img = (doc.modele() as DocxModel).images[0];
    expect(img.widthCm).toBeCloseTo(6, 1);
    // 300 × 150 → rapport 2 : une largeur de 6 cm donne 3 cm de haut, jamais 6.
    expect(img.heightCm).toBeCloseTo(3, 1);
  });

  it("sans taille demandée, l'image ne DÉBORDE pas de la page", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : insérer à la taille naturelle. Une capture de 1920 px
     * entre en 50,8 cm — hors de la page A4, dont la largeur utile est ici de 18 cm. Le
     * document s'ouvre, et son image sort de la marge : il faut le reprendre à la main.
     */
    const avant = await docxDeParagraphes(["Rapport"]);
    const doc = await adaptateurDocx.ouvrir(avant);
    doc.fournirRessources?.(ressources(pngUni(1920, 1080), "capture.png"));
    expect(doc.appliquer(commande("docx.inserer_image", { imageSource: REF })).ok).toBe(true);
    const m = doc.modele() as DocxModel;
    const utile = m.pageWidthCm - m.marginLeftCm - m.marginRightCm;
    expect(m.images[0].widthCm).toBeLessThanOrEqual(utile + 0.01);
    expect(m.images[0].widthCm).toBeGreaterThan(utile - 0.5);
  });

  it("se place AVANT ou APRÈS le paragraphe visé, et se dit", async () => {
    const { doc } = await docAvecImage();
    const effet = doc.appliquer(commande("docx.inserer_image", {
      imageSource: REF, cible: cibleIndex(2), position: "avant", largeurCm: 4,
    }));
    expect(effet.ok).toBe(true);
    expect(effet.resume).toContain("avant");
    // ON LIT LA PIÈCE, PAS LE ZIP. Chercher du texte dans les octets d'une archive DEFLATE ne
    // trouve rien — et un test qui « ne trouve rien » ressemble à un test qui échoue pour la
    // bonne raison.
    const xml = pieces(await doc.serialiser()).get("word/document.xml") ?? "";
    const posImage = xml.indexOf("<w:drawing>");
    const posArticle = xml.indexOf("Article 1");
    expect(posImage).toBeGreaterThan(0);
    expect(posImage).toBeLessThan(posArticle);
  });

  it("le reste du fichier est INTACT, pièce par pièce", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : réécrire `styles.xml` ou `_rels/.rels` en passant. Le
     * document s'ouvrirait toujours — il aurait juste perdu ses styles, et personne ne saurait
     * quand. C'est le garde-fou de §104.2, appliqué au geste le plus intrusif du lot : celui
     * qui AJOUTE des pièces au zip.
     */
    const { avant, doc } = await docAvecImage();
    doc.appliquer(commande("docx.inserer_image", { imageSource: REF, largeurCm: 5 }));
    const apres = await doc.serialiser();

    const a = pieces(avant);
    const b = pieces(apres);
    // Trois pièces NOUVELLES au plus : le média, et rien d'autre — les rels et les types
    // existaient déjà.
    const nouvelles = [...b.keys()].filter((k) => !a.has(k));
    expect(nouvelles).toEqual(["word/media/image1.png"]);

    for (const [nom, contenu] of a) {
      if (nom === "word/document.xml") continue;
      if (nom === "word/_rels/document.xml.rels") continue;
      if (nom === "[Content_Types].xml") continue;
      expect(b.get(nom), `${nom} a été réécrit alors qu'on n'y touchait pas`).toBe(contenu);
    }
  });

  it("le document reste OUVRABLE — c'est ce que `valider` promet", async () => {
    const { doc } = await docAvecImage();
    doc.appliquer(commande("docx.inserer_image", { imageSource: REF, largeurCm: 5 }));
    const v = await doc.valider();
    expect(v.problemes).toEqual([]);
    expect(v.ok).toBe(true);
  });
});

describe("ce qu'une insertion REFUSE de faire", () => {
  it("une source illisible NOMME le fichier — et le document ne bouge pas", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : insérer un média vide « pour ne pas échouer ». Word
     * annoncerait un document endommagé, sur le contrat de quelqu'un, et le journal dirait
     * « image insérée ».
     */
    const avant = await docxDeParagraphes(["Contrat"]);
    const doc = await adaptateurDocx.ouvrir(avant);
    doc.fournirRessources?.(new Map());
    const effet = doc.appliquer(commande("docx.inserer_image", { imageSource: "drive-absent" }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("drive-absent");
    expect(pieces(await doc.serialiser()).size).toBe(pieces(avant).size);
  });

  it("des octets qui ne sont pas une image sont refusés, avec les formats acceptés", async () => {
    const avant = await docxDeParagraphes(["Contrat"]);
    const doc = await adaptateurDocx.ouvrir(avant);
    doc.fournirRessources?.(ressources(Buffer.from("ceci est un fichier texte"), "notes.txt"));
    const effet = doc.appliquer(commande("docx.inserer_image", { imageSource: REF }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("notes.txt");
    expect(effet.motif).toMatch(/PNG/);
  });
});

describe("remplacer une image", () => {
  async function docDeuxImages() {
    const avant = await docxDeParagraphes(["Contrat", "Article 1"]);
    const doc = await adaptateurDocx.ouvrir(avant);
    doc.fournirRessources?.(ressources());
    doc.appliquer(commande("docx.inserer_image", { imageSource: REF, largeurCm: 6 }));
    return doc;
  }

  it("garde la place et la TAILLE, et ne déplace que le lien vers les octets", async () => {
    const doc = await docDeuxImages();
    const avantXml = pieces(await doc.serialiser()).get("word/document.xml") ?? "";
    const rIdAvant = /r:embed="(rId\d+)"/.exec(avantXml)?.[1];
    expect(rIdAvant, "aucun lien d'image dans le document de départ").toBeTruthy();
    const tailleAvant = (doc.modele() as DocxModel).images[0].widthCm;

    doc.fournirRessources?.(new Map([["nouveau", { octets: pngUni(400, 200), nom: "logo-2027.png" }]]));
    const effet = doc.appliquer(commande("docx.remplacer_image", {
      cible: cibleIndex(1), imageSource: "nouveau",
    }));
    expect(effet.ok, effet.motif ?? "").toBe(true);
    expect(effet.resume).toContain("logo-2027.png");

    const apres = await doc.serialiser();
    const rIdApres = /r:embed="(rId\d+)"/.exec(pieces(apres).get("word/document.xml") ?? "")?.[1];
    expect(rIdApres).toBeTruthy();
    expect(rIdApres).not.toBe(rIdAvant);
    // La taille ne bouge PAS : « remplace le logo » ne dit pas « redimensionne-le ».
    expect((doc.modele() as DocxModel).images[0].widthCm).toBeCloseTo(tailleAvant, 3);

    /**
     * L'ANCIENNE PARTIE RESTE. On ne l'écrase pas : Word partage une même partie entre
     * plusieurs images quand on copie-colle, et l'écraser changerait toutes les occurrences
     * alors qu'on n'en a désigné qu'une (§118.48, l'empreinte ne dépasse pas la demande).
     */
    const media = [...pieces(apres).keys()].filter((k) => k.startsWith("word/media/"));
    expect(media).toHaveLength(2);
  });

  it("PRÉVIENT quand les proportions changent, au lieu de corriger dans le dos", async () => {
    const doc = await docDeuxImages();
    doc.fournirRessources?.(new Map([["carree", { octets: pngUni(500, 500), nom: "carre.png" }]]));
    const effet = doc.appliquer(commande("docx.remplacer_image", {
      cible: cibleIndex(1), imageSource: "carree",
    }));
    expect(effet.ok).toBe(true);
    expect(effet.resume).toMatch(/étirée|proportions/i);
  });

  it("sur une désignation AMBIGUË, rend des candidats — jamais « la première des deux »", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : choisir seul. Remplacer la mauvaise image en annonçant que
     * c'est fait est le défaut le plus coûteux de tout ce système (§104.7) : la personne
     * envoie le document, et découvre l'erreur chez son destinataire.
     */
    const doc = await docDeuxImages();
    doc.fournirRessources?.(ressources());
    doc.appliquer(commande("docx.inserer_image", { imageSource: REF, largeurCm: 3 }));
    expect((doc.modele() as DocxModel).images).toHaveLength(2);

    doc.fournirRessources?.(new Map([["neuf", { octets: pngUni(100, 100), nom: "neuf.png" }]]));
    // Les deux images portent le même texte de remplacement : « le logo » en désigne deux.
    const effet = doc.appliquer(commande("docx.remplacer_image", {
      cible: cibleTexte("logo"), imageSource: "neuf",
    }));
    expect(effet.ok).toBe(false);
    expect(effet.candidats.length).toBeGreaterThanOrEqual(2);
  });

  it("SANS cible, le refus vient du compilateur — avant même d'ouvrir le document", () => {
    /**
     * La garde vit en amont, et c'est mieux ainsi : « remplace l'image » sur un document qui en
     * a quatre n'en désigne aucune, et le dire AVANT d'appliquer évite d'avoir à défaire.
     */
    const r = compilerCommandes([commande("docx.remplacer_image", { imageSource: REF })], "DOCX");
    expect(r.commandes).toHaveLength(0);
    expect(r.refus[0].motif).toContain("QUELLE image");
  });
});
