import Link from "next/link";
import type { EntityType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { CONGRESS_REQUEST_STATUS, NATIONAL_EVENT_TYPE, EXPENSE_ORDER_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { CongressDetail } from "@/lib/queries/congress";
import { PreliminaryDecision, ProductAnalysis, FinalDecision } from "./congress-workflow";

type PM = { id: string; name: string };

const CONGRESS_DOC_CATEGORIES = ["REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"];

export function CongressDetailView({
  detail, canValidate, canAnalyze, productManagers, entityType, entityId, documents, canUpload, canDelete, path,
}: {
  detail: CongressDetail;
  canValidate: boolean;
  canAnalyze: boolean;
  productManagers: PM[];
  entityType: EntityType;
  entityId: string;
  documents: DocItem[];
  canUpload: boolean;
  canDelete: boolean;
  path: string;
}) {
  const d = detail;
  const st = d.requestStatus;
  const done = (s: string[]) => s.includes(st);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {d.eventType && <Info label="Type" value={NATIONAL_EVENT_TYPE[d.eventType] ?? d.eventType} />}
            <Info label="Spécialité / thème" value={d.specialty} />
            <Info label="Lieu" value={d.location} />
            <Info label="Date" value={d.date ? formatDate(d.date) : null} />
            {d.endDate && <Info label="Date fin" value={formatDate(d.endDate)} />}
            <Info label="Demandeur" value={d.requester} />
          </CardContent>
        </Card>

        {/* Budgets */}
        <Card>
          <CardHeader><CardTitle>Budgets</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Budget label="Estimé par le demandeur" value={d.estimatedBudget} />
            <Budget label="Proposé par le chef de produit" value={d.productManagerBudget} tone="primary" />
          </CardContent>
        </Card>

        {/* Workflow A → Z */}
        <Card>
          <CardHeader><CardTitle>Workflow de la demande</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Demande créée" active state="done">
              <p className="text-sm text-muted-foreground">Par {d.requester || "—"} · {formatDateTime(d.createdAt)} · estimation {d.estimatedBudget !== null ? formatCurrency(d.estimatedBudget) : "—"}</p>
            </Step>

            <Step n={2} title="Validation préliminaire (Direction)"
              state={st === "REJECTED" && !d.finalAt ? "rejected" : done(["PRELIMINARY_APPROVED", "AWAITING_FINAL", "APPROVED", "COMPLETED"]) ? "done" : st === "AWAITING_PRELIMINARY" ? "current" : "pending"}>
              {st === "AWAITING_PRELIMINARY" ? (
                canValidate ? <PreliminaryDecision type={d.type} id={d.id} productManagers={productManagers} />
                  : <p className="text-sm text-muted-foreground">En attente de la Direction.</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {d.preliminaryBy ? `${d.preliminaryBy} · ${d.preliminaryAt ? formatDate(d.preliminaryAt) : ""}` : ""}
                  {d.preliminaryNote ? ` — ${d.preliminaryNote}` : ""}
                  {d.productManager ? ` · Chef de produit : ${d.productManager}` : ""}
                </p>
              )}
            </Step>

            <Step n={3} title="Analyse chef de produit"
              state={done(["AWAITING_FINAL", "APPROVED", "COMPLETED"]) ? "done" : st === "PRELIMINARY_APPROVED" ? "current" : "pending"}>
              {st === "PRELIMINARY_APPROVED" ? (
                canAnalyze ? <ProductAnalysis type={d.type} id={d.id} />
                  : <p className="text-sm text-muted-foreground">En attente de l'analyse du chef de produit {d.productManager ? `(${d.productManager})` : ""}.</p>
              ) : d.productManagerBudget !== null ? (
                <p className="text-sm text-muted-foreground">{d.productManager} · budget {formatCurrency(d.productManagerBudget)}{d.productManagerNotes ? ` — ${d.productManagerNotes}` : ""}</p>
              ) : <p className="text-sm text-muted-foreground">À venir.</p>}
            </Step>

            <Step n={4} title="Validation définitive (Direction)"
              state={st === "APPROVED" || st === "COMPLETED" ? "done" : st === "REJECTED" && d.finalAt ? "rejected" : st === "AWAITING_FINAL" ? "current" : "pending"}>
              {st === "AWAITING_FINAL" ? (
                canValidate ? <FinalDecision type={d.type} id={d.id} suggestedAmount={d.productManagerBudget ?? d.estimatedBudget ?? null} />
                  : <p className="text-sm text-muted-foreground">En attente de la validation définitive.</p>
              ) : st === "APPROVED" || st === "COMPLETED" ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{d.finalBy} · {d.finalAt ? formatDate(d.finalAt) : ""}{d.finalNote ? ` — ${d.finalNote}` : ""}</p>
                  {d.expenseOrder && (
                    <p className="flex items-center gap-2">
                      Ordre de dépense <span className="font-mono text-xs">{d.expenseOrder.reference}</span>
                      <StatusBadge map={EXPENSE_ORDER_STATUS} value={d.expenseOrder.status} dot={false} />
                      <span>{formatCurrency(d.expenseOrder.amount)}</span>
                      <Link href="/finances/ordres-de-depense" className="text-primary hover:underline">Voir</Link>
                    </p>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">À venir.</p>}
            </Step>

            {st === "REJECTED" && d.rejectionReason && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Refusé — {d.rejectionReason}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents + médecins + participants */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Documents</CardTitle><Badge tone="neutral" dot={false}>{documents.length}</Badge></CardHeader>
          <CardContent className="space-y-4">
            {canUpload && <DocumentUpload entityType={entityType} entityId={entityId} categories={CONGRESS_DOC_CATEGORIES} />}
            <DocumentList documents={documents} canDelete={canDelete} canRename={canUpload} canEdit={onlyofficeConfigured() && canUpload} path={path} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Médecins invités</CardTitle><Badge tone="neutral" dot={false}>{d.doctors.length}</Badge></CardHeader>
          <CardContent>
            {d.doctors.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> : (
              <ul className="space-y-2">
                {d.doctors.map((doc) => (
                  <li key={doc.id} className="text-sm">
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{[doc.specialty, doc.institution].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Participants Adventum</CardTitle><Badge tone="neutral" dot={false}>{d.participants.length}</Badge></CardHeader>
          <CardContent>
            {d.participants.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> : (
              <ul className="space-y-2">
                {d.participants.map((p) => (
                  <li key={p.id} className="text-sm"><span className="font-medium">{p.name}</span>{p.title && <span className="text-xs text-muted-foreground"> · {p.title}</span>}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}

function Budget({ label, value, tone }: { label: string; value: number | null; tone?: "primary" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value !== null ? formatCurrency(value) : "—"}</p>
    </div>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "current" | "pending" | "rejected"; active?: boolean; children: React.ReactNode }) {
  const tone = state === "done" ? "bg-success text-success-foreground" : state === "current" ? "bg-warning text-warning-foreground" : state === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-muted-foreground";
  return (
    <div className="flex gap-3">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone}`}>{state === "rejected" ? "✗" : state === "done" ? "✓" : n}</div>
      <div className="min-w-0 flex-1 space-y-1.5 border-b border-border pb-3 last:border-0">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}
