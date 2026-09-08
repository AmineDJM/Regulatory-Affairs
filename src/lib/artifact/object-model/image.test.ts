import { describe, expect, it } from "vitest";
import { lireImage, tailleInsertion } from "./image";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'EN-TÊTE D'UNE IMAGE, LU SANS DÉCODEUR.
 *
 * Les octets sont FABRIQUÉS ici, à la main : un test qui lirait un fichier d'exemple
 * vérifierait que le disque contient ce qu'on y a mis, pas que le lecteur lit ce qu'il faut. Ce
 * qu'on veut prouver, c'est que chaque format range ses dimensions là où l'on croit — et
 * qu'aucun n'est lu à la place d'un autre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function png(l: number, h: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(l, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

function jpeg(l: number, h: number, avecSegmentAvant = true): Buffer {
  const morceaux: Buffer[] = [Buffer.from([0xff, 0xd8])];
  if (avecSegmentAvant) {
    // Un APP0 (JFIF) de 16 octets — le cas normal, et celui qui fait échouer un lecteur naïf
    // qui chercherait le SOF0 à un décalage fixe.
    const app0 = Buffer.alloc(18);
    app0.writeUInt8(0xff, 0); app0.writeUInt8(0xe0, 1); app0.writeUInt16BE(16, 2);
    app0.write("JFIF\0", 4, "latin1");
    morceaux.push(app0);
  }
  const sof = Buffer.alloc(11);
  sof.writeUInt8(0xff, 0); sof.writeUInt8(0xc0, 1); sof.writeUInt16BE(9, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(l, 7);
  morceaux.push(sof);
  return Buffer.concat(morceaux);
}

function gif(l: number, h: number): Buffer {
  const b = Buffer.alloc(16);
  b.write("GIF89a", 0, "latin1");
  b.writeUInt16LE(l, 6);
  b.writeUInt16LE(h, 8);
  return b;
}

function bmp(l: number, h: number): Buffer {
  const b = Buffer.alloc(30);
  b.write("BM", 0, "latin1");
  b.writeInt32LE(l, 18);
  // Hauteur NÉGATIVE : le cas d'un bitmap « à l'endroit », très courant sur les captures.
  b.writeInt32LE(-h, 22);
  return b;
}

describe("lireImage", () => {
  it("PNG : largeur et hauteur en gros-boutiste, après l'IHDR", () => {
    const i = lireImage(png(1200, 630));
    expect(i?.type).toBe("png");
    expect([i?.largeurPx, i?.hauteurPx]).toEqual([1200, 630]);
    expect(i?.mime).toBe("image/png");
  });

  it("JPEG : le SOF n'est PAS à un décalage fixe — on parcourt les segments", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : lire les dimensions à un décalage constant. Presque tous
     * les JPEG portent un APP0 ou un EXIF avant leur trame ; un lecteur naïf marcherait sur
     * l'exemple minimal et rendrait n'importe quoi sur une photo réelle.
     */
    const i = lireImage(jpeg(4032, 3024));
    expect(i?.type).toBe("jpeg");
    expect([i?.largeurPx, i?.hauteurPx]).toEqual([4032, 3024]);
    // Et hauteur AVANT largeur dans le segment : les inverser donne une photo en portrait.
    expect(lireImage(jpeg(800, 600, false))?.largeurPx).toBe(800);
  });

  it("GIF et BMP : petit-boutiste, et une hauteur négative reste une hauteur", () => {
    expect(lireImage(gif(320, 240))?.hauteurPx).toBe(240);
    const b = lireImage(bmp(1024, 768));
    expect(b?.type).toBe("bmp");
    expect([b?.largeurPx, b?.hauteurPx]).toEqual([1024, 768]);
  });

  it("la taille naturelle est en 96 ppp — la convention OOXML, pas une supposition", () => {
    const i = lireImage(png(96, 48));
    expect(i?.largeurCm).toBeCloseTo(2.54, 5);
    expect(i?.hauteurCm).toBeCloseTo(1.27, 5);
  });

  it("rend `null` sur ce qu'on ne reconnaît pas À COUP SÛR", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : un repli « c'est sûrement du PNG ». On écrirait des octets
     * d'un type inconnu dans un `.docx` en les déclarant PNG, et Word annoncerait un document
     * ENDOMMAGÉ — c'est-à-dire le document de quelqu'un, cassé, par une supposition.
     */
    expect(lireImage(Buffer.from("ceci n'est pas une image du tout"))).toBeNull();
    expect(lireImage(Buffer.alloc(4))).toBeNull();
    // Un PNG dont l'en-tête annonce une largeur nulle est un fichier cassé, pas une image plate.
    expect(lireImage(png(0, 100))).toBeNull();
  });

  it("un JPEG TRONQUÉ ne rend pas une dimension inventée", () => {
    const coupe = jpeg(800, 600).subarray(0, 20);
    expect(lireImage(coupe)).toBeNull();
  });
});

describe("tailleInsertion", () => {
  const img = lireImage(png(1000, 500))!;

  it("une seule dimension donnée CONSERVE le rapport", () => {
    expect(tailleInsertion(img, { largeurCm: 8 }, 16).hauteurCm).toBeCloseTo(4, 5);
    expect(tailleInsertion(img, { hauteurCm: 3 }, 16).largeurCm).toBeCloseTo(6, 5);
  });

  it("les deux données sont respectées — c'est une demande, pas une suggestion", () => {
    expect(tailleInsertion(img, { largeurCm: 5, hauteurCm: 9 }, 16)).toEqual({ largeurCm: 5, hauteurCm: 9 });
  });

  it("rien de donné : la taille naturelle, BORNÉE par la largeur utile", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : insérer une capture d'écran de 1920 px à sa taille
     * naturelle — 50,8 cm. Elle sortirait de la page, et un document dont l'image dépasse la
     * marge est un document abîmé qu'il faut reprendre à la main.
     */
    const capture = lireImage(png(1920, 1080))!;
    const t = tailleInsertion(capture, {}, 16);
    expect(t.largeurCm).toBe(16);
    expect(t.hauteurCm).toBeCloseTo(9, 5);

    // Une petite image, elle, garde sa taille : la borne est un plafond, pas un étirement.
    const petite = lireImage(png(200, 100))!;
    expect(tailleInsertion(petite, {}, 16).largeurCm).toBeCloseTo(200 / (96 / 2.54), 5);
  });
});
