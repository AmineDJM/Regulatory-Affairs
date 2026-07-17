import { prisma } from "@/lib/prisma";

const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

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
  rows: ResearchRowDTO[];
}

export async function listMarketResearch(): Promise<ResearchListItem[]> {
  const list = await prisma.marketResearch.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });
  return list.map((r) => ({ id: r.id, title: r.title, status: r.status, rowCount: r._count.rows, updatedAt: r.updatedAt.toISOString() }));
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
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    notes: r.notes,
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
