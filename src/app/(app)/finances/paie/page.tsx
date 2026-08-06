import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createEmployee, createPayroll } from "@/lib/actions/finance-actions";
import { PAYROLL_STATUS } from "@/lib/labels";
import { PayrollTable, type PayrollRow } from "./payroll-table";
import { BackLink } from "@/components/shared/back-link";

export default async function PaiePage() {
  const user = await requireModule("FINANCES");
  const canCreate = userCan(user, "FINANCES", "CREATE");
  const canPay = userCan(user, "FINANCES", "UPDATE");
  const now = new Date();

  const [employees, payrolls] = await Promise.all([
    prisma.employee.findMany({ orderBy: { fullName: "asc" } }),
    prisma.payrollEntry.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 200, include: { employee: { select: { fullName: true } } } }),
  ]);

  const active = employees.filter((e) => e.isActive);
  const masseSalariale = active.reduce((a, e) => a + toNumber(e.baseSalary), 0);
  const paidThisMonth = payrolls.filter((p) => p.status === "PAID" && p.year === now.getFullYear() && p.month === now.getMonth() + 1).reduce((a, p) => a + toNumber(p.net), 0);
  const toPay = payrolls.filter((p) => p.status !== "PAID").reduce((a, p) => a + toNumber(p.net), 0);

  const payrollRows: PayrollRow[] = payrolls.map((p) => ({
    id: p.id, employee: p.employee.fullName, year: p.year, month: p.month,
    gross: toNumber(p.gross), bonuses: toNumber(p.bonuses), deductions: toNumber(p.deductions),
    net: toNumber(p.net), status: p.status, canPay,
  }));

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.fullName }));
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"][i] }));

  const payrollFields: FieldDef[] = [
    { type: "select", name: "employeeId", label: "Employé", options: employeeOptions, required: true, full: true },
    { type: "number", name: "year", label: "Année", defaultValue: now.getFullYear() },
    { type: "select", name: "month", label: "Mois", options: monthOptions, defaultValue: String(now.getMonth() + 1) },
    { type: "number", name: "gross", label: "Salaire brut (DZD)" },
    { type: "number", name: "bonuses", label: "Primes (DZD)" },
    { type: "number", name: "deductions", label: "Retenues (DZD)" },
    { type: "select", name: "status", label: "Statut", options: optionsFromMap(PAYROLL_STATUS), defaultValue: "DRAFT" },
  ];

  return (
    <div className="space-y-6">
      <BackLink href="/finances">
        <ArrowLeft className="h-4 w-4" /> Retour aux finances
      </BackLink>
      <PageHeader title="Paie" description="Employés, salaires et bulletins de paie. Le règlement impacte la trésorerie." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Employés actifs" value={active.length} icon="Users" />
        <KpiCard label="Masse salariale (base)" value={formatCurrency(masseSalariale)} icon="Wallet" tone="info" />
        <KpiCard label="Payé ce mois" value={formatCurrency(paidThisMonth)} icon="BadgeCheck" tone="success" />
        <KpiCard label="À régler" value={formatCurrency(toPay)} icon="Clock" tone="warning" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bulletins de paie</h2>
          {canCreate && (
            <CreateRecordButton label="Nouveau bulletin" title="Créer un bulletin de paie" action={createPayroll} width="md"
              description="Net = Brut + Primes − Retenues. « Payer » crée l’écriture de trésorerie." fields={payrollFields} />
          )}
        </div>
        <PayrollTable rows={payrollRows} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Employés</h2>
          {canCreate && (
            <CreateRecordButton label="Nouvel employé" title="Ajouter un employé" action={createEmployee} width="md"
              fields={[
                { type: "text", name: "fullName", label: "Nom complet", required: true, full: true },
                { type: "text", name: "position", label: "Poste" },
                { type: "text", name: "department", label: "Département" },
                { type: "number", name: "baseSalary", label: "Salaire de base (DZD)" },
                { type: "text", name: "email", label: "Email" },
                { type: "text", name: "phone", label: "Téléphone" },
                { type: "text", name: "iban", label: "RIB / IBAN" },
                { type: "date", name: "hireDate", label: "Date d’embauche" },
              ]} />
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            {employees.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucun employé. Ajoutez votre équipe.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead><TableHead>Poste</TableHead><TableHead>Département</TableHead>
                    <TableHead className="text-right">Salaire de base</TableHead><TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.fullName}</TableCell>
                      <TableCell>{e.position || "—"}</TableCell>
                      <TableCell>{e.department || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(toNumber(e.baseSalary))}</TableCell>
                      <TableCell>{e.isActive ? <Badge tone="success" dot={false}>Actif</Badge> : <Badge tone="danger" dot={false}>Inactif</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
