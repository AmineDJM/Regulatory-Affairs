import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope, getCompanies, companyOptions } from "@/lib/company";
import { toNumber, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CONSULTING_STATUS, CONSULTING_BILLING, EVENTS_TABS } from "@/lib/labels";
import { consultingCreateFields } from "@/lib/ad-pro/create-fields";
import { createConsultingContract } from "@/lib/actions/consulting-actions";
import { billingSuffix, isOverdue } from "@/lib/ad-pro/consulting";

export const dynamic = "force-dynamic";

/**
 * CONSULTING — les engagements pris avec des prestataires.
 *
 * Un contrat n'est pas une demande qu'on approuve puis qu'on oublie : c'est une relation qui
 * court dans le temps. La liste répond donc à trois questions, et dans cet ordre : lesquels sont
 * ACTIFS, lesquels ARRIVENT À TERME, et combien ils nous engagent.
 */
export default async function ConsultingPage() {
  const user = await requireModule("CONSULTING");
  const canCreate = userCan(user, "CONSULTING", "CREATE");

  const [contracts, companies] = await Promise.all([
    prisma.consultingContract.findMany({
      where: await platformScope(user.id),
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } }, tasks: { select: { doneAt: true } } },
    }),
    getCompanies(),
  ]);

  const active = contracts.filter((c) => c.status === "ACTIVE");
  const awaiting = contracts.filter((c) => c.status === "AWAITING_VALIDATION");
  const overdue = contracts.filter((c) => isOverdue(c));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Consulting"
        description="Les contrats passés avec des consultants et des cabinets : mission, rémunération, durée, tâches attendues et pièces signées."
      >
        {canCreate && (
          <CreateRecordButton
            autoOpenParam="new"
            label="Nouveau contrat"
            title="Nouveau contrat de consulting"
            description="Un contrat a deux parties : indiquez le prestataire, ce qu'il doit livrer, et à quelles conditions."
            action={createConsultingContract}
            redirectBase="/consulting"
            fields={consultingCreateFields({ companies: companyOptions(companies) })}
          />
        )}
      </PageHeader>

      <ModuleTabs tabs={EVENTS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Contrats" value={contracts.length} icon="Handshake" />
        <KpiCard label="Actifs" value={active.length} icon="CircleCheck" tone="success" />
        <KpiCard label="En cours de validation" value={awaiting.length} icon="Hourglass" tone={awaiting.length > 0 ? "warning" : "default"} />
        {/* Le terme dépassé se SIGNALE : une échéance d'un jour se prolonge souvent d'un avenant,
            et un logiciel qui clôt de lui-même la relation oblige à la rouvrir. */}
        <KpiCard label="Terme dépassé" value={overdue.length} icon="CalendarX" tone={overdue.length > 0 ? "danger" : "default"} />
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          icon="Handshake"
          title="Aucun contrat de consulting"
          description={canCreate ? "Créez un contrat pour suivre la mission, la rémunération et ce qui reste à livrer." : "Les contrats apparaîtront ici."}
        />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Contrat</TableHead>
                <TableHead>Consultant / cabinet</TableHead>
                <TableHead>Période</TableHead>
                <TableHead className="text-right">Rémunération</TableHead>
                <TableHead>Livrables</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => {
                const amount = c.amount == null ? null : toNumber(c.amount);
                const done = c.tasks.filter((t) => t.doneAt).length;
                return (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      <Link href={`/consulting/${c.id}`} className="hover:underline">{c.reference}</Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/consulting/${c.id}`} className="hover:underline">{c.title}</Link>
                      {c.company && <div className="mt-0.5 text-xs text-muted-foreground">{c.company.name}</div>}
                    </TableCell>
                    <TableCell>{c.counterparty}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.startDate ? formatDate(c.startDate.toISOString()) : "—"}
                      {c.endDate ? ` → ${formatDate(c.endDate.toISOString())}` : ""}
                      {isOverdue(c) && <Badge tone="danger" dot={false} className="ml-1.5">terme dépassé</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {amount != null ? `${formatCurrency(amount)}${billingSuffix(c.billing)}` : "—"}
                      {amount != null && c.billing !== "ONE_OFF" && (
                        <div className="text-[0.6875rem] text-muted-foreground">{CONSULTING_BILLING[c.billing]}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.tasks.length > 0 ? `${done}/${c.tasks.length}` : "—"}
                    </TableCell>
                    <TableCell><StatusBadge map={CONSULTING_STATUS} value={c.status} dot={false} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
