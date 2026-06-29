"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { superAdminDelete } from "@/lib/actions/admin-delete-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * Bouton « Supprimer définitivement » réservé au Super Admin (n'est rendu que si
 * `enabled`). Sert à nettoyer les enregistrements de test : ouvre une confirmation
 * claire (action irréversible), supprime, puis redirige vers la liste où l'élément
 * a disparu. Le serveur revérifie le rôle — ce bouton n'est qu'une commodité.
 */
export function SuperAdminDeleteButton({
  kind,
  id,
  name,
  enabled,
  label = "Supprimer définitivement",
}: {
  kind: string;
  id: string;
  name: string;
  enabled: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!enabled) return null;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("id", id);
    const r = await superAdminDelete(fd);
    if (r.ok) {
      setOpen(false);
      router.push(r.redirect ?? "/dashboard");
      router.refresh();
    } else {
      setBusy(false);
      setError(r.error ?? "Suppression impossible.");
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> {label}
      </Button>

      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Supprimer définitivement"
        description="Action réservée au Super Admin — irréversible."
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Cette suppression est définitive.</p>
              <p>L'élément, ses pièces jointes et ses commentaires seront retirés et n'apparaîtront plus nulle part. Cette action ne peut pas être annulée.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">Élément à supprimer</p>
            <p className="font-medium">{name}</p>
          </div>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Oui, supprimer définitivement
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
