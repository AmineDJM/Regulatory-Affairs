import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getFieldDefs } from "@/lib/custom-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CustomFieldsCard } from "@/components/shared/custom-fields-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTRACT_TYPE, LEAVE_TYPE, LEAVE_STATUS, PAYROLL_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/utils";
import { getEmployeeHrDossier } from "@/lib/queries/hr-documents";
import { EmployeeForm, type EmployeeFormValues } from "./employee-form";
import { HrDossier } from "./hr-dossier";

const d10 = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "");

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("RH");
  const canUpdate = userCan(user, "RH", "UPDATE");

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      manager: { select: { id: true, fullName: true } },
      user: { select: { id: true, name: true, email: true } },
      leaveRequests: { orderBy: { startDate: "desc" }, take: 20 },
      payrolls: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 5 },
    },
  });
  if (!employee) notFound();

  const [fieldDefs, otherEmployees, unlinkedUsers, hrDossier] = await Promise.all([
    getFieldDefs("EMPLOYEE"),
    prisma.employee.findMany({ where: { id: { not: employee.id } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, employee: { is: null } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    getEmployeeHrDossier(employee.id),
  ]);

  const managerOptions = otherEmployees.map((e) => ({ value: e.id, label: e.fullName }));
  const userOptions = [
    ...(employee.user ? [{ value: employee.user.id, label: `${employee.user.name} (${employee.user.email})` }] : []),
    ...unlinkedUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
  ];

  const formValues: EmployeeFormValues = {
    id: employee.id,
    fullName: employee.fullName,
    position: employee.position ?? "",
    department: employee.department ?? "",
    contractType: employee.contractType ?? "",
    baseSalary: String(toNumber(employee.baseSalary)),
    leaveBalanceDays: String(toNumber(employee.leaveBalanceDays)),
    hireDate: d10(employee.hireDate),
    contractStart: d10(employee.contractStart),
    contractEnd: d10(employee.contractEnd),
    birthDate: d10(employee.birthDate),
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    iban: employee.iban ?? "",
    nationalId: employee.nationalId ?? "",
    cnasNumber: employee.cnasNumber ?? "",
    address: employee.address ?? "",
    managerId: employee.managerId ?? "",
    userId: employee.userId ?? "",
    isActive: employee.isActive,
  };

  return (
    <div className="space-y-5">
      <Link href="/rh" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux RH
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
          <p className="text-muted-foreground">
            {employee.position || "Poste non défini"}{employee.department ? ` · ${employee.department}` : ""}
          </p>
        </div>
        {employee.isActive ? <Badge tone="success" dot={false}>Actif</Badge> : <Badge tone="danger" dot={false}>Inactif</Badge>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>{canUpdate ? "Dossier employé" : "Informations"}</CardTitle></CardHeader>
            <CardContent>
              {canUpdate ? (
                <EmployeeForm employee={formValues} managerOptions={managerOptions} userOptions={userOptions} />
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <Info label="Poste" value={employee.position} />
                  <Info label="Département" value={employee.department} />
                  <Info label="Contrat" value={employee.contractType ? CONTRACT_TYPE[employee.contractType] : null} />
                  <Info label="Salaire de base" value={formatCurrency(toNumber(employee.baseSalary))} />
                  <Info label="Solde congés" value={`${toNumber(employee.leaveBalanceDays)} j`} />
                  <Info label="Embauche" value={employee.hireDate ? formatDate(employee.hireDate) : null} />
                  <Info label="Fin de contrat" value={employee.contractEnd ? formatDate(employee.contractEnd) : null} />
                  <Info label="Email" value={employee.email} />
                  <Info label="Téléphone" value={employee.phone} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Champs personnalisés</CardTitle></CardHeader>
            <CardContent>
              <CustomFieldsCard
                entityType="EMPLOYEE"
                entityId={employee.id}
                defs={fieldDefs.map((f) => ({ id: f.id, key: f.key, label: f.label, type: f.type, options: f.options }))}
                values={(employee.custom as Record<string, unknown>) ?? {}}
                canEdit={canUpdate}
              />
            </CardContent>
          </Card>

          {canUpdate && (
            <Card>
              <CardHeader><CardTitle>Documents & demandes RH</CardTitle></CardHeader>
              <CardContent>
                <HrDossier employeeId={employee.id} documents={hrDossier.documents} requests={hrDossier.requests} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Historique des congés</CardTitle></CardHeader>
            <CardContent className="p-0">
              {employee.leaveRequests.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Aucune demande de congé.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead><TableHead>Période</TableHead>
                      <TableHead className="text-right">Jours</TableHead><TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employee.leaveRequests.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{LEAVE_TYPE[l.type] ?? l.type}</TableCell>
                        <TableCell>{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
                        <TableCell className="text-right">{toNumber(l.days)}</TableCell>
                        <TableCell><StatusBadge map={LEAVE_STATUS} value={l.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Compte & traçabilité</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Compte applicatif" value={employee.user ? `${employee.user.name} (${employee.user.email})` : "Non lié"} />
              <Info label="Manager (N+1)" value={employee.manager?.fullName} />
              <Info label="NIN" value={employee.nationalId} />
              <Info label="N° CNAS" value={employee.cnasNumber} />
              <Info label="Créé le" value={formatDateTime(employee.createdAt)} />
              <Info label="Modifié le" value={formatDateTime(employee.updatedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Derniers bulletins</CardTitle>
              <Link href="/finances/paie" className="text-xs text-primary hover:underline">Voir la paie</Link>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {employee.payrolls.length === 0 ? (
                <p className="text-muted-foreground">Aucun bulletin.</p>
              ) : (
                employee.payrolls.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{String(p.month).padStart(2, "0")}/{p.year}</span>
                    <span className="font-medium">{formatCurrency(toNumber(p.net))}</span>
                    <StatusBadge map={PAYROLL_STATUS} value={p.status} dot={false} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
