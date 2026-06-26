"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { updateTender, deleteTender, createOrder, updateOrder, deleteOrder } from "@/lib/actions/pch-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PCH_TENDER_STATUS, PCH_ORDER_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { PchTenderDTO, PchOrderDTO } from "@/lib/queries/pch";

type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

function W({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}><Label>{label}</Label>{children}</div>;
}

function useSubmit() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const submit = async (action: Action, fd: FormData, onOk: () => void) => {
    setSaving(true); setErr(null);
    const r = await action(fd);
    setSaving(false);
    if (r.ok) { onOk(); router.refresh(); } else setErr(r.error ?? "Erreur.");
  };
  return { saving, err, setErr, submit };
}

export function EditTenderButton({ tender, canDelete }: { tender: PchTenderDTO; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { saving, err, setErr, submit } = useSubmit();
  const t = tender;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setErr(null); setOpen(true); }}><Pencil className="h-4 w-4" /> Modifier</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Modifier l'appel d'offres" width="lg">
        <form action={(fd) => { fd.set("id", t.id); submit(updateTender, fd, () => setOpen(false)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <W full label="Intitulé"><Input name="title" defaultValue={t.title} /></W>
            <W full label="Produits"><Textarea name="products" defaultValue={t.products} /></W>
            <W label="Fournisseur"><Input name="supplier" defaultValue={t.supplier} /></W>
            <W label="Pays du fournisseur"><Input name="supplierCountry" defaultValue={t.supplierCountry} /></W>
            <W label="Quantité"><Input name="quantity" type="number" defaultValue={t.quantity} /></W>
            <W label="Valeur (DZD)"><Input name="value" type="number" step="any" defaultValue={t.value ?? ""} /></W>
            <W label="Client"><Input name="client" defaultValue={t.client} /></W>
            <W label="Statut"><Select name="status" defaultValue={t.status}>{Object.entries(PCH_TENDER_STATUS).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}</Select></W>
            <W label="Date d'attribution"><Input name="awardDate" type="date" defaultValue={t.awardDate?.slice(0, 10) ?? ""} /></W>
            <W full label="— Caution —"><div /></W>
            <W label="Montant caution (DZD)"><Input name="cautionAmount" type="number" step="any" defaultValue={t.cautionAmount ?? ""} /></W>
            <W label="Déposée ?"><label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" name="cautionDeposited" defaultChecked={t.cautionDeposited} className="h-4 w-4 rounded border-input" /> Caution déposée</label></W>
            <W label="Caution — début"><Input name="cautionStart" type="date" defaultValue={t.cautionStart?.slice(0, 10) ?? ""} /></W>
            <W label="Caution — fin"><Input name="cautionEnd" type="date" defaultValue={t.cautionEnd?.slice(0, 10) ?? ""} /></W>
            <W full label="Notes"><Textarea name="notes" defaultValue={t.notes} /></W>
          </div>
          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex items-center justify-between pt-1">
            {canDelete ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm("Supprimer cet appel d'offres et ses bons de commande ?")) { const fd = new FormData(); fd.set("id", t.id); deleteTender(fd).then((r) => { if (r.ok) router.push("/pch"); else window.alert(r.error); }); } }}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
            </div>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function OrdersManager({ tenderId, orders, canEdit, canDelete }: { tenderId: string; orders: PchOrderDTO[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<PchOrderDTO | null>(null);
  const [adding, setAdding] = React.useState(false);
  const { saving, err, setErr, submit } = useSubmit();
  const open = adding || editing !== null;
  const o = editing;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bons de commande ({orders.length})</h2>
        {canEdit && <Button size="sm" onClick={() => { setErr(null); setAdding(true); }}><Plus className="h-4 w-4" /> Nouveau bon</Button>}
      </div>

      {orders.length === 0 ? (
        <p className="surface p-4 text-sm text-muted-foreground">Aucun bon de commande. Ajoutez les bons reçus de la PCH.</p>
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead><TableHead>Produits</TableHead><TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Valeur</TableHead><TableHead>Reçu</TableHead><TableHead>Paiement</TableHead><TableHead>Statut</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((ord) => (
                <TableRow key={ord.id}>
                  <TableCell className="font-mono text-xs">{ord.reference || "—"}</TableCell>
                  <TableCell>{ord.products || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(ord.quantity)}</TableCell>
                  <TableCell className="text-right">{ord.value !== null ? formatCurrency(ord.value) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ord.receivedDate ? formatDate(ord.receivedDate) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ord.paymentDate ? formatDate(ord.paymentDate) : "—"}</TableCell>
                  <TableCell><StatusBadge map={PCH_ORDER_STATUS} value={ord.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      {canEdit && <button onClick={() => { setErr(null); setEditing(ord); }} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>}
                      {canDelete && <button onClick={() => { if (window.confirm("Supprimer ce bon de commande ?")) { const fd = new FormData(); fd.set("id", ord.id); deleteOrder(fd).then(() => router.refresh()); } }} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={open} onClose={() => { setAdding(false); setEditing(null); }} title={o ? "Modifier le bon de commande" : "Nouveau bon de commande"} width="md">
        <form
          action={(fd) => {
            if (o) { fd.set("id", o.id); submit(updateOrder, fd, () => setEditing(null)); }
            else { fd.set("tenderId", tenderId); submit(createOrder, fd, () => setAdding(false)); }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <W label="Référence (n° BC)"><Input name="reference" defaultValue={o?.reference} /></W>
            <W label="Statut"><Select name="status" defaultValue={o?.status ?? "PENDING"}>{Object.entries(PCH_ORDER_STATUS).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}</Select></W>
            <W full label="Produits"><Input name="products" defaultValue={o?.products} /></W>
            <W label="Quantité"><Input name="quantity" type="number" defaultValue={o?.quantity ?? ""} /></W>
            <W label="Valeur (DZD)"><Input name="value" type="number" step="any" defaultValue={o?.value ?? ""} /></W>
            <W label="Date de réception"><Input name="receivedDate" type="date" defaultValue={o?.receivedDate?.slice(0, 10) ?? ""} /></W>
            <W label="Date de paiement"><Input name="paymentDate" type="date" defaultValue={o?.paymentDate?.slice(0, 10) ?? ""} /></W>
            <W full label="Notes"><Textarea name="notes" defaultValue={o?.notes} /></W>
          </div>
          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setAdding(false); setEditing(null); }}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
