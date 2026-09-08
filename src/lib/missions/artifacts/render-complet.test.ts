import { describe, expect, it } from "vitest";
import type { ArtefactSpec, FormatArtefact } from "./spec";
import { rendre, rendreCsv } from "./render";
import { adaptateurPour } from "@/lib/artifact/adapters/registry";
import type { ArtifactModel } from "@/lib/artifact/object-model/model";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN RENDU ÉCARTE, IL LE NOMME — la règle, tenue pour les QUATRE formats à la fois.
 *
 * ── POURQUOI CE TEST EXISTE, ET POURQUOI IL EST GÉNÉRIQUE ───────────────────────────────
 *
 * Le PowerPoint coupait trois fois en silence : les sources déclarées (jetées), les lignes
 * au-delà de dix, les feuilles au-delà de quatre. Le Word et le PDF, eux, disaient les leurs.
 * Ce n'était donc pas une règle du produit : c'était une habitude tenue par trois rendus sur
 * quatre, et le quatrième était celui qu'on projette en comité.
 *
 * Corriger `rendrePptx` répare le cas mesuré. Ce test répare la CLASSE : il boucle sur les
 * formats, donne à chacun une spec plus grosse que toutes ses limites, ROUVRE le fichier
 * produit avec l'adaptateur de production — celui du destinataire — et exige d'y lire, en
 * toutes lettres, la source déclarée et le compte de ce qui n'a pas tenu.
 *
 * CE QUI LE FERAIT TOMBER : ajouter un cinquième format qui coupe sans le dire, ou baisser une
 * limite existante sans écrire la phrase qui l'accompagne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const LIGNES = 60;
const FEUILLES = 6;
const SOURCE = "ERP Adventum — extraction du 08/09/2026";

const spec = (format: FormatArtefact): ArtefactSpec => ({
  key: "k", title: "Revue de portefeuille", format,
  summary: [{ heading: "Ce que disent les chiffres", paragraphs: ["Le portefeuille progresse de 12 %."], bullets: [] }],
  sheets: Array.from({ length: FEUILLES }, (_, s) => ({
    name: `Feuille ${s + 1}`,
    columns: [{ header: "Produit", key: "produit", type: "text" as const }, { header: "CA", key: "ca", type: "money" as const }],
    rows: Array.from({ length: LIGNES }, (_, i) => ({ produit: `Produit ${i + 1}`, ca: 1000 + i })),
  })),
  charts: [],
  sources: [SOURCE],
});

/**
 * Tout le texte que le DESTINATAIRE peut lire dans le fichier, quel qu'en soit le format.
 *
 * Le PDF fait exception et c'est délibéré : `PdfPageNode.preview` ne porte, par définition, que
 * les premières lignes d'une page — il sert à DÉSIGNER une page, pas à la lire. S'en contenter
 * ferait échouer ce test sur une limite de l'INSTRUMENT et non du fichier. Nos PDF sont écrits
 * sans compression par `simple-pdf.ts` : on relit donc les flux de texte du fichier lui-même.
 */
function texteLisible(m: ArtifactModel, buffer: Buffer): string {
  if (m.kind === "DOCX") {
    return [...m.paragraphs.map((p) => p.text), ...m.tables.flatMap((t) => t.cells.map((c) => c.text))].join("\n");
  }
  if (m.kind === "PPTX") {
    return m.slides.flatMap((d) => [d.title, ...d.shapes.map((f) => f.text)]).join("\n");
  }
  if (m.kind === "PDF") {
    return (buffer.toString("latin1").match(/\((?:\\.|[^()\\])*\)\s*Tj/g) ?? [])
      .map((t) => t.slice(1, t.lastIndexOf(")")).replace(/\\([()\\])/g, "$1")).join("\n");
  }
  return m.sheets.flatMap((s) => s.cells.map((c) => c.value)).join("\n");
}

/**
 * Les tirets typographiques et les puces n'existent pas en WinAnsi : `simple-pdf.ts` les
 * translittère, et c'est correct. Comparer sans normaliser ferait tomber ce test sur une
 * propriété connue de l'écriture PDF au lieu de l'omission qu'il cherche.
 */
const normaliser = (t: string): string => t.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();

describe("ce qu'un rendu écarte, il le nomme", () => {
  for (const format of ["DOCX", "PPTX", "PDF", "XLSX"] as const) {
    it(`${format} : la source déclarée est DANS le fichier`, async () => {
      const rendu = await rendre(spec(format));
      const doc = await adaptateurPour(format).ouvrir(rendu.buffer);
      expect(normaliser(texteLisible(doc.modele(), rendu.buffer)), `${format} jette les sources que le schéma exige du modèle`)
        .toContain(normaliser(SOURCE));
    });

    it(`${format} : ce qui a été coupé est COMPTÉ dans le fichier`, async () => {
      const rendu = await rendre(spec(format));
      const doc = await adaptateurPour(format).ouvrir(rendu.buffer);
      const texte = texteLisible(doc.modele(), rendu.buffer);

      // Combien de lignes de données le fichier porte-t-il vraiment ? On le lit, on ne le
      // suppose pas — « Produit 60 » n'est présent que si la 60ᵉ ligne y est.
      const portees = Array.from({ length: LIGNES }, (_, i) => i + 1).filter((i) => texte.includes(`Produit ${i}`)).length;
      if (portees >= LIGNES * FEUILLES || portees >= LIGNES) return; // rien n'a été coupé : rien à dire

      // Un nombre, quelque part, doit dire combien manque. On accepte le compte du reste comme
      // le compte total : les deux informent honnêtement, « au total » et « de plus ».
      const manquant = LIGNES - portees;
      const chiffres = new Set((texte.match(/\d+/g) ?? []).map(Number));
      expect(
        chiffres.has(manquant) || chiffres.has(LIGNES),
        `${format} coupe ${manquant} ligne(s) sans l'écrire nulle part`,
      ).toBe(true);
    });
  }

  it("le deck NOMME les tableaux qui n'y sont pas", async () => {
    const rendu = await rendre(spec("PPTX"));
    const doc = await adaptateurPour("PPTX").ouvrir(rendu.buffer);
    const texte = texteLisible(doc.modele(), rendu.buffer);
    expect(texte, "un lecteur croit voir tout le classeur").toContain(`Feuille ${FEUILLES}`);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TOTAL SURVIT DANS LES CINQ FORMATS — le piège de la promotion (§118.59).
 *
 * `promouvoirTotaux` sort la ligne de total des DONNÉES pour en faire une OPÉRATION : parfait
 * pour le classeur, qui écrit une formule. Mais le Word, le PDF, le CSV et le deck ne rendent
 * que `rows` et n'ont jamais lu `totals` — la promotion, seule, aurait fait DISPARAÎTRE le
 * total de quatre livrables sur cinq. Une régression qu'aucun contrôle de structure ne voit :
 * le fichier s'ouvre, il est simplement amputé.
 *
 * CE QUI FERAIT TOMBER CE TEST : rendre `rows` sans la ligne calculée, dans n'importe lequel
 * des cinq formats.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("un total déclaré apparaît dans TOUS les formats", () => {
  const avecTotal = (format: FormatArtefact): ArtefactSpec => ({
    key: "k", title: "Consolidation", format,
    summary: [{ heading: "Synthèse", paragraphs: ["Deux produits."], bullets: [] }],
    sheets: [{
      name: "Ventes",
      columns: [{ header: "Produit", key: "produit", type: "text" }, { header: "CA", key: "ca", type: "money" }],
      rows: [{ produit: "Nivolex", ca: 84500 }, { produit: "Trastuzex", ca: 91000 }],
      totals: { ca: "SUM" },
    }],
    charts: [], sources: ["ERP"],
  });

  for (const format of ["DOCX", "PPTX", "PDF", "XLSX"] as const) {
    it(`${format} porte la ligne de total et sa valeur`, async () => {
      const rendu = await rendre(avecTotal(format));
      const doc = await adaptateurPour(format).ouvrir(rendu.buffer);
      const texte = normaliser(texteLisible(doc.modele(), rendu.buffer));
      expect(texte, `${format} a perdu le libellé de la ligne de total`).toContain("TOTAL");
      // Le classeur porte une FORMULE : sa valeur ne s'écrit qu'à l'ouverture dans Excel. Les
      // quatre autres n'ont pas de moteur, donc ils doivent porter le NOMBRE.
      if (format !== "XLSX") expect(texte, `${format} affiche un total vide`).toContain("175500");
    });
  }

  it("CSV : la dernière ligne est le total, calculé par le code", () => {
    const csv = rendreCsv(avecTotal("CSV")).toString("utf8").trim().split("\r\n");
    expect(csv.at(-1)).toBe("TOTAL;175500");
  });
});
