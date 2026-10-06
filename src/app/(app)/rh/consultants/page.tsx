import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope, getMyCompanies, companyOptions } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { visibleTabs } from "@/lib/nav-tabs";
import { EMPLOYES_TABS } from "@/lib/labels";
import { consultingRhCreateFields } from "@/lib/ad-pro/create-fields";
import { createConsultingContract } from "@/lib/actions/consulting-actions";
import { isOverdue } from "@/lib/ad-pro/consulting";
import { ContractsTable } from "@/components/consulting/contracts-table";

export const dynamic = "force-dynamic";

/**
 * RH › CONSULTANTS — les contrats de consulting qui relèvent des Ressources humaines (§118.150).
 *
 * « Transfère le consulting de Consultant médical — Atakor Minds, qui est dans Consulting
 * d'Ad&Pro, à un consulting en RH. » Côté RH, mesuré, un consultant n'existait que comme demande
 * de recrutement « Consulting », close « consultant externe » sans fiche ni contrat : il n'y avait
 * AUCUN endroit où suivre l'engagement. Ce sont les MÊMES contrats que ceux d'Ad & Pro › Consulting
 * — même fiche, mêmes tâches, mêmes pièces, même cycle de vie — rangés au pôle RH : ceux qui
 * suivent la promotion ne les voient plus, les RH si.
 */
export default async function RhConsultantsPage() {
  const user = await requireModule("EMPLOYEES");
  const canCreate = userCan(user, "EMPLOYEES", "CREATE");

  const [contracts, companies, tabs] = await Promise.all([
    // LE PÔLE RH SEULEMENT — composé avec la portée de la plateforme, jamais étalé (§118.133).
    prisma.consultingContract.findMany({
      where: { AND: [await platformScope(user.id), { pole: "RH" }] },
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } }, tasks: { select: { doneAt: true } } },
    }),
    getMyCompanies(user.id),
    visibleTabs(user, EMPLOYES_TABS),
  ]);

  const active = contracts.filter((c) => c.status === "ACTIVE");
  const awaiting = contracts.filter((c) => c.status === "AWAITING_VALIDATION");
  const overdue = contracts.filter((c) => isOverdue(c));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Consultants"
        description="Les contrats des consultants suivis par les RH : mission, rémunération, durée, tâches attendues et pièces signées."
      >
        {canCreate && (
          <CreateRecordButton
            autoOpenParam="new"
            label="Nouveau contrat"
            title="Nouveau contrat de consultant"
            description="Un contrat a deux parties : indiquez le consultant, ce qu'il doit livrer, et à quelles conditions."
            action={createConsultingContract}
            redirectBase="/consulting"
            fields={consultingRhCreateFields({ companies: companyOptions(companies) })}
          />
        )}
      </PageHeader>

      <ModuleTabs tabs={tabs} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Contrats" value={contracts.length} icon="Handshake" />
        <KpiCard label="Actifs" value={active.length} icon="CircleCheck" tone="success" />
        <KpiCard label="En cours de validation" value={awaiting.length} icon="Hourglass" tone={awaiting.length > 0 ? "warning" : "default"} />
        <KpiCard label="Terme dépassé" value={overdue.length} icon="CalendarX" tone={overdue.length > 0 ? "danger" : "default"} />
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          icon="Handshake"
          title="Aucun contrat de consultant"
          // L'état vide NOMME le geste : un contrat déjà suivi par Ad & Pro se transfère depuis sa
          // fiche — le recréer ici en ferait deux, avec deux références et deux historiques.
          description={
            "Un contrat déjà enregistré dans Ad & Pro › Consulting se transfère depuis sa fiche (« Transférer vers Ressources humaines »)"
            + (canCreate ? " ; un nouveau contrat se crée ici." : ".")
          }
        />
      ) : (
        <ContractsTable contracts={contracts} />
      )}
    </div>
  );
}
