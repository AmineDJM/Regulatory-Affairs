import { beforeAll, describe, expect, it } from "vitest";
import crypto from "crypto";
import JSZip from "jszip";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { reduire } from "./reduction";
import { _etatCacheReductions, _viderCacheReductions, obtenirReduction } from "./reduction-cache";
import { profilReduction, reductionRetenue } from "./politique";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { docxDeParagraphes } from "@/lib/artifact/adapters/fixtures";
import { listerZip, lireEntreeZip, sourceTampon } from "@/lib/storage/zip-lecteur";

/**
 * LA VERSION « TAILLE RÉDUITE » — chaque nature rouverte par un lecteur INDÉPENDANT de ce qui l'a
 * produite (sharp, mupdf, JSZip, l'adaptateur Word de production : §118.54, « le fichier s'ouvre »
 * n'est pas « le fichier est livrable »). Les cas disent ce qui les ferait tomber (§118.17).
 */

let graine = 7;
const alea = () => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 2 ** 32);

async function photoBruitee(l: number, h: number, bruit = 55): Promise<Buffer> {
  const raw = Buffer.alloc(l * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const i = (y * l + x) * 3;
    const base = 120 + 80 * Math.sin(x / 90) * Math.cos(y / 70);
    raw[i] = Math.max(0, Math.min(255, base + (alea() - 0.5) * bruit));
    raw[i + 1] = Math.max(0, Math.min(255, base * 0.9 + 20 + (alea() - 0.5) * bruit));
    raw[i + 2] = Math.max(0, Math.min(255, base * 0.7 + 40 + (alea() - 0.5) * bruit));
  }
  return sharp(raw, { raw: { width: l, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

const mots = "dossier réglementaire module qualité stabilité produit fini substance active étude clinique comprimé solution injectable conformité lot fabrication contrôle méthode validation".split(" ");
const paragraphe = (n: number) => Array.from({ length: n }, () => mots[Math.floor(alea() * mots.length)]).join(" ");

async function pdfTexte(compress: boolean, pages = 40, extra?: (d: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, compress });
  const m: Buffer[] = [];
  doc.on("data", (c) => m.push(c));
  const fin = new Promise<void>((r) => doc.on("end", () => r()));
  for (let p = 0; p < pages; p++) { doc.fontSize(10).text(`Page ${p + 1}. ${paragraphe(250)}`); if (p < pages - 1) doc.addPage(); }
  extra?.(doc);
  doc.end();
  await fin;
  return Buffer.concat(m);
}

const nbPagesEtTexte = async (pdf: Buffer): Promise<{ pages: number; texte: string[] }> => {
  const mupdf = await import("mupdf");
  const d = mupdf.Document.openDocument(new Uint8Array(pdf), "application/pdf");
  try {
    const n = d.countPages();
    const texte: string[] = [];
    for (let i = 0; i < n; i++) { const p = d.loadPage(i); texte.push(p.toStructuredText().asText()); p.destroy?.(); }
    return { pages: n, texte };
  } finally { d.destroy?.(); }
};

describe("profil statique — ce qu'on propose sans rien lire", () => {
  it("ZIP, MP4, MP3 et fichiers légers : jamais de choix (déjà optimisé) ; JPEG/PNG/PDF/Office/texte assez gros : oui", () => {
    expect(profilReduction("a.zip", "application/zip", 5e6).nature).toBeNull();
    expect(profilReduction("film.mp4", "video/mp4", 80e6).nature).toBeNull();
    expect(profilReduction("a.jpg", "image/jpeg", 20_000).nature).toBeNull();
    expect(profilReduction("a.jpg", "image/jpeg", 20_000).raison).toMatch(/Déjà optimisé/);
    expect(profilReduction("a.jpg", "image/jpeg", 2e6).nature).toBe("jpeg");
    expect(profilReduction("A.PNG", null, 2e6).nature).toBe("png");
    expect(profilReduction("rapport.pdf", "application/pdf", 3e6).nature).toBe("pdf");
    expect(profilReduction("rapport.pdf", "application/pdf", 300e6).raison).toMatch(/Trop volumineux/);
    expect(profilReduction("contrat.docx", null, 2e6).nature).toBe("office");
    expect(profilReduction("donnees.csv", "text/csv", 1e6).nature).toBe("texte");
    expect(profilReduction("inconnu.xyz", null, 1e9).nature).toBeNull();
  });

  it("`reductionRetenue` : il faut ≥ 10 % d'économie réelle", () => {
    expect(reductionRetenue(1000, 900)).toBe(true);
    expect(reductionRetenue(1000, 901)).toBe(false);
    expect(reductionRetenue(1000, 1200)).toBe(false);
    expect(reductionRetenue(0, 0)).toBe(false);
  });
});

describe("JPEG", () => {
  let photo: Buffer;
  beforeAll(async () => { photo = await photoBruitee(1600, 1200); });

  it("la version réduite est plus petite, se décode, garde ses proportions — l'original n'est jamais touché", async () => {
    const avant = crypto.createHash("sha256").update(photo).digest("hex");
    const r = await reduire(photo, "photo.jpg", "image/jpeg");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.octets.length).toBeLessThan(photo.length * 0.9);
    const m = await sharp(r.octets).metadata();
    expect(m.format).toBe("jpeg");
    expect([m.width, m.height]).toEqual([1600, 1200]);
    expect(r.nom).toBe("photo.jpg");
    expect(r.mime).toBe("image/jpeg");
    expect(r.methode).toMatch(/JPEG qualité 80/);
    expect(crypto.createHash("sha256").update(photo).digest("hex")).toBe(avant);
  }, 60_000);

  it("l'orientation EXIF est APPLIQUÉE : retirer les métadonnées ne couche pas la photo", async () => {
    const couchee = await sharp(photo).withMetadata({ orientation: 6 }).jpeg({ quality: 95 }).toBuffer();
    expect((await sharp(couchee).metadata()).orientation).toBe(6);
    const r = await reduire(couchee, "portrait.jpg", "image/jpeg");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = await sharp(r.octets).metadata();
    expect([m.width, m.height], "1600x1200 tourné de 90° : 1200x1600 une fois redressé").toEqual([1200, 1600]);
    expect(m.orientation ?? 1).toBe(1);
  }, 60_000);

  it("une très grande image est ramenée à 4096 px (côté max), proportions gardées", async () => {
    const grande = await sharp({ create: { width: 6000, height: 4000, channels: 3, background: { r: 90, g: 120, b: 200 } } })
      .composite([{ input: await sharp(photo).resize(600, 400).toBuffer(), left: 100, top: 100 }]).jpeg({ quality: 100 }).toBuffer();
    const r = await reduire(grande, "grande.jpg", "image/jpeg");
    if (r.ok) {
      const m = await sharp(r.octets).metadata();
      expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(4096);
      expect(Math.abs(m.width! / m.height! - 1.5)).toBeLessThan(0.01);
    } else {
      expect(r.raison).toMatch(/Déjà optimisé/); // jamais un « réduit » plus gros
    }
  }, 60_000);

  it("un nom .jpg dont le contenu n'est pas un JPEG est refusé (jamais deviné)", async () => {
    const r = await reduire(crypto.randomBytes(400_000), "faux.jpg", "image/jpeg");
    expect(r).toEqual({ ok: false, raison: "Le contenu n'est pas un JPEG." });
  });

  it("une photo déjà très compressée n'est PAS « réduite » en plus gros : refus dit", async () => {
    const legere = await sharp(photo).jpeg({ quality: 40 }).toBuffer();
    const r = await reduire(legere, "legere.jpg", "image/jpeg");
    expect(r.ok).toBe(false);
  }, 60_000);
});

describe("PNG — sans perte, prouvée pixel par pixel", () => {
  it("un PNG recompressé s'ouvre avec les MÊMES pixels", async () => {
    // dégradé + bruit : les filtres adaptatifs gagnent, et un lecteur indépendant compare les pixels
    const l = 1200, h = 900;
    const raw = Buffer.alloc(l * h * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (Math.floor(i / 3 % l) / 5 + alea() * 40) | 0;
    // Un export « sans optimisation » (compression 1), comme en produisent beaucoup d'outils : c'est lui qu'on peut resserrer SANS perte.
    const png = await sharp(raw, { raw: { width: l, height: h, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
    expect(png.length).toBeGreaterThan(100 * 1024);
    const r = await reduire(png, "capture.png", "image/png");
    expect(r.ok, JSON.stringify(r.ok ? "" : r)).toBe(true);
    if (!r.ok) return;
    expect(r.octets.length).toBeLessThan(png.length * 0.9);
    const a = await sharp(png).raw().toBuffer();
    const b = await sharp(r.octets).raw().toBuffer();
    expect(b.equals(a)).toBe(true);
  }, 60_000);

  it("un PNG à 16 bits est conservé tel quel (la réduction à 8 bits serait une perte)", async () => {
    const png16 = await sharp(Buffer.alloc(800 * 800 * 2, 9), { raw: { width: 800, height: 800, channels: 1, depth: "ushort" } as import("sharp").CreateRaw & { depth: string } }).png().toBuffer();
    const meta = await sharp(png16).metadata();
    if (meta.depth !== "ushort") return; // la plateforme de sharp ne produit pas de 16 bits : rien à prouver ici
    const r = await reduire(Buffer.concat([png16, Buffer.alloc(120_000)]), "profond.png", "image/png");
    expect(r.ok).toBe(false);
  });
});

describe("PDF — réécriture sans perte, et ce qu'on ne touche JAMAIS", () => {
  it("un PDF non compressé rétrécit fortement ; pages ET texte relus identiques", async () => {
    const pdf = await pdfTexte(false);
    const r = await reduire(pdf, "rapport.pdf", "application/pdf");
    expect(r.ok, JSON.stringify(r.ok ? "" : r)).toBe(true);
    if (!r.ok) return;
    expect(r.octets.length).toBeLessThan(pdf.length * 0.5);
    const a = await nbPagesEtTexte(pdf);
    const b = await nbPagesEtTexte(r.octets);
    expect(b.pages).toBe(a.pages);
    expect(b.texte).toEqual(a.texte);
    expect(r.mime).toBe("application/pdf");
  }, 60_000);

  it("un PDF SIGNÉ (/ByteRange) n'est jamais réécrit : la signature serait invalidée", async () => {
    const pdf = Buffer.concat([await pdfTexte(false, 20), Buffer.from("\n% signature /ByteRange [0 100 200 300]\n")]);
    const r = await reduire(pdf, "signe.pdf", "application/pdf");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/signé/);
  });

  it("un PDF/A, un PDF chiffré, un PDF tronqué : conservés tels quels, avec leur raison", async () => {
    const base = await pdfTexte(false, 20);
    const pdfa = await reduire(Buffer.concat([base, Buffer.from("\n% <pdfaid:part>1</pdfaid:part>\n")]), "archive.pdf", "application/pdf");
    expect(pdfa.ok).toBe(false);
    if (!pdfa.ok) expect(pdfa.raison).toMatch(/PDF\/A/);
    const chiffre = await reduire(Buffer.concat([base, Buffer.from("\n% /Encrypt\n")]), "chiffre.pdf", "application/pdf");
    expect(chiffre.ok).toBe(false);
    const casse = await reduire(base.subarray(0, Math.floor(base.length / 2)), "casse.pdf", "application/pdf");
    expect(casse.ok).toBe(false); // jamais un « réduit » bâti sur un fichier réparé
  });

  it("un PDF de scan (images JPEG) n'a rien à gagner : « déjà optimisé », jamais un fichier plus gros", async () => {
    const img = await photoBruitee(1200, 1600);
    const doc = new PDFDocument({ autoFirstPage: false });
    const m: Buffer[] = [];
    doc.on("data", (c) => m.push(c));
    const fin = new Promise<void>((r) => doc.on("end", () => r()));
    for (let i = 0; i < 3; i++) { doc.addPage({ size: "A4", margin: 0 }); doc.image(img, 0, 0, { width: 595, height: 842 }); }
    doc.end(); await fin;
    const r = await reduire(Buffer.concat(m), "scan.pdf", "application/pdf");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/Déjà optimisé/);
  }, 60_000);
});

describe("Office — médias optimisés, tout le reste intact, relu par l'adaptateur de production", () => {
  async function docxAvecPhotos(): Promise<Buffer> {
    const base = await docxDeParagraphes(["Contrat", "Article 1", "Article 2"], { premierEstTitre: true, tableau: [["Poste", "Montant"], ["Conseil", "120 000"]] });
    const z = await JSZip.loadAsync(base);
    z.file("word/media/image1.jpeg", await photoBruitee(1600, 1200));
    z.file("word/media/image2.jpeg", await photoBruitee(1400, 1000));
    return z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  it("le DOCX réduit est plus petit ; mêmes entrées dans le même ordre ; tout ce qui n'est pas un média identique OCTET POUR OCTET ; l'adaptateur Word lit le même modèle", async () => {
    const docx = await docxAvecPhotos();
    const r = await reduire(docx, "rapport.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(r.ok, JSON.stringify(r.ok ? "" : r)).toBe(true);
    if (!r.ok) return;
    expect(r.octets.length).toBeLessThan(docx.length * 0.9);
    const a = await JSZip.loadAsync(docx);
    const b = await JSZip.loadAsync(r.octets);
    expect(Object.keys(b.files)).toEqual(Object.keys(a.files));
    for (const n of Object.keys(a.files)) {
      if (a.files[n].dir) continue;
      if (/\/media\//.test(n)) {
        const m = await sharp(await b.files[n].async("nodebuffer")).metadata();
        expect(m.format).toBe("jpeg");
      } else {
        expect((await b.files[n].async("nodebuffer")).equals(await a.files[n].async("nodebuffer")), n).toBe(true);
      }
    }
    // §118.54 : le fichier est LIVRABLE, pas seulement « ouvrable » — l'adaptateur de production le rouvre et le valide.
    const ouvertA = await adaptateurDocx.ouvrir(docx);
    const ouvertB = await adaptateurDocx.ouvrir(r.octets);
    expect((await ouvertB.valider()).ok).toBe(true);
    expect(JSON.stringify(ouvertB.modele())).toBe(JSON.stringify(ouvertA.modele()));
    expect(r.methode).toMatch(/image\(s\)/);
  }, 90_000);

  it("un DOCX de texte seul n'a rien à gagner (déjà un ZIP compressé) : pas de version réduite", async () => {
    const texte = await docxDeParagraphes(Array.from({ length: 200 }, (_, i) => `Article ${i} ${paragraphe(12)}`));
    const r = await reduire(texte, "contrat.docx", null);
    expect(r.ok).toBe(false);
  });

  it("un fichier .docx qui n'est pas un ZIP, ou un ZIP sans [Content_Types].xml, est conservé tel quel", async () => {
    expect((await reduire(crypto.randomBytes(400_000), "faux.docx", null)).ok).toBe(false);
    const z = new JSZip(); z.file("autre.txt", "x".repeat(500_000));
    expect((await reduire(await z.generateAsync({ type: "nodebuffer" }), "faux2.docx", null)).ok).toBe(false);
  });
});

describe("texte — archive ZIP relue", () => {
  it("un CSV devient `.csv.zip` ; l'entrée relue par notre lecteur est le CSV d'origine, octet pour octet", async () => {
    const csv = Buffer.from(Array.from({ length: 6000 }, (_, i) => `${i};L${i % 977};${paragraphe(6)}`).join("\n"));
    const r = await reduire(csv, "donnees.csv", "text/csv");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nom).toBe("donnees.csv.zip");
    expect(r.mime).toBe("application/zip");
    expect(r.octets.length).toBeLessThan(csv.length * 0.5);
    const src = sourceTampon(r.octets);
    const { entrees } = await listerZip(src);
    expect(entrees.map((e) => e.chemin)).toEqual(["donnees.csv"]);
    expect((await lireEntreeZip(src, entrees[0], csv.length + 1)).equals(csv)).toBe(true);
  });

  it("des octets aléatoires nommés .csv ne donnent PAS une « réduction » plus grosse", async () => {
    const r = await reduire(crypto.randomBytes(200_000), "bruit.csv", "text/csv");
    expect(r.ok).toBe(false);
  });
});

describe("mémoire des réductions", () => {
  it("deux demandes simultanées du même fichier n'en calculent qu'UNE ; le verdict reste en cache ; un autre contenu (autre empreinte) se recalcule", async () => {
    _viderCacheReductions();
    const csv = Buffer.from(Array.from({ length: 4000 }, (_, i) => `${i};${paragraphe(8)}`).join("\n"));
    let chargements = 0;
    const d = (empreinte: string | null) => ({ empreinte, nom: "t.csv", mime: "text/csv", taille: csv.length, charger: async () => { chargements++; return csv; } });
    const [a, b] = await Promise.all([obtenirReduction(d("e1"), { avecOctets: true }), obtenirReduction(d("e1"), { avecOctets: true })]);
    expect(a.ok && b.ok).toBe(true);
    expect(chargements).toBe(1);
    await obtenirReduction(d("e1"), { avecOctets: false });
    expect(chargements).toBe(1);
    await obtenirReduction(d("e2"), { avecOctets: false });
    expect(chargements).toBe(2);
    // Sans empreinte (ancien fichier sur disque) : aucun cache — jamais de contenu périmé servi.
    await obtenirReduction(d(null), { avecOctets: false });
    await obtenirReduction(d(null), { avecOctets: false });
    expect(chargements).toBe(4);
    expect(_etatCacheReductions().entrees).toBe(2);
  });

  it("le profil statique est jugé AVANT de charger : un ZIP n'est jamais lu", async () => {
    let chargements = 0;
    const r = await obtenirReduction({ empreinte: "z", nom: "a.zip", mime: "application/zip", taille: 5e6, charger: async () => { chargements++; return Buffer.alloc(1); } }, { avecOctets: false });
    expect(r.ok).toBe(false);
    expect(chargements).toBe(0);
  });
});
