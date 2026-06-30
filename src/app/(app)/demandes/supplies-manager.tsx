"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, AlertCircle, Check, Plus, Pencil, X } from "lucide-react";
import { createSupplyArticle, updateSupplyArticle, toggleSupplyArticle } from "@/lib/actions/office-supply-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { TextField, TextAreaField, SelectField, optionsFromMap } from "@/components/shared/form-fields";
import { SUPPLY_CATEGORY, SUPPLY_UNIT } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";

export interface SupplyArticleRow {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  reference: string | null;
  estimatedPrice: number | null;
  supplierHint: string | null;
  active: boolean;
  notes: string | null;
}

export function SuppliesManager({ articles }: { articles: SupplyArticleRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SupplyArticleRow | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const reset = () => { setEditing(null); setError(null); formRef.current?.reset(); };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Package className="h-4 w-4" />
        Catalogue articles
      </Button>

      <Sheet
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Catalogue d'articles de fourniture"
        description="Référentiel des articles de bureau pour passer commande plus vite. Sélectionnables dans les demandes d'achat."
        width="lg"
      >
        <div className="space-y-6">
          <form
            ref={formRef}
            key={editing?.id ?? "new"}
            action={async (fd) => {
              setSubmitting(true); setError(null); setSaved(false);
              const r = editing ? await updateSupplyArticle(fd) : await createSupplyArticle(fd);
              setSubmitting(false);
              if (r.ok) { setSaved(true); reset(); router.refresh(); setTimeout(() => setSaved(false), 2000); }
              else setError(r.error ?? "Erreur.");
            }}
            className="space-y-4 rounded-xl border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{editing ? `Modifier « ${editing.name} »` : "Nouvel article"}</p>
              {editing && (
                <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" /> Annuler
                </button>
              )}
            </div>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Nom de l'article" name="name" placeholder="Ex. Rame de papier A4 80g" defaultValue={editing?.name} className="col-span-2" />
              <SelectField label="Catégorie" name="category" options={optionsFromMap(SUPPLY_CATEGORY)} placeholder="—" defaultValue={editing?.category ?? ""} />
              <SelectField label="Unité" name="unit" options={optionsFromMap(SUPPLY_UNIT)} placeholder="—" defaultValue={editing?.unit ?? ""} />
              <TextField label="Référence / code" name="reference" placeholder="Ex. PAP-A4-80" defaultValue={editing?.reference ?? undefined} />
              <TextField label="Prix indicatif (DZD)" name="estimatedPrice" type="number" defaultValue={editing?.estimatedPrice ?? undefined} />
              <TextField label="Fournisseur habituel" name="supplierHint" placeholder="Ex. Papeterie Centrale" defaultValue={editing?.supplierHint ?? undefined} className="col-span-2" />
              <TextAreaField label="Notes" name="notes" placeholder="Précisions éventuelles…" defaultValue={editing?.notes ?? undefined} className="col-span-2" />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="h-4 w-4" /> Enregistré</span>}
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Articles <span className="text-muted-foreground">({articles.length})</span>
            </p>
            {articles.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                Aucun article. Ajoutez vos fournitures les plus courantes.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {articles.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.name}
                        {!a.active && <span className="ml-2 text-xs font-normal text-muted-foreground">(inactif)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[a.category ? SUPPLY_CATEGORY[a.category] ?? a.category : null, a.unit ? SUPPLY_UNIT[a.unit] ?? a.unit : null, a.reference, a.estimatedPrice != null ? formatCurrency(a.estimatedPrice) : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(a); setError(null); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <form action={async (fd) => { await toggleSupplyArticle(fd); router.refresh(); }}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          {a.active ? <Badge tone="success" dot={false}>Actif</Badge> : <Badge tone="neutral" dot={false}>Inactif</Badge>}
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
