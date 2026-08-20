"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Check, Undo2, Pencil, PiggyBank, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { markSalaryPaid, unmarkSalaryPaid, updatePayrollEntry, transferPayrollToBudget } from "@/lib/actions/payroll-hr-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCurrency, formatMonth } from "@/lib/utils";

export interface PayrollCell {
  state: "UNPAID" | "PAID" | "TRANSFERRED";
  /** Brut = base du transfert budgétaire. */
  amount: number | null;
  /** Net = ce que perçoit le salarié. */
  net: number | null;
  /** Coût employeur réellement enregistré — c'est lui qu'on rouvre pour corriger. */
  employerCost?: number | null;
  entryId: string | null;
}
export interface PayrollRow {
  employeeId: string;
  name: string;
  /** Pré-remplissage au marquage : salaire brut (→ budget) et net (→ salarié). */
  defaultGross: number | null;
  /** Coût employeur de référence — ce qui préremplit le champ obligatoire de la paie. */
  defaultEmployerCost: number | null;
  defaultNet: number | null;
  months: PayrollCell[]; // index 0 = janvier
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export function PayrollMatrix({ year, rows, budgetOptions }: { year: number; rows: PayrollRow[]; budgetOptions: { id: string; label: string }[] }) {
  const router = useRouter();
  const [paying, setPaying] = React.useState<{ row: PayrollRow; month: number } | null>(null);
  // CORRIGER une ligne déjà payée : le même formulaire, prérempli avec ce qui a été enregistré.
  const [editing, setEditing] = React.useState<{ row: PayrollRow; month: number; cell: PayrollCell } | null>(null);
  const [transfer, setTransfer] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Assistant de transfert : étape 1 = mois + catégorie (modifiables), étape 2 = résumé.
  const [step, setStep] = React.useState<1 | 2>(1);
  const [tMonth, setTMonth] = React.useState<number>(new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12);
  const [tCategory, setTCategory] = React.useState<string>(budgetOptions[0]?.id ?? "");

  const transferable = React.useMemo(
    () => rows
      .map((r) => ({ name: r.name, cell: r.months[tMonth - 1] }))
      .filter((x) => x.cell.state === "PAID"),
    [rows, tMonth],
  );
  const transferTotal = transferable.reduce((a, x) => a + (x.cell.amount ?? 0), 0);
  const categoryLabel = budgetOptions.find((b) => b.id === tCategory)?.label ?? "—";

  async function undo(entryId: string, name: string, month: number) {
    if (!window.confirm(`Annuler le paiement de ${name} pour ${formatMonth(ym(year, month))} ? (possible tant que non transféré)`)) return;
    const fd = new FormData(); fd.set("id", entryId);
    const r = await unmarkSalaryPaid(fd);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Link href={`/rh/paie?year=${year - 1}`} className="rounded-md border border-border p-1.5 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-16 text-center text-sm font-semibold">{year}</span>
          <Link href={`/rh/paie?year=${year + 1}`} className="rounded-md border border-border p-1.5 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        <Button size="sm" onClick={() => { setStep(1); setErr(null); setTransfer(true); }}>
          <PiggyBank className="h-4 w-4" /> Transférer dans le budget
        </Button>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left">Employé</th>
              {MONTHS.map((m) => <th key={m} className="px-2 py-2 text-center">{m}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium">{r.name}</td>
                {r.months.map((cell, i) => (
                  <td key={i} className="px-1 py-1.5 text-center">
                    {cell.state === "UNPAID" ? (
                      <button
                        onClick={() => { setErr(null); setPaying({ row: r, month: i + 1 }); }}
                        className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                        title={`Marquer payé — ${MONTHS[i]} ${year}`}
                      >
                        —
                      </button>
                    ) : (
                      <div className="group relative inline-flex flex-col items-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cell.state === "TRANSFERRED" ? "bg-primary/10 text-primary" : "bg-success/15 text-success"}`}
                          title={`${cell.amount != null ? `Brut ${formatCurrency(cell.amount)} (→ budget)` : ""}${cell.net != null ? ` · Net ${formatCurrency(cell.net)} (salarié)` : ""}${cell.state === "TRANSFERRED" ? " · transféré au budget" : " · payé (annulable avant transfert)"}`}
                        >
                          <Check className="h-3 w-3" /> Payé
                        </span>
                        {cell.entryId && (
                          <span className="mt-0.5 hidden items-center gap-1.5 group-hover:inline-flex">
                            {/* Une paie fausse ne se rattrape pas au mois suivant : elle se
                                corrige, même transférée — l'écriture budgétaire suit. */}
                            <button
                              onClick={() => { setErr(null); setEditing({ row: r, month: i + 1, cell }); }}
                              className="inline-flex items-center gap-0.5 text-[0.625rem] text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="h-3 w-3" /> modifier
                            </button>
                            {cell.state === "PAID" && (
                              <button
                                onClick={() => undo(cell.entryId!, r.name, i + 1)}
                                className="inline-flex items-center gap-0.5 text-[0.625rem] text-muted-foreground hover:text-destructive"
                              >
                                <Undo2 className="h-3 w-3" /> annuler
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Vert = payé (annulable tant que non transféré) · Bleu = transféré dans le budget.
        Une ligne se <strong>corrige</strong> dans les deux cas — après transfert, l&apos;écriture
        budgétaire est corrigée avec elle. L&apos;employé reçoit sa notification 24 h après le marquage.
      </p>

      {/* Marquer payé : montant total + fiche de paie */}
      <Sheet
        open={paying !== null}
        onClose={() => !busy && setPaying(null)}
        title={paying ? `Payer — ${paying.row.name}` : ""}
        description={paying ? `${formatMonth(ym(year, paying.month))} · la fiche de paie (facultative), si jointe, sera déposée dans son dossier RH ; il sera notifié dans 24 h.` : undefined}
        width="md"
      >
        {paying && (
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("employeeId", paying.row.employeeId);
              fd.set("year", String(year));
              fd.set("month", String(paying.month));
              const r = await markSalaryPaid(fd);
              setBusy(false);
              if (r.ok) { setPaying(null); router.refresh(); } else setErr(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {/* LE COÛT EMPLOYEUR REMPLACE LE BRUT comme montant obligatoire : c'est ce que la
                  société décaisse réellement, et donc ce qui pèse sur le budget et fait la masse
                  salariale. Le brut, lui, n'est qu'une ligne du bulletin — l'imputer sous-évaluait
                  la masse du montant exact des charges patronales. */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-cost">Coût employeur (DZD) <span className="text-destructive">*</span></Label>
                <Input id="pay-cost" name="employerCost" type="number" step="any" min="1" required defaultValue={paying.row.defaultEmployerCost ?? undefined} />
                <p className="text-xs text-muted-foreground">Brut + <span className="font-medium text-foreground">charges patronales</span> : le total imputé au budget, et la brique de la masse salariale. Pré-rempli depuis la fiche employé — modifiable.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-net">Salaire net (DZD) <span className="text-destructive">*</span></Label>
                <Input id="pay-net" name="net" type="number" step="any" min="1" required defaultValue={paying.row.defaultNet ?? undefined} />
                <p className="text-xs text-muted-foreground">Montant <span className="font-medium text-foreground">affiché au salarié</span>. Ne peut pas dépasser le coût employeur.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pay-gross">Salaire brut (DZD) <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
                <Input id="pay-gross" name="gross" type="number" step="any" min="0" defaultValue={paying.row.defaultGross ?? undefined} />
                <p className="text-xs text-muted-foreground">Information de bulletin. Laissé vide, il est repris du coût employeur — il n'entre pas dans le calcul du budget.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-file">Fiche de paie <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
              <input id="pay-file" name="payslip" type="file" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
              <p className="text-xs text-muted-foreground">Optionnel — vous pouvez marquer payé sans joindre la fiche.</p>
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPaying(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Marquer payé</Button>
            </div>
          </form>
        )}
      </Sheet>

      {/* CORRIGER une ligne déjà payée — le même formulaire, prérempli. Refuser la correction
          après transfert, c'est garantir qu'on vit avec un chiffre faux : personne ne défera un
          transfert de paie pour mille dinars. On corrige donc, et le budget suit. */}
      <Sheet
        open={editing !== null}
        onClose={() => !busy && setEditing(null)}
        title={editing ? `Corriger la paie — ${editing.row.name}` : ""}
        description={editing
          ? `${formatMonth(ym(year, editing.month))}${editing.cell.state === "TRANSFERRED" ? " · déjà transférée : l'écriture budgétaire sera corrigée avec la ligne." : ""}`
          : undefined}
        width="md"
      >
        {editing && (
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("id", editing.cell.entryId ?? "");
              const r = await updatePayrollEntry(fd);
              setBusy(false);
              if (r.ok) { setEditing(null); router.refresh(); } else setErr(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cost">Coût employeur (DZD) <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-cost" name="employerCost" type="number" step="any" min="1" required
                  defaultValue={editing.cell.employerCost ?? editing.cell.amount ?? undefined}
                />
                <p className="text-xs text-muted-foreground">Le total imputé au budget. Le corriger corrige la masse salariale.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-net">Salaire net (DZD) <span className="text-destructive">*</span></Label>
                <Input id="edit-net" name="net" type="number" step="any" min="1" required defaultValue={editing.cell.net ?? undefined} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-gross">Salaire brut (DZD) <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
                <Input id="edit-gross" name="gross" type="number" step="any" min="0" defaultValue={editing.cell.amount ?? undefined} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-file">Remplacer la fiche de paie <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
              <input id="edit-file" name="payslip" type="file" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
              <p className="text-xs text-muted-foreground">
                La nouvelle prend la place de l&apos;ancienne dans le dossier du salarié — deux bulletins
                pour le même mois lui laisseraient deviner lequel fait foi.
              </p>
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer la correction</Button>
            </div>
          </form>
        )}
      </Sheet>

      {/* Transfert budget : étape 1 (mois + catégorie) → étape 2 (résumé) → confirmation */}
      <Sheet open={transfer} onClose={() => !busy && setTransfer(false)} title="Transférer la paie dans le budget" width="md">
        <div className="space-y-4">
          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-month">Mois</Label>
                  <Select id="t-month" value={String(tMonth)} onChange={(e) => setTMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m} {year}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-cat">Catégorie budgétaire exacte</Label>
                  <Select id="t-cat" value={tCategory} onChange={(e) => setTCategory(e.target.value)}>
                    {budgetOptions.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {transferable.length} salaire·s payé·s non transféré·s pour {formatMonth(ym(year, tMonth))} — total <span className="font-medium text-foreground">brut</span> {formatCurrency(transferTotal)} (montant imputé au budget).
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTransfer(false)}>Annuler</Button>
                <Button type="button" disabled={transferable.length === 0 || !tCategory} onClick={() => setStep(2)}>Voir le résumé</Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <p className="mb-2 font-medium">Résumé du transfert — {formatMonth(ym(year, tMonth))}</p>
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {transferable.map((x) => (
                    <li key={x.name} className="flex items-center justify-between gap-2">
                      <span>{x.name}</span>
                      <span className="font-medium">{x.cell.amount != null ? formatCurrency(x.cell.amount) : "—"}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                  <span className="font-medium">Total brut ({transferable.length} salaire·s)</span>
                  <span className="text-base font-semibold">{formatCurrency(transferTotal)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Catégorie budgétaire : <span className="font-medium text-foreground">{categoryLabel}</span></p>
              </div>
              <p className="text-xs text-muted-foreground">Une écriture de trésorerie « Salaire » (sortie) est créée par employé sur le montant <span className="font-medium text-foreground">brut</span> (coût réel), imputée à cette catégorie. Le net reste ce que perçoit le salarié. Les lignes transférées sont ensuite verrouillées.</p>
              {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
              <div className="flex justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={busy}><ArrowLeft className="h-4 w-4" /> Retour / modifier</Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true); setErr(null);
                    const fd = new FormData();
                    fd.set("year", String(year)); fd.set("month", String(tMonth)); fd.set("budgetCategoryId", tCategory);
                    const r = await transferPayrollToBudget(fd);
                    setBusy(false);
                    if (r.ok) { setTransfer(false); setStep(1); router.refresh(); } else setErr(r.error ?? "Échec.");
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PiggyBank className="h-4 w-4" />} Confirmer le transfert
                </Button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
