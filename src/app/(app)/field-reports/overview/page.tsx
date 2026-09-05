import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { getFieldReportsOverview, canViewFieldReportsOverview } from "@/lib/queries/field-reports";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FIELD_REPORT_STATUS } from "@/lib/labels";
import { TrendArea, HBars, StatusDonut } from "./overview-charts";

export const dynamic = "force-dynamic";

export default async function FieldReportsOverviewPage() {
  const user = await requireModule("FIELD_REPORTS");
  const { fieldReportsOverviewRoles } = await getAppSettings();
  // Onglet réservé : Super Admin ou rôle explicitement autorisé par le Super Admin.
  if (!canViewFieldReportsOverview(user, fieldReportsOverviewRoles)) notFound();

  const ov = await getFieldReportsOverview();
  const statusData = ov.byStatus.map((s) => ({ name: FIELD_REPORT_STATUS[s.name]?.label ?? s.name, value: s.value }));

  const tabs = [
    { label: "Rapports", href: "/field-reports" },
    { label: "Overview", href: "/field-reports/overview" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Rapports terrain — Overview" description="Suivi analytique des visites : par médecin, hôpital, délégué, spécialité, et dans le temps." />
      <ModuleTabs tabs={tabs} />

      {ov.kpis.reports === 0 ? (
        <EmptyState icon="BarChart3" title="Pas encore de données" description="Les graphiques apparaîtront dès que des rapports terrain seront saisis." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Rapports" value={ov.kpis.reports} icon="FileText" />
            <KpiCard label="Validés" value={ov.kpis.validated} icon="CheckCheck" tone="success" />
            <KpiCard label="Médecins visités" value={ov.kpis.doctors} icon="Stethoscope" tone="info" />
            <KpiCard label="Établissements" value={ov.kpis.institutions} icon="Building2" />
            <KpiCard label="Délégués actifs" value={ov.kpis.delegates} icon="Users" />
            <KpiCard label="Spécialités" value={ov.kpis.specialties} icon="Activity" />
          </div>

          <Card>
            <CardHeader><CardTitle>Visites par mois (12 derniers mois)</CardTitle></CardHeader>
            <CardContent><TrendArea data={ov.byMonth} /></CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top médecins visités</CardTitle></CardHeader>
              <CardContent><HBars data={ov.byDoctor} color="#2563eb" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top établissements / hôpitaux</CardTitle></CardHeader>
              <CardContent><HBars data={ov.byInstitution} color="#14b8a6" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Visites par délégué</CardTitle></CardHeader>
              <CardContent><HBars data={ov.byDelegate} color="#8b5cf6" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Visites par spécialité</CardTitle></CardHeader>
              <CardContent><HBars data={ov.bySpecialty} color="#0ea5e9" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Produits les plus discutés</CardTitle></CardHeader>
              <CardContent><HBars data={ov.topProducts} color="#f59e0b" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Répartition par statut</CardTitle></CardHeader>
              <CardContent><StatusDonut data={statusData} /></CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
