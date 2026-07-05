import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Dimension multi-entités (sociétés du groupe : Adventum Pharma, Pharmagène, …).
 *
 * Une **portée d'entité** est mémorisée dans un cookie et pilotée par le sélecteur de
 * la barre supérieure. `null` (« Toutes les entités ») n'applique aucun filtre ; une
 * entité précise restreint les listes aux enregistrements de cette entité. Les objets
 * non rattachés (companyId = null) restent visibles en vue « Toutes » — on peut ensuite
 * les affecter. Tout est dynamique : les entités se créent/renomment/désactivent en
 * Administration, sans code.
 */

export const COMPANY_COOKIE = "amd-company";

export interface CompanyLite {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
}

/** Entités actives, triées (ordre d'affichage puis nom). */
export async function getCompanies(): Promise<CompanyLite[]> {
  return prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true, shortName: true, color: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Portée d'entité active (cookie). `null` = toutes les entités. Défensif : hors
 * contexte de requête (tests, tâches planifiées), renvoie `null` (aucun filtre).
 */
export function getCompanyScope(): string | null {
  try {
    const raw = cookies().get(COMPANY_COOKIE)?.value;
    return raw && raw !== "ALL" ? raw : null;
  } catch {
    return null;
  }
}

/** Filtre Prisma `{ companyId }` pour une portée ; `{}` si « toutes les entités ». */
export function companyWhere(scope: string | null): { companyId?: string } {
  return scope ? { companyId: scope } : {};
}

/** Raccourci serveur : filtre Prisma de la portée active (lue du cookie). */
export function currentCompanyWhere(): { companyId?: string } {
  return companyWhere(getCompanyScope());
}

/** Libellé court d'une entité (fallback sur le nom complet). */
export function companyLabel(c: CompanyLite): string {
  return c.shortName || c.name;
}

/** Options `{ value, label }` d'un `<select>` d'entité pour les formulaires. */
export function companyOptions(companies: CompanyLite[]): { value: string; label: string }[] {
  return companies.map((c) => ({ value: c.id, label: companyLabel(c) }));
}
