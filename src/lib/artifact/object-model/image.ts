/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UNE IMAGE DIT D'ELLE-MÊME — module PUR, aucune dépendance.
 *
 * ── POURQUOI PAS `sharp`, QUI EST DÉJÀ DANS LE DÉPÔT ────────────────────────────────────
 *
 * Parce qu'on ne DÉCODE rien : on veut le type et les dimensions, et les deux sont écrits en
 * clair dans les premiers octets du fichier. Charger un décodeur natif pour lire un en-tête
 * coûterait un démarrage à froid et ferait entrer un paquet Node-only dans une chaîne d'import
 * que le garde de paquet client surveille (`client-bundle-guard`). Trente lignes d'en-tête
 * valent mieux qu'une dépendance.
 *
 * ── POURQUOI LES DIMENSIONS COMPTENT, ET PAS SEULEMENT LE TYPE ──────────────────────────
 *
 * « Insère le logo » ne dit pas la taille. Sans le RAPPORT de l'image, l'insertion choisit une
 * hauteur au hasard : le logo entre écrasé ou étiré, et personne ne peut dire pourquoi. Avec le
 * rapport, une largeur suffit — la hauteur s'en déduit, et l'image entre comme elle est.
 *
 * ── CE QU'ON REFUSE, ET POURQUOI C'EST UN REFUS ET NON UN DÉFAUT ────────────────────────
 *
 * Un format qu'on ne reconnaît pas à coup sûr rend `null`. Word et PowerPoint acceptent un
 * nombre limité de types ; y glisser des octets d'un type qu'on n'a pas su nommer produit un
 * fichier que le lecteur signale comme endommagé — c'est-à-dire le document de quelqu'un,
 * cassé. Un refus qui nomme le type manquant se répare ; un fichier corrompu, non.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les types que l'OOXML accepte sans conversion — et qu'on sait donc insérer tels quels. */
export const TYPES_IMAGE = ["png", "jpeg", "gif", "bmp", "tiff", "webp"] as const;
export type TypeImage = (typeof TYPES_IMAGE)[number];

export interface ImageLue {
  type: TypeImage;
  /** L'extension à donner à la partie du zip (`image3.png`) — jamais celle du nom d'origine. */
  extension: string;
  mime: string;
  largeurPx: number;
  hauteurPx: number;
  /**
   * La taille « naturelle » en centimètres, à 96 points par pouce.
   *
   * Word raisonne en EMU et n'a aucune idée de la densité voulue : 96 ppp est la convention de
   * l'OOXML et celle de tous les écrans par défaut. Une capture de 1920 px entre donc en
   * 50,8 cm — trop large pour une page, et c'est bien pour cela qu'on demande une largeur.
   */
  largeurCm: number;
  hauteurCm: number;
}

const MIMES: Record<TypeImage, string> = {
  png: "image/png", jpeg: "image/jpeg", gif: "image/gif",
  bmp: "image/bmp", tiff: "image/tiff", webp: "image/webp",
};

/** 96 points par pouce, 2,54 cm par pouce — la convention OOXML, écrite une fois. */
const PX_PAR_CM = 96 / 2.54;

function fini(type: TypeImage, largeurPx: number, hauteurPx: number, extension = type): ImageLue | null {
  if (!Number.isFinite(largeurPx) || !Number.isFinite(hauteurPx) || largeurPx <= 0 || hauteurPx <= 0) return null;
  return {
    type, extension, mime: MIMES[type],
    largeurPx, hauteurPx,
    largeurCm: largeurPx / PX_PAR_CM,
    hauteurCm: hauteurPx / PX_PAR_CM,
  };
}

/**
 * LIT L'EN-TÊTE. Rend `null` sur tout ce qu'on ne reconnaît pas À COUP SÛR (§104.5).
 *
 * Les tailles minimales sont vérifiées avant chaque lecture : un fichier tronqué ne doit pas
 * produire une dimension lue au-delà de sa fin, qui vaudrait `0` et passerait pour une image
 * plate au lieu d'un fichier cassé.
 */
export function lireImage(octets: Buffer): ImageLue | null {
  // Le plancher est celui de la plus petite SIGNATURE qu'on sache lire ; chaque branche
  // vérifie ensuite la longueur dont ELLE a besoin. Un plancher plus haut refuserait un
  // fichier valide court, et un plancher plus bas ferait lire un octet manquant.
  if (octets.length < 8) return null;

  // ── PNG : signature de 8 octets, puis IHDR (largeur, hauteur en gros-boutiste).
  if (octets.length >= 24
    && octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47
    && octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a) {
    return fini("png", octets.readUInt32BE(16), octets.readUInt32BE(20));
  }

  // ── GIF : « GIF87a » / « GIF89a », puis largeur/hauteur en petit-boutiste.
  if (octets.length >= 10 && octets.toString("latin1", 0, 3) === "GIF") {
    return fini("gif", octets.readUInt16LE(6), octets.readUInt16LE(8));
  }

  // ── BMP : « BM », puis l'en-tête DIB (entiers SIGNÉS : une hauteur négative dit « à
  //    l'endroit », et c'est sa valeur absolue qui est la hauteur).
  if (octets.length >= 26 && octets[0] === 0x42 && octets[1] === 0x4d) {
    return fini("bmp", Math.abs(octets.readInt32LE(18)), Math.abs(octets.readInt32LE(22)));
  }

  // ── WEBP : conteneur RIFF. Trois variantes, et elles ne rangent pas les dimensions au
  //    même endroit — les confondre donnerait une taille plausible et fausse.
  if (octets.length >= 30
    && octets.toString("latin1", 0, 4) === "RIFF" && octets.toString("latin1", 8, 12) === "WEBP") {
    const variante = octets.toString("latin1", 12, 16);
    if (variante === "VP8 " && octets.length >= 30) {
      // Bloc-clé : 3 octets de marqueur, puis 14 bits de largeur et 14 de hauteur.
      return fini("webp", octets.readUInt16LE(26) & 0x3fff, octets.readUInt16LE(28) & 0x3fff);
    }
    if (variante === "VP8L" && octets.length >= 25) {
      const bits = octets.readUInt32LE(21);
      return fini("webp", (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (variante === "VP8X" && octets.length >= 30) {
      // Dimensions sur 24 bits, moins un — la seule variante qui les écrit ainsi.
      const l = octets[24] | (octets[25] << 8) | (octets[26] << 16);
      const h = octets[27] | (octets[28] << 8) | (octets[29] << 16);
      return fini("webp", l + 1, h + 1);
    }
    return null;
  }

  // ── TIFF : petit ou gros-boutiste, dimensions dans les étiquettes 256 et 257 de l'IFD.
  if (octets.length >= 8) {
    const petit = octets[0] === 0x49 && octets[1] === 0x49 && octets[2] === 0x2a && octets[3] === 0x00;
    const gros = octets[0] === 0x4d && octets[1] === 0x4d && octets[2] === 0x00 && octets[3] === 0x2a;
    if (petit || gros) return lireTiff(octets, petit);
  }

  // ── JPEG : suite de segments. On avance de segment en segment jusqu'au marqueur de trame
  //    (SOF0…SOF15, sauf les marqueurs qui n'en sont pas), qui porte hauteur puis largeur.
  if (octets[0] === 0xff && octets[1] === 0xd8) return lireJpeg(octets);

  return null;
}

function lireJpeg(octets: Buffer): ImageLue | null {
  let i = 2;
  while (i + 9 < octets.length) {
    if (octets[i] !== 0xff) { i += 1; continue; }
    const marqueur = octets[i + 1];
    // Les marqueurs sans charge utile : on les saute d'un octet, pas d'une longueur.
    if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) { i += 2; continue; }
    const longueur = octets.readUInt16BE(i + 2);
    if (longueur < 2) return null;
    const estTrame = marqueur >= 0xc0 && marqueur <= 0xcf
      && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
    if (estTrame) {
      if (i + 9 > octets.length) return null;
      return fini("jpeg", octets.readUInt16BE(i + 7), octets.readUInt16BE(i + 5), "jpeg");
    }
    i += 2 + longueur;
  }
  return null;
}

function lireTiff(octets: Buffer, petit: boolean): ImageLue | null {
  const u16 = (o: number) => (petit ? octets.readUInt16LE(o) : octets.readUInt16BE(o));
  const u32 = (o: number) => (petit ? octets.readUInt32LE(o) : octets.readUInt32BE(o));
  const debut = u32(4);
  if (debut + 2 > octets.length) return null;
  const n = u16(debut);
  let largeur = 0;
  let hauteur = 0;
  for (let k = 0; k < n; k++) {
    const e = debut + 2 + k * 12;
    if (e + 12 > octets.length) return null;
    const etiquette = u16(e);
    const typeChamp = u16(e + 2);
    // 3 = court (16 bits), 4 = long (32 bits). Tout autre type pour une dimension n'a pas de
    // sens, et le deviner donnerait une taille inventée.
    const valeur = typeChamp === 3 ? u16(e + 8) : typeChamp === 4 ? u32(e + 8) : NaN;
    if (etiquette === 256) largeur = valeur;
    if (etiquette === 257) hauteur = valeur;
  }
  return fini("tiff", largeur, hauteur);
}

/**
 * LA TAILLE D'INSERTION, à partir de ce que la personne a dit et de ce que l'image EST.
 *
 * Une seule dimension donnée conserve le rapport — étirer une photo est un défaut qu'aucun test
 * unitaire ne verrait et que tout le monde voit à l'écran. Rien de donné rend la taille
 * naturelle, BORNÉE par la largeur utile : une capture d'écran de 1920 px entre en 50 cm, donc
 * hors de la page, et un document dont l'image dépasse la marge est un document abîmé.
 */
export function tailleInsertion(
  img: ImageLue,
  demande: { largeurCm?: number | null; hauteurCm?: number | null },
  largeurUtileCm: number,
): { largeurCm: number; hauteurCm: number } {
  const rapport = img.hauteurPx / img.largeurPx;
  const l = demande.largeurCm ?? null;
  const h = demande.hauteurCm ?? null;

  if (l !== null && h !== null) return { largeurCm: l, hauteurCm: h };
  if (l !== null) return { largeurCm: l, hauteurCm: l * rapport };
  if (h !== null) return { largeurCm: h / rapport, hauteurCm: h };

  const largeur = Math.min(img.largeurCm, largeurUtileCm);
  return { largeurCm: largeur, hauteurCm: largeur * rapport };
}
