import { prisma } from "@/lib/prisma";
import { myCompanyScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import type { DeptBudgetRow } from "@/lib/department-budget";

/**
 * Tableau « budget par département » pour une année.
 *
 * La masse salariale CONSOMMÉE n'est pas une saisie : elle est calculée depuis la paie réelle
 * des membres du département sur l'exercice. C'est le seul chiffre qui permette de dire si le
 * budget RH tient — un montant ressaisi à la main dirait ce qu'on espère, pas ce qui se passe.
 *
 * Le fonctionnement, lui, n'a pas d'équivalent : aucune dépense n'est aujourd'hui imputée à un
 * département. On affiche donc l'alloué sans inventer une consommation — mieux vaut une colonne
 * vide qu'un chiffre qui ressemble à une mesure sans en être une.
 */
export async function getDepartmentBudgets(userId: string, year: number): Promise<DeptBudgetRow[]> {
  // Le tableau reste dans la portée d'entité en cours : le budget d'Adventum n'est pas celui
  // de Pharmagène. Les départements transverses (sans entité) restent visibles.
  const scope = await myCompanyScope(userId);

  const departments = await prisma.department.findMany({
    where: scope ? { OR: [{ companyId: scope }, { companyId: null }] } : {},
    select: {
      id: true, name: true, parentId: true,
      company: { select: { name: true, shortName: true } },
      members: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  if (departments.length === 0) return [];

  const ids = departments.map((d) => d.id);
  const [budgets, payroll] = await Promise.all([
    prisma.departmentBudget.findMany({ where: { departmentId: { in: ids }, year }, select: { departmentId: true, kind: true, amount: true } }),
    // Masse salariale réelle : le BRUT de l'exercice, regroupé par employé puis reventilé sur
    // son département (la paie ne connaît que l'employé).
    prisma.payrollEntry.groupBy({
      by: ["employeeId"],
      where: { year, employee: { departmentId: { in: ids } } },
      _sum: { gross: true },
    }),
  ]);

  const empDept = new Map<string, string>();
  for (const d of departments) for (const m of d.members) empDept.set(m.id, d.id);

  const consumedByDept = new Map<string, number>();
  for (const p of payroll) {
    const dept = empDept.get(p.employeeId);
    if (!dept) continue;
    consumedByDept.set(dept, (consumedByDept.get(dept) ?? 0) + toNumber(p._sum.gross ?? 0));
  }

  const amountOf = (deptId: string, kind: "OPERATING" | "HR") =>
    toNumber(budgets.find((b) => b.departmentId === deptId && b.kind === kind)?.amount ?? 0);

  // Chemin complet : deux sous-départements « Ville » de deux pôles différents ne doivent pas
  // se confondre dans un tableau de budgets.
  const byId = new Map(departments.map((d) => [d.id, d]));
  const pathOf = (id: string): string => {
    const parts: string[] = [];
    let cur = byId.get(id);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" › ");
  };

  return departments
    .map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      path: pathOf(d.id),
      companyName: d.company?.shortName ?? d.company?.name ?? null,
      members: d.members.length,
      operating: amountOf(d.id, "OPERATING"),
      hr: amountOf(d.id, "HR"),
      hrConsumed: consumedByDept.get(d.id) ?? 0,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, "fr"));
}
