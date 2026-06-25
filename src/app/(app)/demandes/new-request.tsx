"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ArrowLeft } from "lucide-react";
import { createRequest } from "@/lib/actions/admin-request-actions";
import { REQUEST_TYPES, REQUEST_TYPE_FIELDS } from "@/lib/admin-requests";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { optionsFromMap } from "@/components/shared/form-fields";
import { PRIORITY } from "@/lib/labels";

type Option = { id: string; name: string };

export function NewRequestButton({ users, departments }: { users: Option[]; departments: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const typeFields = type ? REQUEST_TYPE_FIELDS[type] ?? [] : [];
  const typeLabel = REQUEST_TYPES.find((t) => t.value === type)?.label;

  return (
    <>
      <Button onClick={() => { setType(null); setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle demande</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvelle demande" description={type ? typeLabel : "Choisissez le type de demande"} width="lg">
        {!type ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REQUEST_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-secondary">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={t.icon} className="h-4 w-4" /></span>
                <span><span className="block text-sm font-medium">{t.label}</span><span className="block text-xs text-muted-foreground">{t.description}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <form
            action={async (fd) => {
              setSaving(true); setErr(null);
              const r = await createRequest(undefined, fd);
              setSaving(false);
              if (r.ok) { setOpen(false); if (r.id) router.push(`/demandes/${r.id}`); else router.refresh(); }
              else setErr(r.error ?? "Erreur.");
            }}
            className="space-y-4"
          >
            <button type="button" onClick={() => setType(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Changer de type
            </button>
            <input type="hidden" name="type" value={type} />
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap full label="Titre" required><Input name="title" required placeholder="Ex. Billet délégué Oran → Alger" /></FieldWrap>
              <FieldWrap label="Priorité"><Select name="priority" defaultValue="MEDIUM">{optionsFromMap(PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></FieldWrap>
              <FieldWrap label="Échéance"><Input name="deadline" type="date" /></FieldWrap>
              <FieldWrap label="Personne concernée"><Select name="concernedUserId" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FieldWrap>
              <FieldWrap label="Responsable"><Select name="assignedToId" defaultValue=""><option value="">— (l'assistante)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FieldWrap>
              <FieldWrap label="Département"><Select name="departmentId" defaultValue=""><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></FieldWrap>
              <FieldWrap full label="Description"><Textarea name="description" placeholder="Précisez votre besoin…" /></FieldWrap>

              {typeFields.map((f) => {
                const name = `f_${f.name}`;
                return (
                  <FieldWrap key={f.name} full={f.full || f.type === "textarea"} label={f.label}>
                    {f.type === "textarea" ? (
                      <Textarea id={name} name={name} />
                    ) : f.type === "select" ? (
                      <Select id={name} name={name} defaultValue={f.defaultValue ?? ""}>
                        {f.placeholder && <option value="">{f.placeholder}</option>}
                        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    ) : f.type === "checkbox" ? null : (
                      <Input id={name} name={name} type={f.type} defaultValue={f.defaultValue} step={f.type === "number" ? "any" : undefined} />
                    )}
                  </FieldWrap>
                );
              })}
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Créer la demande</Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

function FieldWrap({ label, full, required, children }: { label: string; full?: boolean; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}
