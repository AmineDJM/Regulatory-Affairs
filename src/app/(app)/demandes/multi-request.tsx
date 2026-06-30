"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { createRequestBatch } from "@/lib/actions/admin-request-actions";
import { REQUEST_TYPES } from "@/lib/admin-requests";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { optionsFromMap } from "@/components/shared/form-fields";
import { PRIORITY } from "@/lib/labels";

type Option = { id: string; name: string };
type Article = { id: string; name: string };

interface Cell {
  type: string;
  title: string;
  description: string;
  priority: string;
  deadline: string;
  articleId: string;
  quantity: string;
}

const emptyCell = (): Cell => ({ type: "PURCHASE", title: "", description: "", priority: "MEDIUM", deadline: "", articleId: "", quantity: "" });

export function MultiRequestButton({ users, departments, articles }: { users: Option[]; departments: Option[]; articles: Article[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [cells, setCells] = React.useState<Cell[]>([emptyCell(), emptyCell()]);
  const [shared, setShared] = React.useState({ concernedUserId: "", assignedToId: "", departmentId: "" });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const update = (i: number, patch: Partial<Cell>) => setCells((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCell = (i: number) => setCells((cs) => (cs.length > 1 ? cs.filter((_, idx) => idx !== i) : cs));

  async function submit() {
    setErr(null);
    const payload = cells
      .filter((c) => c.title.trim())
      .map((c) => ({
        type: c.type,
        title: c.title.trim(),
        description: c.description.trim() || undefined,
        priority: c.priority,
        deadline: c.deadline || undefined,
        articleId: c.type === "PURCHASE" && c.articleId ? c.articleId : undefined,
        articleName: c.type === "PURCHASE" && c.articleId ? articles.find((a) => a.id === c.articleId)?.name : undefined,
        quantity: c.type === "PURCHASE" && c.quantity ? c.quantity : undefined,
      }));
    if (payload.length === 0) { setErr("Ajoutez au moins une cellule avec un objet."); return; }

    const fd = new FormData();
    fd.set("cells", JSON.stringify(payload));
    if (shared.concernedUserId) fd.set("concernedUserId", shared.concernedUserId);
    if (shared.assignedToId) fd.set("assignedToId", shared.assignedToId);
    if (shared.departmentId) fd.set("departmentId", shared.departmentId);

    setSaving(true);
    const r = await createRequestBatch(undefined, fd);
    setSaving(false);
    if (r.ok) { setOpen(false); setCells([emptyCell(), emptyCell()]); if (r.id) router.push(`/demandes/${r.id}`); else router.refresh(); }
    else setErr(r.error ?? "Erreur.");
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Layers className="h-4 w-4" /> Demande multiple</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Plusieurs demandes en une fois" description="Chaque ligne (cellule) devient une demande indépendante, regroupées ensemble. L'assistante traite et valide chaque cellule séparément." width="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-secondary/30 p-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Personne concernée</Label>
              <Select value={shared.concernedUserId} onChange={(e) => setShared((s) => ({ ...s, concernedUserId: e.target.value }))}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Select value={shared.assignedToId} onChange={(e) => setShared((s) => ({ ...s, assignedToId: e.target.value }))}><option value="">— (l'assistante)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
            </div>
            <div className="space-y-1">
              <Label>Département</Label>
              <Select value={shared.departmentId} onChange={(e) => setShared((s) => ({ ...s, departmentId: e.target.value }))}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            </div>
          </div>

          <div className="space-y-3">
            {cells.map((c, i) => (
              <div key={i} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Cellule {i + 1}</span>
                  {cells.length > 1 && (
                    <button type="button" onClick={() => removeCell(i)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                      <Trash2 className="h-3.5 w-3.5" /> Retirer
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={c.type} onChange={(e) => update(i, { type: e.target.value })}>{REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Priorité</Label>
                    <Select value={c.priority} onChange={(e) => update(i, { priority: e.target.value })}>{optionsFromMap(PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Objet</Label>
                    <Input value={c.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Ex. Commander 5 rames de papier A4" />
                  </div>
                  {c.type === "PURCHASE" && (
                    <>
                      <div className="space-y-1">
                        <Label>Article (catalogue)</Label>
                        <Select value={c.articleId} onChange={(e) => update(i, { articleId: e.target.value, title: c.title || (articles.find((a) => a.id === e.target.value)?.name ?? "") })}>
                          <option value="">— Libre</option>
                          {articles.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Quantité</Label>
                        <Input value={c.quantity} onChange={(e) => update(i, { quantity: e.target.value })} type="number" step="any" />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <Label>Échéance</Label>
                    <Input value={c.deadline} onChange={(e) => update(i, { deadline: e.target.value })} type="date" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Détails (optionnel)</Label>
                    <Textarea value={c.description} onChange={(e) => update(i, { description: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => setCells((cs) => [...cs, emptyCell()])}>
            <Plus className="h-4 w-4" /> Ajouter une cellule
          </Button>

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Créer {cells.filter((c) => c.title.trim()).length || ""} demande(s)</Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
