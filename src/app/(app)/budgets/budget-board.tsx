"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createEnvelope, updateEnvelope, deleteEnvelope, setBudgetTotal,
  createBudgetCategory, updateBudgetCategory, deleteBudgetCategory, attributeTransaction,
} from "@/lib/actions/budget-envelope-actions";
import type { BudgetOverview, BudgetEnvelopeOption, BudgetCategoryView, BudgetHealth } from "@/lib/queries/budget";
import { ROLE_LABELS } from "@/lib/labels";

interface BudgetTotalInfo { mode: "FIXED" | "FLEXIBLE"; value: number; fixed: number }
// Rôles (hors gestionnaires) auxquels on peut ouvrir une enveloppe en consultation.
const ACCESS_ROLE_OPTIONS = ["DIRECTION", "FINANCE_BUDGET_MANAGER", "MEDICAL_PROMOTION_MANAGER", "PRODUCT_MANAGER"] as const;

type Result = { ok: boolean; error?: string };
const d10 = (iso: string) => iso.slice(0, 10);

// Modules rattachables à une enveloppe (les catégories Ad & Pro en tête).
const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: "SPONSORING", label: "Ad & Pro — Sponsoring" },
  { value: "CONGRESS_INTERNATIONAL", label: "Ad & Pro — Congrès internationaux" },
  { value: "CONGRESS_NATIONAL", label: "Ad & Pro — Congrès nationaux" },
  { value: "EVENTS", label: "Ad & Pro — Événements" },
  { value: "PROMO_MATERIAL", label: "Ad & Pro — Matériel promotionnel" },
  { value: "MEDICAL", label: "Promotion médicale" },
  { value: "REGULATORY", label: "Regulatory" },
  { value: "BUSINESS_DEVELOPMENT", label: "Business Development" },
  { value: "RH", label: "Ressources humaines" },
  { value: "LOGISTICS", label: "Logistique" },
  { value: "PCH", label: "PCH — Marchés" },
];
const moduleLabel = (m: string | null | undefined) => MODULE_OPTIONS.find((o) => o.value === m)?.label ?? null;

function moduleSelect(defaultValue?: string | null) {
  return (
    <div className="col-span-2 space-y-1.5">
      <Label>Module rattaché</Label>
      <Select name="module" defaultValue={defaultValue ?? ""}>
        <option value="">— Aucun —</option>
        {MODULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}

/** Cases « ouvrir en consultation à… » : ces rôles (ex. Direction des opérations)
 *  ne voient que les enveloppes ainsi ouvertes. */
function accessRolesField(defaultRoles: string[] = []) {
  return (
    <div className="col-span-2 space-y-1.5">
      <Label>Ouvrir en consultation à</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {ACCESS_ROLE_OPTIONS.map((r) => (
          <label key={r} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="accessRoles" value={r} defaultChecked={defaultRoles.includes(r)} className="h-4 w-4 rounded border-input" />
            {ROLE_LABELS[r] ?? r}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Laisser vide = visible des seuls gestionnaires de budget.</p>
    </div>
  );
}

const HEALTH: Record<BudgetHealth, { label: string; tone: "success" | "warning" | "danger" | "neutral"; bar: string }> = {
  ON_TRACK: { label: "Maîtrisé", tone: "success", bar: "bg-success" },
  AT_RISK: { label: "À surveiller", tone: "warning", bar: "bg-warning" },
  OVER_BUDGET: { label: "Dépassé", tone: "danger", bar: "bg-destructive" },
  NONE: { label: "—", tone: "neutral", bar: "bg-muted-foreground/40" },
};

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<Result>, onOk?: () => void) => {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) { onOk?.(); router.refresh(); } else setErr(r.error ?? "Erreur.");
  };
  return { busy, err, setErr, run };
}

function field(name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label>{label}</Label>
      <Input name={name} {...props} />
    </div>
  );
}

export function CreateEnvelopeButton() {
  const [open, setOpen] = React.useState(false);
  const { busy, err, run } = useRun();
  const year = new Date().getFullYear();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle enveloppe</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvelle enveloppe budgétaire" description="Un budget total pour une période, à répartir ensuite en catégories." width="md">
        <form action={(fd) => run(() => createEnvelope(fd), () => setOpen(false))} className="grid grid-cols-2 gap-3">
          {field("name", "Nom de l'enveloppe", { placeholder: `Budget ${year}`, required: true }, true)}
          {moduleSelect()}
          {field("totalAmount", "Montant de l'enveloppe (DZD)", { type: "number", step: "any", placeholder: "0" }, true)}
          {field("periodStart", "Début de période", { type: "date", defaultValue: `${year}-01-01` })}
          {field("periodEnd", "Fin de période", { type: "date", defaultValue: `${year}-12-31` })}
          {accessRolesField()}
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea name="notes" rows={2} /></div>
          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Créer</Button></div>
        </form>
      </Sheet>
    </>
  );
}

export function BudgetBoard({ overview, envelopes, canManage, budgetTotal }: { overview: BudgetOverview; envelopes: BudgetEnvelopeOption[]; canManage: boolean; budgetTotal: BudgetTotalInfo }) {
  const router = useRouter();
  const t = overview.totals;
  const [editEnv, setEditEnv] = React.useState(false);
  const [totalSheet, setTotalSheet] = React.useState(false);
  const [catSheet, setCatSheet] = React.useState<{ cat?: BudgetCategoryView } | null>(null);
  const { run } = useRun();

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ env: overview.envelope.id, ...params });
    router.push(`/budgets?${sp.toString()}`);
  };

  return (
    <div className="space-y-5">
      {/* Contrôles : enveloppe + période */}
      <div className="surface flex flex-wrap items-end gap-3 p-3">
        <div className="space-y-1.5">
          <Label>Enveloppe {moduleLabel(overview.envelope.module) && <Badge tone="info" dot={false} className="ml-1">{moduleLabel(overview.envelope.module)}</Badge>}</Label>
          <Select value={overview.envelope.id} onChange={(e) => router.push(`/budgets?env=${e.target.value}`)} className="w-56">
            {envelopes.map((en) => <option key={en.id} value={en.id}>{en.name}{en.isActive ? "" : " (archivée)"}</option>)}
          </Select>
        </div>
        {/* Budget total au-dessus des enveloppes : figé ou somme des enveloppes. */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Budget total
            <Badge tone={budgetTotal.mode === "FIXED" ? "purple" : "neutral"} dot={false}>{budgetTotal.mode === "FIXED" ? "Fixe" : "Flexible"}</Badge>
            {canManage && <button type="button" onClick={() => setTotalSheet(true)} className="text-muted-foreground hover:text-foreground" title="Régler le budget total"><SlidersHorizontal className="h-3.5 w-3.5" /></button>}
          </Label>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(budgetTotal.value)}</p>
        </div>
        <PeriodPicker from={d10(overview.period.from)} to={d10(overview.period.to)} onApply={(from, to) => navigate({ from, to })} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Période : {formatDate(overview.period.from)} → {formatDate(overview.period.to)}</span>
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditEnv(true)}><Pencil className="h-4 w-4" /> Enveloppe</Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Budget total" value={formatCurrency(t.total)} />
        <Kpi label="Alloué" value={formatCurrency(t.allocated)} hint={t.unallocated !== 0 ? `${formatCurrency(t.unallocated)} non alloué` : "100 % réparti"} tone={t.unallocated < 0 ? "danger" : "default"} />
        <Kpi label="Consommé" value={formatCurrency(t.consumed)} hint={`${t.pct}% du total${t.committed ? ` · ${formatCurrency(t.committed)} engagé` : ""}`} tone="warning" />
        <Kpi label="Reste" value={formatCurrency(t.remaining)} tone={t.remaining < 0 ? "danger" : "success"} />
      </div>

      {/* Catégories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Catégories ({overview.categories.length})</h2>
          {canManage && <Button size="sm" onClick={() => setCatSheet({})}><Plus className="h-4 w-4" /> Nouvelle catégorie</Button>}
        </div>
        {overview.categories.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">Aucune catégorie. {canManage && "Répartissez le budget total en créant des catégories (ex. Promotion, Congrès, Logistique…)."}</p>
        ) : (
          <div className="space-y-2">
            {overview.categories.map((c) => <CategoryCard key={c.id} c={c} canManage={canManage} onEdit={() => setCatSheet({ cat: c })} onDelete={() => { if (window.confirm(`Supprimer « ${c.name} » ? Les dépenses repasseront en « non attribué ».`)) { const fd = new FormData(); fd.set("id", c.id); run(() => deleteBudgetCategory(fd)); } }} />)}
          </div>
        )}
      </section>

      {/* Dépenses non attribuées */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dépenses non attribuées {overview.unattributed.total > 0 && <Badge tone="warning" dot={false}>{formatCurrency(overview.unattributed.total)}</Badge>}
        </h2>
        {overview.unattributed.transactions.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">Toutes les dépenses de la période sont attribuées à une catégorie. 👍</p>
        ) : (
          <div className="surface divide-y divide-border">
            {overview.unattributed.transactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.label}</p>
                  <p className="text-xs text-muted-foreground">{tx.reference} · {formatDate(tx.date)}{tx.counterparty ? ` · ${tx.counterparty}` : ""}</p>
                </div>
                <span className="font-semibold text-destructive">{formatCurrency(tx.amount)}</span>
                {canManage ? (
                  <Select
                    defaultValue=""
                    onChange={(e) => { const fd = new FormData(); fd.set("transactionId", tx.id); if (e.target.value) fd.set("budgetCategoryId", e.target.value); run(() => attributeTransaction(fd)); }}
                    className="h-8 w-44 text-xs"
                  >
                    <option value="">Attribuer à…</option>
                    {overview.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                ) : <Badge tone="neutral" dot={false}>Non attribué</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>

      {editEnv && <EnvelopeSheet envelope={overview.envelope} onClose={() => setEditEnv(false)} onDeleted={() => router.push("/budgets")} canDelete={canManage} />}
      {catSheet && <CategorySheet envelopeId={overview.envelope.id} cat={catSheet.cat} onClose={() => setCatSheet(null)} />}
      {totalSheet && <BudgetTotalSheet info={budgetTotal} onClose={() => setTotalSheet(false)} />}
    </div>
  );
}

function BudgetTotalSheet({ info, onClose }: { info: BudgetTotalInfo; onClose: () => void }) {
  const { busy, err, run } = useRun();
  const [mode, setMode] = React.useState<BudgetTotalInfo["mode"]>(info.mode);
  return (
    <Sheet open onClose={onClose} title="Budget total" description="Au-dessus des enveloppes : un montant figé, ou la somme automatique des enveloppes." width="md">
      <form action={(fd) => { fd.set("mode", mode); run(() => setBudgetTotal(fd), onClose); }} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value as BudgetTotalInfo["mode"])}>
            <option value="FLEXIBLE">Flexible — somme des enveloppes</option>
            <option value="FIXED">Fixe — montant figé</option>
          </Select>
        </div>
        {mode === "FIXED" && (
          <div className="space-y-1.5">
            <Label>Montant total fixe (DZD)</Label>
            <Input name="budgetFixedTotal" type="number" step="any" defaultValue={info.fixed} />
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button></div>
      </form>
    </Sheet>
  );
}

function PeriodPicker({ from, to, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  React.useEffect(() => { setF(from); setT(to); }, [from, to]);
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1.5"><Label>Du</Label><Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="w-40" /></div>
      <div className="space-y-1.5"><Label>Au</Label><Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="w-40" /></div>
      <Button variant="outline" size="sm" onClick={() => onApply(f, t)}><SlidersHorizontal className="h-4 w-4" /> Appliquer</Button>
    </div>
  );
}

function CategoryCard({ c, canManage, onEdit, onDelete }: { c: BudgetCategoryView; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const h = HEALTH[c.health];
  const pct = Math.min(c.pct, 100);
  return (
    <div className="surface p-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#64748b" }} />
        <span className="font-semibold">{c.name}</span>
        <Badge tone={h.tone} dot={false}>{h.label}</Badge>
        <span className="ml-auto text-sm text-muted-foreground">{formatCurrency(c.consumed)} / {formatCurrency(c.allocated)}</span>
        {canManage && (
          <div className="flex items-center gap-0.5">
            <button onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
            <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all", h.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Reste : <span className={cn("font-medium", c.remaining < 0 ? "text-destructive" : "text-foreground")}>{formatCurrency(c.remaining)}</span></span>
        <span>{c.pct}% consommé</span>
        {c.committed > 0 && <span>{formatCurrency(c.committed)} engagé (prévu)</span>}
      </div>
    </div>
  );
}

function EnvelopeSheet({ envelope, onClose, onDeleted, canDelete }: { envelope: BudgetOverview["envelope"]; onClose: () => void; onDeleted: () => void; canDelete: boolean }) {
  const { busy, err, run } = useRun();
  return (
    <Sheet open onClose={onClose} title="Modifier l'enveloppe" width="md">
      <form action={(fd) => { fd.set("id", envelope.id); run(() => updateEnvelope(fd), onClose); }} className="grid grid-cols-2 gap-3">
        {field("name", "Nom", { defaultValue: envelope.name, required: true }, true)}
        {moduleSelect(envelope.module)}
        {field("totalAmount", "Budget total (DZD)", { type: "number", step: "any", defaultValue: envelope.total }, true)}
        {field("periodStart", "Début", { type: "date", defaultValue: d10(envelope.periodStart) })}
        {field("periodEnd", "Fin", { type: "date", defaultValue: d10(envelope.periodEnd) })}
        {accessRolesField(envelope.accessRoles)}
        <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea name="notes" defaultValue={envelope.notes ?? ""} rows={2} /></div>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={envelope.isActive} className="h-4 w-4 rounded border-input" /> Enveloppe active</label>
        {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
        <div className="col-span-2 flex items-center justify-between">
          {canDelete ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm("Supprimer cette enveloppe et ses catégories ?")) { const fd = new FormData(); fd.set("id", envelope.id); deleteEnvelope(fd).then(onDeleted); } }}><Trash2 className="h-4 w-4" /> Supprimer</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button></div>
        </div>
      </form>
    </Sheet>
  );
}

function CategorySheet({ envelopeId, cat, onClose }: { envelopeId: string; cat?: BudgetCategoryView; onClose: () => void }) {
  const { busy, err, run } = useRun();
  return (
    <Sheet open onClose={onClose} title={cat ? "Modifier la catégorie" : "Nouvelle catégorie"} width="md">
      <form
        action={(fd) => {
          if (cat) { fd.set("id", cat.id); run(() => updateBudgetCategory(fd), onClose); }
          else { fd.set("envelopeId", envelopeId); run(() => createBudgetCategory(fd), onClose); }
        }}
        className="grid grid-cols-2 gap-3"
      >
        {field("name", "Nom de la catégorie", { defaultValue: cat?.name, placeholder: "Ex. Promotion médicale", required: true }, true)}
        {field("allocated", "Allocation (DZD)", { type: "number", step: "any", defaultValue: cat?.allocated ?? "" })}
        <div className="space-y-1.5"><Label>Couleur</Label><input type="color" name="color" defaultValue={cat?.color ?? "#0ea5e9"} className="h-9 w-full cursor-pointer rounded-lg border border-input" /></div>
        <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea name="notes" defaultValue={cat?.notes ?? ""} rows={2} /></div>
        {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
        <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button></div>
      </form>
    </Sheet>
  );
}

function Kpi({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "warning" | "success" | "danger" }) {
  const toneCls = { default: "", warning: "text-warning", success: "text-success", danger: "text-destructive" }[tone];
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", toneCls)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
