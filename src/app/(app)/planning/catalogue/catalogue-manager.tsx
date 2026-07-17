"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  createBusinessUnit, updateBusinessUnit, deleteBusinessUnit,
  createPromoProduct, updatePromoProduct, deletePromoProduct,
} from "@/lib/actions/sales-planning-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Opt { id: string; name: string }
interface BU { id: string; name: string; code: string | null; color: string | null; companyId: string | null; headId: string | null; isActive: boolean; productCount: number }
interface Prod { id: string; name: string; code: string | null; businessUnitId: string | null; buName: string | null; managerId: string | null; isActive: boolean }

const inputCls = "h-9 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";

export function CatalogueManager({ companies, businessUnits, products, users }: { companies: Opt[]; businessUnits: BU[]; products: Prod[]; users: Opt[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData, refresh = true) {
    setBusy(true);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    if (refresh) router.refresh();
  }

  const buOptions = businessUnits.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ─────────── Business Units ─────────── */}
      <Card>
        <CardHeader><CardTitle>Business Units (franchises)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form
            className="grid grid-cols-2 gap-2"
            action={(fd) => run(createBusinessUnit, fd)}
            onSubmit={() => {}}
          >
            <input name="name" required placeholder="Nom (ex. Neurology)" className={`${inputCls} col-span-2`} />
            <select name="companyId" className={inputCls} defaultValue=""><option value="">— Société —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select name="headId" className={inputCls} defaultValue=""><option value="">— Chef de BU —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <input name="color" type="color" defaultValue="#2563eb" className="h-9 w-16 rounded-lg border border-input bg-background" title="Couleur" />
            <button type="submit" disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter la BU
            </button>
          </form>

          <div className="space-y-1.5">
            {businessUnits.length === 0 && <p className="text-sm text-muted-foreground">Aucune BU.</p>}
            {businessUnits.map((b) => (
              <BuRow key={b.id} bu={b} companies={companies} users={users}
                onSave={(fd) => run(updateBusinessUnit, fd, false)}
                onDelete={() => { if (window.confirm(`Supprimer la BU « ${b.name} » ?`)) { const fd = new FormData(); fd.set("id", b.id); run(deleteBusinessUnit, fd); } }} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─────────── Produits promus ─────────── */}
      <Card>
        <CardHeader><CardTitle>Produits promus</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="grid grid-cols-2 gap-2" action={(fd) => run(createPromoProduct, fd)}>
            <input name="name" required placeholder="Nom du produit" className={`${inputCls} col-span-2`} />
            <select name="businessUnitId" className={inputCls} defaultValue=""><option value="">— BU —</option>{buOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <select name="managerId" className={inputCls} defaultValue=""><option value="">— Chef de produit —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <button type="submit" disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter le produit
            </button>
          </form>

          <div className="space-y-1.5">
            {products.length === 0 && <p className="text-sm text-muted-foreground">Aucun produit.</p>}
            {products.map((p) => (
              <ProdRow key={p.id} prod={p} buOptions={buOptions} users={users}
                onSave={(fd) => run(updatePromoProduct, fd, false)}
                onDelete={() => { if (window.confirm(`Supprimer « ${p.name} » ?`)) { const fd = new FormData(); fd.set("id", p.id); run(deletePromoProduct, fd); } }} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BuRow({ bu, companies, users, onSave, onDelete }: { bu: BU; companies: Opt[]; users: Opt[]; onSave: (fd: FormData) => void; onDelete: () => void }) {
  const [s, setS] = React.useState(bu);
  function save(next: BU) {
    setS(next);
    const fd = new FormData();
    fd.set("id", next.id); fd.set("name", next.name); fd.set("code", next.code ?? ""); fd.set("color", next.color ?? "");
    fd.set("companyId", next.companyId ?? ""); fd.set("headId", next.headId ?? ""); if (next.isActive) fd.set("isActive", "on");
    onSave(fd);
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-1.5">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#94a3b8" }} />
      <input className={`${inputCls} min-w-28 flex-1`} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} onBlur={() => save(s)} />
      <select className={inputCls} value={s.companyId ?? ""} onChange={(e) => save({ ...s, companyId: e.target.value || null })}><option value="">— Société —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={inputCls} value={s.headId ?? ""} onChange={(e) => save({ ...s, headId: e.target.value || null })}><option value="">— Chef —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={s.isActive} onChange={(e) => save({ ...s, isActive: e.target.checked })} /> Actif</label>
      <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function ProdRow({ prod, buOptions, users, onSave, onDelete }: { prod: Prod; buOptions: Opt[]; users: Opt[]; onSave: (fd: FormData) => void; onDelete: () => void }) {
  const [s, setS] = React.useState(prod);
  function save(next: Prod) {
    setS(next);
    const fd = new FormData();
    fd.set("id", next.id); fd.set("name", next.name); fd.set("code", next.code ?? "");
    fd.set("businessUnitId", next.businessUnitId ?? ""); fd.set("managerId", next.managerId ?? ""); if (next.isActive) fd.set("isActive", "on");
    onSave(fd);
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-1.5">
      <input className={`${inputCls} min-w-28 flex-1`} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} onBlur={() => save(s)} />
      <select className={inputCls} value={s.businessUnitId ?? ""} onChange={(e) => save({ ...s, businessUnitId: e.target.value || null })}><option value="">— BU —</option>{buOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select className={inputCls} value={s.managerId ?? ""} onChange={(e) => save({ ...s, managerId: e.target.value || null })}><option value="">— Chef produit —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={s.isActive} onChange={(e) => save({ ...s, isActive: e.target.checked })} /> Actif</label>
      <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
