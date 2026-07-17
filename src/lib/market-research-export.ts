import * as XLSX from "xlsx";
import type { ResearchDetail } from "@/lib/queries/market-research";

/**
 * EXPORT EXCEL (.xlsx) d'une étude de marché — colonnes exactes du modèle :
 * Therapeutic class · N · Product · Market size (Volume / $ Value) · Avg Price/Box $ ·
 * Number of Players · [Player i · Market Share i · Status i]… · Commentaires. Serveur uniquement.
 */
const STATUS: Record<string, string> = { IMPORT: "Importation", MANUFACTURING: "Fabrication" };

export function buildResearchWorkbook(d: ResearchDetail): Buffer {
  const wb = XLSX.utils.book_new();
  const maxPlayers = Math.max(1, ...d.rows.map((r) => r.players.length));

  const header: (string | number)[] = [
    "Therapeutic class", "N", "Product", "Market size in Volume", "Market size in $ Value",
    "Avrg Price Per Box $", "Number of Players in the market",
  ];
  for (let i = 1; i <= maxPlayers; i++) header.push(`Player ${i}`, `Market Share Player ${i} (value)`, `Status Player ${i} (Import or manufacturing)`);
  header.push("Commentaires");

  const rows: (string | number)[][] = [header];
  d.rows.forEach((r, idx) => {
    const line: (string | number)[] = [
      r.therapeuticClass ?? "", idx + 1, r.product,
      r.marketVolume ?? "", r.marketValueUsd ?? "", r.avgPricePerBoxUsd ?? "", r.players.length,
    ];
    for (let i = 0; i < maxPlayers; i++) {
      const p = r.players[i];
      line.push(p?.name ?? "", p?.marketShareValue ?? "", p?.status ? STATUS[p.status] ?? p.status : "");
    }
    line.push(r.comment ?? "");
    rows.push(line);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 4 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, ...Array.from({ length: maxPlayers * 3 }, () => ({ wch: 20 })), { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Market Research");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function researchExportFilename(title: string): string {
  const safe = title.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 60) || "market_research";
  return `Market_Research_${safe}.xlsx`;
}
