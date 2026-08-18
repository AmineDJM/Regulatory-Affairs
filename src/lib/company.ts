import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  allowedCompanyIds, canEditCompany, companyAccessWhere, platformScopeWhere, resolveScope,
  type AccessBearer, type ScopeWhere,
} from "@/lib/company-access";

// Mémoïsation par requête si React `cache` est disponible ; sinon (tests, hors requête) no-op.
const perRequest: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof cache === "function" ? (cache as never) : (fn) => fn;

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

/** Entités actives, triées (ordre d'affichage puis nom). Mémoïsé par requête (appelé sur
 *  de nombreuses pages) → une seule lecture BDD par rendu. */
export const getCompanies = perRequest(async (): Promise<CompanyLite[]> => {
  return prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true, shortName: true, color: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

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

/**
 * LE FILTRE D'ENTITÉ DES ÉCRANS DE MODULE — la portée du sélecteur, VALIDÉE contre les droits.
 *
 * Remplace l'ancien `currentCompanyWhere()`, qui posait le cookie tel quel. Deux trous s'y
 * ouvraient, et le second n'avait rien de théorique :
 *
 *   • le cookie se modifie à la main : il suffisait d'y écrire l'identifiant d'une autre société
 *     pour lire ses dossiers, puisque aucun écran ne revalidait la demande ;
 *   • SANS cookie, il ne filtrait RIEN. Un salarié mono-entité dont le module a une portée
 *     « toutes les lignes » (Regulatory, Legal, Courriers…) voyait donc, par défaut, le travail
 *     de toutes les sociétés du groupe — exactement ce que le cloisonnement doit empêcher.
 *
 * On passe donc par `platformScope`, qui applique la règle commune et ses deux garde-fous :
 * aucun filtre si le groupe ne compte qu'une société, aucun filtre pour qui ne relève d'aucune
 * entité (on n'aveugle personne par omission).
 */
export async function currentCompanyWhereFor(userId: string): Promise<{ companyId?: string | { in: string[] } }> {
  const where = await platformScope(userId);
  return "companyId" in where && where.companyId !== undefined ? { companyId: where.companyId } : {};
}

/** Libellé court d'une entité (fallback sur le nom complet). */
export function companyLabel(c: CompanyLite): string {
  return c.shortName || c.name;
}

/** Options `{ value, label }` d'un `<select>` d'entité pour les formulaires. */
export function companyOptions(companies: CompanyLite[]): { value: string; label: string }[] {
  return companies.map((c) => ({ value: c.id, label: companyLabel(c) }));
}

// ─────────────────────── Étanchéité : les entités auxquelles J'AI DROIT ───────────────────────

/**
 * Les entités visibles PAR CETTE PERSONNE.
 *
 * `getCompanies()` rend toutes les entités actives — c'est ce qu'il faut pour l'administration.
 * Mais le sélecteur de la barre supérieure ne doit proposer que ce à quoi on a droit, sans quoi
 * il suffirait de basculer pour lire les dossiers d'une autre société du groupe.
 *
 * Mémoïsé par requête : appelé sur presque toutes les pages.
 */
export const getMyCompanies = perRequest(async (userId: string): Promise<CompanyLite[]> => {
  const [all, bearer] = await Promise.all([getCompanies(), accessBearerOf(userId)]);
  if (!bearer) return [];
  const ids = allowedCompanyIds(bearer, all.map((c) => c.id));
  return all.filter((c) => ids.includes(c.id));
});

/**
 * Le porteur de droits d'une personne : ses rôles, son entité d'appartenance et ses
 * autorisations. Lu une seule fois par requête.
 */
export const accessBearerOf = perRequest(async (userId: string): Promise<AccessBearer | null> => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true, secondaryRole: true,
        companyAccess: { select: { companyId: true, canEdit: true } },
        employee: { select: { companyId: true } },
      },
    });
    if (!u) return null;
    return {
      role: String(u.role),
      secondaryRole: u.secondaryRole ? String(u.secondaryRole) : null,
      homeCompanyId: u.employee?.companyId ?? null,
      grants: u.companyAccess.map((g) => ({ companyId: g.companyId, canEdit: g.canEdit })),
    };
  } catch (e) {
    console.error("[company] lecture des droits d'entité impossible", e);
    return null;
  }
});

/**
 * La portée RÉELLEMENT applicable : le cookie validé contre les droits.
 *
 * ⚠️ Le cookie vient du navigateur, il se modifie à la main. On ne s'en sert donc que comme
 * d'une **demande**, jamais comme d'une autorisation.
 */
export async function myCompanyScope(userId: string): Promise<string | null> {
  const [all, bearer] = await Promise.all([getCompanies(), accessBearerOf(userId)]);
  if (!bearer) return null;
  return resolveScope(bearer, getCompanyScope(), all.map((c) => c.id));
}

/**
 * Le filtre Prisma qui rend l'étanchéité réelle : même « toutes les entités » signifie
 * « toutes celles auxquelles j'ai droit », jamais toutes celles qui existent.
 */
export async function myCompanyWhere(userId: string): Promise<{ companyId?: string | { in: string[] } }> {
  const [all, bearer] = await Promise.all([getCompanies(), accessBearerOf(userId)]);
  if (!bearer) return { companyId: { in: [] } };
  return companyAccessWhere(bearer, getCompanyScope(), all.map((c) => c.id));
}

/**
 * LE FILTRE À POSER DANS LES MODULES TRANSVERSES (budget, Ad & Pro, finances, demandes).
 *
 * Voir `platformScopeWhere` pour la règle exacte : portée validée contre les droits, et les
 * enregistrements pas encore rattachés restent visibles pour ne pas disparaître de partout.
 *
 * S'utilise en composition, jamais en remplacement d'un filtre métier :
 *   `where: { AND: [ scopeSponsoring(user), await platformScope(user.id) ] }`
 */
export async function platformScope(userId: string): Promise<ScopeWhere> {
  const [all, bearer] = await Promise.all([getCompanies(), accessBearerOf(userId)]);
  if (!bearer) return {};
  return platformScopeWhere(bearer, getCompanyScope(), all.map((c) => c.id));
}

/**
 * L'entité à inscrire sur un objet QUI SE CRÉE.
 *
 * Ordre : la portée réellement sélectionnée (« je travaille sur Pharmagène en ce moment »),
 * à défaut l'entité d'appartenance du créateur. `null` si rien n'est déterminable — on ne
 * devine pas : un objet non rattaché se voit et se corrige, un objet mal rattaché se découvre
 * trop tard.
 */
export async function companyIdForNew(userId: string): Promise<string | null> {
  const scope = await myCompanyScope(userId);
  if (scope) return scope;
  const bearer = await accessBearerOf(userId);
  return bearer?.homeCompanyId ?? null;
}

/** Peut-on écrire sur cette entité ? Voir ne suffit pas. */
export async function canEditCompanyId(userId: string, companyId: string | null): Promise<boolean> {
  if (!companyId) return true; // objet non rattaché : la portée ne s'applique pas
  const bearer = await accessBearerOf(userId);
  return bearer ? canEditCompany(bearer, companyId) : false;
}
