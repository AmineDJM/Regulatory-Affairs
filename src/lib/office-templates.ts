import { deflateRawSync } from "zlib";

/**
 * Génère des fichiers Office (OOXML) **vierges** et valides — Word (docx),
 * Excel (xlsx) et PowerPoint (pptx) — **sans aucune dépendance externe**.
 *
 * Un fichier OOXML n'est qu'une archive ZIP (OPC) contenant quelques parties XML.
 * On écrit donc nous-mêmes le ZIP (DEFLATE + CRC32) et les parties minimales que
 * Word/Excel/PowerPoint — et l'éditeur OnlyOffice — savent ouvrir. Sert au bouton
 * « Nouveau document » du Drive : on crée un blob vierge puis on l'édite en ligne.
 *
 * Serveur uniquement (utilise `zlib`).
 */

// ───────────────────────── Écriture ZIP (sans dépendance) ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Buffer }

/** Construit une archive ZIP (DEFLATE, repli STORE si plus compact) à partir de fichiers. */
function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const comp = deflateRawSync(e.data);
    const store = comp.length >= e.data.length;
    const body = store ? e.data : comp;
    const method = store ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature en-tête local
    local.writeUInt16LE(20, 4);         // version requise
    local.writeUInt16LE(0, 6);          // drapeaux
    local.writeUInt16LE(method, 8);     // méthode (0=stored, 8=deflate)
    local.writeUInt16LE(0, 10);         // heure
    local.writeUInt16LE(0x21, 12);      // date (2000-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);   // taille compressée
    local.writeUInt32LE(e.data.length, 22); // taille réelle
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);         // extra
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature répertoire central
    central.writeUInt16LE(20, 4);         // version créateur
    central.writeUInt16LE(20, 6);         // version requise
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // commentaire
    central.writeUInt16LE(0, 34); // disque
    central.writeUInt16LE(0, 36); // attrs internes
    central.writeUInt32LE(0, 38); // attrs externes
    central.writeUInt32LE(offset, 42); // décalage en-tête local
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End Of Central Directory
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const f = (name: string, xml: string): ZipEntry => ({ name, data: Buffer.from(HEAD + xml, "utf8") });

const NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const NS_PR = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// ───────────────────────── Word (.docx) ─────────────────────────

function blankDocx(): Buffer {
  return zip([
    f("[Content_Types].xml",
      `<Types xmlns="${NS_CT}">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`),
    f("_rels/.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`),
    f("word/document.xml",
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body><w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
      `<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>` +
      `</w:sectPr></w:body></w:document>`),
  ]);
}

// ───────────────────────── Excel (.xlsx) ─────────────────────────

function blankXlsx(): Buffer {
  return zip([
    f("[Content_Types].xml",
      `<Types xmlns="${NS_CT}">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`),
    f("_rels/.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`),
    f("xl/workbook.xml",
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">` +
      `<sheets><sheet name="Feuille1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    f("xl/_rels/workbook.xml.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`),
    f("xl/worksheets/sheet1.xml",
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`),
  ]);
}

// ───────────────────────── PowerPoint (.pptx) ─────────────────────────

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const R = `xmlns:r="${REL}"`;
// Arbre de formes vide (réutilisé par le masque, la mise en page et la diapo).
const SP_TREE =
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>`;

function themeXml(): string {
  const dkLt =
    `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
    `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
    `<a:dk2><a:srgbClr val="44546A"/></a:dk2>` +
    `<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
    `<a:accent1><a:srgbClr val="4472C4"/></a:accent1>` +
    `<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
    `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>` +
    `<a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
    `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>` +
    `<a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
    `<a:hlink><a:srgbClr val="0563C1"/></a:hlink>` +
    `<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>`;
  const font = (script = "") =>
    `<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>${script}`;
  const fill1 = `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`;
  const line = `<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>`;
  return (
    `<a:theme ${A} name="Office">` +
    `<a:themeElements>` +
    `<a:clrScheme name="Office">${dkLt}</a:clrScheme>` +
    `<a:fontScheme name="Office">` +
    `<a:majorFont>${font()}</a:majorFont><a:minorFont>${font()}</a:minorFont>` +
    `</a:fontScheme>` +
    `<a:fmtScheme name="Office">` +
    `<a:fillStyleLst>${fill1}${fill1}${fill1}</a:fillStyleLst>` +
    `<a:lnStyleLst>${line}${line}${line}</a:lnStyleLst>` +
    `<a:effectStyleLst>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle>` +
    `</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${fill1}${fill1}${fill1}</a:bgFillStyleLst>` +
    `</a:fmtScheme>` +
    `</a:themeElements></a:theme>`
  );
}

function blankPptx(): Buffer {
  const clrMap =
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ` +
    `accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`;
  return zip([
    f("[Content_Types].xml",
      `<Types xmlns="${NS_CT}">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
      `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
      `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
      `<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>` +
      `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
      `</Types>`),
    f("_rels/.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>` +
      `</Relationships>`),
    f("ppt/presentation.xml",
      `<p:presentation ${A} ${R} ${P}>` +
      `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
      `<p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>` +
      `<p:notesSz cx="6858000" cy="9144000"/></p:presentation>`),
    f("ppt/_rels/presentation.xml.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/>` +
      `</Relationships>`),
    f("ppt/slideMasters/slideMaster1.xml",
      `<p:sldMaster ${A} ${R} ${P}>` +
      `<p:cSld>${SP_TREE}</p:cSld>${clrMap}` +
      `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
      `</p:sldMaster>`),
    f("ppt/slideMasters/_rels/slideMaster1.xml.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/>` +
      `</Relationships>`),
    f("ppt/slideLayouts/slideLayout1.xml",
      `<p:sldLayout ${A} ${R} ${P} type="blank" preserve="1">` +
      `<p:cSld name="Vierge">${SP_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
      `</p:sldLayout>`),
    f("ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
      `</Relationships>`),
    f("ppt/slides/slide1.xml",
      `<p:sld ${A} ${R} ${P}>` +
      `<p:cSld>${SP_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`),
    f("ppt/slides/_rels/slide1.xml.rels",
      `<Relationships xmlns="${NS_PR}">` +
      `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
      `</Relationships>`),
    f("ppt/theme/theme1.xml", themeXml()),
  ]);
}

// ───────────────────────── API ─────────────────────────

export type OfficeKind = "word" | "cell" | "slide";

export interface BlankOffice { data: Buffer; ext: string; mime: string }

const MIME: Record<OfficeKind, string> = {
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  cell: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  slide: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const EXT: Record<OfficeKind, string> = { word: "docx", cell: "xlsx", slide: "pptx" };

/** Renvoie un fichier Office vierge valide pour le type demandé. */
export function blankOffice(kind: OfficeKind): BlankOffice {
  const data = kind === "word" ? blankDocx() : kind === "cell" ? blankXlsx() : blankPptx();
  return { data, ext: EXT[kind], mime: MIME[kind] };
}

export function isOfficeKind(v: string): v is OfficeKind {
  return v === "word" || v === "cell" || v === "slide";
}
