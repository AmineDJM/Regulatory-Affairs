/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ADAPTATEUR PDF (§16) — supprimer, réordonner, pivoter, recadrer, filigraner.
 *
 * ── POURQUOI MUPDF, ET PAS UN CONVERTISSEUR ─────────────────────────────────────────────
 *
 * MuPDF manipule la STRUCTURE du PDF : supprimer la page 12 retire une entrée de l'arbre des
 * pages et ne retouche pas une seule des autres. Le texte reste du texte, les signatures des
 * autres pages restent valides, les polices intégrées ne sont pas ré-encodées, et l'opération
 * est quasi instantanée quelle que soit la taille (§29). Passer par une conversion — PDF →
 * images → PDF — donnerait un fichier plus lourd, non sélectionnable, et illisible pour un
 * lecteur d'écran. Ce serait une régression déguisée en fonctionnalité.
 *
 * ── LA NUMÉROTATION, ENCORE (§17) ───────────────────────────────────────────────────────
 *
 * L'humain dit « page 12 ». MuPDF compte à partir de 0. La conversion se fait ICI, en UN seul
 * endroit, et les suppressions se font en ordre DÉCROISSANT — supprimer la page 12 avant la 14
 * décalerait la 14 vers la 13, et on effacerait la 15. C'est l'erreur qu'un test doit attraper,
 * et `numbering.test.ts` la reproduit exactement.
 *
 * ── ESM ─────────────────────────────────────────────────────────────────────────────────
 *
 * `mupdf` est un paquet ESM pur : il ne s'importe QUE dynamiquement depuis notre code CommonJS,
 * exactement comme le fait déjà `src/lib/storage/raster.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { PdfModel, PdfPageNode } from "@/lib/artifact/object-model/model";
import { abreger } from "@/lib/artifact/object-model/text";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";
import type { AdaptateurArtefact, DocumentOuvert, EffetCommande, Validation } from "@/lib/artifact/adapters/contract";
import { effetEchec, effetOk } from "@/lib/artifact/adapters/contract";

export const MIME_PDF = "application/pdf";

/**
 * MuPDF ne publie PAS de types TypeScript. On garde donc une surface `unknown` élargie plutôt
 * que d'inventer des déclarations qui mentiraient à la première montée de version : ce qu'on
 * appelle est vérifié par les tests d'adaptateur, qui manipulent de vrais PDF.
 */
type Mupdf = any;

/** Un seul chargement du module ESM pour tout le processus. */
let mupdfCache: Promise<Mupdf> | null = null;
export function chargerMupdf(): Promise<Mupdf> {
  if (!mupdfCache) mupdfCache = import("mupdf");
  return mupdfCache;
}

const PREVU_MAX = 90;

/** Les premières lignes lisibles d'une page — sert aux miniatures et à « la page du sommaire ». */
function apercuPage(page: any): string {
  try {
    const st = JSON.parse(page.toStructuredText().asJSON());
    const bouts: string[] = [];
    for (const bloc of st.blocks ?? []) {
      for (const ligne of bloc.lines ?? []) {
        if (ligne.text) bouts.push(ligne.text);
        if (bouts.join(" ").length > PREVU_MAX) break;
      }
      if (bouts.join(" ").length > PREVU_MAX) break;
    }
    return abreger(bouts.join(" "), PREVU_MAX);
  } catch {
    // Une page scannée n'a pas de texte : ce n'est pas une erreur, c'est une page sans aperçu.
    return "";
  }
}

class PdfOuvert implements DocumentOuvert {
  format = "PDF" as const;
  private modeleCache: PdfModel | null = null;

  constructor(private mupdf: Mupdf, private doc: any) {}

  modele(): PdfModel {
    if (this.modeleCache) return this.modeleCache;
    const pages: PdfPageNode[] = [];
    const n = this.doc.countPages();
    for (let i = 0; i < n; i += 1) {
      const page = this.doc.loadPage(i);
      const b = page.getBounds();
      let rotation = 0;
      try {
        const rot = page.getObject?.().get?.("Rotate");
        const v = rot?.asNumber?.();
        if (Number.isFinite(v)) rotation = ((v % 360) + 360) % 360;
      } catch { /* un PDF sans /Rotate n'est pas pivoté : zéro est la bonne réponse. */ }
      pages.push({
        id: `page${i + 1}`,
        index: i + 1,
        widthPt: Math.round((b[2] - b[0]) * 10) / 10,
        heightPt: Math.round((b[3] - b[1]) * 10) / 10,
        rotation,
        preview: apercuPage(page),
      });
    }
    this.modeleCache = { kind: "PDF", pages, encrypted: Boolean(this.doc.needsPassword?.()) };
    return this.modeleCache;
  }

  appliquer(c: CommandeArtefact): EffetCommande {
    const effet = this.executer(c);
    if (effet.ok) this.modeleCache = null;
    return effet;
  }

  /**
   * Vérifie que toutes les pages demandées existent AVANT d'en supprimer une seule.
   *
   * Le contrôle du RANG MINIMAL est ici EN PLUS du compilateur, et ce n'est pas une redondance
   * inutile : l'adaptateur est appelable par un script, un banc ou un futur appelant qui ne
   * passerait pas par `compile.ts`. Une page « 0 » deviendrait l'index −1, et MuPDF supprimerait
   * la DERNIÈRE page — silencieusement, avec un message de succès.
   */
  private pagesExistantes(pages: number[]): string | null {
    const n = this.doc.countPages();
    const invalides = pages.filter((p) => !Number.isInteger(p) || p < 1);
    if (invalides.length > 0) {
      return `numéro de page invalide (${invalides.join(", ")}) : les pages se comptent à partir de 1`;
    }
    const hors = pages.filter((p) => p > n);
    if (hors.length === 0) return null;
    return `ce document a ${n} page${n > 1 ? "s" : ""} ; ${hors.length > 1 ? "les pages" : "la page"} ${hors.join(", ")} n'existe${hors.length > 1 ? "nt" : ""} pas`;
  }

  private executer(c: CommandeArtefact): EffetCommande {
    switch (c.op) {
      case "pdf.supprimer_pages": return this.supprimerPages(c);
      case "pdf.reordonner": return this.reordonner(c);
      case "pdf.pivoter": return this.pivoter(c);
      case "pdf.recadrer": return this.recadrer(c);
      case "pdf.filigrane": return this.filigrane(c);
      default: return effetEchec(`opération « ${c.op} » non gérée par l'adaptateur PDF`);
    }
  }

  private supprimerPages(c: CommandeArtefact): EffetCommande {
    const demandees = [...new Set(c.pages ?? [])];
    const err = this.pagesExistantes(demandees);
    if (err) return effetEchec(err);
    if (demandees.length >= this.doc.countPages()) {
      return effetEchec("on ne peut pas supprimer toutes les pages : il resterait un fichier vide");
    }
    // ORDRE DÉCROISSANT — supprimer la 12 d'abord décalerait la 14 vers la 13 (§17).
    for (const p of [...demandees].sort((a, b) => b - a)) this.doc.deletePage(p - 1);
    const liste = demandees.sort((a, b) => a - b).join(", ");
    return effetOk(`Page${demandees.length > 1 ? "s" : ""} ${liste} supprimée${demandees.length > 1 ? "s" : ""} — il reste ${this.doc.countPages()} pages.`, demandees.map((p) => `page${p}`));
  }

  private reordonner(c: CommandeArtefact): EffetCommande {
    const ordre = c.ordre ?? [];
    const n = this.doc.countPages();
    if (ordre.length !== n) return effetEchec(`le nouvel ordre décrit ${ordre.length} pages alors que le document en a ${n}`);
    const err = this.pagesExistantes(ordre);
    if (err) return effetEchec(err);
    // On GREFFE dans un document neuf : réordonner sur place demanderait n déplacements dont
    // chacun décale les suivants, et une seule inattention y produit un ordre faux mais plausible.
    const cible = new this.mupdf.PDFDocument();
    const greffe = cible.newGraftMap();
    for (const p of ordre) greffe.graftPage(-1, this.doc, p - 1);
    this.doc = cible;
    return effetOk(`Pages réordonnées : ${ordre.slice(0, 12).join(", ")}${ordre.length > 12 ? "…" : ""}.`, []);
  }

  private pivoter(c: CommandeArtefact): EffetCommande {
    const pages = [...new Set(c.pages ?? [])];
    const err = this.pagesExistantes(pages);
    if (err) return effetEchec(err);
    const delta = ((c.degres ?? 0) % 360 + 360) % 360;
    for (const p of pages) {
      const obj = this.doc.loadPage(p - 1).getObject();
      const actuel = obj.get("Rotate")?.asNumber?.() ?? 0;
      // La rotation est CUMULATIVE : « pivote encore » doit tourner de 90° de plus, pas revenir
      // à 90°. C'est ce que la personne veut dire, et c'est ce que fait Acrobat.
      obj.put("Rotate", (((actuel + delta) % 360) + 360) % 360);
    }
    return effetOk(`${pages.length} page${pages.length > 1 ? "s" : ""} pivotée${pages.length > 1 ? "s" : ""} de ${delta}°.`, pages.map((p) => `page${p}`));
  }

  private recadrer(c: CommandeArtefact): EffetCommande {
    const pages = [...new Set(c.pages ?? [])];
    const err = this.pagesExistantes(pages);
    if (err) return effetEchec(err);
    // Les marges arrivent en centimètres ; le PDF compte en points (72 par pouce).
    const ptParCm = 72 / 2.54;
    const m = {
      haut: (c.avantPt ?? 0) || (c.hauteurCm ?? 0) * ptParCm,
      bas: (c.apresPt ?? 0) || (c.hauteurCm ?? 0) * ptParCm,
      gauche: (c.gaucheCm ?? 0) * ptParCm,
      droite: (c.droiteCm ?? 0) * ptParCm,
    };
    if (![m.haut, m.bas, m.gauche, m.droite].some((v) => v > 0)) return effetEchec("il faut dire de combien recadrer");
    for (const p of pages) {
      const page = this.doc.loadPage(p - 1);
      const b = page.getBounds();
      const nouveau = [b[0] + m.gauche, b[1] + m.haut, b[2] - m.droite, b[3] - m.bas];
      if (nouveau[2] - nouveau[0] < 20 || nouveau[3] - nouveau[1] < 20) {
        return effetEchec(`recadrage trop fort : la page ${p} n'aurait plus de contenu visible`);
      }
      page.getObject().put("CropBox", this.doc.addObject(nouveau));
    }
    return effetOk(`${pages.length} page${pages.length > 1 ? "s" : ""} recadrée${pages.length > 1 ? "s" : ""}.`, pages.map((p) => `page${p}`));
  }

  private filigrane(c: CommandeArtefact): EffetCommande {
    const texte = c.texte ?? "";
    const n = this.doc.countPages();
    const pages = c.pages && c.pages.length ? [...new Set(c.pages)] : Array.from({ length: n }, (_, i) => i + 1);
    const err = this.pagesExistantes(pages);
    if (err) return effetEchec(err);
    const opacite = c.opacite ?? 0.15;
    const police = this.doc.addSimpleFont(new this.mupdf.Font("Helvetica"));
    for (const p of pages) {
      const page = this.doc.loadPage(p - 1);
      const b = page.getBounds();
      const largeur = b[2] - b[0];
      const hauteur = b[3] - b[1];
      const taille = Math.max(18, Math.min(72, largeur / Math.max(6, texte.length) * 2.2));
      // Diagonale à 45°, centrée : la matrice `cos, sin, -sin, cos, tx, ty` fait la rotation.
      const cos = Math.SQRT1_2;
      const flux = [
        "q",
        `/GsAdam gs`,
        "0.5 0.5 0.5 rg",
        "BT",
        `/FAdam ${taille.toFixed(1)} Tf`,
        `${cos.toFixed(5)} ${cos.toFixed(5)} ${(-cos).toFixed(5)} ${cos.toFixed(5)} ${(largeur * 0.18).toFixed(1)} ${(hauteur * 0.28).toFixed(1)} Tm`,
        `(${texte.replace(/([()\\])/g, "\\$1")}) Tj`,
        "ET",
        "Q",
      ].join("\n");
      const ressources = this.doc.newDictionary();
      const polices = this.doc.newDictionary();
      polices.put("FAdam", police);
      ressources.put("Font", polices);
      const etats = this.doc.newDictionary();
      const gs = this.doc.newDictionary();
      gs.put("ca", opacite);
      gs.put("CA", opacite);
      etats.put("GsAdam", gs);
      ressources.put("ExtGState", etats);
      ajouterFlux(this.doc, page, flux, ressources);
    }
    return effetOk(`Filigrane « ${abreger(texte, 30)} » appliqué sur ${pages.length} page${pages.length > 1 ? "s" : ""}.`, []);
  }

  async serialiser(): Promise<Buffer> {
    const buf = this.doc.saveToBuffer("compress");
    return Buffer.from(buf.asUint8Array());
  }

  async valider(): Promise<Validation> {
    const problemes: string[] = [];
    try {
      const octets = await this.serialiser();
      const relu = this.mupdf.Document.openDocument(new Uint8Array(octets), MIME_PDF);
      const n = relu.countPages();
      if (n < 1) problemes.push("le PDF produit n'a aucune page");
      if (n !== this.doc.countPages()) {
        problemes.push(`le PDF relu a ${n} pages alors que le document en compte ${this.doc.countPages()}`);
      }
    } catch (e) {
      problemes.push(`le PDF produit ne se relit pas : ${(e as Error).message}`);
    }
    return { ok: problemes.length === 0, problemes };
  }
}

/**
 * AJOUTE un flux de contenu à une page sans écraser le sien.
 *
 * Le tableau `/Contents` d'un PDF peut être un flux unique ou un tableau de flux ; les deux cas
 * existent dans la nature et confondre l'un avec l'autre EFFACE la page. On normalise donc en
 * tableau avant d'ajouter.
 */
function ajouterFlux(doc: any, page: any, flux: string, ressources: any): void {
  const obj = page.getObject();
  const nouveau = doc.addStream(flux, null);
  const actuel = obj.get("Contents");
  if (actuel && actuel.isArray?.()) {
    actuel.push(nouveau);
  } else {
    const tableau = doc.newArray();
    if (actuel && !actuel.isNull?.()) tableau.push(actuel);
    tableau.push(nouveau);
    obj.put("Contents", tableau);
  }
  // On FUSIONNE les ressources : remplacer le dictionnaire ferait disparaître les polices et
  // images de la page d'origine — un filigrane qui efface le document qu'il devait marquer.
  const resPage = obj.get("Resources");
  if (resPage && resPage.isDictionary?.()) {
    for (const cle of ["Font", "ExtGState"]) {
      const ajout = ressources.get(cle);
      if (!ajout || ajout.isNull?.()) continue;
      const existant = resPage.get(cle);
      if (existant && existant.isDictionary?.()) {
        ajout.forEach?.((valeur: any, nom: any) => existant.put(nom, valeur));
      } else {
        resPage.put(cle, ajout);
      }
    }
  } else {
    obj.put("Resources", ressources);
  }
}

export const adaptateurPdf: AdaptateurArtefact = {
  format: "PDF",
  mimes: [MIME_PDF],
  extensions: [".pdf"],
  async ouvrir(octets: Buffer): Promise<DocumentOuvert> {
    const mupdf = await chargerMupdf();
    const doc = mupdf.PDFDocument.openDocument(new Uint8Array(octets), MIME_PDF);
    if (doc.needsPassword?.()) throw new Error("Ce PDF est protégé par un mot de passe : il ne peut pas être modifié.");
    return new PdfOuvert(mupdf, doc);
  },
};
