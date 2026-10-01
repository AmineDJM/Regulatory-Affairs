import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeBdProject, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere } from "@/lib/company";
import { toNumber } from "@/lib/utils";

/**
 * LES PROJETS QU'UNE PERSONNE VOIT — UNE clause, lue par tous ceux qui posent la question (§118.163).
 *
 * La liste « Projets », le menu « Projet » du tableau Regulatory, la garde par enregistrement et
 * le classement d'un dossier répondent à la même question : « ce projet, cette personne le
 * voit-elle ? ». Quatre réponses écrites séparément finiraient par diverger, et le symptôme serait
 * un menu qui propose un projet que l'action refuse — ou pire, une action qui accepte un projet
 * que la liste cache (§118.5).
 *
 * La portée du module (`scopeBdProject`) ET l'entité, composées en AND — jamais par étalement :
 * deux clauses qui portent chacune un `OR` s'écraseraient (§118.133). `companyScopedWhere` garde
 * les projets pas encore rattachés : un projet d'avant se voit, donc se rattache.
 */
export async function projetsBdVisibles(user: SessionUser): Promise<Prisma.BdProjectWhereInput> {
  return companyScopedWhere(user.id, scopeBdProject(user));
}

/**
 * L'ENTITÉ QUE LES DOSSIERS D'UN PROJET DÉSIGNENT — une PROPOSITION, jamais une écriture.
 *
 * Un projet d'avant n'a pas d'entité. Quand TOUS ses dossiers réglementaires appartiennent à la
 * même société, l'écran la propose dans le formulaire ; quelqu'un l'enregistre. S'ils se partagent
 * entre deux sociétés, ou si aucun n'en porte, on ne propose RIEN : choisir serait décider à la
 * place d'une personne (§118.34).
 *
 * Pure — testée.
 */
export function entiteProposee(companyIdsDesDossiers: readonly (string | null)[]): string | null {
  const distinctes = new Set(companyIdsDesDossiers.filter((c): c is string => typeof c === "string" && c.length > 0));
  return distinctes.size === 1 ? [...distinctes][0]! : null;
}

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
    where: await projetsBdVisibles(user),
    include: PROJECT_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
  });
  return projects.map(toDTO);
}

/**
 * LES PROJETS PROPOSABLES — juste `{ id, name }`, pour le menu « Projet » du tableau Regulatory.
 *
 * Pourquoi pas `getBdProjects` : celui-là charge gammes, produits, marché et investissements
 * pour construire le tableau stratégique. En faire tourner l'équivalent à chaque affichage du
 * tableau Regulatory paierait tout ce travail pour deux colonnes de texte.
 *
 * MÊME CLAUSE que l'écran « Projets » (`projetsBdVisibles`) : le classement se LIT dans
 * Regulatory parce qu'il est écrit sur le dossier, mais la LISTE des projets appartient au module
 * `BD_PROJECTS`. Quelqu'un sans ce module reçoit une liste vide — et le tableau retombe alors sur
 * l'affichage en texte du projet déjà posé, sans menu. Et l'action qui classe lit la même clause :
 * ce que le menu ne propose pas, elle le refuse (§118.163).
 */
export async function getBdProjectOptions(user: SessionUser): Promise<{ id: string; name: string }[]> {
  return prisma.bdProject.findMany({
    where: await projetsBdVisibles(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getBdProject(user: SessionUser, id: string): Promise<BdProjectDTO | null> {
  const project = await prisma.bdProject.findFirst({
    where: { AND: [{ id }, await projetsBdVisibles(user)] },
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
