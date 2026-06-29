"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Pencil, Trash2, Loader2, Map } from "lucide-react";
import { createDelegatePlan, updateDelegatePlan, deleteDelegatePlan, duplicateDelegatePlan } from "@/lib/actions/delegate-plan-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface PlanItem {
  id: string;
  delegateId: string | null;
  delegateName: string | null;
  weekStart: string; // ISO date
  region: string | null;
  productTarget: string | null;
  visitsTarget: number;
  keyDoctorsTarget: number;
  achievedVisits: number;
  managerComment: string | null;
}
interface Opt { value: string; label: string }

const d10 = (iso: string) => iso.slice(0, 10);
const fmtPeriod = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const nextMonthISO = (iso: string) => { const d = new Date(iso); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };

export function DelegatePlans({
  plans, delegates, canCreate, canEdit, canDelete, isManager,
}: { plans: PlanItem[]; delegates: Opt[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; isManager: boolean }) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState<null | { mode: "create" } | { mode: "edit"; plan: PlanItem } | { mode: "dup"; plan: PlanItem }>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce plan de tournée ?")) return;
    const fd = new FormData(); fd.set("id", id);
    await deleteDelegatePlan(fd);
    router.refresh();
  }

  const title = sheet?.mode === "create" ? "Nouveau plan de tournée" : sheet?.mode === "dup" ? "Dupliquer le plan" : "Modifier le plan";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Map className="h-4 w-4" /> Plans de tournée</h2>
        {canCreate && <Button size="sm" onClick={() => { setError(null); setSheet({ mode: "create" }); }}><Plus className="h-4 w-4" /> Nouveau plan</Button>}
      </div>

      {plans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Aucun plan de tournée. Créez-en un, puis dupliquez-le d'un mois sur l'autre.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="surface space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{fmtPeriod(p.weekStart)}</p>
                  <p className="text-xs text-muted-foreground">{[p.region, isManager ? p.delegateName : null].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <Badge tone={p.achievedVisits >= p.visitsTarget && p.visitsTarget > 0 ? "success" : "neutral"} dot={false}>{p.achievedVisits}/{p.visitsTarget} visites</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {p.productTarget && <span className="rounded bg-secondary px-1.5 py-0.5">{p.productTarget}</span>}
                <span className="rounded bg-secondary px-1.5 py-0.5">{p.keyDoctorsTarget} médecins clés</span>
              </div>
              {p.managerComment && <p className="rounded-lg bg-warning/10 px-2 py-1 text-xs text-warning">Manager : {p.managerComment}</p>}
              <div className="flex justify-end gap-1 pt-0.5">
                {canCreate && <button onClick={() => { setError(null); setSheet({ mode: "dup", plan: p }); }} title="Dupliquer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"><Copy className="h-4 w-4" /></button>}
                {canEdit && <button onClick={() => { setError(null); setSheet({ mode: "edit", plan: p }); }} title="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>}
                {canDelete && <button onClick={() => remove(p.id)} title="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheet !== null} onClose={() => !busy && setSheet(null)} title={title} description={sheet?.mode === "dup" ? "Choisissez la nouvelle période (le mois suivant par défaut)." : undefined}>
        {sheet && (
          <form
            action={async (fd) => {
              setBusy(true); setError(null);
              let r;
              if (sheet.mode === "create") r = await createDelegatePlan(fd);
              else if (sheet.mode === "dup") { fd.set("id", sheet.plan.id); r = await duplicateDelegatePlan(fd); }
              else { fd.set("id", sheet.plan.id); r = await updateDelegatePlan(fd); }
              setBusy(false);
              if (r.ok) { setSheet(null); router.refresh(); } else setError(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            {sheet.mode === "dup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="weekStart">Nouvelle période (début)</Label>
                <Input id="weekStart" name="weekStart" type="date" defaultValue={nextMonthISO(sheet.plan.weekStart)} required />
                <p className="text-xs text-muted-foreground">Reprend région, cibles et produit du plan « {fmtPeriod(sheet.plan.weekStart)} » ; l'avancement repart à zéro.</p>
              </div>
            ) : (
              <>
                {isManager && (
                  <div className="space-y-1.5">
                    <Label htmlFor="delegateId">Délégué</Label>
                    <Select id="delegateId" name="delegateId" defaultValue={sheet.mode === "edit" ? (sheet.plan.delegateId ?? "") : ""}>
                      <option value="">— Moi —</option>
                      {delegates.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="weekStart">Début de période</Label>
                    <Input id="weekStart" name="weekStart" type="date" defaultValue={sheet.mode === "edit" ? d10(sheet.plan.weekStart) : ""} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="region">Région / secteur</Label>
                    <Input id="region" name="region" defaultValue={sheet.mode === "edit" ? (sheet.plan.region ?? "") : ""} placeholder="Ex. Alger Centre" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="visitsTarget">Objectif visites</Label>
                    <Input id="visitsTarget" name="visitsTarget" type="number" min="0" defaultValue={sheet.mode === "edit" ? sheet.plan.visitsTarget : 0} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="keyDoctorsTarget">Médecins clés</Label>
                    <Input id="keyDoctorsTarget" name="keyDoctorsTarget" type="number" min="0" defaultValue={sheet.mode === "edit" ? sheet.plan.keyDoctorsTarget : 0} />
                  </div>
                  {sheet.mode === "edit" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="achievedVisits">Visites réalisées</Label>
                      <Input id="achievedVisits" name="achievedVisits" type="number" min="0" defaultValue={sheet.plan.achievedVisits} />
                    </div>
                  )}
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="productTarget">Produits à pousser</Label>
                    <Input id="productTarget" name="productTarget" defaultValue={sheet.mode === "edit" ? (sheet.plan.productTarget ?? "") : ""} placeholder="Ex. Adventor, Cardiomax" />
                  </div>
                </div>
                {isManager && (
                  <div className="space-y-1.5">
                    <Label htmlFor="managerComment">Commentaire manager</Label>
                    <Textarea id="managerComment" name="managerComment" defaultValue={sheet.mode === "edit" ? (sheet.plan.managerComment ?? "") : ""} placeholder="Consignes pour le délégué…" />
                  </div>
                )}
              </>
            )}

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setSheet(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : sheet.mode === "dup" ? <Copy className="h-4 w-4" /> : null}
                {sheet.mode === "dup" ? "Dupliquer" : sheet.mode === "create" ? "Créer le plan" : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </section>
  );
}
