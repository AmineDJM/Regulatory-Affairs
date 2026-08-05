import * as XLSX from "xlsx";

/**
 * EXPORT EXCEL D'UN APPEL D'OFFRES PCH — le tableau que l'on remplit pour répondre.
 *
 * Une feuille par usage, parce qu'on ne travaille pas la réponse commerciale et l'analyse de
 * marché au même moment :
 *   • **Produits demandés** — ce que la PCH demande, tel qu'extrait du document : désignation,
 *     molécule, dosage, forme, quantité et **nature de l'unité** (comprimé, flacon, seringue…),
 *     conditionnement, nombre de boîtes à fournir, prix de référence des réceptions PCH,
 *     et notre position (avons-nous le produit, à quel prix).
 *   • **Analyse de marché** — ce que l'Intelligence marché sait de chaque produit : taille du
 *     marché, partage ville / hôpital, concentration, principaux concurrents, et si le marché
 *     est tenu par des fabricants locaux ou des importateurs.
 *
 * Serveur uniquement. Aucun chiffre inventé : les colonnes vides le restent.
 */

export interface TenderExportLine {
  designation: string;
  dci: string | null;
  dosage: string | null;
  form: string | null;
  unitLabel: string | null;
  quantityUnits: number;
  unitsPerBox: number | null;
  refPriceDzd: number | null;
  refPriceSource: string | null;
  haveProduct: boolean;
  ourProduct: string | null;
  unitPriceDzd: number | null;
  registeredNomenclature: boolean;
  registeredOurs: boolean;
  status: string;
  marketEstimateDzd: number | null;
  competitorCount: number | null;
  marketOrigin: string | null;
  marketVillePct: number | null;
  marketHopitalPct: number | null;
  marketHhi: number | null;
  competitorsTop: string | null;
  note: string | null;
}

export interface TenderExportHeader {
  reference: string;
  title: string;
  buyer: string | null;
  submissionDeadline: string | null;
}

const ORIGIN_LABEL: Record<string, string> = {
  LOCAL: "Fabriqué localement",
  IMPORT: "Importé",
  MIXTE: "Local et importé",
};

/** Nombre de boîtes à fournir = ⌈unités / unités par boîte⌉ (vide si le conditionnement est inconnu). */
export function boxesNeeded(quantityUnits: number, unitsPerBox: number | null): number | "" {
  if (!unitsPerBox || unitsPerBox <= 0 || quantityUnits <= 0) return "";
  return Math.ceil(quantityUnits / unitsPerBox);
}

/** Concentration lisible : c'est ce mot qui compte, pas l'indice brut. */
export function concentrationLabel(hhi: number | null): string {
  if (hhi == null) return "";
  if (hhi >= 2500) return "Concentré";
  if (hhi >= 1500) return "Modéré";
  return "Fragmenté";
}

export function buildTenderWorkbook(header: TenderExportHeader, lines: TenderExportLine[]): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Feuille 1 : les produits demandés (la réponse commerciale)
  const rows: (string | number)[][] = [
    [`Appel d'offres : ${header.reference}`],
    [header.title],
    [
      header.buyer ? `Acheteur : ${header.buyer}` : "",
      header.submissionDeadline ? `Remise des offres : ${header.submissionDeadline.slice(0, 10)}` : "",
      `Produits demandés : ${lines.length}`,
    ],
    [],
    [
      "N°", "Désignation (document)", "Molécule (DCI)", "Dosage", "Forme", "Unité demandée",
      "Quantité (unités)", "Unités par boîte", "Boîtes à fournir",
      "Prix réf. PCH (DZD/unité)", "Source du prix de référence",
      "Valeur du marché au prix de réf. (DZD)",
      "Nous l'avons ?", "Notre produit", "Notre prix (DZD/unité)",
      "Enregistré nomenclature", "Notre produit enregistré", "Statut", "Note",
    ],
  ];
  lines.forEach((l, i) => {
    const boxes = boxesNeeded(l.quantityUnits, l.unitsPerBox);
    rows.push([
      i + 1,
      l.designation,
      l.dci ?? "",
      l.dosage ?? "",
      l.form ?? "",
      l.unitLabel ?? "",
      l.quantityUnits || "",
      l.unitsPerBox ?? "",
      boxes,
      l.refPriceDzd ?? "",
      l.refPriceSource ?? "",
      l.refPriceDzd != null && l.quantityUnits > 0 ? Math.round(l.refPriceDzd * l.quantityUnits) : "",
      l.haveProduct ? "Oui" : "Non",
      l.ourProduct ?? "",
      l.unitPriceDzd ?? "",
      l.registeredNomenclature ? "Oui" : "Non",
      l.registeredOurs ? "Oui" : "Non",
      l.status,
      l.note ?? "",
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 44 }, { wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 15 }, { wch: 20 }, { wch: 38 }, { wch: 26 },
    { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Produits demandés");

  // ── Feuille 2 : l'analyse de marché (l'aide à la décision)
  const mRows: (string | number)[][] = [
    [
      "N°", "Désignation", "Molécule (DCI)", "Dosage", "Forme",
      "Taille du marché (DZD)", "Concurrents", "Part ville (%)", "Part hôpital (%)",
      "Concentration", "HHI", "Principaux acteurs", "Production",
    ],
  ];
  lines.forEach((l, i) => {
    mRows.push([
      i + 1,
      l.designation,
      l.dci ?? "",
      l.dosage ?? "",
      l.form ?? "",
      l.marketEstimateDzd ?? "",
      l.competitorCount ?? "",
      l.marketVillePct ?? "",
      l.marketHopitalPct ?? "",
      concentrationLabel(l.marketHhi),
      l.marketHhi ?? "",
      l.competitorsTop ?? "",
      l.marketOrigin ? ORIGIN_LABEL[l.marketOrigin] ?? l.marketOrigin : "",
    ]);
  });
  const mws = XLSX.utils.aoa_to_sheet(mRows);
  mws["!cols"] = [
    { wch: 5 }, { wch: 44 }, { wch: 26 }, { wch: 12 }, { wch: 16 },
    { wch: 22 }, { wch: 13 }, { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 8 },
    { wch: 46 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, mws, "Analyse de marché");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Nom de fichier sûr (référence assainie + date du jour). */
export function tenderExportFilename(reference: string): string {
  const safe = reference.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) || "appel-offres";
  return `appel-offres-${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
