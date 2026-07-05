import { prisma } from "@/lib/prisma";
import { scopePromoMaterial, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import { currentCompanyWhere, type CompanyLite } from "@/lib/company";
import { toNumber } from "@/lib/utils";

export interface PromoListItem {
  id: string;
  reference: string;
  title: string;
  status: string;
  materialType: string | null;
  company: CompanyLite | null;
  chosenAgency: string | null;
  amount: number | null;
  requester: string;
  assistant: string;
  createdAt: string;
}

async function resolveNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function getPromoMaterials(user: SessionUser): Promise<PromoListItem[]> {
  const rows = await prisma.promoMaterial.findMany({
    where: { ...scopePromoMaterial(user), ...currentCompanyWhere() },
    include: { company: { select: { id: true, name: true, shortName: true, color: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const names = await resolveNames(rows.flatMap((r) => [r.requesterId, r.assistantId]));
  return rows.map((r) => ({
    id: r.id, reference: r.reference, title: r.title, status: r.status,
    materialType: r.materialType,
    company: r.company,
    chosenAgency: r.chosenAgency,
    amount: r.chosenAmount != null ? toNumber(r.chosenAmount) : r.amount != null ? toNumber(r.amount) : null,
    requester: r.requesterId ? names.get(r.requesterId) ?? "" : "",
    assistant: r.assistantId ? names.get(r.assistantId) ?? "" : "",
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPromoMaterial(id: string) {
  return prisma.promoMaterial.findUnique({ where: { id } });
}

export type PromoDetail = NonNullable<Awaited<ReturnType<typeof getPromoMaterial>>>;

/** Visible par : vue globale, le demandeur Marketing, l'assistante assignée, ou
 *  tout détenteur du module avec portée ALL (finances / information médicale…). */
export function canViewPromo(user: SessionUser, pm: PromoDetail): boolean {
  if (hasGlobalView(user.role)) return true;
  if (!userCan(user, "PROMO_MATERIAL", "VIEW")) return false;
  const m = user.access.modules.get("PROMO_MATERIAL");
  if (m?.scope === "ALL") return true;
  return pm.requesterId === user.id || pm.assistantId === user.id;
}

export async function promoNames(pm: PromoDetail): Promise<{ requester: string; assistant: string }> {
  const names = await resolveNames([pm.requesterId, pm.assistantId]);
  return {
    requester: pm.requesterId ? names.get(pm.requesterId) ?? "" : "",
    assistant: pm.assistantId ? names.get(pm.assistantId) ?? "" : "",
  };
}
