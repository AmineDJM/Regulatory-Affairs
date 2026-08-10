import { describe, it, expect } from "vitest";
import {
  buildOrgChartSvg, buildPrintDocument, escapeXml, clip,
  type PrintNode, type PrintPoint,
} from "./org-chart-print";

const at = (x: number, y: number): PrintPoint => ({ x, y });

const node = (over: Partial<PrintNode> & { id: string }): PrintNode => ({
  fullName: "Sans nom", position: null, entity: null, color: null, managerId: null, ...over,
});

describe("escapeXml", () => {
  it("neutralise ce qui casserait le document", () => {
    expect(escapeXml('A & B <c> "d" \'e\'')).toBe("A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;");
  });
});

describe("clip", () => {
  it("tronque au-delà de la largeur d'une boîte, sinon laisse intact", () => {
    expect(clip("court", 20)).toBe("court");
    expect(clip("  espaces  ", 20)).toBe("espaces");
    expect(clip("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("buildOrgChartSvg", () => {
  it("dessine une boîte par personne et un lien par rattachement affiché", () => {
    const nodes = [
      node({ id: "a", fullName: "Directrice" }),
      node({ id: "b", fullName: "Chef de produit", managerId: "a" }),
    ];
    const pos = new Map([["a", at(40, 40)], ["b", at(40, 160)]]);
    const { svg } = buildOrgChartSvg(nodes, pos);
    expect(svg.match(/<rect [^>]*rx="8"/g)).toHaveLength(2);
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg).toContain("Directrice");
  });

  it("ne relie PAS à un responsable absent de la vue (filtre par entité)", () => {
    // Le responsable est chez une autre société : le filtre l'a retiré. Tracer le lien
    // dessinerait une flèche vers le vide, qui se lit comme une erreur de structure.
    const nodes = [node({ id: "b", fullName: "Chef de produit", managerId: "absent" })];
    const { svg } = buildOrgChartSvg(nodes, new Map([["b", at(40, 40)]]));
    expect(svg).not.toContain("<path ");
  });

  it("ignore une personne sans position plutôt que de produire des NaN", () => {
    const nodes = [node({ id: "a", fullName: "A" }), node({ id: "b", fullName: "B" })];
    const { svg, width, height } = buildOrgChartSvg(nodes, new Map([["a", at(40, 40)]]));
    expect(svg).not.toContain("NaN");
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
  });

  it("dimensionne la feuille sur la boîte la plus éloignée", () => {
    const nodes = [node({ id: "a", fullName: "A" })];
    const { width, height } = buildOrgChartSvg(nodes, new Map([["a", at(1000, 800)]]));
    expect(width).toBeGreaterThan(1000);
    expect(height).toBeGreaterThan(800);
  });

  it("garde un minimum lisible même pour une seule personne", () => {
    const { width, height } = buildOrgChartSvg([node({ id: "a" })], new Map([["a", at(0, 0)]]));
    expect(width).toBeGreaterThanOrEqual(640);
    expect(height).toBeGreaterThanOrEqual(420);
  });

  it("refuse une couleur d'entité qui n'en est pas une (pas d'injection d'attribut)", () => {
    const nodes = [node({ id: "a", fullName: "A", color: '" onload="alert(1)' })];
    const { svg } = buildOrgChartSvg(nodes, new Map([["a", at(10, 10)]]));
    expect(svg).not.toContain("onload");
    expect(svg).not.toContain("<circle");
  });

  it("accepte une couleur hexadécimale légitime", () => {
    const nodes = [node({ id: "a", fullName: "A", color: "#1d4ed8" })];
    const { svg } = buildOrgChartSvg(nodes, new Map([["a", at(10, 10)]]));
    expect(svg).toContain('fill="#1d4ed8"');
  });

  it("échappe les noms dans le SVG", () => {
    const nodes = [node({ id: "a", fullName: "Ben & Co <script>" })];
    const { svg } = buildOrgChartSvg(nodes, new Map([["a", at(10, 10)]]));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&amp;");
  });
});

describe("buildPrintDocument", () => {
  it("impose le PAYSAGE dans la boîte de dialogue d'impression", () => {
    const chart = buildOrgChartSvg([node({ id: "a" })], new Map([["a", at(10, 10)]]));
    const html = buildPrintDocument(chart, "Organigramme", "Adventum · 12 personnes");
    expect(html).toContain("size: A4 landscape");
  });

  it("met la carte à l'échelle de la feuille au lieu de la tronquer", () => {
    const chart = buildOrgChartSvg([node({ id: "a" })], new Map([["a", at(3000, 10)]]));
    const html = buildPrintDocument(chart, "T", "S");
    expect(html).toContain("svg { width: 100%; height: auto; }");
  });

  it("échappe le titre et le sous-titre", () => {
    const chart = buildOrgChartSvg([node({ id: "a" })], new Map([["a", at(10, 10)]]));
    const html = buildPrintDocument(chart, "A & B", "<b>x</b>");
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<b>x</b>");
  });
});
