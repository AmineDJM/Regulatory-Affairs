"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, SlidersHorizontal, Wallet, CornerDownRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createEnvelope, updateEnvelope, deleteEnvelope, setBudgetTotal,
  createBudgetCategory, updateBudgetCategory, deleteBudgetCategory, attributeTransaction, addBudgetExpense,
} from "@/lib/actions/budget-envelope-actions";
import type { BudgetOverview, BudgetEnvelopeOption, BudgetCategoryView, BudgetHealth, EnvelopesGrandTotal } from "@/lib/queries/budget";
import { ROLE_LABELS } from "@/lib/labels";

interface BudgetTotalInfo { mode: "FIXED" | "FLEXIBLE"; value: number; fixed: number }
type UserOpt = { id: string; name: string };
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

/** Cases à cocher : une enveloppe peut couvrir un OU plusieurs modules. */
function modulesField(defaultModules: string[] = []) {
  return (
    <div className="col-span-2 space-y-1.5">
      <Label>Modules rattachés</Label>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-input p-2.5">
        {MODULE_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="modules" value={o.value} defaultChecked={defaultModules.includes(o.value)} className="h-4 w-4 rounded border-input" />
            {o.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Cochez un ou plusieurs modules. Laisser vide = enveloppe transverse.</p>
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

/** Autorisation par PERSONNE (en plus des rôles) — accordée par le Super Admin. */
function accessUsersField(users: UserOpt[], defaultIds: string[] = []) {
  if (users.length === 0) return null;
  return (
    <div className="col-span-2 space-y-1.5">
      <Label>Autoriser des personnes précises</Label>
      <div className="grid max-h-40 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-lg border border-input p-2.5">
        {users.map((u) => (
          <label key={u.id} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="accessUserIds" value={u.id} defaultChecked={defaultIds.includes(u.id)} className="h-4 w-4 rounded border-input" />
            {u.name}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Ces personnes pourront consulter cette enveloppe (en plus des rôles cochés).</p>
    </div>
  );
}

/**
 * Vue consolidée « total des enveloppes » : visible du Super Admin et des personnes/
 * rôles qu'il a autorisés (la requête n'agrège que les enveloppes accessibles).
 */
export function EnvelopesGrandTotalPanel({ data }: { data: EnvelopesGrandTotal }) {
  const pct = data.total > 0 ? Math.round((data.consumed / data.total) * 100) : 0;
  return (
    <section className="surface space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Total des enveloppes</h2>
        <Badge tone="neutral" dot={false}>{data.count} enveloppe{data.count > 1 ? "s" : ""}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Budget cumulé" value={formatCurrency(data.total)} />
        <Kpi label="Alloué (catégories)" value={formatCurrency(data.allocated)} hint={data.total - data.allocated !== 0 ? `${formatCurrency(data.total - data.allocated)} non alloué` : "100 % réparti"} />
        <Kpi label="Consommé" value={formatCurrency(data.consumed)} hint={`${pct}% du cumulé`} tone="warning" />
        <Kpi label="Reste" value={formatCurrency(data.remaining)} tone={data.remaining < 0 ? "danger" : "success"} />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground">
            <tr><th className="px-3 py-1.5 text-left font-medium">Enveloppe</th><th className="px-3 py-1.5 text-right font-medium">Budget</th><th className="px-3 py-1.5 text-right font-medium">Consommé</th><th className="px-3 py-1.5 text-right font-medium">Reste</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.items.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-1.5">{e.name}{!e.isActive && <span className="ml-1 text-xs text-muted-foreground">(archivée)</span>}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(e.total)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-warning">{formatCurrency(e.consumed)}</td>
                <td className={cn("px-3 py-1.5 text-right tabular-nums", e.remaining < 0 ? "text-destructive" : "text-success")}>{formatCurrency(e.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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

export function CreateEnvelopeButton({ users = [] }: { users?: UserOpt[] }) {
  const [open, setOpen] = React.useState(false);
  const { busy, err, run } = useRun();
  const year = new Date().getFullYear();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle enveloppe</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvelle enveloppe budgétaire" description="Un budget total pour une période, à répartir ensuite en catégories." width="md">
        <form action={(fd) => run(() => createEnvelope(fd), () => setOpen(false))} className="grid grid-cols-2 gap-3">
          {field("name", "Nom de l'enveloppe", { placeholder: `Budget ${year}`, required: true }, true)}
          {modulesField()}
          {field("totalAmount", "Montant de l'enveloppe (DZD)", { type: "number", step: "any", placeholder: "0" }, true)}
          {field("periodStart", "Début de période", { type: "date", defaultValue: `${year}-01-01` })}
          {field("periodEnd", "Fin de période", { type: "date", defaultValue: `${year}-12-31` })}
          {accessRolesField()}
          {accessUsersField(users)}
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea name="notes" rows={2} /></div>
          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Créer</Button></div>
        </form>
      </Sheet>
    </>
  );
}

export function BudgetBoard({ overview, envelopes, canManage, canAttribute = canManage, budgetTotal, users = [] }: { overview: BudgetOverview; envelopes: BudgetEnvelopeOption[]; canManage: boolean; canAttribute?: boolean; budgetTotal: BudgetTotalInfo; users?: UserOpt[] }) {
  const router = useRouter();
  const t = overview.totals;
  // Modules couverts par l'enveloppe (rétrocompat : ancien champ `module` unique).
  const envModules = overview.envelope.modules.length ? overview.envelope.modules : overview.envelope.module ? [overview.envelope.module] : [];
  const [editEnv, setEditEnv] = React.useState(false);
  const [totalSheet, setTotalSheet] = React.useState(false);
  const [catSheet, setCatSheet] = React.useState<{ cat?: BudgetCategoryView; parentId?: string } | null>(null);
  const { run } = useRun();

  // Catégories de 1er niveau + leurs sous-catégories (regroupées par parent).
  const topCats = overview.categories.filter((c) => c.parentId === null);
  const subsByParent = new Map<string, BudgetCategoryView[]>();
  for (const c of overview.categories) {
    if (c.parentId) subsByParent.set(c.parentId, [...(subsByParent.get(c.parentId) ?? []), c]);
  }
  const topCatOptions = topCats.map((c) => ({ id: c.id, name: c.name }));
  const editCat = (cat: BudgetCategoryView) => setCatSheet({ cat });
  const deleteCat = (cat: BudgetCategoryView) => {
    if (window.confirm(`Supprimer « ${cat.name} » ?${cat.parentId === null ? " Ses sous-catégories seront aussi supprimées." : ""} Les dépenses repasseront en « non attribué ».`)) {
      const fd = new FormData(); fd.set("id", cat.id); run(() => deleteBudgetCategory(fd));
    }
  };

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ env: overview.envelope.id, ...params });
    router.push(`/budgets?${sp.toString()}`);
  };

  return (
    <div className="space-y-5">
      {/* Contrôles : enveloppe + période */}
      <div className="surface flex flex-wrap items-end gap-3 p-3">
        <div className="space-y-1.5">
          <Label className="flex flex-wrap items-center gap-1">
            Enveloppe
            {envModules.map((m) => <Badge key={m} tone="info" dot={false}>{moduleLabel(m) ?? m}</Badge>)}
          </Label>
          <Select value={overview.envelope.id} onChange={(e) => router.push(`/budgets?env=${e.target.value}`)} className="w-56">
            {envelopes.map((en) => <option key={en.id} value={en.id}>{en.name}{en.isActive ? "" : " (archivée)"}</option>)}
          </Select>
        </div>
        {/* Budget total au-dessus des enveloppes : figé ou somme des enveloppes.
            Réglé ici par le Super Admin (ou un délégué) via « Régler ». */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Budget total (toutes enveloppes)
            <Badge tone={budgetTotal.mode === "FIXED" ? "purple" : "neutral"} dot={false}>{budgetTotal.mode === "FIXED" ? "Fixe" : "Flexible"}</Badge>
          </Label>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(budgetTotal.value)}</p>
            {canManage && <Button type="button" variant="outline" size="sm" onClick={() => setTotalSheet(true)}><SlidersHorizontal className="h-3.5 w-3.5" /> Régler</Button>}
          </div>
        </div>
        <PeriodPicker from={d10(overview.period.from)} to={d10(overview.period.to)} onApply={(from, to) => navigate({ from, to })} />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Période : {formatDate(overview.period.from)} → {formatDate(overview.period.to)}</span>
          <a
            href={`/api/budgets/export?env=${overview.envelope.id}&from=${d10(overview.period.from)}&to=${d10(overview.period.to)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
            title="Exporter le budget en Excel (avec taux de consommation)"
          >
            <Download className="h-4 w-4" /> Excel
          </a>
          {canManage && <Button variant="outline" size="sm" onClick={() => setEditEnv(true)}><Pencil className="h-4 w-4" /> Enveloppe</Button>}
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
        {/* Ajout RAPIDE d'une ligne de dépense (référence + montant) qui consomme un budget. */}
        {canAttribute && overview.categories.length > 0 && <AddExpenseRow categories={overview.categories} />}
        {topCats.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">Aucune catégorie. {canManage && "Répartissez le budget total en créant des catégories (ex. Promotion, Congrès, Logistique…), avec si besoin des sous-catégories (ex. Table ronde)."}</p>
        ) : (
          <div className="space-y-2">
            {topCats.map((c) => (
              <CategoryCard
                key={c.id}
                c={c}
                subs={subsByParent.get(c.id) ?? []}
                canManage={canManage}
                onEdit={editCat}
                onDelete={deleteCat}
                onAddSub={() => setCatSheet({ parentId: c.id })}
              />
            ))}
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
                {canAttribute ? (
                  <Select
                    defaultValue=""
                    onChange={(e) => { const fd = new FormData(); fd.set("transactionId", tx.id); if (e.target.value) fd.set("budgetCategoryId", e.target.value); run(() => attributeTransaction(fd)); }}
                    className="h-8 w-44 text-xs"
                  >
                    <option value="">Attribuer à…</option>
                    {overview.categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `↳ ${c.name}` : c.name}</option>)}
                  </Select>
                ) : <Badge tone="neutral" dot={false}>Non attribué</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dépenses attribuées — la Direction peut RÉ-ATTRIBUER la (sous-)catégorie à tout moment */}
      {canAttribute && overview.attributed.transactions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dépenses attribuées ({overview.attributed.count}) <span className="font-normal normal-case text-[11px] text-muted-foreground">— modifiez la catégorie à tout moment</span>
          </h2>
          <div className="surface divide-y divide-border">
            {overview.attributed.transactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.label}</p>
                  <p className="text-xs text-muted-foreground">{tx.reference} · {formatDate(tx.date)}{tx.counterparty ? ` · ${tx.counterparty}` : ""}</p>
                </div>
                <span className="font-semibold text-destructive">{formatCurrency(tx.amount)}</span>
                <Select
                  defaultValue={tx.categoryId}
                  onChange={(e) => { const fd = new FormData(); fd.set("transactionId", tx.id); if (e.target.value) fd.set("budgetCategoryId", e.target.value); run(() => attributeTransaction(fd)); }}
                  className="h-8 w-48 text-xs"
                >
                  <option value="">— Retirer l'attribution —</option>
                  {overview.categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `↳ ${c.name}` : c.name}</option>)}
                </Select>
              </div>
            ))}
          </div>
        </section>
      )}

      {editEnv && <EnvelopeSheet envelope={overview.envelope} users={users} onClose={() => setEditEnv(false)} onDeleted={() => router.push("/budgets")} canDelete={canManage} />}
      {catSheet && <CategorySheet envelopeId={overview.envelope.id} cat={catSheet.cat} defaultParentId={catSheet.parentId} parentOptions={topCatOptions} onClose={() => setCatSheet(null)} />}
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

/**
 * Ajout RAPIDE d'une ligne de dépense qui CONSOMME un budget : (sous-)catégorie + référence
 * + montant → « + ». Crée une dépense réelle réglée imputée à la catégorie (consommation immédiate).
 */
function AddExpenseRow({ categories }: { categories: BudgetCategoryView[] }) {
  const { busy, err, run } = useRun();
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={(fd) => run(() => addBudgetExpense(fd), () => formRef.current?.reset())}
      className="surface flex flex-wrap items-end gap-2 p-3"
    >
      <div className="space-y-1">
        <Label className="text-xs">Budget consommé</Label>
        <Select name="budgetCategoryId" required defaultValue="" className="h-9 w-56">
          <option value="" disabled>Choisir une (sous-)catégorie…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `↳ ${c.name}` : c.name}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Référence</Label>
        <Input name="reference" required placeholder="Ex. Facture 2026-042" className="h-9 w-48" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Montant (DZD)</Label>
        <Input name="amount" type="number" step="any" min="0" required placeholder="0" className="h-9 w-32" />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter la dépense
      </Button>
      {err && <p className="w-full text-xs text-destructive">{err}</p>}
    </form>
  );
}

function CategoryCard({ c, subs, canManage, onEdit, onDelete, onAddSub }: { c: BudgetCategoryView; subs: BudgetCategoryView[]; canManage: boolean; onEdit: (cat: BudgetCategoryView) => void; onDelete: (cat: BudgetCategoryView) => void; onAddSub: () => void }) {
  const h = HEALTH[c.health];
  const pct = Math.min(c.pct, 100);
  const subAllocated = subs.reduce((a, s) => a + s.allocated, 0);
  return (
    <div className="surface p-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#64748b" }} />
        <span className="font-semibold">{c.name}</span>
        {c.module && <Badge tone="info" dot={false}>{moduleLabel(c.module) ?? c.module}</Badge>}
        <Badge tone={h.tone} dot={false}>{h.label}</Badge>
        <span className="ml-auto text-sm text-muted-foreground">{formatCurrency(c.consumed)} / {formatCurrency(c.allocated)}</span>
        {canManage && (
          <div className="flex items-center gap-0.5">
            <button title="Ajouter une sous-catégorie" onClick={onAddSub} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Plus className="h-4 w-4" /></button>
            <button title="Modifier" onClick={() => onEdit(c)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
            <button title="Supprimer" onClick={() => onDelete(c)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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
        {subs.length > 0 && <span>{subs.length} sous-catégorie{subs.length > 1 ? "s" : ""} · {formatCurrency(subAllocated)} réparti</span>}
      </div>

      {/* Sous-catégories (ex. Table ronde sous Événement) */}
      {subs.length > 0 && (
        <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#94a3b8" }} />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatCurrency(s.consumed)} / {formatCurrency(s.allocated)}</span>
              {canManage && (
                <div className="flex items-center gap-0.5">
                  <button title="Modifier" onClick={() => onEdit(s)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button title="Supprimer" onClick={() => onDelete(s)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnvelopeSheet({ envelope, users, onClose, onDeleted, canDelete }: { envelope: BudgetOverview["envelope"]; users: UserOpt[]; onClose: () => void; onDeleted: () => void; canDelete: boolean }) {
  const { busy, err, run } = useRun();
  return (
    <Sheet open onClose={onClose} title="Modifier l'enveloppe" width="md">
      <form action={(fd) => { fd.set("id", envelope.id); run(() => updateEnvelope(fd), onClose); }} className="grid grid-cols-2 gap-3">
        {field("name", "Nom", { defaultValue: envelope.name, required: true }, true)}
        {modulesField(envelope.modules.length ? envelope.modules : envelope.module ? [envelope.module] : [])}
        {field("totalAmount", "Budget total (DZD)", { type: "number", step: "any", defaultValue: envelope.total }, true)}
        {field("periodStart", "Début", { type: "date", defaultValue: d10(envelope.periodStart) })}
        {field("periodEnd", "Fin", { type: "date", defaultValue: d10(envelope.periodEnd) })}
        {accessRolesField(envelope.accessRoles)}
        {accessUsersField(users, envelope.accessUserIds)}
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

function CategorySheet({ envelopeId, cat, defaultParentId, parentOptions, onClose }: { envelopeId: string; cat?: BudgetCategoryView; defaultParentId?: string; parentOptions: { id: string; name: string }[]; onClose: () => void }) {
  const { busy, err, run } = useRun();
  const [parent, setParent] = React.useState(cat?.parentId ?? defaultParentId ?? "");
  // On ne propose pas la catégorie elle-même comme parente (édition) → pas de cycle.
  const opts = parentOptions.filter((o) => o.id !== cat?.id);
  return (
    <Sheet open onClose={onClose} title={cat ? "Modifier la catégorie" : parent ? "Nouvelle sous-catégorie" : "Nouvelle catégorie"} width="md">
      <form
        action={(fd) => {
          if (cat) { fd.set("id", cat.id); run(() => updateBudgetCategory(fd), onClose); }
          else { fd.set("envelopeId", envelopeId); run(() => createBudgetCategory(fd), onClose); }
        }}
        className="grid grid-cols-2 gap-3"
      >
        {field("name", "Nom de la catégorie", { defaultValue: cat?.name, placeholder: parent ? "Ex. Table ronde" : "Ex. Sponsoring", required: true }, true)}
        {opts.length > 0 && (
          <div className="col-span-2 space-y-1.5">
            <Label>Catégorie parente</Label>
            <Select name="parentId" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— Catégorie de tête —</option>
              {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
            <p className="text-xs text-muted-foreground">Rattachez-la à une catégorie pour en faire une sous-catégorie (ex. « Table ronde » sous « Événement »).</p>
          </div>
        )}
        {/* Le module ne s'applique qu'aux catégories de tête (attribution automatique). */}
        {!parent && (
          <div className="col-span-2 space-y-1.5">
            <Label>Module associé</Label>
            <Select name="module" defaultValue={cat?.module ?? ""}>
              <option value="">— Aucun —</option>
              {MODULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <p className="text-xs text-muted-foreground">Les dépenses d'une demande de ce module, une fois validées et réglées par les Finances, sont attribuées automatiquement à cette catégorie.</p>
          </div>
        )}
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
