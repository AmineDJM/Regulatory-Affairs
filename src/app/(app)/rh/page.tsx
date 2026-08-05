import Link from "next/link";
import { Banknote, Building2, Users, CalendarOff } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getRhData } from "@/lib/queries/hr";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createEmployee, analyzeEmployeeContract } from "@/lib/actions/hr-actions";
import { aiConfigured } from "@/lib/ai";
import { getCompanies, companyOptions } from "@/lib/company";
import { CONTRACT_TYPE, HR_REQUEST_TYPE, HR_REQUEST_STATUS, HR_TABS } from "@/lib/labels";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { getDepartmentOptions } from "@/lib/departments";
import { LeaveApprovals, type PendingLeave } from "./leave-approvals";
import { AdvanceApprovals, type AdvanceRow } from "./advance-approvals";

export default async function RhPage() {
  const user = await requireModule("RH");
  const canCreate = userCan(user, "RH", "CREATE");
  const canValidate = userCan(user, "RH", "VALIDATE");
  const canManage = userCan(user, "RH", "UPDATE"); // RH/DRH : modifier toute demande de congé (dont l'historique)
  const data = await getRhData();
  const companies = await getCompanies();
  const departmentOptions = await getDepartmentOptions();
  const tabs = await visibleTabs(user, HR_TABS);

  // Demandes « Mon Dossier RH » de TOUS les employés — traitées ICI, dans le module RH
  // (les statuts se règlent sur la fiche employé, section Dossier RH).
  const hrRequests = await prisma.hrDocumentRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 60,
    include: { employee: { select: { id: true, fullName: true } } },
  });
  const openHrRequests = hrRequests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS");

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
    // Rattachement STRUCTURÉ (département ou sous-département) — remplace l'ancien texte libre.
    { type: "select", name: "departmentId", label: "Département", options: departmentOptions.map((o) => ({ value: o.id, label: o.label })), placeholder: "— Non affecté —" },
    { type: "select", name: "companyId", label: "Entité", options: companyOptions(companies), placeholder: "— Entité —" },
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
      <PageHeader title="Ressources humaines" description="Ce qui attend une décision : demandes, congés, avances et échéances.">
        {canValidate && (
          <Link href="/rh/paie"><Button variant="outline"><Banknote className="h-4 w-4" /> Paie</Button></Link>
        )}
        {canCreate && (
          <CreateRecordButton label="Nouvel employé" title="Ajouter un employé" redirectBase="/rh"
            description="Dossier complet : contrat, état civil, solde de congés et compte applicatif." action={createEmployee} fields={employeeFields}
            analyze={{
              action: analyzeEmployeeContract,
              buttonLabel: "Analyser le contrat",
              title: "Pré-remplir depuis un contrat de travail (IA)",
              hint: "Téléversez le contrat (PDF ou image) : l'OCR Mistral + l'IA extraient nom, poste, type de contrat, dates, salaire de base, NIN, CNAS… Tout reste modifiable avant l'enregistrement.",
              accept: ".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff",
              disabled: !aiConfigured(),
              disabledHint: "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render).",
            }} />
        )}
      </PageHeader>
      <ModuleTabs tabs={tabs} />

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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Demandes RH à traiter ({openHrRequests.length})</h2>
          <p className="text-xs text-muted-foreground">Demandes émises depuis « Mon Dossier RH » (attestations, congés, ordres de mission…). Cliquez pour traiter sur la fiche de l'employé.</p>
          <Card>
            <CardContent className="p-0">
              {hrRequests.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Aucune demande.</p>
              ) : (
                <Table mobileCards>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Demande</TableHead>
                      <TableHead>Précisions</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hrRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.employee.fullName}</TableCell>
                        <TableCell>{HR_REQUEST_TYPE[r.type] ?? r.type}</TableCell>
                        <TableCell className="max-w-[280px]"><p className="truncate text-xs text-muted-foreground" title={r.details ?? ""}>{r.details ?? "—"}</p></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                        <TableCell><StatusBadge map={HR_REQUEST_STATUS} value={r.status} /></TableCell>
                        <TableCell className="text-right">
                          <Link href={`/rh/${r.employee.id}`} className="text-sm font-medium text-primary hover:underline">Traiter</Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {canValidate && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Demandes de congés à traiter</h2>
          <LeaveApprovals leaves={pendingLeaves} canManage={canManage} />
        </section>
      )}

      {canValidate && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Avances sur salaire</h2>
          <p className="text-xs text-muted-foreground">Une fois approuvée, un ordre de dépense est transmis au comptable pour règlement.</p>
          <AdvanceApprovals rows={advanceRows} />
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

      {/* L'ANNUAIRE et l'HISTORIQUE des congés vivent dans leurs propres onglets : cet écran
          ne garde que ce qui appelle une décision. */}
      <div className="flex flex-wrap gap-2">
        <Link href="/rh/equipe" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary">
          <Users className="h-4 w-4" /> Voir l&apos;équipe ({data.stats.active})
        </Link>
        <Link href="/rh/conges" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary">
          <CalendarOff className="h-4 w-4" /> Congés & absences
        </Link>
        <Link href="/rh/departements" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary">
          <Building2 className="h-4 w-4" /> Départements
        </Link>
      </div>

    </div>
  );
}
