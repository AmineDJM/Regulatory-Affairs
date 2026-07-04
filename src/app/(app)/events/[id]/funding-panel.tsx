"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { submitEventForApproval } from "@/lib/actions/event-actions";
import { PreliminaryDecision, ProductAnalysis, FinalDecision, EditGrantedBudget } from "../../congress-international/congress-workflow";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EXPENSE_ORDER_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

type PM = { id: string; name: string };
type Cat = { id: string; label: string; isSub: boolean };

export interface EventFunding {
  id: string;
  requestStatus: string | null;
  requesterName: string | null;
  productManagerName: string | null;
  productManagerBudget: number | null;
  productManagerNotes: string | null;
  preliminaryByName: string | null;
  preliminaryAt: string | null;
  preliminaryNote: string | null;
  finalByName: string | null;
  finalAt: string | null;
  finalNote: string | null;
  finalAmount: number | null;
  estimatedBudget: number | null;
  rejectionReason: string | null;
  expenseOrder: { reference: string; status: string; amount: number } | null;
}

interface Props {
  data: EventFunding;
  productManagers: PM[];
  budgetCategories?: Cat[];
  canSubmit: boolean;
  canMarketing: boolean;
  canAnalyze: boolean;
  canValidate: boolean;
}

// Le circuit de prise en charge des événements réutilise les composants & actions
// des congrès, paramétrés par le type « EVENT » (cf. congress-request-actions).
const TYPE = "EVENT";

function SubmitButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const submit = () =>
    start(async () => {
      setErr(null);
      const fd = new FormData();
      fd.set("id", id);
      const r = await submitEventForApproval(fd);
      if (!r.ok) { setErr(r.error ?? "Erreur."); return; }
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Soumettez cet événement au circuit de prise en charge : il part vers le National Sales
        (approbation + choix du chef de produit), puis l'analyse du chef de produit, puis la Direction
        (budget accordé), puis l'information médicale (déclaration aux autorités).
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Soumettre pour prise en charge
      </Button>
    </div>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "current" | "pending" | "rejected"; children?: React.ReactNode }) {
  const tone =
    state === "done" ? "border-success bg-success/10 text-success"
      : state === "current" ? "border-primary bg-primary/10 text-primary"
        : state === "rejected" ? "border-destructive bg-destructive/10 text-destructive"
          : "border-border bg-secondary text-muted-foreground";
  return (
    <div className="flex gap-3">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${tone}`}>{n}</div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}

export function EventFundingPanel({ data, productManagers, budgetCategories = [], canSubmit, canMarketing, canAnalyze, canValidate }: Props) {
  const st = data.requestStatus;

  if (!st) {
    if (!canSubmit) {
      return <p className="text-sm text-muted-foreground">Cet événement n'est pas soumis à un circuit de prise en charge (financement).</p>;
    }
    return <SubmitButton id={data.id} />;
  }

  const done = (states: string[]) => states.includes(st);

  return (
    <div className="space-y-4">
      <Step n={1} title="Demande soumise" state="done">
        <p className="text-sm text-muted-foreground">
          {data.requesterName ? `Par ${data.requesterName}` : "Demande créée"}
          {data.estimatedBudget !== null ? ` · estimation ${formatCurrency(data.estimatedBudget)}` : ""}
        </p>
      </Step>

      <Step n={2} title="Approbation préliminaire (National Sales)"
        state={st === "REJECTED" && !data.finalAt ? "rejected" : done(["PRELIMINARY_APPROVED", "AWAITING_FINAL", "APPROVED", "COMPLETED"]) ? "done" : st === "AWAITING_PRELIMINARY" ? "current" : "pending"}>
        {st === "AWAITING_PRELIMINARY" ? (
          canMarketing ? <PreliminaryDecision type={TYPE} id={data.id} productManagers={productManagers} />
            : <p className="text-sm text-muted-foreground">En attente du National Sales.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.preliminaryByName ? `${data.preliminaryByName}${data.preliminaryAt ? ` · ${formatDate(data.preliminaryAt)}` : ""}` : ""}
            {data.preliminaryNote ? ` — ${data.preliminaryNote}` : ""}
            {data.productManagerName ? ` · Chef de produit : ${data.productManagerName}` : ""}
          </p>
        )}
      </Step>

      <Step n={3} title="Analyse chef de produit"
        state={done(["AWAITING_FINAL", "APPROVED", "COMPLETED"]) ? "done" : st === "PRELIMINARY_APPROVED" ? "current" : "pending"}>
        {st === "PRELIMINARY_APPROVED" ? (
          canAnalyze ? <ProductAnalysis type={TYPE} id={data.id} />
            : <p className="text-sm text-muted-foreground">En attente de l'analyse du chef de produit {data.productManagerName ? `(${data.productManagerName})` : ""}.</p>
        ) : data.productManagerBudget !== null || data.productManagerNotes ? (
          <p className="text-sm text-muted-foreground">{data.productManagerName}{data.productManagerBudget !== null ? ` · budget proposé ${formatCurrency(data.productManagerBudget)}` : ""}{data.productManagerNotes ? ` — ${data.productManagerNotes}` : ""}</p>
        ) : <p className="text-sm text-muted-foreground">À venir.</p>}
      </Step>

      <Step n={4} title="Validation définitive (Direction) → information médicale"
        state={st === "APPROVED" || st === "COMPLETED" ? "done" : st === "REJECTED" && data.finalAt ? "rejected" : st === "AWAITING_FINAL" ? "current" : "pending"}>
        {st === "AWAITING_FINAL" ? (
          canValidate ? <FinalDecision type={TYPE} id={data.id} suggestedAmount={data.productManagerBudget ?? data.estimatedBudget ?? null} categories={budgetCategories} />
            : <p className="text-sm text-muted-foreground">En attente de la validation définitive de la Direction.</p>
        ) : st === "APPROVED" || st === "COMPLETED" ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{data.finalByName}{data.finalAt ? ` · ${formatDate(data.finalAt)}` : ""}{data.finalNote ? ` — ${data.finalNote}` : ""}{data.finalAmount != null ? ` · ${formatCurrency(data.finalAmount)} accordé` : ""}</p>
            {data.expenseOrder ? (
              <p className="flex flex-wrap items-center gap-2">
                Ordre de dépense <span className="font-mono text-xs">{data.expenseOrder.reference}</span>
                <StatusBadge map={EXPENSE_ORDER_STATUS} value={data.expenseOrder.status} dot={false} />
                <span>{formatCurrency(data.expenseOrder.amount)}</span>
                <Link href="/finances/ordres-de-depense" className="text-primary hover:underline">Voir</Link>
              </p>
            ) : (
              <p className="text-xs">En cours de traitement (information médicale / Finances).</p>
            )}
            {canValidate && <EditGrantedBudget type={TYPE} id={data.id} current={data.finalAmount ?? data.productManagerBudget ?? null} />}
          </div>
        ) : <p className="text-sm text-muted-foreground">À venir.</p>}
      </Step>

      {st === "REJECTED" && data.rejectionReason && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Refusé — {data.rejectionReason}</p>
      )}
    </div>
  );
}
