import { requireUser } from "@/lib/session";
import { getMyMissions } from "@/lib/queries/missions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MON_DOSSIER_TABS } from "@/lib/labels";
import { MissionItem } from "@/components/missions/mission-item";

export const dynamic = "force-dynamic";

export default async function MyMissionsPage() {
  const user = await requireUser();
  const missions = await getMyMissions(user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mon dossier RH — Mes ordres de mission"
        description="Vos missions d'accompagnement et de représentation (congrès, événements, sponsoring). Demandez ou recevez votre ordre de mission, déposez vos pièces et échangez."
      />
      <ModuleTabs tabs={MON_DOSSIER_TABS.map((t) => ({ label: t.label, href: t.href }))} />

      {missions.length === 0 ? (
        <EmptyState icon="MapPin" title="Aucune mission" description="Vous n'êtes assigné à aucune mission pour le moment. Lorsqu'un responsable vous assignera comme accompagnant ou délégué de référence, votre mission apparaîtra ici." />
      ) : (
        <div className="space-y-2">
          {missions.map((m) => (
            <MissionItem key={m.id} m={m} canManage={false} currentUserId={user.id} path="/missions" showParent />
          ))}
        </div>
      )}
    </div>
  );
}
