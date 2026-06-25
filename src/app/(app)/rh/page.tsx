import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getRhData } from "@/lib/queries/hr";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createEmployee } from "@/lib/actions/hr-actions";
import { CONTRACT_TYPE, LEAVE_TYPE, LEAVE_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, toNumber, daysUntil } from "@/lib/utils";
import { LeaveApprovals, type PendingLeave } from "./leave-approvals";
import { AdvanceApprovals, type AdvanceRow } from "./advance-approvals";

export default async function RhPage() {
  const user = await requireModule("RH");
  const canCreate = userCan(user, "RH", "CREATE");
  const canValidate = userCan(user, "RH", "VALIDATE");
  const canPayFinance = userCan(user, "FINANCES", "UPDATE");
  const data = await getRhData();

  const advanceRows: AdvanceRow[] = data.advances.map((a) => ({
    id: a.id, employee: a.employee.fullName, amount: Number(a.amount),
    reason: a.reason, status: a.status, createdAt: a.createdAt.toISOString(),
  }));

  const linkableUsers = await prisma.user.findMany({
    where: { isActive: true, employee: { is: null } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const pendingLeaves: PendingLeave[] = data.pendingLeaves.map((l) => ({
    id: l.id, employee: l.employee.fullName, type: l.type,
    startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(),
    days: Number(l.days), reason: l.reason,
  }));

  const employeeFields: FieldDef[] = [
    { type: "text", name: "fullName", label: "Nom complet", required: true, full: true },
    { type: "text", name: "position", label: "Poste" },
    { type: "text", name: "department", label: "Département" },
    { type: "select", name: "contractType", label: "Type de contrat", options: optionsFromMap(CONTRACT_TYPE), placeholder: "—" },
    { type: "number", name: "baseSalary", label: "Salaire de base (DZD)" },
    { type: "number", name: "leaveBalanceDays", label: "Solde congés (jours)", defaultValue: 30 },
    { type: "date", name: "hireDate", label: "Date d'embauche" },
    { type: "date", name: "contractStart", label: "Début de contrat" },
    { type: "date", name: "contractEnd", label: "Fin de contrat (échéance)" },
    { type: "date", name: "birthDate", label: "Date de naissance" },
    { type: "text", name: "email", label: "Email" },
    { type: "text", name: "phone", label: "Téléphone" },
    { type: "text", name: "iban", label: "RIB / IBAN" },
    { type: "text", name: "nationalId", label: "NIN" },
    { type: "text", name: "cnasNumber", label: "N° CNAS" },
    { type: "text", name: "address", label: "Adresse", full: true },
    { type: "select", name: "managerId", label: "Manager (N+1)", options: data.employees.map((e) => ({ value: e.id, label: e.fullName })), placeholder: "—" },
    { type: "select", name: "userId", label: "Compte applicatif lié", options: linkableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })), placeholder: "Aucun" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Ressources humaines" description="Dossiers employés, contrats, congés et présence — toute l'équipe au même endroit.">
        {canCreate && (
          <CreateRecordButton label="Nouvel employé" title="Ajouter un employé" redirectBase="/rh"
            description="Dossier complet : contrat, état civil, solde de congés et compte applicatif." action={createEmployee} fields={employeeFields} />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Effectif" value={data.stats.total} icon="Users" />
        <KpiCard label="Actifs" value={data.stats.active} icon="UserCheck" tone="success" />
        <KpiCard label="Congés en attente" value={data.stats.pending} icon="Hourglass" tone={data.stats.pending > 0 ? "warning" : "default"} />
        <KpiCard label="Avances en attente" value={data.stats.advances} icon="Banknote" tone={data.stats.advances > 0 ? "warning" : "default"} />
        <KpiCard label="Contrats à échéance" value={data.stats.expiring} icon="CalendarClock" tone={data.stats.expiring > 0 ? "danger" : "default"} hint="≤ 60 jours" />
        <KpiCard label="Masse salariale" value={formatCurrency(data.stats.masseSalariale)} icon="Wallet" tone="info" hint="base mensuelle" />
      </div>

      {canValidate && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Demandes de congés à traiter</h2>
          <LeaveApprovals leaves={pendingLeaves} />
        </section>
      )}

      {(canValidate || canPayFinance) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Avances sur salaire</h2>
          <AdvanceApprovals rows={advanceRows} canPay={canPayFinance} />
        </section>
      )}

      {data.contractsExpiring.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Contrats arrivant à échéance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.contractsExpiring.map((e) => {
              const d = daysUntil(e.contractEnd);
              return (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <Link href={`/rh/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link>
                  <span className="text-muted-foreground">
                    {formatDate(e.contractEnd)} {d !== null && <span className={d <= 15 ? "text-destructive" : "text-warning"}>· dans {d} j</span>}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Équipe</h2>
        {data.employees.length === 0 ? (
          <EmptyState icon="Users" title="Aucun employé" description="Ajoutez les membres de l'équipe pour démarrer." />
        ) : (
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Contrat</TableHead>
                  <TableHead className="text-right">Salaire base</TableHead>
                  <TableHead className="text-right">Solde congés</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link href={`/rh/${e.id}`} className="hover:underline">{e.fullName}</Link>
                    </TableCell>
                    <TableCell>{e.position || "—"}</TableCell>
                    <TableCell>{e.department || "—"}</TableCell>
                    <TableCell>
                      {e.contractType ? CONTRACT_TYPE[e.contractType] : "—"}
                      {e.contractEnd && <span className="block text-xs text-muted-foreground">→ {formatDate(e.contractEnd)}</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(toNumber(e.baseSalary))}</TableCell>
                    <TableCell className="text-right">{toNumber(e.leaveBalanceDays)} j</TableCell>
                    <TableCell>{e.user ? <Badge tone="info" dot={false}>Lié</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{e.isActive ? <Badge tone="success" dot={false}>Actif</Badge> : <Badge tone="danger" dot={false}>Inactif</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {data.recentLeaves.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique des congés</h2>
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLeaves.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.employee.fullName}</TableCell>
                    <TableCell>{LEAVE_TYPE[l.type] ?? l.type}</TableCell>
                    <TableCell>{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
                    <TableCell className="text-right">{Number(l.days)}</TableCell>
                    <TableCell><StatusBadge map={LEAVE_STATUS} value={l.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
