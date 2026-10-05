import * as zlib from "zlib";
import { deflateRawSync } from "zlib";
import { formatDejaCompresse } from "./politique";

/**
 * ÉCRIVAIN DE ZIP EN FLUX — l'archive est produite entrée par entrée, jamais montée en mémoire.
 *
 * Pourquoi pas JSZip : il tient TOUTES les entrées, puis l'archive, dans le tas — d'où l'ancien
 * plafond de 800 Mo d'un téléchargement de dossier. Ici, la mémoire vaut la plus grosse entrée
 * (une à la fois) ; l'archive part au fil de l'eau avec la contre-pression du réseau.
 *
 * Deux niveaux, qui sont aussi les deux « qualités » du téléchargement :
 *   • `stocke` (qualité maximale) : AUCUNE compression — chaque fichier y est, octet pour octet ;
 *   • `max`    (taille réduite)   : deflate niveau 9, mais JAMAIS de gonflement — une entrée qui
 *     ne compresse pas (ou qui est déjà compressée : JPEG, ZIP, DOCX…) est stockée telle quelle.
 *
 * Limite opérationnelle, dite avec son chiffre : pas de Zip64 — une entrée ou une archive de 4 Gio
 * ou plus est REFUSÉE (`ErreurZipLimite`), jamais écrite tronquée.
 */

export const LIMITE_ZIP_OCTETS = 4 * 1024 ** 3 - 1024 * 1024; // marge pour les en-têtes
export class ErreurZipLimite extends Error {}

export type NiveauZip = "stocke" | "max";

export interface EntreeZip {
  /** Chemin dans l'archive, séparateur « / ». */
  chemin: string;
  date?: Date;
  /** Un tampon (la taille et le CRC se connaissent : en-tête complet) ou un flux de taille connue (descripteur de données). */
  contenu: Buffer | { flux: AsyncIterable<Buffer>; taille: number };
}

// ─── CRC-32 : zlib.crc32 quand il existe (Node ≥ 20.15 / 22.2), sinon une table.
const TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crcTable(buf: Uint8Array, crc = 0): number {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const natif = (zlib as unknown as { crc32?: (d: Uint8Array, v?: number) => number }).crc32;
export const crc32 = (buf: Uint8Array, crc = 0): number => (natif ? natif(buf, crc) >>> 0 : crcTable(buf, crc));

/** Date MS-DOS (le format d'un ZIP). Une date hors de 1980-2107 est ramenée dans la plage. */
function dateDos(d: Date): { date: number; heure: number } {
  const an = Math.min(2107, Math.max(1980, d.getFullYear()));
  return { date: ((an - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), heure: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1) };
}

interface Central { nom: Buffer; methode: number; crc: number; taille: number; tailleCompressee: number; decalage: number; date: number; heure: number; descripteur: boolean }

function enteteLocal(e: Central): Buffer {
  const b = Buffer.alloc(30 + e.nom.length);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(0x0800 | (e.descripteur ? 0x0008 : 0), 6); // bit 11 : noms en UTF-8 ; bit 3 : descripteur de données
  b.writeUInt16LE(e.methode, 8);
  b.writeUInt16LE(e.heure, 10);
  b.writeUInt16LE(e.date, 12);
  b.writeUInt32LE(e.descripteur ? 0 : e.crc, 14);
  b.writeUInt32LE(e.descripteur ? 0 : e.tailleCompressee, 18);
  b.writeUInt32LE(e.descripteur ? 0 : e.taille, 22);
  b.writeUInt16LE(e.nom.length, 26);
  b.writeUInt16LE(0, 28);
  e.nom.copy(b, 30);
  return b;
}

function entreeCentrale(e: Central): Buffer {
  const b = Buffer.alloc(46 + e.nom.length);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4); // fait par
  b.writeUInt16LE(20, 6); // nécessaire
  b.writeUInt16LE(0x0800 | (e.descripteur ? 0x0008 : 0), 8);
  b.writeUInt16LE(e.methode, 10);
  b.writeUInt16LE(e.heure, 12);
  b.writeUInt16LE(e.date, 14);
  b.writeUInt32LE(e.crc, 16);
  b.writeUInt32LE(e.tailleCompressee, 20);
  b.writeUInt32LE(e.taille, 24);
  b.writeUInt16LE(e.nom.length, 28);
  b.writeUInt32LE(e.decalage, 42);
  e.nom.copy(b, 46);
  return b;
}

const cheminZip = (c: string) => c.replace(/\\/g, "/").split("/").filter((s) => s && s !== "." && s !== "..").join("/") || "sans-nom";

/**
 * Écrit l'archive. `entrees` peut être un générateur paresseux : une entrée n'est lue que quand le
 * consommateur a demandé la précédente (contre-pression).
 */
export async function* ecrireZip(entrees: AsyncIterable<EntreeZip> | Iterable<EntreeZip>, niveau: NiveauZip): AsyncGenerator<Buffer> {
  const centrales: Central[] = [];
  let decalage = 0;
  const emettre = (b: Buffer) => { decalage += b.length; if (decalage > LIMITE_ZIP_OCTETS) throw new ErreurZipLimite("Archive trop volumineuse (4 Go au plus) — téléchargez par sous-dossiers."); return b; };

  for await (const e of entrees) {
    const nom = Buffer.from(cheminZip(e.chemin), "utf8");
    const { date, heure } = dateDos(e.date ?? new Date());
    const debut = decalage;
    if (Buffer.isBuffer(e.contenu)) {
      const brut = e.contenu;
      if (brut.length >= 4 * 1024 ** 3 - 1) throw new ErreurZipLimite(`« ${e.chemin} » dépasse 4 Go : trop volumineux pour une archive ZIP ici.`);
      let methode = 0;
      let octets = brut;
      if (niveau === "max" && brut.length > 0 && !formatDejaCompresse(brut.subarray(0, 16))) {
        const d = deflateRawSync(brut, { level: 9 });
        // JAMAIS de gonflement : on ne garde le deflate que s'il est plus petit.
        if (d.length < brut.length) { methode = 8; octets = d; }
      }
      const c: Central = { nom, methode, crc: crc32(brut), taille: brut.length, tailleCompressee: octets.length, decalage: debut, date, heure, descripteur: false };
      yield emettre(enteteLocal(c));
      if (octets.length) yield emettre(octets);
      centrales.push(c);
    } else {
      // Entrée en flux (objet volumineux d'un bucket) : STOCKÉE, avec descripteur de données — la
      // taille est annoncée par la source, le CRC ne se connaît qu'à la fin.
      const { flux, taille } = e.contenu;
      if (taille >= 4 * 1024 ** 3 - 1) throw new ErreurZipLimite(`« ${e.chemin} » dépasse 4 Go : trop volumineux pour une archive ZIP ici.`);
      const c: Central = { nom, methode: 0, crc: 0, taille, tailleCompressee: taille, decalage: debut, date, heure, descripteur: true };
      yield emettre(enteteLocal(c));
      let crc = 0; let lu = 0;
      for await (const morceau of flux) { lu += morceau.length; crc = crc32(morceau, crc); yield emettre(morceau); }
      if (lu !== taille) throw new Error(`« ${e.chemin} » : taille lue (${lu}) différente de la taille annoncée (${taille}) — archive abandonnée.`);
      c.crc = crc;
      const d = Buffer.alloc(16);
      d.writeUInt32LE(0x08074b50, 0); d.writeUInt32LE(crc, 4); d.writeUInt32LE(taille, 8); d.writeUInt32LE(taille, 12);
      yield emettre(d);
      centrales.push(c);
    }
  }

  const debutCentral = decalage;
  for (const c of centrales) yield emettre(entreeCentrale(c));
  const tailleCentral = decalage - debutCentral;
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(centrales.length, 8); fin.writeUInt16LE(centrales.length, 10);
  fin.writeUInt32LE(tailleCentral, 12); fin.writeUInt32LE(debutCentral, 16);
  if (centrales.length > 0xffff) throw new ErreurZipLimite("Plus de 65 535 fichiers : téléchargez par sous-dossiers.");
  yield emettre(fin);
}

/** Un générateur d'octets → un `ReadableStream` Web, avec contre-pression et erreur propagée (le téléchargement échoue, il ne se tronque pas en silence). */
export function enFluxWeb(source: AsyncIterable<Buffer>): ReadableStream<Uint8Array> {
  const it = source[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controle) {
      try {
        const { done, value } = await it.next();
        if (done) controle.close(); else controle.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      } catch (e) { controle.error(e); }
    },
    async cancel() { await it.return?.(undefined); },
  });
}

/** Archive d'UNE entrée en mémoire (le texte « taille réduite »). */
export async function zipUneEntree(chemin: string, octets: Buffer, date?: Date): Promise<Buffer> {
  const morceaux: Buffer[] = [];
  for await (const b of ecrireZip([{ chemin, contenu: octets, date }], "max")) morceaux.push(b);
  return Buffer.concat(morceaux);
}
