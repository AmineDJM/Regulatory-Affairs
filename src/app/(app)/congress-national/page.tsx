import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getCongressList, getCongressFormData } from "@/lib/queries/congress";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { CONGRESS_TABS } from "@/lib/labels";
import { CongressRequestButton } from "../congress-international/congress-request-form";
import { CongressTable } from "../congress-international/congress-table";

export default async function CongressNationalPage() {
  const user = await requireModule("CONGRESS_NATIONAL");
  const canCreate = userCan(user, "CONGRESS_NATIONAL", "CREATE");

  const [rows, form] = await Promise.all([getCongressList("NATIONAL", user), getCongressFormData()]);

  const pending = rows.filter((r) => ["AWAITING_PRELIMINARY", "PRELIMINARY_APPROVED", "AWAITING_FINAL"].includes(r.requestStatus)).length;
  const approved = rows.filter((r) => r.requestStatus === "APPROVED" || r.requestStatus === "COMPLETED").length;

  return (
    <div className="space-y-5">
      <PageHeader title="Événements nationaux" description="Congrès, séminaires, tables rondes, webinaires… Demandes de prise en charge avec validation Direction et analyse chef de produit.">
        {canCreate && <CongressRequestButton national doctors={form.doctors} users={form.users} />}
      </PageHeader>

      <ModuleTabs tabs={CONGRESS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Demandes" value={rows.length} icon="MapPin" />
        <KpiCard label="En cours" value={pending} icon="Hourglass" tone={pending > 0 ? "warning" : "default"} />
        <KpiCard label="Pris en charge" value={approved} icon="CheckCircle2" tone="success" />
        <KpiCard label="Refusées" value={rows.filter((r) => r.requestStatus === "REJECTED").length} icon="XCircle" />
      </div>

      <CongressTable rows={rows} basePath="/congress-national" showType />
    </div>
  );
}
