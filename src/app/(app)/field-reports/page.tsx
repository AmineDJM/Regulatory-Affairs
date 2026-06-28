import Link from "next/link";
import { requireModule } from "@/lib/session";
import { getMyFieldReports, getFieldReportsAggregation, managesReports, type ReportSnippet } from "@/lib/queries/field-reports";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FIELD_REPORT_STATUS, MEDICAL_TABS } from "@/lib/labels";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { userCan } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { NewReportButton } from "./new-report-button";

export const dynamic = "force-dynamic";

export default async function FieldReportsPage() {
  const user = await requireModule("MEDICAL");
  const isManager = managesReports(user);
  const [reports, agg] = await Promise.all([
    getMyFieldReports(user),
    isManager ? getFieldReportsAggregation() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Rapports terrain" description="Comptes rendus de visite des délégués — dictés à la voix, structurés par l'IA, relus et validés.">
        <NewReportButton />
      </PageHeader>
      <ModuleTabs tabs={MEDICAL_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      {isManager && agg && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Rapports validés" value={agg.stats.reports} icon="ClipboardCheck" tone="success" />
            <KpiCard label="Médecins visités" value={agg.stats.doctors} icon="Stethoscope" />
            <KpiCard label="Signalements qualité/PV" value={agg.stats.withQuality} icon="ShieldAlert" tone={agg.stats.withQuality > 0 ? "danger" : "default"} />
            <KpiCard label="Opportunités" value={agg.stats.withOpportunity} icon="Sparkles" tone="info" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SnippetCard title="Signalements qualité / pharmacovigilance" items={agg.qualitySignals} tone="danger" />
            <SnippetCard title="Opportunités terrain" items={agg.opportunities} />
            <SnippetCard title="Objections fréquentes" items={agg.objections} />
            <SnippetCard title="Questions médicales" items={agg.medicalQuestions} />
            <SnippetCard title="Concurrents mentionnés" items={agg.competitors} />
            <SnippetCard title="Demandes de sponsoring" items={agg.sponsoringRequests} />
            <SnippetCard title="Prochaines actions" items={agg.nextActions} />
            <Card>
              <CardHeader><CardTitle>Produits les plus discutés</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {agg.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : agg.topProducts.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm"><span>{p.name}</span><Badge tone="info" dot={false}>{p.count}</Badge></div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{isManager ? "Tous les rapports" : "Mes rapports"} ({reports.length})</h2>
        {reports.length === 0 ? (
          <EmptyState icon="Mic" title="Aucun rapport" description="Cliquez sur « Nouveau rapport (Parler) » pour dicter votre première visite." />
        ) : (
          <div className="surface divide-y divide-border">
            {reports.map((r) => (
              <Link key={r.id} href={`/field-reports/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-secondary/40">
                <StatusBadge map={FIELD_REPORT_STATUS} value={r.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.doctorName || "Médecin non précisé"}{r.specialty ? ` · ${r.specialty}` : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.summary || r.products || "Brouillon en cours…"}</p>
                </div>
                {isManager && r.delegateName && <span className="text-xs text-muted-foreground">{r.delegateName}</span>}
                {r.attachments > 0 && <span className="text-xs text-muted-foreground">📎 {r.attachments}</span>}
                <span className="text-xs text-muted-foreground">{formatDate(r.visitDate)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SnippetCard({ title, items, tone }: { title: string; items: ReportSnippet[]; tone?: "danger" }) {
  return (
    <Card>
      <CardHeader><CardTitle className={tone === "danger" ? "text-destructive" : ""}>{title} ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucun élément.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {items.map((it, i) => (
              <li key={i} className="px-4 py-2">
                <p className="text-sm">{it.text}</p>
                <p className="text-[11px] text-muted-foreground">{[it.doctor, it.delegate, formatDate(it.date)].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
