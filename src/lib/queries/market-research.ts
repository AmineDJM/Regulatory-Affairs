import { prisma } from "@/lib/prisma";
import { getMarketData } from "@/lib/market/data";

const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

/** DCI normalisés (MAJUSCULES) issus de la nomenclature DZ — pour le menu déroulant produit. */
export function nomenclatureDciOptions(): string[] {
  const set = new Set<string>();
  for (const r of getMarketData().nom) {
    const dci = (r.dci ?? "").trim();
    if (dci) set.add(dci.toUpperCase());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

export interface ResearchListItem {
  id: string;
  title: string;
  status: string;
  rowCount: number;
  updatedAt: string;
}

export interface ResearchPlayerDTO {
  id: string;
  rank: number;
  name: string;
  marketShareValue: number | null;
  status: string | null;
}

export interface ResearchRowDTO {
  id: string;
  therapeuticClass: string | null;
  product: string;
  marketVolume: number | null;
  marketValueUsd: number | null;
  avgPricePerBoxUsd: number | null;
  comment: string | null;
  players: ResearchPlayerDTO[];
}

export interface ResearchDetail {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  sources: string | null;
  participants: { id: string; name: string }[];
  rows: ResearchRowDTO[];
}

/** Sources de données par défaut d'une étude (jeux réels disponibles dans l'app). */
export const DEFAULT_RESEARCH_SOURCES = "IQVIA 2025-2026 · Nomenclature DZ (enregistrements) · Réceptions PCH 2025";

export async function listMarketResearch(): Promise<ResearchListItem[]> {
  const list = await prisma.marketResearch.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });
  return list.map((r) => ({ id: r.id, title: r.title, status: r.status, rowCount: r._count.rows, updatedAt: r.updatedAt.toISOString() }));
}

export interface PresentationVersionDTO {
  id: string;
  version: number;
  instruction: string | null;
  model: string | null;
  createdAt: string;
}

export interface PresentationDTO {
  id: string;
  title: string;
  createdAt: string;
  versions: PresentationVersionDTO[]; // triées de la plus récente à la plus ancienne
}

/** Présentations d'une étude, avec l'historique de versions (métadonnées seulement). */
export async function listResearchPresentations(researchId: string): Promise<PresentationDTO[]> {
  const list = await prisma.marketResearchPresentation.findMany({
    where: { researchId },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { version: "desc" }, select: { id: true, version: true, instruction: true, model: true, createdAt: true } } },
  });
  return list.map((p) => ({
    id: p.id,
    title: p.title,
    createdAt: p.createdAt.toISOString(),
    versions: p.versions.map((v) => ({ id: v.id, version: v.version, instruction: v.instruction, model: v.model, createdAt: v.createdAt.toISOString() })),
  }));
}

export interface PresentationVersionExport {
  version: number;
  presentationTitle: string;
  createdAt: Date;
  analysis: unknown; // JSON structuré (PresentationAnalysis)
  research: ResearchDetail;
}

/** Charge une version + son étude complète pour (re)construire le .pptx à la demande. */
export async function getPresentationVersionForExport(versionId: string): Promise<PresentationVersionExport | null> {
  const v = await prisma.marketResearchPresentationVersion.findUnique({
    where: { id: versionId },
    include: { presentation: true },
  });
  if (!v) return null;
  const research = await getMarketResearch(v.presentation.researchId);
  if (!research) return null;
  return { version: v.version, presentationTitle: v.presentation.title, createdAt: v.createdAt, analysis: v.analysis, research };
}

export async function getMarketResearch(id: string): Promise<ResearchDetail | null> {
  const r = await prisma.marketResearch.findUnique({
    where: { id },
    include: {
      rows: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { players: { orderBy: [{ rank: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!r) return null;
  const participants = r.participantIds.length
    ? await prisma.user.findMany({ where: { id: { in: r.participantIds } }, select: { id: true, name: true } })
    : [];
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    notes: r.notes,
    sources: r.sources,
    participants,
    rows: r.rows.map((row) => ({
      id: row.id,
      therapeuticClass: row.therapeuticClass,
      product: row.product,
      marketVolume: toNum(row.marketVolume),
      marketValueUsd: toNum(row.marketValueUsd),
      avgPricePerBoxUsd: toNum(row.avgPricePerBoxUsd),
      comment: row.comment,
      players: row.players.map((p) => ({ id: p.id, rank: p.rank, name: p.name, marketShareValue: toNum(p.marketShareValue), status: p.status })),
    })),
  };
}
