import Link from "next/link";
import { requireModule } from "@/lib/session";
import { getMyFieldReports, viewsAllReports } from "@/lib/queries/field-reports";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FIELD_REPORT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { NewReportButton } from "./new-report-button";

export const dynamic = "force-dynamic";

export default async function FieldReportsPage() {
  const user = await requireModule("FIELD_REPORTS");
  const isManager = viewsAllReports(user);
  // Vue simple : rien que les rapports, les uns après les autres (pas de listes agrégées
  // pharmacovigilance / opportunités / etc.), y compris en vue Direction.
  const reports = await getMyFieldReports(user);

  return (
    <div className="space-y-6">
      <PageHeader title="Rapports terrain" description="Comptes rendus de visite — dictés à la voix ou saisis, avec médecin(s), établissement, spécialité et pièces jointes.">
        <NewReportButton />
      </PageHeader>

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
