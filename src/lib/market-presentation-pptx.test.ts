import { describe, it, expect } from "vitest";
import { buildPresentationPptx, presentationFilename } from "./market-presentation-pptx";
import type { ResearchDetail } from "./queries/market-research";
import type { PresentationAnalysis } from "./market-presentation";

const research: ResearchDetail = {
  id: "r1",
  title: "Marché des IPP en Algérie",
  status: "DRAFT",
  notes: "Étude test",
  rows: [
    {
      id: "row1", therapeuticClass: "Antiulcéreux", product: "Oméprazole 20mg",
      marketVolume: 1_200_000, marketValueUsd: 4_800_000, avgPricePerBoxUsd: 4, comment: "Marché mature",
      players: [
        { id: "p1", rank: 1, name: "Laboratoire A", marketShareValue: 45, status: "MANUFACTURING" },
        { id: "p2", rank: 2, name: "Laboratoire B", marketShareValue: 30, status: "IMPORT" },
        { id: "p3", rank: 3, name: "Laboratoire C", marketShareValue: 25, status: "IMPORT" },
      ],
    },
    {
      id: "row2", therapeuticClass: "Antidiabétiques", product: "Metformine 500mg",
      marketVolume: 3_000_000, marketValueUsd: 6_000_000, avgPricePerBoxUsd: 2, comment: null,
      players: [{ id: "p4", rank: 1, name: "Labo D", marketShareValue: null, status: "MANUFACTURING" }],
    },
  ],
};

const analysis: PresentationAnalysis = {
  executiveSummary: "Le marché combiné représente 10,8 M$ pour deux molécules matures.",
  marketOverview: "Panorama : forte présence de la fabrication locale sur les antidiabétiques.",
  productAnalyses: [
    { product: "Oméprazole 20mg", analysis: "Marché concurrentiel, fabrication locale dominante." },
    { product: "Metformine 500mg", analysis: "Volume élevé, prix bas, faible marge." },
  ],
  competition: "L'importation reste significative sur les IPP.",
  opportunities: ["Fabrication locale d'IPP", "Génériques à fort volume"],
  risks: ["Guerre des prix", "Dépendance aux importations d'API"],
  opinion: "Adventum devrait prioriser la fabrication locale d'oméprazole.",
  recommendation: "Cibler l'oméprazole en fabrication locale.",
};

describe("buildPresentationPptx", () => {
  it("produit un .pptx valide (signature ZIP) à partir de l'étude et de l'analyse", async () => {
    const buf = await buildPresentationPptx(research, analysis, { presentationTitle: "Test", version: 1, generatedAt: new Date("2026-07-17") });
    expect(Buffer.isBuffer(buf) || buf instanceof Uint8Array).toBe(true);
    // Un .pptx est une archive ZIP → commence par "PK".
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(5000);
  });

  it("ne plante pas quand les acteurs / valeurs sont absents", async () => {
    const bare: ResearchDetail = { id: "r2", title: "Vide", status: "DRAFT", notes: null, rows: [{ id: "x", therapeuticClass: null, product: "Produit X", marketVolume: null, marketValueUsd: null, avgPricePerBoxUsd: null, comment: null, players: [] }] };
    const minimal: PresentationAnalysis = { executiveSummary: "", marketOverview: "", productAnalyses: [], competition: "", opportunities: [], risks: [], opinion: "", recommendation: "" };
    const buf = await buildPresentationPptx(bare, minimal, { presentationTitle: "Vide", version: 1, generatedAt: new Date() });
    expect(buf[0]).toBe(0x50);
    expect(buf.length).toBeGreaterThan(3000);
  });
});

describe("presentationFilename", () => {
  it("nettoie le titre et ajoute la version", () => {
    expect(presentationFilename("Marché des IPP / 2026", 3)).toBe("Presentation_Marché_des_IPP_2026_v3.pptx");
  });
  it("gère un titre vide", () => {
    expect(presentationFilename("", 1)).toBe("Presentation_presentation_v1.pptx");
  });
});
