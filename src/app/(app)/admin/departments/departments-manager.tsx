"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Building2, CornerDownRight, Users } from "lucide-react";
import { createDepartment, updateDepartment, deleteDepartment } from "@/lib/actions/department-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label } from "@/components/ui/input";
import type { DepartmentNode } from "@/lib/queries/departments";

type Result = { ok: boolean; error?: string };

type SheetState =
  | { mode: "create-top" }
  | { mode: "create-sub"; parentId: string; parentName: string }
  | { mode: "edit"; id: string; name: string; code: string; parentId: string | null; parentName: string | null };

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
  return { busy, err, run };
}

export function DepartmentsManager({ departments }: { departments: DepartmentNode[] }) {
  const { run } = useRun();
  const [sheet, setSheet] = React.useState<SheetState | null>(null);

  const del = (id: string, name: string, sub: boolean) => {
    const msg = sub
      ? `Supprimer le sous-département « ${name} » ? Les employés rattachés repasseront « non affectés ».`
      : `Supprimer le département « ${name} » ? Ses sous-départements deviendront des départements de tête et les employés rattachés repasseront « non affectés ».`;
    if (window.confirm(msg)) { const fd = new FormData(); fd.set("id", id); run(() => deleteDepartment(fd)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setSheet({ mode: "create-top" })}><Plus className="h-4 w-4" /> Nouveau département</Button>
      </div>

      {departments.length === 0 ? (
        <p className="surface p-6 text-center text-sm text-muted-foreground">Aucun département. Créez le premier pour commencer à structurer l&apos;entreprise.</p>
      ) : (
        <div className="space-y-3">
          {departments.map((d) => (
            <div key={d.id} className="surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{d.name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{d.code}</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {d.members}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setSheet({ mode: "create-sub", parentId: d.id, parentName: d.name })}><Plus className="h-3.5 w-3.5" /> Sous-département</Button>
                  <button title="Modifier" onClick={() => setSheet({ mode: "edit", id: d.id, name: d.name, code: d.code, parentId: null, parentName: null })} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button title="Supprimer" onClick={() => del(d.id, d.name, false)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {d.children.length > 0 && (
                <div className="mt-3 space-y-1.5 border-l-2 border-border pl-4">
                  {d.children.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{c.name}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{c.code}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {c.members}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button title="Modifier" onClick={() => setSheet({ mode: "edit", id: c.id, name: c.name, code: c.code, parentId: d.id, parentName: d.name })} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button title="Supprimer" onClick={() => del(c.id, c.name, true)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sheet && <DeptSheet sheet={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function DeptSheet({ sheet, onClose }: { sheet: SheetState; onClose: () => void }) {
  const { busy, err, run } = useRun();
  const lock = React.useRef(false);
  const title = sheet.mode === "edit" ? "Modifier le département"
    : sheet.mode === "create-sub" ? `Nouveau sous-département de « ${sheet.parentName} »`
      : "Nouveau département";

  return (
    <Sheet open onClose={onClose} title={title} width="md">
      <form
        action={(fd) => {
          if (lock.current) return; lock.current = true;
          if (sheet.mode === "edit") { fd.set("id", sheet.id); run(() => updateDepartment(fd), onClose).finally(() => { lock.current = false; }); }
          else {
            if (sheet.mode === "create-sub") fd.set("parentId", sheet.parentId);
            run(() => createDepartment(fd), onClose).finally(() => { lock.current = false; });
          }
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label>Nom {sheet.mode === "create-sub" ? "du sous-département" : "du département"} <span className="text-destructive">*</span></Label>
          <Input name="name" required defaultValue={sheet.mode === "edit" ? sheet.name : ""} placeholder="Ex. Commercial, Support technique…" />
        </div>
        <div className="space-y-1.5">
          <Label>Code (optionnel — généré depuis le nom sinon)</Label>
          <Input name="code" defaultValue={sheet.mode === "edit" ? sheet.code : ""} placeholder="Ex. COMMERCIAL" />
        </div>
        {sheet.mode === "edit" && (
          // Conserve le rattachement actuel (ne pas détacher un sous-département lors d'un simple renommage).
          <input type="hidden" name="parentId" value={sheet.parentId ?? ""} />
        )}
        {sheet.mode === "edit" && sheet.parentName && (
          <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">Sous-département de « {sheet.parentName} ».</p>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Sheet>
  );
}
