"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ReceiptText, FileUp } from "lucide-react";
import { requestBV } from "@/lib/actions/regulatory-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface BvItem {
  id: string;
  reference: string;
  label: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
}

const BV_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  PENDING: { label: "À régler", tone: "warning" },
  REVISION_REQUESTED: { label: "Révision demandée", tone: "danger" },
  PAID: { label: "Réglé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

const fmtDZD = (n: number) => `${n.toLocaleString("fr-FR")} DZD`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : null);

export function BvRequests({ productId, items, canRequest }: { productId: string; items: BvItem[]; canRequest: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canRequest && (
        <Button size="sm" onClick={() => { setError(null); setFileName(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Demande de BV
        </Button>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande de BV pour ce dossier.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.label}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{b.reference}</span> · {fmtDZD(b.amount)}
                  {b.dueDate && <> · échéance {fmtDate(b.dueDate)}</>}
                  {b.paidDate && <> · réglé le {fmtDate(b.paidDate)}</>}
                </p>
              </div>
              <Badge tone={BV_STATUS[b.status]?.tone ?? "neutral"} dot={false}>{BV_STATUS[b.status]?.label ?? b.status}</Badge>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Demande de BV" description="Envoyée à l'espace comptable (ordre de dépense).">
        <form
          action={async (fd) => {
            setBusy(true); setError(null);
            fd.set("productId", productId);
            const r = await requestBV(fd);
            setBusy(false);
            if (r.ok) { setOpen(false); router.refresh(); }
            else setError(r.error ?? "Échec.");
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="bvType">Type de BV</Label>
            <Select id="bvType" name="bvType" defaultValue="BV 25 %">
              <option value="BV 25 %">BV 25 %</option>
              <option value="BV 75 %">BV 75 %</option>
              <option value="BV complémentaire">BV complémentaire</option>
              <option value="BV">Autre BV</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Montant (DZD)</Label>
              <Input id="amount" name="amount" type="number" step="any" min="1" required placeholder="Ex. 150000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Échéance souhaitée</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note pour le comptable</Label>
            <Textarea id="note" name="note" placeholder="Précisions éventuelles (référence, urgence…)" />
          </div>
          <div className="space-y-1.5">
            <Label>Justificatif (proforma BV, PDF…)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted/50">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{fileName ?? "Joindre un document (optionnel)"}</span>
              <input type="file" name="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
            </label>
          </div>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />} Envoyer au comptable
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
