import { prisma } from "@/lib/prisma";
import { scopePromoMaterial, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere, type CompanyLite } from "@/lib/company";
import { toNumber } from "@/lib/utils";

export interface PromoListItem {
  id: string;
  reference: string;
  title: string;
  status: string;
  /** L'état du circuit COURT — quand il est présent, c'est LUI que la liste affiche. */
  circuitState: string | null;
  /** La version du circuit — le libellé d'une étape en dépend (`libelleEtape`). */
  circuitVersion: number;
  /**
   * CE QUE LA DEMANDE COMMANDE — les noms des supports de ses lignes, dans l'ordre (§118.173). Le
   * catalogue EST la liste des supports : une demande se dit par ses lignes, plus par un « type »
   * choisi à côté. Un dossier d'AVANT les lignes garde son type (`typeHerite`) — l'histoire ne se
   * réécrit pas, et sans lui la colonne se viderait sur tous les anciens dossiers.
   */
  articles: string[];
  typeHerite: string | null;
  company: CompanyLite | null;
  chosenAgency: string | null;
  amount: number | null;
  requester: string;
  assistant: string;
  createdAt: string;
}

/**
 * Le N+1 du demandeur, résolu par l'ORGANIGRAMME : le responsable nommé sur la fiche employé,
 * à défaut le responsable du département. `null` reste possible (un directeur n'a pas de N+1) :
 * le Super Admin débloque alors l'étape. Partagé entre la création et le lancement du circuit.
 */
export async function promoManagerOf(userId: string): Promise<string | null> {
  const emp = await prisma.employee.findFirst({
    where: { userId },
    select: {
      manager: { select: { userId: true } },
      departmentRef: { select: { head: { select: { userId: true } } } },
    },
  });
  return emp?.manager?.userId ?? emp?.departmentRef?.head?.userId ?? null;
}

async function resolveNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function getPromoMaterials(user: SessionUser): Promise<PromoListItem[]> {
  const rows = await prisma.promoMaterial.findMany({
    where: await companyScopedWhere(user.id, scopePromoMaterial(user)),
    include: {
      company: { select: { id: true, name: true, shortName: true, color: true } },
      articlesDemandes: { orderBy: { position: "asc" }, select: { catalogue: { select: { nom: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const names = await resolveNames(rows.flatMap((r) => [r.requesterId, r.assistantId]));
  return rows.map((r) => ({
    id: r.id, reference: r.reference, title: r.title, status: r.status,
    circuitState: r.circuitState,
    circuitVersion: r.circuitVersion,
    articles: r.articlesDemandes.map((l) => l.catalogue.nom),
    typeHerite: r.materialType,
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


export async function promoNames(pm: PromoDetail): Promise<{ requester: string; assistant: string }> {
  const names = await resolveNames([pm.requesterId, pm.assistantId]);
  return {
    requester: pm.requesterId ? names.get(pm.requesterId) ?? "" : "",
    assistant: pm.assistantId ? names.get(pm.assistantId) ?? "" : "",
  };
}
