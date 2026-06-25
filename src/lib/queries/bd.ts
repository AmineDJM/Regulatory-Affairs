import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeBdProject, type SessionUser } from "@/lib/rbac";
import { toNumber } from "@/lib/utils";

/** Serializable DTOs for the strategic table (Projet → Gamme → Produit). */
export interface BdProductDTO {
  id: string;
  dci: string;
  brandName: string;
  dosage: string;
  form: string;
  sourcing: string;
  marketSizeDzd: number | null;
  marketSizeUsd: number | null;
  unitPrice: number | null;
  totalMarketVolume: number | null;
  competitors: string;
  competitorShares: string;
  competitorVolume: string;
  competitorPrice: string;
  investmentY1: number | null;
  investmentY2: number | null;
  investmentY3: number | null;
  revenueY1: number | null;
  revenueY2: number | null;
  revenueY3: number | null;
  comment: string;
}

export interface BdRangeDTO {
  id: string;
  name: string;
  comment: string;
  products: BdProductDTO[];
}

export interface BdProjectDTO {
  id: string;
  name: string;
  status: string;
  description: string;
  comment: string;
  owner: string;
  ranges: BdRangeDTO[];
  rangeCount: number;
  productCount: number;
}

const dec = (v: unknown): number | null => (v === null || v === undefined ? null : toNumber(v));

const PROJECT_INCLUDE = {
  owner: { select: { name: true } },
  ranges: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { products: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
} satisfies Prisma.BdProjectInclude;

type ProjectRow = Prisma.BdProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

function toDTO(p: ProjectRow): BdProjectDTO {
  const ranges: BdRangeDTO[] = p.ranges.map((r) => ({
    id: r.id,
    name: r.name,
    comment: r.comment ?? "",
    products: r.products.map((pr) => ({
      id: pr.id,
      dci: pr.dci,
      brandName: pr.brandName ?? "",
      dosage: pr.dosage ?? "",
      form: pr.form ?? "",
      sourcing: pr.sourcing,
      marketSizeDzd: dec(pr.marketSizeDzd),
      marketSizeUsd: dec(pr.marketSizeUsd),
      unitPrice: dec(pr.unitPrice),
      totalMarketVolume: dec(pr.totalMarketVolume),
      competitors: pr.competitors ?? "",
      competitorShares: pr.competitorShares ?? "",
      competitorVolume: pr.competitorVolume ?? "",
      competitorPrice: pr.competitorPrice ?? "",
      investmentY1: dec(pr.investmentY1),
      investmentY2: dec(pr.investmentY2),
      investmentY3: dec(pr.investmentY3),
      revenueY1: dec(pr.revenueY1),
      revenueY2: dec(pr.revenueY2),
      revenueY3: dec(pr.revenueY3),
      comment: pr.comment ?? "",
    })),
  }));
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    description: p.description ?? "",
    comment: p.comment ?? "",
    owner: p.owner?.name ?? "",
    ranges,
    rangeCount: ranges.length,
    productCount: ranges.reduce((a, r) => a + r.products.length, 0),
  };
}

export async function getBdProjects(user: SessionUser): Promise<BdProjectDTO[]> {
  const projects = await prisma.bdProject.findMany({
    where: scopeBdProject(user),
    include: PROJECT_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
  });
  return projects.map(toDTO);
}

export async function getBdProject(user: SessionUser, id: string): Promise<BdProjectDTO | null> {
  const project = await prisma.bdProject.findFirst({
    where: { id, ...scopeBdProject(user) },
    include: PROJECT_INCLUDE,
  });
  return project ? toDTO(project) : null;
}

/** KPI roll-up across the visible projects. */
export function bdSummary(projects: BdProjectDTO[]) {
  let products = 0;
  let revenue3y = 0;
  let invest3y = 0;
  let active = 0;
  let validated = 0;
  const closedStatuses = new Set(["ABANDONED", "CLOSED"]);
  for (const p of projects) {
    if (!closedStatuses.has(p.status)) active += 1;
    if (p.status === "VALIDATED") validated += 1;
    for (const r of p.ranges) {
      for (const pr of r.products) {
        products += 1;
        revenue3y += (pr.revenueY1 ?? 0) + (pr.revenueY2 ?? 0) + (pr.revenueY3 ?? 0);
        invest3y += (pr.investmentY1 ?? 0) + (pr.investmentY2 ?? 0) + (pr.investmentY3 ?? 0);
      }
    }
  }
  return { projects: projects.length, products, active, validated, revenue3y, invest3y };
}
