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
import { entryCost } from "@/lib/hr/payroll-cost";
import { massByEntity, type PayrollCostLine } from "@/lib/hr/payroll-mass";
import { getMyCompanies, myCompanyWhere } from "@/lib/company";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Onglet Paie des RH : matrice employés × mois, « Payé » + fiche, transfert budget. */
export default async function PaiePage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireModule("RH");
  if (!userCan(user, "RH", "UPDATE")) redirect("/rh");

  const year = Math.min(2100, Math.max(2020, Number(searchParams.year) || new Date().getFullYear()));

  // LA PAIE EST SÉPARÉE PAR ENTITÉ. Le groupe compte plusieurs sociétés ; chacune paie ses
  // salaires et rend ses comptes. Une matrice qui les mélange affiche une masse salariale qui
  // n'est le chiffre d'aucune d'elles — et c'est pourtant celui qu'on lisait. Le sélecteur
  // d'entité de la barre supérieure sépare donc réellement la paie, et la portée est VALIDÉE
  // contre les droits : « toutes les entités » veut dire « toutes celles auxquelles j'ai droit ».
  const portee = await myCompanyWhere(user.id);

  const [employees, entries, budgetOptions, mesEntites] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, ...portee },
      select: {
        id: true, fullName: true, netToPay: true, grossSalary: true, baseSalary: true,
        employerCost: true, companyId: true, departmentId: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.payrollEntry.findMany({ where: { year } }),
    // Options de catégories budgétaires RESTREINTES aux enveloppes ouvertes à ce compte
    // (encadrement strict — pas de fuite des libellés d'enveloppes non partagées).
    getBudgetCategoryOptions(undefined, user),
    getMyCompanies(user.id),
  ]);

  // LES FICHES DE PAIE DÉJÀ DÉPOSÉES — chargées EN LOT et rendues à l'écran.
  //
  // Elles étaient bien enregistrées (dossier RH du salarié), mais la matrice n'en disait rien :
  // on sortait de l'écran, on revenait, et plus aucune trace du bulletin qu'on venait de joindre.
  // Un fichier qu'on ne peut pas revoir depuis l'endroit où on l'a déposé est, pour celui qui
  // l'a déposé, un fichier perdu.
  const payslipIds = entries.map((e) => e.payslipDocumentId).filter((v): v is string => Boolean(v));
  const payslips = payslipIds.length
    ? await prisma.employeeDocument.findMany({
        where: { id: { in: payslipIds } },
        select: { id: true, name: true, size: true, createdAt: true },
      })
    : [];
  const payslipById = new Map(payslips.map((d) => [d.id, d]));

  const byKey = new Map(entries.map((e) => [`${e.employeeId}:${e.month}`, e]));

  // LA MASSE SALARIALE, SOCIÉTÉ PAR SOCIÉTÉ. C'est le chiffre que chaque entité doit reconnaître
  // comme le sien ; consolidé, il n'est celui d'aucune. Calculé sur les lignes PAYÉES de l'année
  // et sur les seuls salariés de la portée — le même coût employeur que celui imputé au budget.
  const empById = new Map(employees.map((e) => [e.id, e]));
  const lignes: PayrollCostLine[] = entries
    .filter((e) => e.status === "PAID" && empById.has(e.employeeId))
    .map((e) => {
      const emp = empById.get(e.employeeId)!;
      return {
        departmentId: emp.departmentId ?? null,
        companyId: emp.companyId ?? null,
        cost: entryCost({
          employerCost: e.employerCost != null ? toNumber(e.employerCost) : null,
          gross: toNumber(e.gross), bonuses: toNumber(e.bonuses), deductions: toNumber(e.deductions),
        }),
      };
    });
  const masse = massByEntity(lignes);
  const nomEntite = new Map(mesEntites.map((c) => [c.id, c.shortName || c.name]));
  const masseParEntite = [...masse.entries()]
    .map(([companyId, total]) => ({
      companyId,
      label: companyId ? (nomEntite.get(companyId) ?? "Entité inconnue") : "Sans entité — à rattacher",
      total,
    }))
    .sort((a, b) => (a.companyId ? 0 : 1) - (b.companyId ? 0 : 1) || a.label.localeCompare(b.label, "fr"));
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
      if (!e || e.status !== "PAID") return { state: "UNPAID" as const, amount: null, net: null, employerCost: null, entryId: e?.id ?? null, payslip: null };
      const doc = e.payslipDocumentId ? payslipById.get(e.payslipDocumentId) ?? null : null;
      return {
        state: e.budgetTransferredAt ? ("TRANSFERRED" as const) : ("PAID" as const),
        // `amount` = BRUT (ligne de bulletin) ; `net` = ce que perçoit le salarié ;
        // `employerCost` = ce qui pèse sur le budget, et donc ce qu'on rouvre pour corriger.
        amount: toNumber(e.gross),
        net: toNumber(e.net),
        employerCost: e.employerCost != null ? toNumber(e.employerCost) : null,
        entryId: e.id,
        payslip: doc ? { id: doc.id, name: doc.name, sizeBytes: doc.size, addedAt: doc.createdAt.toISOString() } : null,
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
        description="Un clic sur un mois pour marquer « Payé » (montant total + fiche de paie). La fiche jointe reste attachée au mois : elle se rouvre d'ici, et se dépose plus tard si elle manquait. L'employé est notifié 24 h après le marquage. Puis « Transférer dans le budget » impute le mois à la catégorie choisie, avec résumé avant confirmation."
      />
      {/* LA MASSE SALARIALE, SOCIÉTÉ PAR SOCIÉTÉ — et non un total consolidé qui n'est le chiffre
          d'aucune d'elles. La matrice ci-dessous ne montre que les salariés de la portée
          sélectionnée : c'est le sélecteur d'entité de la barre supérieure qui sépare la paie. */}
      {masseParEntite.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {masseParEntite.map((m) => (
            <div key={m.companyId ?? "sans"} className={`rounded-lg border px-3 py-2 ${m.companyId ? "border-border" : "border-warning/40 bg-warning/5"}`}>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(m.total)}</p>
              <p className="text-[0.6875rem] text-muted-foreground">masse salariale payée {year}</p>
            </div>
          ))}
        </div>
      )}

      <PayrollMatrix year={year} rows={rows} budgetOptions={budgetOptions.map((b) => ({ id: b.id, label: b.label }))} />
    </div>
  );
}
