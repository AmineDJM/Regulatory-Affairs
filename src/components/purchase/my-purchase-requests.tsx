"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { withdrawPurchaseRequest } from "@/lib/actions/purchase-request-actions";
import { STAGE_LABEL, STAGE_TONE, canWithdraw, type PurchaseStage } from "@/lib/general-means/purchase-request";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface MyPurchaseRow {
  id: string;
  reference: string;
  title: string;
  summary: string;
  createdAt: string;
  stage: PurchaseStage;
  validatorName: string | null;
  estimated: number | null;
  decisionNote: string | null;
}

/**
 * MES DEMANDES D'ACHAT — où en est chacune, et qui la tient.
 *
 * La question à laquelle cet écran répond n'est pas « quelles demandes existent » mais
 * « qu'est-ce que j'attends, et de qui ». C'est pourquoi chaque ligne NOMME le validateur :
 * « en attente » sans destinataire fait relancer tout le monde, ou personne.
 */
export function MyPurchaseRequests({ rows }: { rows: MyPurchaseRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="ShoppingBasket"
        title="Aucune demande d'achat"
        description="Demandez ce dont vous avez besoin : votre responsable la validera, et l'achat suivra."
      />
    );
  }

  const withdraw = async (id: string) => {
    if (!window.confirm("Retirer cette demande ? Votre responsable en sera informé.")) return;
    setBusy(id);
    const fd = new FormData(); fd.set("id", id);
    const r = await withdrawPurchaseRequest(fd);
    setBusy(null);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    else router.refresh();
  };

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{r.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{r.summary}</span>
            <span className="block text-[0.6875rem] text-muted-foreground">
              {r.reference} · {formatDate(r.createdAt)}
              {r.validatorName ? ` · ${r.validatorName}` : ""}
              {r.estimated != null ? ` · ~${formatCurrency(r.estimated)}` : ""}
            </span>
            {r.decisionNote && <span className="block text-xs text-muted-foreground">{r.decisionNote}</span>}
          </span>
          <Badge tone={STAGE_TONE[r.stage]} dot={false}>{STAGE_LABEL[r.stage]}</Badge>
          <Link
            href={`/demandes/${r.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Suivre <ExternalLink className="h-3 w-3" />
          </Link>
          {canWithdraw(r.stage) && (
            <button
              type="button" disabled={busy === r.id} onClick={() => void withdraw(r.id)}
              title="Retirer la demande"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
