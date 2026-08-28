/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC DU LIVE OFFICE (§97) — les cibles de §29, MESURÉES.
 *
 * §29 pose deux chiffres : une modification simple sous une à deux secondes, une suppression de
 * page PDF « quasi instantanée ». Une cible sans mesure est un vœu. Ce banc exerce le VRAI
 * chemin — ouverture, analyse, commande, sérialisation, relecture — sur de VRAIS fichiers, et
 * rend des P50 / P95.
 *
 *   npx tsx scripts/bench/office-bench.ts
 *
 * ── CE QUI EST MESURÉ, ET CE QUI NE L'EST PAS ───────────────────────────────────────────
 *
 * MESURÉ : l'ouverture (décompression + analyse + construction du modèle), l'application d'une
 * commande, la sérialisation, la rastérisation d'une page PDF, le décodage d'une phrase.
 *
 * PAS MESURÉ, et dit franchement : la latence réseau, le déchiffrement du blob Drive et l'aller-
 * retour d'action serveur. Ils dépendent de l'hébergement, pas de ce code ; les inventer ici
 * donnerait un chiffre flatteur et faux. Le chrono renvoyé par le moteur (`ResultatEdition.chrono`)
 * les inclut, lui, en production.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { adaptateurPdf } from "@/lib/artifact/adapters/pdf/adapter";
import { adaptateurXlsx } from "@/lib/artifact/adapters/xlsx/adapter";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { docxDeParagraphes, pdfNumerote, pptxDiapos, xlsxVentes } from "@/lib/artifact/adapters/fixtures";
import { cibleIndex, cibleRole, commande } from "@/lib/artifact/commands/ir";
import { decoder } from "@/lib/artifact/commands/nl";
import { rendrePagePdf } from "@/lib/artifact/render/raster";
import { percentiles } from "@/lib/artifact/observability/timing";
import type { DocumentOuvert } from "@/lib/artifact/adapters/contract";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";

const TOURS = 12;

interface Ligne {
  quoi: string;
  taille: string;
  p50: number;
  p95: number;
  max: number;
}

const lignes: Ligne[] = [];

async function mesurer(quoi: string, taille: string, tours: number, travail: () => Promise<void>): Promise<void> {
  // Un tour à blanc : le premier appel paie le chargement du module ESM de MuPDF et la
  // compilation à la volée. Le compter écraserait la médiane et donnerait un chiffre faux dans
  // le mauvais sens — ce n'est pas ce qu'une personne ressent au deuxième clic.
  await travail();
  const t: number[] = [];
  for (let i = 0; i < tours; i += 1) {
    const debut = performance.now();
    await travail();
    t.push(performance.now() - debut);
  }
  const p = percentiles(t);
  lignes.push({ quoi, taille, p50: p.p50, p95: p.p95, max: p.max });
}

/** Un document Word volumineux mais réaliste : un contrat de plusieurs dizaines de pages. */
async function grosDocx(paragraphes: number): Promise<Buffer> {
  const textes = ["Contrat de prestation"];
  for (let i = 1; i <= paragraphes; i += 1) {
    textes.push(`Article ${i} — Le prestataire s'engage à fournir les services décrits en annexe, dans les conditions et délais convenus entre les parties signataires du présent document.`);
  }
  return docxDeParagraphes(textes, { premierEstTitre: true, tableau: [["Poste", "Montant"], ["Conseil", "120 000 DZD"], ["Formation", "80 000 DZD"]] });
}

async function main(): Promise<void> {
  console.log("BANC LIVE OFFICE — cibles §29 : modification simple < 1–2 s, page PDF quasi instantanée\n");

  // ── Word ───────────────────────────────────────────────────────────────────────────
  for (const n of [40, 400]) {
    const octets = await grosDocx(n);
    const ko = Math.round(octets.length / 1024);
    let doc!: DocumentOuvert;
    await mesurer("DOCX ouvrir + modéliser", `${n} ¶ (${ko} Ko)`, TOURS, async () => {
      doc = await adaptateurDocx.ouvrir(octets);
      doc.modele();
    });
    await mesurer("DOCX centrer + 16 pt + Aptos", `${n} ¶`, TOURS, async () => {
      const d = await adaptateurDocx.ouvrir(octets);
      d.appliquer(commande("docx.align", { cible: cibleRole("titre"), alignement: "center" }));
      d.appliquer(commande("docx.format_texte", { cible: cibleIndex(1), taillePt: 16, police: "Aptos" }));
      d.modele();
    });
    await mesurer("DOCX sérialiser", `${n} ¶`, TOURS, async () => {
      await doc.serialiser();
    });
  }

  // ── PDF ────────────────────────────────────────────────────────────────────────────
  for (const n of [20, 300]) {
    const octets = await pdfNumerote(n);
    const ko = Math.round(octets.length / 1024);
    await mesurer("PDF ouvrir + modéliser", `${n} pages (${ko} Ko)`, TOURS, async () => {
      (await adaptateurPdf.ouvrir(octets)).modele();
    });
    await mesurer("PDF supprimer 3 pages", `${n} pages`, TOURS, async () => {
      const d = await adaptateurPdf.ouvrir(octets);
      d.appliquer(commande("pdf.supprimer_pages", { pages: [3, 5, 9] }));
      d.modele();
    });
    await mesurer("PDF rendre UNE page en PNG", `${n} pages`, Math.min(TOURS, 6), async () => {
      await rendrePagePdf(octets, Math.min(7, n));
    });
  }

  // ── Excel ──────────────────────────────────────────────────────────────────────────
  {
    const octets = await xlsxVentes();
    await mesurer("XLSX ouvrir + modéliser", `2 feuilles (${Math.round(octets.length / 1024)} Ko)`, TOURS, async () => {
      (await adaptateurXlsx.ouvrir(octets)).modele();
    });
    await mesurer("XLSX écrire + mettre en forme + trier", "2 feuilles", TOURS, async () => {
      const d = await adaptateurXlsx.ouvrir(octets);
      d.appliquer(commande("xlsx.valeur", { feuille: "Ventes", plage: "B3", texte: "Tlemcen" }));
      d.appliquer(commande("xlsx.format", { feuille: "Ventes", plage: "A1:C1", gras: true, remplissage: "1B7F79" }));
      d.appliquer(commande("xlsx.trier", { feuille: "Ventes", plage: "A2:C5", colonne: 3, direction: "desc" }));
      await d.serialiser();
    });
  }

  // ── PowerPoint ─────────────────────────────────────────────────────────────────────
  {
    const octets = await pptxDiapos(20);
    await mesurer("PPTX ouvrir + modéliser", `20 diapos (${Math.round(octets.length / 1024)} Ko)`, TOURS, async () => {
      (await adaptateurPptx.ouvrir(octets)).modele();
    });
    await mesurer("PPTX texte + format + déplacer", "20 diapos", TOURS, async () => {
      const d = await adaptateurPptx.ouvrir(octets);
      d.appliquer(commande("pptx.texte", { diapo: 2, cible: cibleIndex(1), texte: "Résultats 2026" }));
      d.appliquer(commande("pptx.format_texte", { diapo: 2, cible: cibleIndex(1), taillePt: 40, police: "Aptos" }));
      d.appliquer(commande("pptx.deplacer", { diapo: 2, cible: cibleIndex(1), dxCm: -1.5 }));
      await d.serialiser();
    });
  }

  // ── Le décodeur direct (§30) : le chemin SANS modèle ───────────────────────────────
  await mesurer("Décodage d'une phrase (0 modèle)", "—", 200, async () => {
    decoder("Centre le titre, réduis-le à 16", { format: "DOCX", derniereCible: [], activePage: null, activeSlide: null, activeSheet: null });
    decoder("Supprime les pages 12, 14 et 18", { format: "PDF", derniereCible: [], activePage: 1, activeSlide: null, activeSheet: null });
  });

  // ── Le rapport ─────────────────────────────────────────────────────────────────────
  const large = Math.max(...lignes.map((l) => l.quoi.length));
  const largeT = Math.max(...lignes.map((l) => l.taille.length));
  console.log(`${"opération".padEnd(large)}  ${"taille".padEnd(largeT)}  ${"P50".padStart(9)}  ${"P95".padStart(9)}  ${"max".padStart(9)}`);
  console.log("─".repeat(large + largeT + 35));
  for (const l of lignes) {
    console.log(`${l.quoi.padEnd(large)}  ${l.taille.padEnd(largeT)}  ${`${l.p50} ms`.padStart(9)}  ${`${l.p95} ms`.padStart(9)}  ${`${l.max} ms`.padStart(9)}`);
  }

  // ── Le verdict, chiffré ────────────────────────────────────────────────────────────
  const CIBLE_EDITION_MS = 1000;
  const CIBLE_PAGE_PDF_MS = 400;
  const editions = lignes.filter((l) => /centrer|supprimer|écrire|texte \+ format/.test(l.quoi));
  const pages = lignes.filter((l) => l.quoi.includes("rendre UNE page"));
  const lentes = editions.filter((l) => l.p95 > CIBLE_EDITION_MS);
  const lentesPages = pages.filter((l) => l.p95 > CIBLE_PAGE_PDF_MS);

  console.log(`\nCIBLE §29 — modification simple : P95 < ${CIBLE_EDITION_MS} ms (hors réseau)`);
  console.log(lentes.length === 0
    ? `  ✓ les ${editions.length} opérations d'édition tiennent la cible`
    : `  ✗ ${lentes.length} au-dessus : ${lentes.map((l) => `${l.quoi} (${l.taille}) ${l.p95} ms`).join(", ")}`);
  console.log(`CIBLE §29 — page PDF affichée : P95 < ${CIBLE_PAGE_PDF_MS} ms`);
  console.log(lentesPages.length === 0
    ? `  ✓ le rendu d'une page tient la cible, y compris sur 300 pages`
    : `  ✗ ${lentesPages.map((l) => `${l.taille} : ${l.p95} ms`).join(", ")}`);
  console.log("\nNON MESURÉ ICI (dépend de l'hébergement, pas de ce code) : réseau, déchiffrement");
  console.log("du blob Drive, aller-retour d'action serveur. Le chrono du moteur les inclut en production.");

  if (lentes.length || lentesPages.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
