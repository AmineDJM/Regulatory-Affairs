"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, AlertCircle } from "lucide-react";
import { setDepartmentBudget } from "@/lib/actions/department-budget-actions";
import {
  DEPT_BUDGET_LABEL, DEPT_BUDGET_HINT, budgetHealth, consumedPercent,
  type DeptBudgetKind, type DeptBudgetRow,
} from "@/lib/department-budget";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

/**
 * Le tableau des budgets départementaux.
 *
 * Une case non modifiable n'est pas cachée : elle est **affichée en lecture**, avec un cadenas.
 * Masquer le budget des employés à l'administrateur (et réciproquement) l'empêcherait de voir
 * ce que coûte réellement un département — or c'est justement l'intérêt de mettre les deux
 * colonnes côte à côte. Ce qui est réservé, c'est l'ÉCRITURE, pas la lecture.
 *
 * La saisie s'enregistre à la sortie du champ (et à Entrée), sans bouton : un tableau de
 * budgets se remplit en tabulant d'une case à l'autre.
 */
export function DepartmentBudgetTable({
  rows, year, editable, totals,
}: {
  rows: DeptBudgetRow[];
  year: number;
  editable: DeptBudgetKind[];
  totals: { operating: number; hr: number; hrConsumed: number; members: number };
}) {
  const router = useRouter();
  const [err, setErr] = React.useState<string | null>(null);
  const canEdit = (k: DeptBudgetKind) => editable.includes(k);

  const years = [year - 1, year, year + 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Exercice</span>
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => router.push(`/budgets/departements?year=${y}`)}
            className={`rounded-lg px-3 py-1 text-sm transition ${y === year ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Qui règle quoi — dit à l'écran, pas seulement appliqué en silence. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {(["OPERATING", "HR"] as DeptBudgetKind[]).map((k) => (
          <p key={k} className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            {!canEdit(k) && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>
              <strong className="text-foreground">{DEPT_BUDGET_LABEL[k]}</strong> — {DEPT_BUDGET_HINT[k]}
              {!canEdit(k) && " Vous le consultez sans pouvoir le modifier."}
            </span>
          </p>
        ))}
      </div>

      {err && (
        <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {err}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Département</th>
              <th className="px-3 py-2 text-right font-medium">Effectif</th>
              <th className="px-3 py-2 text-right font-medium">{DEPT_BUDGET_LABEL.OPERATING}</th>
              <th className="px-3 py-2 text-right font-medium">{DEPT_BUDGET_LABEL.HR}</th>
              <th className="px-3 py-2 text-right font-medium">Masse salariale réelle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.departmentId} className="hover:bg-secondary/20">
                <td className="px-3 py-2">
                  <span className="font-medium">{r.path}</span>
                  {r.companyName && <span className="ml-2 text-xs text-muted-foreground">{r.companyName}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.members}</td>
                <td className="px-3 py-2 text-right">
                  <AmountCell
                    departmentId={r.departmentId} year={year} kind="OPERATING"
                    value={r.operating} readOnly={!canEdit("OPERATING")} onError={setErr}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <AmountCell
                    departmentId={r.departmentId} year={year} kind="HR"
                    value={r.hr} readOnly={!canEdit("HR")} onError={setErr}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <HrConsumption allocated={r.hr} consumed={r.hrConsumed} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border bg-secondary/30 font-medium">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.members}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.operating)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.hr)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.hrConsumed)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        La <strong>masse salariale réelle</strong> est calculée depuis la paie de l&apos;exercice — elle n&apos;est pas
        saisie. Le fonctionnement n&apos;a pas encore d&apos;équivalent : aucune dépense n&apos;est aujourd&apos;hui imputée
        à un département, et un chiffre inventé ressemblerait à une mesure sans en être une.
      </p>
    </div>
  );
}

function AmountCell({
  departmentId, year, kind, value, readOnly, onError,
}: {
  departmentId: string; year: number; kind: DeptBudgetKind;
  value: number; readOnly: boolean; onError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState(value ? String(value) : "");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const initial = React.useRef(value ? String(value) : "");

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
        <Lock className="h-3 w-3" /> {value ? formatCurrency(value) : "—"}
      </span>
    );
  }

  const save = () => {
    if (busy || text.trim() === initial.current.trim()) return;
    setBusy(true);
    onError(null);
    const fd = new FormData();
    fd.set("departmentId", departmentId);
    fd.set("kind", kind);
    fd.set("year", String(year));
    fd.set("amount", text);
    void (async () => {
      try {
        const r = await setDepartmentBudget(fd);
        if (!r.ok) {
          onError(r.error ?? "Enregistrement impossible.");
          setText(initial.current); // on ne laisse pas à l'écran un montant qui n'a pas été retenu
          return;
        }
        initial.current = text;
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        inputMode="decimal"
        placeholder="0"
        className="h-8 w-32 text-right tabular-nums"
        aria-label={`${DEPT_BUDGET_LABEL[kind]} ${year}`}
      />
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : saved ? <Check className="h-3.5 w-3.5 text-success" /> : <span className="w-3.5" />}
    </span>
  );
}

function HrConsumption({ allocated, consumed }: { allocated: number; consumed: number }) {
  const health = budgetHealth(allocated, consumed);
  if (health === "UNSET") {
    return <span className="tabular-nums text-muted-foreground">{consumed ? formatCurrency(consumed) : "—"}</span>;
  }
  const tone = health === "OVER_BUDGET" ? "danger" : health === "AT_RISK" ? "warning" : "success";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">{formatCurrency(consumed)}</span>
      <Badge tone={tone} dot={false}>{consumedPercent(allocated, consumed)} %</Badge>
    </span>
  );
}
