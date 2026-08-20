import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBudgetCategoryOptions } from "@/lib/queries/budget";
import { PageHeader } from "@/components/shared/page-header";
import { toNumber } from "@/lib/utils";
import { PayrollMatrix, type PayrollRow } from "./payroll-matrix";
import { BackLink } from "@/components/shared/back-link";
import { defaultEmployerCost } from "@/lib/hr/payroll-cost";

export const dynamic = "force-dynamic";

/** Onglet Paie des RH : matrice employés × mois, « Payé » + fiche, transfert budget. */
export default async function PaiePage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireModule("RH");
  if (!userCan(user, "RH", "UPDATE")) redirect("/rh");

  const year = Math.min(2100, Math.max(2020, Number(searchParams.year) || new Date().getFullYear()));

  const [employees, entries, budgetOptions] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, netToPay: true, grossSalary: true, baseSalary: true, employerCost: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.payrollEntry.findMany({ where: { year } }),
    // Options de catégories budgétaires RESTREINTES aux enveloppes ouvertes à ce compte
    // (encadrement strict — pas de fuite des libellés d'enveloppes non partagées).
    getBudgetCategoryOptions(undefined, user),
  ]);

  const byKey = new Map(entries.map((e) => [`${e.employeeId}:${e.month}`, e]));
  const rows: PayrollRow[] = employees.map((emp) => ({
    employeeId: emp.id,
    name: emp.fullName,
    // Pré-remplissage : brut depuis le salaire brut de la fiche (à défaut le salaire de base), net depuis le net à payer.
    defaultGross: emp.grossSalary != null ? toNumber(emp.grossSalary) : emp.baseSalary != null ? toNumber(emp.baseSalary) : null,
    // Ordre : le coût employeur de la fiche, à défaut le brut, à défaut le salaire de base — et
    // JAMAIS 0, qui se validerait sans qu'on le relise et amputerait la masse d'un salaire.
    defaultEmployerCost: defaultEmployerCost({
      employerCost: emp.employerCost != null ? toNumber(emp.employerCost) : null,
      grossSalary: emp.grossSalary != null ? toNumber(emp.grossSalary) : null,
      baseSalary: emp.baseSalary != null ? toNumber(emp.baseSalary) : null,
    }),
    defaultNet: emp.netToPay != null ? toNumber(emp.netToPay) : emp.baseSalary != null ? toNumber(emp.baseSalary) : null,
    months: Array.from({ length: 12 }, (_, i) => {
      const e = byKey.get(`${emp.id}:${i + 1}`);
      if (!e || e.status !== "PAID") return { state: "UNPAID" as const, amount: null, net: null, employerCost: null, entryId: e?.id ?? null };
      return {
        state: e.budgetTransferredAt ? ("TRANSFERRED" as const) : ("PAID" as const),
        // `amount` = BRUT (ligne de bulletin) ; `net` = ce que perçoit le salarié ;
        // `employerCost` = ce qui pèse sur le budget, et donc ce qu'on rouvre pour corriger.
        amount: toNumber(e.gross),
        net: toNumber(e.net),
        employerCost: e.employerCost != null ? toNumber(e.employerCost) : null,
        entryId: e.id,
      };
    }),
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/rh">
        <ArrowLeft className="h-4 w-4" /> Ressources humaines
      </BackLink>
      <PageHeader
        title={`Paie ${year}`}
        description="Un clic sur un mois pour marquer « Payé » (montant total + fiche de paie). L'employé est notifié 24 h plus tard (marge d'erreur). Puis « Transférer dans le budget » impute le mois à la catégorie choisie, avec résumé avant confirmation."
      />
      <PayrollMatrix year={year} rows={rows} budgetOptions={budgetOptions.map((b) => ({ id: b.id, label: b.label }))} />
    </div>
  );
}
