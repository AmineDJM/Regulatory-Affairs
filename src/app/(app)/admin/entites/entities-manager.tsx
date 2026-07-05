"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil, Power, Building2 } from "lucide-react";
import { createCompany, updateCompany, toggleCompany } from "@/lib/actions/company-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label } from "@/components/ui/input";

export interface EntityRow {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  isActive: boolean;
  products: number;
  employees: number;
}

const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#475569"];

export function EntitiesManager({ rows }: { rows: EntityRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<EntityRow | "new" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [color, setColor] = React.useState<string>(PALETTE[0]);

  function openNew() {
    setErr(null);
    setColor(PALETTE[rows.length % PALETTE.length]);
    setEditing("new");
  }
  function openEdit(row: EntityRow) {
    setErr(null);
    setColor(row.color || PALETTE[0]);
    setEditing(row);
  }

  async function toggle(row: EntityRow) {
    const verb = row.isActive ? "désactiver" : "réactiver";
    if (!window.confirm(`Voulez-vous ${verb} l'entité « ${row.name} » ? (une entité inactive disparaît du sélecteur)`)) return;
    const fd = new FormData();
    fd.set("id", row.id);
    const r = await toggleCompany(fd);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    router.refresh();
  }

  const row = editing && editing !== "new" ? editing : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouvelle entité</Button>
      </div>

      <div className="surface overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left">Entité</th>
              <th className="px-3 py-2 text-left">Libellé court</th>
              <th className="px-3 py-2 text-right">Produits</th>
              <th className="px-3 py-2 text-right">Employés</th>
              <th className="px-3 py-2 text-center">Statut</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className={r.isActive ? "" : "opacity-60"}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color || "#64748b" }} />
                    {r.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.shortName || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.products}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.employees}</td>
                <td className="px-3 py-2 text-center">
                  {r.isActive ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Active</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactive</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggle(r)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title={r.isActive ? "Désactiver" : "Réactiver"}>
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Aucune entité. Créez-en une pour commencer.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => !busy && setEditing(null)}
        title={row ? `Modifier — ${row.name}` : "Nouvelle entité"}
        description="Le libellé court sert aux pastilles ; la couleur les distingue d'un coup d'œil."
        width="md"
      >
        {editing && (
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("color", color);
              if (row) fd.set("id", row.id);
              const res = row ? await updateCompany(fd) : await createCompany(undefined, fd);
              setBusy(false);
              if (res.ok) { setEditing(null); router.refresh(); } else setErr(res.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nom de l&apos;entité <span className="text-destructive">*</span></Label>
              <Input id="c-name" name="name" required defaultValue={row?.name} placeholder="Ex. Adventum Pharma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-short">Libellé court</Label>
              <Input id="c-short" name="shortName" defaultValue={row?.shortName ?? ""} placeholder="Ex. Adventum" />
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-foreground" : ""}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="ml-2 w-28" />
              </div>
            </div>
            {row && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> {row.products} produit·s · {row.employees} employé·s rattaché·s.
              </p>
            )}
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
