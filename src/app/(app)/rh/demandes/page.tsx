import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { clauseSalariesVisibles } from "@/lib/queries/visibilite-listes";
import { getLeavesToDecide } from "@/lib/queries/hr";
import { getHrRequestQueue } from "@/lib/queries/hr-documents";
import { referenceOrdreMissionSuggeree } from "@/lib/hr/ordre-mission/service";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { DEMANDES_RH_TABS } from "@/lib/labels";
import { LeaveApprovals } from "@/components/hr/leave-approvals";
import { FileDemandesRh } from "../[id]/hr-dossier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demandes RH — AMD Internal OS" };

/**
 * « DEMANDES RH » — le sous-module des demandes des salariés (Direction, 06/10 : « qui recevra uniquement les demandes RH
 * et les congés »). Ce qui attend une décision des RH, traité SUR PLACE : les demandes « Mon dossier RH » (attestations,
 * ordres de mission, notes de frais, entrevues) et les congés et absences arrivés à la marche des RH. Les salariés eux-
 * mêmes sont dans « Employés », la paie dans « RH » : chacun son droit, réglable dans la console.
 */
export default async function DemandesRhPage() {
  const user = await requireModule("HR_REQUESTS");
  const peutTrancherConges = userCan(user, "HR_REQUESTS", "VALIDATE");
  const [tabs, demandes, conges, reference] = await Promise.all([
    visibleTabs(user, DEMANDES_RH_TABS),
    getHrRequestQueue(await clauseSalariesVisibles(user.id)),
    peutTrancherConges ? getLeavesToDecide(user) : Promise.resolve([]),
    referenceOrdreMissionSuggeree(),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Demandes RH" description="Les demandes des salariés et les congés qui attendent les ressources humaines — traités ici." />
      <ModuleTabs tabs={tabs} />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Demandes à traiter ({demandes.length})</h2>
        <FileDemandesRh
          demandes={demandes} referenceOrdreMission={reference} currentUserId={user.id}
          lienFiche={userCan(user, "EMPLOYEES", "VIEW")}
        />
      </section>
      {peutTrancherConges && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Congés et absences à trancher ({conges.length})</h2>
          <p className="text-xs text-muted-foreground">
            Circuit : <strong>responsable (N+1) → ressources humaines</strong>. Seules les demandes qui attendent votre signature figurent ici ; le solde
            n&apos;est débité qu&apos;au bout du circuit.
          </p>
          <LeaveApprovals leaves={conges} canManage={userCan(user, "HR_REQUESTS", "UPDATE")} />
        </section>
      )}
    </div>
  );
}
