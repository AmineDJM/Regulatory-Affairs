/**
 * CONSTRUCTION du fichier PowerPoint (.pptx) d'une présentation stratégique de marché — **serveur uniquement**.
 *
 * Prend l'étude (données chiffrées) + l'analyse IA structurée et produit un vrai .pptx éditable
 * (pptxgenjs) : page de titre, synthèse, tableau du marché, graphe des valeurs, une diapo par produit
 * (avec parts de marché), opportunités/risques, et la diapo OPINION / recommandation. Le .pptx est
 * (re)généré à la demande — jamais stocké en binaire.
 */

import pptxgen from "pptxgenjs";
import type { ResearchDetail } from "@/lib/queries/market-research";
import type { PresentationAnalysis } from "@/lib/market-presentation";

// Palette Adventum — sobre et pro (navy + teal + accents).
const NAVY = "0B2545";
const TEAL = "1B7F79";
const ACCENT = "E0A458";
const LIGHT = "F4F6F8";
const GREY = "5B6470";
const RED = "B4451F";
const GREEN = "1B7F79";

const STATUS_FR: Record<string, string> = { IMPORT: "Importation", MANUFACTURING: "Fabrication locale" };

const fmtNum = (v: number | null): string =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);
const fmtUsd = (v: number | null): string =>
  v == null ? "—" : `$ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)}`;
const fmtPrice = (v: number | null): string =>
  v == null ? "—" : `$ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v)}`;

/** Bandeau de titre commun à toutes les diapos de contenu. */
function header(slide: pptxgen.Slide, title: string): void {
  slide.addShape("rect", { x: 0, y: 0, w: "100%", h: 0.9, fill: { color: NAVY } });
  slide.addShape("rect", { x: 0, y: 0.9, w: "100%", h: 0.06, fill: { color: TEAL } });
  slide.addText(title, { x: 0.5, y: 0.12, w: 12.3, h: 0.66, fontSize: 22, bold: true, color: "FFFFFF", valign: "middle" });
}

function footer(slide: pptxgen.Slide, studyTitle: string): void {
  slide.addText(
    [
      { text: "Adventum Pharma", options: { bold: true, color: TEAL } },
      { text: `  ·  ${studyTitle}`, options: { color: GREY } },
    ],
    { x: 0.5, y: 7.05, w: 10, h: 0.3, fontSize: 9 },
  );
  slide.addText("Analyse assistée par IA — à valider", { x: 10.5, y: 7.05, w: 2.3, h: 0.3, fontSize: 9, italic: true, color: GREY, align: "right" });
}

/** Construit et sérialise le .pptx. Renvoie un Buffer prêt à télécharger. */
export async function buildPresentationPptx(
  d: ResearchDetail,
  a: PresentationAnalysis,
  meta: { presentationTitle: string; version: number; generatedAt: Date },
): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 pouces
  pptx.author = "Adventum Pharma";
  pptx.company = "Adventum Pharma";
  pptx.subject = "Analyse stratégique de marché";
  pptx.title = meta.presentationTitle;

  const dateStr = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(meta.generatedAt);

  // ── 1. Diapo de titre ─────────────────────────────────────────────
  const t = pptx.addSlide();
  t.background = { color: NAVY };
  t.addShape("rect", { x: 0, y: 3.15, w: 13.33, h: 0.06, fill: { color: ACCENT } });
  t.addText("ANALYSE STRATÉGIQUE DE MARCHÉ", { x: 0.7, y: 2.15, w: 12, h: 0.5, fontSize: 16, color: ACCENT, charSpacing: 2, bold: true });
  t.addText(d.title, { x: 0.7, y: 2.6, w: 12, h: 1.1, fontSize: 34, bold: true, color: "FFFFFF" });
  t.addText(
    [
      { text: "Adventum Pharma", options: { fontSize: 16, color: "FFFFFF", bold: true } },
      { text: `\n${dateStr}  ·  Version ${meta.version}`, options: { fontSize: 13, color: "D8DEE6" } },
      { text: `\n${d.rows.length} produit(s) / molécule(s) étudié(s)`, options: { fontSize: 12, color: "9FB0C0" } },
    ],
    { x: 0.7, y: 3.5, w: 12, h: 1.2, lineSpacingMultiple: 1.2 },
  );

  // ── 2. Synthèse ───────────────────────────────────────────────────
  const s = pptx.addSlide();
  header(s, "Synthèse");
  s.addText("En bref", { x: 0.5, y: 1.2, w: 12.3, h: 0.35, fontSize: 14, bold: true, color: TEAL });
  s.addText(a.executiveSummary || "—", { x: 0.5, y: 1.55, w: 12.3, h: 1.6, fontSize: 15, color: "222222", valign: "top", lineSpacingMultiple: 1.15 });
  s.addText("Panorama du marché", { x: 0.5, y: 3.3, w: 12.3, h: 0.35, fontSize: 14, bold: true, color: TEAL });
  s.addText(a.marketOverview || "—", { x: 0.5, y: 3.65, w: 12.3, h: 3.0, fontSize: 14, color: "333333", valign: "top", lineSpacingMultiple: 1.15 });
  footer(s, d.title);

  // ── 3. Tableau du marché (colonnes du modèle) ─────────────────────
  const tbl = pptx.addSlide();
  header(tbl, "Le marché en chiffres");
  const head = ["Classe", "Produit", "Volume", "Valeur $", "Prix/boîte $", "Acteurs"].map((h) => ({
    text: h,
    options: { bold: true, color: "FFFFFF", fill: { color: TEAL }, fontSize: 11, align: "center" as const, valign: "middle" as const },
  }));
  const bodyRows = d.rows.map((r, i) => {
    const fill = i % 2 === 0 ? "FFFFFF" : LIGHT;
    const cell = (text: string, align: "left" | "right" | "center" = "left") => ({ text, options: { fill: { color: fill }, fontSize: 10, align, valign: "middle" as const, color: "222222" } });
    return [cell(r.therapeuticClass ?? "—"), cell(r.product), cell(fmtNum(r.marketVolume), "right"), cell(fmtUsd(r.marketValueUsd), "right"), cell(fmtPrice(r.avgPricePerBoxUsd), "right"), cell(String(r.players.length), "center")];
  });
  tbl.addTable([head, ...bodyRows], {
    x: 0.4, y: 1.2, w: 12.5, colW: [2.2, 3.3, 2.0, 2.2, 1.9, 0.9],
    border: { type: "solid", color: "D5DAE0", pt: 0.5 }, autoPage: true, autoPageRepeatHeader: true, newSlideStartY: 1.2,
  });
  footer(tbl, d.title);

  // ── 4. Graphe : valeur du marché par produit ─────────────────────
  const valued = d.rows.filter((r) => r.marketValueUsd != null && r.marketValueUsd > 0);
  if (valued.length >= 2) {
    const g = pptx.addSlide();
    header(g, "Taille du marché par produit (valeur $)");
    g.addChart(
      pptx.ChartType.bar,
      [{ name: "Valeur du marché ($)", labels: valued.map((r) => r.product), values: valued.map((r) => Number(r.marketValueUsd)) }],
      {
        x: 0.5, y: 1.25, w: 12.3, h: 5.4, barDir: "bar", chartColors: [TEAL],
        showValue: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 9,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, showLegend: false, valGridLine: { style: "none" },
      },
    );
    footer(g, d.title);
  }

  // ── 5. Une diapo par produit (analyse + parts de marché) ──────────
  d.rows.forEach((r) => {
    const p = pptx.addSlide();
    header(p, r.product);
    if (r.therapeuticClass) p.addText(r.therapeuticClass, { x: 0.5, y: 1.05, w: 8, h: 0.3, fontSize: 12, italic: true, color: GREY });

    // Cartons de KPI
    const kpis: [string, string][] = [
      ["Volume", fmtNum(r.marketVolume)],
      ["Valeur $", fmtUsd(r.marketValueUsd)],
      ["Prix/boîte", fmtPrice(r.avgPricePerBoxUsd)],
      ["Acteurs", String(r.players.length)],
    ];
    kpis.forEach(([label, val], i) => {
      const x = 0.5 + i * 3.05;
      p.addShape("roundRect", { x, y: 1.5, w: 2.85, h: 1.05, rectRadius: 0.06, fill: { color: LIGHT }, line: { color: "E1E6EB", width: 1 } });
      p.addText(label.toUpperCase(), { x: x + 0.1, y: 1.6, w: 2.65, h: 0.3, fontSize: 9, color: GREY, bold: true, charSpacing: 1 });
      p.addText(val, { x: x + 0.1, y: 1.9, w: 2.65, h: 0.55, fontSize: 17, bold: true, color: NAVY, valign: "middle" });
    });

    // Analyse IA du produit
    const pa = a.productAnalyses.find((x) => x.product.trim().toLowerCase() === r.product.trim().toLowerCase());
    p.addText("Analyse", { x: 0.5, y: 2.75, w: 7.0, h: 0.3, fontSize: 13, bold: true, color: TEAL });
    p.addText(pa?.analysis || "—", { x: 0.5, y: 3.05, w: 7.0, h: 3.5, fontSize: 13, color: "333333", valign: "top", lineSpacingMultiple: 1.15 });

    // Parts de marché des acteurs (camembert si valeurs, sinon liste)
    const withShare = r.players.filter((pl) => pl.marketShareValue != null && pl.marketShareValue > 0);
    if (withShare.length >= 2) {
      p.addText("Parts de marché", { x: 8.0, y: 2.75, w: 4.8, h: 0.3, fontSize: 13, bold: true, color: TEAL });
      p.addChart(
        pptx.ChartType.pie,
        [{ name: "Parts", labels: withShare.map((pl) => pl.name), values: withShare.map((pl) => Number(pl.marketShareValue)) }],
        { x: 7.9, y: 3.0, w: 5.0, h: 3.5, showLegend: true, legendPos: "r", legendFontSize: 9, showValue: false, dataLabelFontSize: 9 },
      );
    } else if (r.players.length) {
      p.addText("Acteurs", { x: 8.0, y: 2.75, w: 4.8, h: 0.3, fontSize: 13, bold: true, color: TEAL });
      const rows = r.players.map((pl, i) => {
        const fill = i % 2 === 0 ? "FFFFFF" : LIGHT;
        return [
          { text: pl.name, options: { fill: { color: fill }, fontSize: 10, color: "222222", valign: "middle" as const } },
          { text: pl.status ? STATUS_FR[pl.status] ?? pl.status : "—", options: { fill: { color: fill }, fontSize: 9, color: pl.status === "MANUFACTURING" ? GREEN : GREY, align: "right" as const, valign: "middle" as const } },
        ];
      });
      p.addTable([[{ text: "Acteur", options: { bold: true, color: "FFFFFF", fill: { color: TEAL }, fontSize: 10 } }, { text: "Statut", options: { bold: true, color: "FFFFFF", fill: { color: TEAL }, fontSize: 10, align: "right" as const } }], ...rows], {
        x: 8.0, y: 3.05, w: 4.85, colW: [3.15, 1.7], border: { type: "solid", color: "E1E6EB", pt: 0.5 }, autoPage: false,
      });
    }
    if (r.comment) p.addText([{ text: "Note : ", options: { bold: true, color: GREY } }, { text: r.comment, options: { color: GREY } }], { x: 0.5, y: 6.55, w: 12.3, h: 0.4, fontSize: 9, valign: "top" });
    footer(p, d.title);
  });

  // ── 6. Paysage concurrentiel ──────────────────────────────────────
  const c = pptx.addSlide();
  header(c, "Paysage concurrentiel");
  c.addText(a.competition || "—", { x: 0.5, y: 1.3, w: 12.3, h: 5.3, fontSize: 15, color: "333333", valign: "top", lineSpacingMultiple: 1.2 });
  footer(c, d.title);

  // ── 7. Opportunités & risques ─────────────────────────────────────
  if (a.opportunities.length || a.risks.length) {
    const o = pptx.addSlide();
    header(o, "Opportunités & risques");
    o.addShape("roundRect", { x: 0.5, y: 1.25, w: 6.05, h: 5.4, rectRadius: 0.06, fill: { color: "EAF4F3" }, line: { color: TEAL, width: 1 } });
    o.addText("OPPORTUNITÉS", { x: 0.75, y: 1.45, w: 5.6, h: 0.35, fontSize: 13, bold: true, color: TEAL, charSpacing: 1 });
    o.addText(
      (a.opportunities.length ? a.opportunities : ["—"]).map((x) => ({ text: x, options: { bullet: { code: "2022" }, color: "24303A" } })),
      { x: 0.8, y: 1.9, w: 5.5, h: 4.6, fontSize: 13, valign: "top", lineSpacingMultiple: 1.25, paraSpaceAfter: 8 },
    );
    o.addShape("roundRect", { x: 6.8, y: 1.25, w: 6.05, h: 5.4, rectRadius: 0.06, fill: { color: "FBEFEA" }, line: { color: RED, width: 1 } });
    o.addText("RISQUES & BARRIÈRES", { x: 7.05, y: 1.45, w: 5.6, h: 0.35, fontSize: 13, bold: true, color: RED, charSpacing: 1 });
    o.addText(
      (a.risks.length ? a.risks : ["—"]).map((x) => ({ text: x, options: { bullet: { code: "2022" }, color: "3A2622" } })),
      { x: 7.1, y: 1.9, w: 5.5, h: 4.6, fontSize: 13, valign: "top", lineSpacingMultiple: 1.25, paraSpaceAfter: 8 },
    );
    footer(o, d.title);
  }

  // ── 8. Opinion & recommandation (l'avis de l'IA) ──────────────────
  const op = pptx.addSlide();
  header(op, "Opinion & recommandation");
  op.addText("Notre lecture stratégique", { x: 0.5, y: 1.2, w: 12.3, h: 0.35, fontSize: 14, bold: true, color: TEAL });
  op.addText(a.opinion || "—", { x: 0.5, y: 1.55, w: 12.3, h: 3.6, fontSize: 15, color: "222222", valign: "top", lineSpacingMultiple: 1.2 });
  op.addShape("roundRect", { x: 0.5, y: 5.3, w: 12.3, h: 1.35, rectRadius: 0.08, fill: { color: NAVY } });
  op.addText([{ text: "RECOMMANDATION\n", options: { fontSize: 11, bold: true, color: ACCENT, charSpacing: 1 } }, { text: a.recommendation || "—", options: { fontSize: 15, bold: true, color: "FFFFFF" } }], { x: 0.8, y: 5.45, w: 11.7, h: 1.05, valign: "middle", lineSpacingMultiple: 1.05 });
  footer(op, d.title);

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

export function presentationFilename(title: string, version: number): string {
  const safe = title.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 60) || "presentation";
  return `Presentation_${safe}_v${version}.pptx`;
}
