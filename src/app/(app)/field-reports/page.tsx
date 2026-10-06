import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getMyFieldReports, viewsAllReports, canViewFieldReportsOverview } from "@/lib/queries/field-reports";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FIELD_REPORT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { NewReportButton } from "./new-report-button";
import { SupprimerRapport } from "./supprimer-rapport";

export const dynamic = "force-dynamic";

export default async function FieldReportsPage() {
  const user = await requireModule("FIELD_REPORTS");
  const isManager = viewsAllReports(user);
  // Vue simple : rien que les rapports, les uns après les autres (pas de listes agrégées
  // pharmacovigilance / opportunités / etc.), y compris en vue Direction.
  const [reports, settings] = await Promise.all([getMyFieldReports(user), getAppSettings()]);
  const canOverview = canViewFieldReportsOverview(user, settings.fieldReportsOverviewRoles);
  const tabs = [
    { label: "Rapports", href: "/field-reports" },
    { label: "Overview", href: "/field-reports/overview", show: canOverview },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Rapports terrain" description="Comptes rendus de visite — dictés à la voix ou saisis, avec médecin(s), établissement, spécialité et pièces jointes.">
        <NewReportButton />
        {/* LE SECOND CHOIX DU KAM (Direction, 06/10) : un rapport de visite, OU un cas de pharmacovigilance pour Regulatory. */}
        {userCan(user, "PHARMACOVIGILANCE", "CREATE") && (
          <Link href="/field-reports/pharmacovigilance/nouveau" className="inline-flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm font-medium hover:bg-warning/20">
            <ShieldAlert className="h-4 w-4" /> Signaler un cas de pharmacovigilance
          </Link>
        )}
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{isManager ? "Tous les rapports" : "Mes rapports"} ({reports.length})</h2>
        {reports.length === 0 ? (
          <EmptyState icon="Mic" title="Aucun rapport" description="Cliquez sur « Nouveau rapport (Parler) » pour dicter votre première visite." />
        ) : (
          <div className="surface divide-y divide-border">
            {reports.map((r) => (
              // La ligne n'est plus UN lien : une icône dans un lien est un bouton dans un lien (deux
              // gestes pour un clic). Le lien porte le contenu, la corbeille est sa SŒUR (§118.212).
              <div key={r.id} className="flex items-center gap-1 pr-2 hover:bg-secondary/40">
                <Link href={`/field-reports/${r.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-3">
                  <StatusBadge map={FIELD_REPORT_STATUS} value={r.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.doctorName || "Médecin non précisé"}{r.specialty ? ` · ${r.specialty}` : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.summary || r.products || "Brouillon en cours…"}</p>
                  </div>
                  {isManager && r.delegateName && <span className="text-xs text-muted-foreground">{r.delegateName}</span>}
                  {r.attachments > 0 && <span className="text-xs text-muted-foreground">📎 {r.attachments}</span>}
                  <span className="text-xs text-muted-foreground">{formatDate(r.visitDate)}</span>
                </Link>
                <SupprimerRapport
                  id={r.id}
                  enabled={r.canDelete}
                  name={`${r.doctorName || "Rapport"}${r.delegateName ? ` — ${r.delegateName}` : ""} · ${formatDate(r.visitDate)}`}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
