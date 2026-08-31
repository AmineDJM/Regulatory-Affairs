import Link from "next/link";
import { ArrowRight, ShieldPlus, FileClock, FileCheck2, Inbox, Filter } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getDeclarations, declarationsHiddenByScope } from "@/lib/queries/medical-info";
import { getCompanyScope, getMyCompanies } from "@/lib/company";
import { hiddenByScopeMessage } from "@/lib/company-visibility";
import { toNumber, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MEDICAL_INFO_STATUS, ENTITY_TYPE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function MedicalInfoPage() {
  const user = await requireModule("MEDICAL_INFO");
  const [declarations, portee, myCompanies] = await Promise.all([
    getDeclarations(user),
    declarationsHiddenByScope(user),
    getMyCompanies(user.id),
  ]);
  // CE QUE LE FILTRE D'ENTITÉ CACHE, dit au lieu d'être subi : sans ce chiffre, on voit des
  // déclarations dans « Mon espace » et pas dans son module, et rien ne relie les deux faits.
  const scopeId = getCompanyScope();
  const masques = hiddenByScopeMessage({
    ...portee,
    companyLabel: scopeId ? (myCompanies.find((c) => c.id === scopeId)?.name ?? null) : null,
  });

  const count = (s: string) => declarations.filter((d) => d.status === s).length;
  const stats = [
    { label: "À déclarer", value: count("AWAITING_REVIEW"), icon: ShieldPlus, tone: "text-warning" },
    { label: "Pièces demandées", value: count("DOCS_REQUESTED"), icon: FileClock, tone: "text-primary" },
    { label: "Prêt à valider", value: count("READY"), icon: FileCheck2, tone: "text-purple-500" },
    { label: "Validés", value: count("VALIDATED"), icon: FileCheck2, tone: "text-success" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Information médicale"
        description="Déclaration réglementaire des sponsorings et congrès validés par la Direction — avant tout règlement. Le pharmacien responsable exige les pièces nécessaires, puis valide pour déclencher l'ordre de dépense."
      />

      {masques && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          <Filter className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {masques}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 py-4">
              <s.icon className={`h-7 w-7 shrink-0 ${s.tone}`} />
              <div>
                <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {declarations.length === 0 ? (
        <EmptyState icon="ShieldPlus" title="Aucune déclaration" description="Les événements validés définitivement par la Direction apparaîtront ici pour déclaration." />
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {declarations.map((d) => {
              const pending = d.requests.filter((r) => r.status === "PENDING").length;
              return (
                <Link key={d.id} href={`/information-medicale/${d.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                      <span className="truncate font-medium">{d.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ENTITY_TYPE_LABELS[d.sourceType] ?? d.sourceType}
                      {d.amount != null && <> · {formatCurrency(toNumber(d.amount))}</>}
                      {pending > 0 && <> · {pending} pièce{pending > 1 ? "s" : ""} en attente</>}
                      <> · {formatDate(d.createdAt.toISOString())}</>
                    </p>
                  </div>
                  <StatusBadge map={MEDICAL_INFO_STATUS} value={d.status} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
