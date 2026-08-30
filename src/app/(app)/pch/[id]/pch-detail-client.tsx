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
import type { Market360 } from "@/lib/queries/market-360";
import { OrderExecution } from "./order-execution";

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

export function EditTenderButton({ tender, canDelete, users = [], businessUnits = [] }: {
  tender: PchTenderDTO; canDelete: boolean;
  users?: { id: string; name: string }[];
  businessUnits?: { id: string; name: string }[];
}) {
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
            <W label="Référence interne"><Input name="internalReference" defaultValue={t.internalReference ?? ""} placeholder="AO-2026-ONCO-04" /></W>
            <W label="Responsable interne">
              <Select name="responsibleId" defaultValue={t.responsibleId ?? ""}>
                <option value="">—</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </W>
            <W label="Publié le"><Input name="publishedAt" type="date" defaultValue={t.publishedAt?.slice(0, 10) ?? ""} /></W>
            <W label="Date limite de dépôt"><Input name="submissionDeadline" type="date" defaultValue={t.submissionDeadline?.slice(0, 10) ?? ""} /></W>
            <W label="Business Unit">
              <Select name="businessUnitId" defaultValue={t.businessUnitId ?? ""}>
                <option value="">—</option>
                {businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </W>
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

export function OrdersManager({ tenderId, orders, canEdit, canDelete, details = [], contrats = [] }: {
  tenderId: string; orders: PchOrderDTO[]; canEdit: boolean; canDelete: boolean;
  /** L'exécution de chaque bon (lignes, livraisons, factures) — la vue 360°. */
  details?: Market360["bons"];
  contrats?: Market360["contrats"];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<PchOrderDTO | null>(null);
  const [adding, setAdding] = React.useState(false);
  // LE BON DÉPLIÉ : ses lignes, ses livraisons, ses factures. Un seul à la fois — la table
  // reste une table, le détail reste un détail.
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const detailOf = React.useMemo(() => new Map(details.map((d) => [d.id, d])), [details]);
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
                <React.Fragment key={ord.id}>
                <TableRow
                  className={detailOf.has(ord.id) ? "cursor-pointer" : undefined}
                  onClick={() => detailOf.has(ord.id) && setExpanded(expanded === ord.id ? null : ord.id)}
                >
                  <TableCell className="font-mono text-xs">{ord.reference || "—"}</TableCell>
                  <TableCell>{ord.products || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(ord.quantity)}</TableCell>
                  <TableCell className="text-right">{ord.value !== null ? formatCurrency(ord.value) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ord.receivedDate ? formatDate(ord.receivedDate) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ord.paymentDate ? formatDate(ord.paymentDate) : "—"}</TableCell>
                  <TableCell><StatusBadge map={PCH_ORDER_STATUS} value={ord.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      {canEdit && <button onClick={(e) => { e.stopPropagation(); setErr(null); setEditing(ord); }} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>}
                      {canDelete && <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Supprimer ce bon de commande ?")) { const fd = new FormData(); fd.set("id", ord.id); deleteOrder(fd).then(() => router.refresh()); } }} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </TableCell>
                </TableRow>
                {expanded === ord.id && detailOf.has(ord.id) && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-transparent p-2">
                      <OrderExecution bon={detailOf.get(ord.id)!} contrats={contrats} canEdit={canEdit} />
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
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
            {/* Le CONTRAT exécuté : c'est lui qui ouvre le contrôle du restant sur les lignes. */}
            {!o && contrats.length > 0 && (
              <W full label="Contrat exécuté">
                <Select name="contractId" defaultValue={contrats.length === 1 ? contrats[0].id : ""}>
                  <option value="">— Sans contrat —</option>
                  {contrats.map((c) => <option key={c.id} value={c.id}>{c.reference ? `${c.reference} — ` : ""}{c.title}</option>)}
                </Select>
              </W>
            )}
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
