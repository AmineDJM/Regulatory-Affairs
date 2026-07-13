import * as XLSX from "xlsx";
import type { BudgetOverview, EnvelopesGrandTotal } from "@/lib/queries/budget";

/**
 * EXPORT EXCEL (.xlsx) du budget avec le TAUX DE CONSOMMATION actuel. Feuille 1 : l'enveloppe
 * affichée (catégories + sous-catégories, alloué / consommé / engagé / reste / % consommé).
 * Feuille 2 (si fournie) : le total de toutes les enveloppes accessibles. Serveur uniquement.
 */

const rate = (consumed: number, base: number) => (base > 0 ? Math.round((consumed / base) * 100) : 0);
const day = (iso: string) => iso.slice(0, 10);

export function buildBudgetWorkbook(overview: BudgetOverview, grandTotal?: EnvelopesGrandTotal): Buffer {
  const wb = XLSX.utils.book_new();
  const env = overview.envelope;
  const t = overview.totals;
  const catNameById = new Map(overview.categories.map((c) => [c.id, c.name]));

  const rows: (string | number)[][] = [
    [`Enveloppe : ${env.name}`],
    [`Période : ${day(overview.period.from)} → ${day(overview.period.to)}`],
    [`Budget total : ${t.total}`, `Alloué : ${t.allocated}`, `Consommé : ${t.consumed}`, `Reste : ${t.remaining}`, `Taux global : ${t.pct} %`],
    [],
    ["Catégorie", "Sous-catégorie de", "Module", "Alloué (DZD)", "Consommé (DZD)", "Engagé (DZD)", "Reste (DZD)", "Taux consommation (%)"],
  ];
  for (const c of overview.categories) {
    rows.push([
      c.name,
      c.parentId ? catNameById.get(c.parentId) ?? "" : "",
      c.module ?? "",
      c.allocated, c.consumed, c.committed, c.remaining, rate(c.consumed, c.allocated),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Enveloppe");

  if (grandTotal && grandTotal.items.length > 0) {
    const gRows: (string | number)[][] = [
      ["Enveloppe", "Statut", "Budget (DZD)", "Alloué (DZD)", "Consommé (DZD)", "Reste (DZD)", "Taux consommation (%)"],
      ...grandTotal.items.map((i) => [i.name, i.isActive ? "Active" : "Archivée", i.total, i.allocated, i.consumed, i.remaining, rate(i.consumed, i.total)]),
      [],
      ["TOTAL", "", grandTotal.total, grandTotal.allocated, grandTotal.consumed, grandTotal.remaining, rate(grandTotal.consumed, grandTotal.total)],
    ];
    const gws = XLSX.utils.aoa_to_sheet(gRows);
    gws["!cols"] = [{ wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, gws, "Total enveloppes");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Nom de fichier sûr pour l'export (nom d'enveloppe assaini + date du jour). */
export function budgetExportFilename(envelopeName: string): string {
  const safe = envelopeName.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) || "budget";
  return `budget-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
