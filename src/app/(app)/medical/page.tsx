import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { getMedicalData } from "@/lib/queries/medical";
import { createVisit } from "@/lib/actions/medical-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { VISIT_STATUS, doctorDisplayName, MEDICAL_TABS } from "@/lib/labels";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MedicalDirectory } from "./medical-directory";
import { VisitsTable, type VisitRow } from "./visits-table";

export default async function MedicalPage() {
  const user = await requireModule("MEDICAL");
  const canCreate = userCan(user, "MEDICAL", "CREATE");
  const canEdit = userCan(user, "MEDICAL", "UPDATE");
  const canDelete = userCan(user, "MEDICAL", "DELETE");
  const isManager = hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER";

  const data = await getMedicalData(user);
  const allDoctors = data.groups.flatMap((g) => g.doctors).sort((a, b) => a.name.localeCompare(b.name));
  const delegateOptions = data.delegates.map((d) => ({ value: d.id, label: d.name }));

  const visitFields: FieldDef[] = [
    { type: "date", name: "date", label: "Date", required: true },
    { type: "select", name: "doctorId", label: "Médecin", options: allDoctors.map((d) => ({ value: d.id, label: doctorDisplayName(d) })), placeholder: "—" },
    { type: "text", name: "region", label: "Région" },
    { type: "text", name: "objective", label: "Objectif de visite" },
    { type: "text", name: "presentedProducts", label: "Produits à présenter" },
    { type: "select", name: "status", label: "Statut", options: optionsFromMap(VISIT_STATUS), defaultValue: "PLANNED" },
    ...(isManager ? [{ type: "select", name: "delegateId", label: "Délégué", options: delegateOptions, placeholder: "—" } as FieldDef] : []),
  ];

  const visitRows: VisitRow[] = data.visits;

  return (
    <div className="space-y-6">
      <PageHeader title="Promotion médicale" description="Spécialités, médecins (hôpital / libéral), influence & potentiel, et suivi des visites des délégués." />
      <ModuleTabs tabs={MEDICAL_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Spécialités" value={data.stats.specialties} icon="Tags" tone="info" />
        <KpiCard label="Médecins" value={data.stats.doctors} icon="Stethoscope" />
        <KpiCard label="Leaders d'opinion" value={data.stats.kol} icon="Star" tone={data.stats.kol > 0 ? "info" : "default"} />
        <KpiCard label="Visites réalisées (mois)" value={data.stats.completedThisMonth} icon="CheckCircle2" tone="success" />
      </div>

      <MedicalDirectory
        groups={data.groups}
        specialties={data.specialties}
        delegates={data.delegates}
        canCreate={canCreate}
        canEdit={canEdit}
        canManageSpecialties={canCreate || canEdit}
        canDelete={canDelete}
        isManager={isManager}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visites & tournées</h2>
          {canCreate && <CreateRecordButton label="Nouvelle visite" title="Planifier une visite" action={createVisit} fields={visitFields} />}
        </div>
        <VisitsTable rows={visitRows} />
      </section>
    </div>
  );
}
