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

export const dynamic = "force-dynamic";

/** Onglet Paie des RH : matrice employés × mois, « Payé » + fiche, transfert budget. */
export default async function PaiePage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireModule("RH");
  if (!userCan(user, "RH", "UPDATE")) redirect("/rh");

  const year = Math.min(2100, Math.max(2020, Number(searchParams.year) || new Date().getFullYear()));

  const [employees, entries, budgetOptions] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, netToPay: true, baseSalary: true },
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
    defaultAmount: emp.netToPay != null ? toNumber(emp.netToPay) : emp.baseSalary != null ? toNumber(emp.baseSalary) : null,
    months: Array.from({ length: 12 }, (_, i) => {
      const e = byKey.get(`${emp.id}:${i + 1}`);
      if (!e || e.status !== "PAID") return { state: "UNPAID" as const, amount: null, entryId: e?.id ?? null };
      return {
        state: e.budgetTransferredAt ? ("TRANSFERRED" as const) : ("PAID" as const),
        amount: toNumber(e.net),
        entryId: e.id,
      };
    }),
  }));

  return (
    <div className="space-y-5">
      <Link href="/rh" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Ressources humaines
      </Link>
      <PageHeader
        title={`Paie ${year}`}
        description="Un clic sur un mois pour marquer « Payé » (montant total + fiche de paie). L'employé est notifié 24 h plus tard (marge d'erreur). Puis « Transférer dans le budget » impute le mois à la catégorie choisie, avec résumé avant confirmation."
      />
      <PayrollMatrix year={year} rows={rows} budgetOptions={budgetOptions.map((b) => ({ id: b.id, label: b.label }))} />
    </div>
  );
}
