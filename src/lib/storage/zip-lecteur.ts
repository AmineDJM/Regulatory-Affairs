import { inflateRaw } from "zlib";
import { promisify } from "util";

const inflate = promisify(inflateRaw);

/**
 * LECTEUR DE ZIP PAR PLAGES — lit la TABLE DES MATIÈRES d'une archive, puis UNE entrée, sans jamais
 * charger l'archive entière.
 *
 * Pourquoi pas JSZip : il charge tout le ZIP en mémoire, puis le décompresse. Au-delà de quelques
 * centaines de Mo, c'est la mémoire de l'instance qui cède — l'ancien aperçu du Drive refusait donc
 * « au-delà de 300 Mo » une archive CTD de plusieurs Go, c'est-à-dire exactement celles qu'on veut
 * parcourir. Ici, la source ne sait faire qu'une chose : lire `longueur` octets à partir de `debut`
 * (une requête `Range` sur le bucket, ou une tranche de tampon). Le répertoire central tient en
 * quelques Ko par millier d'entrées ; une entrée se lit à elle seule.
 *
 * Gère Zip64 (archives de plus de 4 Go, ou de plus de 65 535 entrées). Ce qu'il ne sait pas lire
 * (archive chiffrée, méthode de compression inconnue) est DIT, jamais deviné.
 */

export interface SourceZip {
  taille: number;
  lire: (debut: number, longueur: number) => Promise<Buffer>;
}

export interface EntreeZip {
  /** Chemin complet dans l'archive, séparateur « / ». */
  chemin: string;
  dossier: boolean;
  tailleCompressee: number;
  taille: number;
  /** Position de l'en-tête local dans l'archive. */
  decalage: number;
  methode: number;
  chiffree: boolean;
}

export class ErreurZip extends Error {}

const SIG_FIN = 0x06054b50;
const SIG_FIN64_LOCALISATEUR = 0x07064b50;
const SIG_FIN64 = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** Un champ Zip64 vaut 0xFFFFFFFF (ou 0xFFFF) quand la vraie valeur est dans le bloc étendu. */
const SATURE32 = 0xffffffff;
const SATURE16 = 0xffff;

const lire64 = (b: Buffer, o: number): number => Number(b.readBigUInt64LE(o));

/** Le nom est en UTF-8 si le bit 11 est posé ; sinon CP437, dont l'ASCII est un sous-ensemble sûr. */
function decoderNom(brut: Buffer, drapeaux: number): string {
  return (drapeaux & 0x0800) !== 0 ? brut.toString("utf8") : brut.toString("latin1");
}

/**
 * Chemin sûr : jamais de « .. », jamais de chemin absolu. Une archive n'écrit rien ici, mais le
 * chemin finit dans une adresse et un nom de fichier téléchargé — on ne laisse pas passer l'astuce.
 */
export function cheminSur(brut: string): string {
  return brut.replace(/\\/g, "/").split("/").filter((s) => s && s !== "." && s !== "..").join("/");
}

/** Lit la table des matières. `maxEntrees` borne la mémoire d'une archive pathologique. */
export async function listerZip(source: SourceZip, maxEntrees = 100_000): Promise<{ entrees: EntreeZip[]; tronque: boolean }> {
  if (source.taille < 22) throw new ErreurZip("Ce fichier n'est pas une archive ZIP valide.");

  // 1. Fin du répertoire central : dans les 22 derniers octets, ou avant, derrière un commentaire
  //    (65 535 octets au plus).
  const fenetre = Math.min(source.taille, 22 + 65_535);
  const fin = await source.lire(source.taille - fenetre, fenetre);
  let posFin = -1;
  for (let i = fin.length - 22; i >= 0; i--) {
    if (fin.readUInt32LE(i) === SIG_FIN) { posFin = i; break; }
  }
  if (posFin < 0) throw new ErreurZip("Ce fichier n'est pas une archive ZIP valide (fin du répertoire introuvable).");

  let nbEntrees = fin.readUInt16LE(posFin + 10);
  let tailleCentrale = fin.readUInt32LE(posFin + 12);
  let debutCentral = fin.readUInt32LE(posFin + 16);

  // 2. Zip64 : le localisateur précède la fin classique de 20 octets.
  const saturee = nbEntrees === SATURE16 || tailleCentrale === SATURE32 || debutCentral === SATURE32;
  if (saturee && posFin >= 20 && fin.readUInt32LE(posFin - 20) === SIG_FIN64_LOCALISATEUR) {
    const posFin64 = lire64(fin, posFin - 20 + 8);
    const e64 = await source.lire(posFin64, 56);
    if (e64.length < 56 || e64.readUInt32LE(0) !== SIG_FIN64) throw new ErreurZip("Archive Zip64 illisible (fin du répertoire).");
    nbEntrees = lire64(e64, 32);
    tailleCentrale = lire64(e64, 40);
    debutCentral = lire64(e64, 48);
  } else if (saturee) {
    throw new ErreurZip("Archive Zip64 illisible (localisateur absent).");
  }
  if (debutCentral + tailleCentrale > source.taille) throw new ErreurZip("Répertoire de l'archive hors du fichier — archive incomplète ou corrompue.");
  // Le répertoire central tient en mémoire : borné (une entrée ≈ 100 octets ; 100 000 entrées ≈ 10 Mo).
  if (tailleCentrale > 200 * 1024 * 1024) throw new ErreurZip("Répertoire de l'archive trop volumineux pour être ouvert ici — téléchargez-la.");

  const central = await source.lire(debutCentral, tailleCentrale);
  const entrees: EntreeZip[] = [];
  let o = 0;
  let tronque = false;
  while (o + 46 <= central.length && central.readUInt32LE(o) === SIG_CENTRAL) {
    if (entrees.length >= maxEntrees) { tronque = true; break; }
    const drapeaux = central.readUInt16LE(o + 8);
    const methode = central.readUInt16LE(o + 10);
    let tailleCompressee = central.readUInt32LE(o + 20);
    let taille = central.readUInt32LE(o + 24);
    const lNom = central.readUInt16LE(o + 28);
    const lExtra = central.readUInt16LE(o + 30);
    const lCom = central.readUInt16LE(o + 32);
    let decalage = central.readUInt32LE(o + 42);
    const nomBrut = central.subarray(o + 46, o + 46 + lNom);
    const extra = central.subarray(o + 46 + lNom, o + 46 + lNom + lExtra);

    // Bloc Zip64 (id 0x0001) : ne porte QUE les champs saturés, dans cet ordre.
    if (taille === SATURE32 || tailleCompressee === SATURE32 || decalage === SATURE32) {
      let p = 0;
      while (p + 4 <= extra.length) {
        const id = extra.readUInt16LE(p);
        const lg = extra.readUInt16LE(p + 2);
        if (id === 0x0001) {
          let q = p + 4;
          if (taille === SATURE32) { taille = lire64(extra, q); q += 8; }
          if (tailleCompressee === SATURE32) { tailleCompressee = lire64(extra, q); q += 8; }
          if (decalage === SATURE32) { decalage = lire64(extra, q); }
          break;
        }
        p += 4 + lg;
      }
    }

    const nom = decoderNom(nomBrut, drapeaux);
    const dossier = nom.endsWith("/") || nom.endsWith("\\");
    const chemin = cheminSur(nom);
    if (chemin) entrees.push({ chemin, dossier, tailleCompressee, taille, decalage, methode, chiffree: (drapeaux & 0x0001) !== 0 });
    o += 46 + lNom + lExtra + lCom;
  }
  void nbEntrees;
  return { entrees, tronque };
}

/**
 * Lit UNE entrée. `maxOctets` borne la taille DÉCOMPRESSÉE : une archive qui annonce 1 Mo et
 * en gonfle 10 Go (« bombe ») est refusée avant d'être décompressée.
 */
export async function lireEntreeZip(source: SourceZip, entree: EntreeZip, maxOctets = 200 * 1024 * 1024): Promise<Buffer> {
  if (entree.dossier) throw new ErreurZip("Un dossier n'a pas de contenu.");
  if (entree.chiffree) throw new ErreurZip("Cette entrée est protégée par un mot de passe — téléchargez l'archive pour l'ouvrir.");
  if (entree.taille > maxOctets) {
    throw new ErreurZip(`Cette entrée est trop volumineuse pour être ouverte ici (${Math.round(entree.taille / 1024 / 1024)} Mo) — téléchargez l'archive.`);
  }
  // En-tête local : sa longueur de nom/extra peut différer de celle du répertoire central.
  const entete = await source.lire(entree.decalage, 30);
  if (entete.length < 30 || entete.readUInt32LE(0) !== SIG_LOCAL) throw new ErreurZip("Entrée corrompue (en-tête local introuvable).");
  const debutDonnees = entree.decalage + 30 + entete.readUInt16LE(26) + entete.readUInt16LE(28);
  const brut = await source.lire(debutDonnees, entree.tailleCompressee);
  if (brut.length !== entree.tailleCompressee) throw new ErreurZip("Entrée tronquée — archive incomplète.");
  if (entree.methode === 0) return brut;
  if (entree.methode === 8) {
    const sortie = await inflate(brut, { maxOutputLength: Math.max(entree.taille, 1) + 1 });
    if (sortie.length !== entree.taille) throw new ErreurZip("Entrée corrompue (taille décompressée inattendue).");
    return sortie;
  }
  throw new ErreurZip(`Méthode de compression ${entree.methode} non prise en charge ici — téléchargez l'archive.`);
}

/** Source en mémoire (petites archives, ou tests). */
export function sourceTampon(buf: Buffer): SourceZip {
  return { taille: buf.length, lire: async (debut, longueur) => buf.subarray(debut, debut + longueur) };
}
