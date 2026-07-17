"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Truck, Loader2, CheckCircle2 } from "lucide-react";
import { setOrderArrival } from "@/lib/actions/pch-tender-line-actions";
import type { PchOrderDTO } from "@/lib/queries/pch";

type Res = { ok: boolean; error?: string };
const d10 = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Suivi logistique : dates d'arrivée prévue / réelle des bons de commande (client = PCH). */
export function TenderLogistics({ tenderId, orders, canEdit }: { tenderId: string; orders: PchOrderDTO[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function save(orderId: string, expectedArrival: string, arrivedDate: string) {
    if (busy) return; setBusy(orderId);
    const fd = new FormData(); fd.set("id", orderId); fd.set("tenderId", tenderId);
    fd.set("expectedArrival", expectedArrival); fd.set("arrivedDate", arrivedDate);
    const r: Res = await setOrderArrival(fd); setBusy(null);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    router.refresh();
  }

  if (orders.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-base font-semibold"><Truck className="h-4 w-4 text-primary" /> Logistique — acheminement (client : PCH)</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-secondary/40 text-xs text-muted-foreground">
            <tr><th className="px-3 py-2 text-left font-medium">Bon de commande</th><th className="px-3 py-2 text-left font-medium">Arrivée prévue</th><th className="px-3 py-2 text-left font-medium">Arrivée réelle</th><th className="px-3 py-2 text-center font-medium">Reçu</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((o) => <LogisticsRow key={o.id} order={o} canEdit={canEdit} busy={busy === o.id} onSave={save} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogisticsRow({ order, canEdit, busy, onSave }: { order: PchOrderDTO; canEdit: boolean; busy: boolean; onSave: (id: string, e: string, a: string) => void }) {
  const [expected, setExpected] = React.useState(d10(order.expectedArrival));
  const [arrived, setArrived] = React.useState(d10(order.arrivedDate));
  const cls = "h-8 rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60";
  return (
    <tr className="hover:bg-secondary/20">
      <td className="px-3 py-2">{order.reference || "—"} <span className="text-xs text-muted-foreground">· {order.products || "—"}</span></td>
      <td className="px-3 py-2">{canEdit ? <input type="date" className={cls} value={expected} disabled={busy} onChange={(e) => setExpected(e.target.value)} onBlur={() => onSave(order.id, expected, arrived)} /> : (expected || "—")}</td>
      <td className="px-3 py-2">{canEdit ? <input type="date" className={cls} value={arrived} disabled={busy} onChange={(e) => setArrived(e.target.value)} onBlur={() => onSave(order.id, expected, arrived)} /> : (arrived || "—")}</td>
      <td className="px-3 py-2 text-center">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /> : arrived ? <CheckCircle2 className="mx-auto h-4 w-4 text-success" /> : <span className="text-xs text-muted-foreground">en attente</span>}</td>
    </tr>
  );
}
