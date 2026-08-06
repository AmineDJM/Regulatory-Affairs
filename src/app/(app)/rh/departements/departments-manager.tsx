"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Users, ShieldCheck, UserPlus, ChevronRight } from "lucide-react";
import { createDepartment, updateDepartment, deleteDepartment, assignEmployeeDepartment } from "@/lib/actions/department-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DepartmentNode, DepartmentOption } from "@/lib/departments";

type Result = { ok: boolean; error?: string };
type EmpOpt = { id: string; fullName: string; position: string | null };

type SheetState =
  | { mode: "create"; parentId: string | null; parentName: string | null }
  | { mode: "edit"; node: DepartmentNode };

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

type CompanyOpt = { id: string; label: string };

export function DepartmentsManager({
  tree, options, employees, unassigned, canManage, companies, companyScope,
}: {
  tree: DepartmentNode[];
  options: DepartmentOption[];
  employees: EmpOpt[];
  unassigned: EmpOpt[];
  canManage: boolean;
  companies: CompanyOpt[];
  companyScope: string | null;
}) {
  const { run } = useRun();
  const [sheet, setSheet] = React.useState<SheetState | null>(null);

  const del = (node: DepartmentNode) => {
    const msg = node.children.length > 0
      ? `Supprimer « ${node.name} » ? Ses ${node.children.length} sous-département(s) remonteront d'un niveau et ses ${node.members} membre(s) directs repasseront « non affectés ».`
      : `Supprimer « ${node.name} » ? Ses ${node.members} membre(s) repasseront « non affectés ».`;
    if (window.confirm(msg)) { const fd = new FormData(); fd.set("id", node.id); run(() => deleteDepartment(fd)); }
  };

  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setSheet({ mode: "create", parentId: null, parentName: null })}>
            <Plus className="h-4 w-4" /> Nouveau département
          </Button>
        </div>
      )}

      {tree.length > 0 && (
        <div className="space-y-2">
          {tree.map((node) => (
            <DeptCard
              key={node.id} node={node} canManage={canManage}
              onAddChild={(n) => setSheet({ mode: "create", parentId: n.id, parentName: n.name })}
              onEdit={(n) => setSheet({ mode: "edit", node: n })}
              onDelete={del}
            />
          ))}
        </div>
      )}

      {canManage && unassigned.length > 0 && (
        <UnassignedPanel employees={unassigned} options={options} />
      )}

      {sheet && (
        <DeptSheet sheet={sheet} options={options} employees={employees} companies={companies} companyScope={companyScope} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/** Carte d'un département : responsable, effectifs, et ses sous-départements en cascade. */
function DeptCard({
  node, canManage, onAddChild, onEdit, onDelete,
}: {
  node: DepartmentNode;
  canManage: boolean;
  onAddChild: (n: DepartmentNode) => void;
  onEdit: (n: DepartmentNode) => void;
  onDelete: (n: DepartmentNode) => void;
}) {
  const isRoot = node.depth === 0;
  return (
    <div className={isRoot ? "surface p-4" : "rounded-lg border border-border bg-card/60 p-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {!isRoot && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className={isRoot ? "font-semibold" : "text-sm font-medium"}>{node.name}</span>
        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">{node.code}</span>
        {isRoot && node.companyName && <Badge tone="purple" dot={false} className="text-[0.625rem]">{node.companyName}</Badge>}

        {node.headName ? (
          <Badge tone="info" dot={false} className="gap-1"><ShieldCheck className="h-3 w-3" /> {node.headName}</Badge>
        ) : (
          <Badge tone="warning" dot={false}>Sans responsable</Badge>
        )}
        {node.deputyName && <span className="text-[0.6875rem] text-muted-foreground">adjoint : {node.deputyName}</span>}

        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" /> {node.members}
          {node.totalMembers !== node.members && <span className="opacity-70">({node.totalMembers} avec sous-dép.)</span>}
        </span>

        {canManage && (
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => onAddChild(node)}><Plus className="h-3.5 w-3.5" /> Sous-département</Button>
            <button title="Modifier" onClick={() => onEdit(node)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
            <button title="Supprimer" onClick={() => onDelete(node)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {node.description && <p className="mt-1 text-xs text-muted-foreground">{node.description}</p>}

      {node.children.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-border pl-4">
          {node.children.map((c) => (
            <DeptCard key={c.id} node={c} canManage={canManage} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Rattachement express des employés encore « non affectés ». */
function UnassignedPanel({ employees, options }: { employees: EmpOpt[]; options: DepartmentOption[] }) {
  const { busy, err, run } = useRun();
  return (
    <section className="surface space-y-3 p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-warning" />
        <h2 className="text-sm font-semibold">Personnes non affectées ({employees.length})</h2>
      </div>
      <p className="text-xs text-muted-foreground">Rattachez-les à un département — le responsable de ce département devient leur N+1 par défaut.</p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="divide-y divide-border">
        {employees.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <Link href={`/rh/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link>
            {e.position && <span className="text-xs text-muted-foreground">{e.position}</span>}
            <Select
              defaultValue=""
              disabled={busy}
              className="ml-auto h-8 w-64 text-xs"
              onChange={(ev) => {
                const departmentId = ev.target.value;
                if (!departmentId) return;
                const fd = new FormData();
                fd.set("employeeId", e.id); fd.set("departmentId", departmentId);
                run(() => assignEmployeeDepartment(fd));
              }}
            >
              <option value="">— Rattacher à… —</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeptSheet({
  sheet, options, employees, companies, companyScope, onClose,
}: {
  sheet: SheetState;
  options: DepartmentOption[];
  employees: EmpOpt[];
  companies: CompanyOpt[];
  companyScope: string | null;
  onClose: () => void;
}) {
  const { busy, err, run } = useRun();
  const lock = React.useRef(false);
  const editing = sheet.mode === "edit" ? sheet.node : null;
  // À l'édition, on ne propose pas le département lui-même comme parent (les cycles plus
  // profonds sont refusés côté serveur, qui connaît toute la descendance).
  const parentOptions = options.filter((o) => o.id !== editing?.id);

  return (
    <Sheet
      open onClose={onClose}
      title={editing ? `Modifier « ${editing.name} »` : sheet.mode === "create" && sheet.parentName ? `Nouveau sous-département de « ${sheet.parentName} »` : "Nouveau département"}
      description="Le responsable devient le N+1 par défaut des personnes rattachées. L'adjoint le supplée en cas d'absence."
      width="md"
    >
      <form
        action={(fd) => {
          if (lock.current) return; lock.current = true;
          const done = () => { lock.current = false; };
          if (editing) { fd.set("id", editing.id); run(() => updateDepartment(fd), onClose).finally(done); }
          else {
            if (sheet.mode === "create" && sheet.parentId) fd.set("parentId", sheet.parentId);
            run(() => createDepartment(fd), onClose).finally(done);
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="col-span-2 space-y-1.5">
          <Label>Nom <span className="text-destructive">*</span></Label>
          <Input name="name" required defaultValue={editing?.name ?? ""} placeholder="Ex. Commercial, Ventes Nord…" />
        </div>
        <div className="space-y-1.5">
          <Label>Code (généré si vide)</Label>
          <Input name="code" defaultValue={editing?.code ?? ""} placeholder="COMMERCIAL" />
        </div>
        {(sheet.mode === "edit" ? !editing?.parentId : !sheet.parentId) && companies.length > 0 && (
          <div className="col-span-2 space-y-1.5">
            <Label>Entité</Label>
            <Select name="companyId" defaultValue={editing ? editing.companyId ?? "" : companyScope ?? ""}>
              <option value="">— Transverse au groupe —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
            <p className="text-xs text-muted-foreground">Chaque société (Adventum, Pharmagène…) a ses propres départements. Un sous-département hérite automatiquement de l&apos;entité de son parent.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Rattaché à</Label>
          <Select name="parentId" defaultValue={editing ? editing.parentId ?? "" : sheet.mode === "create" ? sheet.parentId ?? "" : ""}>
            <option value="">— Département de tête —</option>
            {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Responsable (N+1)</Label>
          <Select name="headId" defaultValue={editing?.headId ?? ""}>
            <option value="">— Aucun —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Adjoint (supplée)</Label>
          <Select name="deputyId" defaultValue={editing?.deputyId ?? ""}>
            <option value="">— Aucun —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description</Label>
          <Textarea name="description" defaultValue={editing?.description ?? ""} rows={2} placeholder="Mission du département…" />
        </div>
        {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Sheet>
  );
}
