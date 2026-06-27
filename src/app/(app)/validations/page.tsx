import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireModule } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { getMyValidations } from "@/lib/queries/validations";
import { createValidationRequest } from "@/lib/actions/validation-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { NAVIGATION, PRIORITY, VALIDATION_STATUS, VALIDATION_STEP_STATE, VALIDATION_MODE } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime, daysUntil } from "@/lib/utils";
import { ValidationDecision } from "./validation-decision";

export default async function ValidationsPage() {
  const user = await requireModule("VALIDATIONS");
  const { toValidate, myRequests, crossModule } = await getMyValidations(user);

  const mods = accessibleModules(user);
  const seen = new Set<string>();
  const moduleOptions = NAVIGATION
    .filter((n) => mods.includes(n.module) && !seen.has(n.module) && seen.add(n.module))
    .map((n) => ({ value: n.label, label: n.label }));

  const requestFields: FieldDef[] = [
    { type: "text", name: "title", label: "Objet à valider", required: true, full: true, placeholder: "Ex. Paiement prestataire impression" },
    { type: "select", name: "module", label: "Module concerné", options: moduleOptions, required: true },
    { type: "text", name: "objectType", label: "Type d'objet", placeholder: "PURCHASE, PAYMENT, SPONSORING…" },
    { type: "number", name: "amount", label: "Montant (DZD)" },
    { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "text", name: "department", label: "Département" },
    { type: "text", name: "category", label: "Catégorie" },
    { type: "text", name: "link", label: "Lien vers l'objet (URL interne)", placeholder: "/demandes/…" },
    { type: "date", name: "deadline", label: "Échéance" },
    { type: "textarea", name: "description", label: "Détails / contexte" },
  ];

  const pendingMine = myRequests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Validations"
        description="Ce que vous devez valider, et le suivi de vos demandes de validation. Les circuits sont définis par le Super Admin."
      >
        <CreateRecordButton
          label="Demander une validation"
          title="Demander une validation"
          description="La demande sera routée automatiquement vers le bon validateur selon les règles configurées."
          action={createValidationRequest}
          fields={requestFields}
        />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="À valider" value={toValidate.length + crossModule.length} icon="ShieldCheck" tone={toValidate.length + crossModule.length > 0 ? "warning" : "default"} />
        <KpiCard label="Mes demandes en cours" value={pendingMine} icon="Hourglass" tone="info" />
        <KpiCard label="Total de mes demandes" value={myRequests.length} icon="ListChecks" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À valider ({toValidate.length})</h2>
        {toValidate.length === 0 ? (
          <EmptyState icon="CheckCheck" title="Aucune validation en attente" description="Les éléments qui requièrent votre validation apparaîtront ici." />
        ) : (
          <div className="space-y-3">
            {toValidate.map((v) => {
              const d = v.deadline ? daysUntil(v.deadline) : null;
              return (
                <Card key={v.stepId}>
                  <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{v.reference}</span>
                        <Badge tone="neutral" dot={false}>{v.module}</Badge>
                        {v.objectType && <Badge tone="neutral" dot={false}>{v.objectType}</Badge>}
                        <StatusBadge map={PRIORITY} value={v.priority} dot={false} />
                        {v.amount !== null && <span className="text-sm font-semibold">{formatCurrency(v.amount)}</span>}
                      </div>
                      <p className="font-medium">{v.title}</p>
                      {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        Demandé par {v.requester || "—"} · {formatDateTime(v.createdAt)}
                        {v.deadline ? ` · échéance ${formatDate(v.deadline)}${d !== null && d < 0 ? " (en retard)" : ""}` : ""}
                      </p>
                      {v.link && (
                        <Link href={v.link} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> Ouvrir l'élément
                        </Link>
                      )}
                    </div>
                    <div className="shrink-0">
                      <ValidationDecision stepId={v.stepId} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {crossModule.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Validations transverses — autres modules ({crossModule.length})</h2>
          <div className="space-y-2">
            {crossModule.map((v) => (
              <Card key={v.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{v.reference}</span>
                      <Badge tone="info" dot={false}>{v.module}</Badge>
                      <Badge tone="neutral" dot={false}>{v.stage}</Badge>
                      {v.amount !== null && <span className="text-sm font-semibold">{formatCurrency(v.amount)}</span>}
                    </div>
                    <p className="truncate font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">Demandé par {v.requester || "—"} · {formatDateTime(v.createdAt)}</p>
                  </div>
                  <Link href={v.link} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
                    <ExternalLink className="h-4 w-4" /> Ouvrir pour valider
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes demandes de validation ({myRequests.length})</h2>
        {myRequests.length === 0 ? (
          <EmptyState icon="Send" title="Aucune demande envoyée" description="Vos demandes de validation et leur avancement apparaîtront ici." />
        ) : (
          <div className="space-y-2">
            {myRequests.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                      <span className="font-medium">{r.title}</span>
                      <Badge tone="neutral" dot={false}>{r.module}</Badge>
                      <span className="text-xs text-muted-foreground">{VALIDATION_MODE[r.mode]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.amount !== null && <span className="text-sm font-semibold">{formatCurrency(r.amount)}</span>}
                      <StatusBadge map={VALIDATION_STATUS} value={r.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.steps.map((s) => (
                      <span key={s.order} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs" title={s.reason || undefined}>
                        <span className="text-muted-foreground">{s.order}.</span>
                        <span>{s.validator}</span>
                        <StatusBadge map={VALIDATION_STEP_STATE} value={s.status} dot={false} />
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
