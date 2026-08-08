"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setDossierBudget } from "@/lib/regulatory/intelligence/cost/cost-actions";

/**
 * Une ligne de dépense par dossier, avec son plafond MODIFIABLE sur place.
 *
 * « Visible ET gérable depuis l'administration » : lire la dépense sans pouvoir agir obligerait à
 * rouvrir chaque dossier un par un — exactement ce que cette page remplace. Le plafond n'est pas
 * décoratif : au-delà, les analyses économiques s'arrêtent et le disent, plutôt que de laisser
 * filer la facture.
 */
export interface BudgetRowData {
  dossierId: string;
  reference: string;
  title: string;
  calls: number;
  costUsd: number;
  budgetUsd: number | null;
  exhausted: boolean;
}

export function DossierBudgetRow({ row, canManage }: { row: BudgetRowData; canManage: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(row.budgetUsd != null ? String(row.budgetUsd) : "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const lock = React.useRef(false);

  const save = () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("dossierId", row.dossierId);
    fd.set("budgetUsd", value);
    void (async () => {
      try {
        const r = await setDossierBudget(fd);
        setMsg({ ok: r.ok, text: r.ok ? "Enregistré." : (r.error ?? "Échec.") });
        if (r.ok) router.refresh();
      } finally {
        setBusy(false);
        lock.current = false;
      }
    })();
  };

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-3">
        <Link href={`/regulatory/enregistrement/analyse/${row.dossierId}`} className="font-medium hover:underline">
          {row.reference}
        </Link>
        <span className="ml-1.5 text-xs text-muted-foreground">{row.title}</span>
        {row.exhausted && (
          <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> plafond atteint — analyses arrêtées
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{row.calls}</td>
      <td className="py-2 pr-3 text-right font-medium tabular-nums">{row.costUsd.toFixed(2)} $</td>
      <td className="py-2">
        {canManage ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="0" step="0.5" value={value}
              onChange={(e) => setValue(e.target.value)} placeholder="global"
              aria-label={`Plafond du dossier ${row.reference}`}
              className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-primary/60"
            />
            <Button size="sm" variant="outline" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
            </Button>
            {msg && (msg.ok
              ? <CheckCircle2 className="h-4 w-4 text-success" aria-label={msg.text} />
              : <XCircle className="h-4 w-4 text-destructive" aria-label={msg.text} />)}
          </div>
        ) : (
          <span className="text-sm tabular-nums text-muted-foreground">
            {row.budgetUsd != null ? `${row.budgetUsd.toFixed(2)} $` : "plafond global"}
          </span>
        )}
      </td>
    </tr>
  );
}
